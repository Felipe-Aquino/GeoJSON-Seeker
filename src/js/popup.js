const total_width = 800 * 0.95;
const total_height = 560;

let app;

async function initWasm(module_path) {
  const imports = {
    'env': {
      sinf: Math.sin,
      cosf: Math.cos,
      atanf: Math.atan,
      console_log,

      // Functions for canvas 2d context
      c2d_set_fill_color,
      c2d_set_stroke_color,
      c2d_line,
      c2d_quad,
      c2d_fill_quad,
      c2d_circle,
      c2d_fill_circle,
      c2d_fill_text,
      c2d_text_width,
      c2d_image,
      c2d_image_a,
      c2d_image_s,

      // Interop functions
      load_map,
      geojson_to_clipboard,
    },
  };

  let wasm = null;

  const module = fetch(module_path);

  if (typeof WebAssembly.instantiateStreaming === 'function') {
    try {
      wasm = await WebAssembly.instantiateStreaming(module, imports);
    } catch (e) {
      console.log('Error to initializa wasm via instantiateStreaming', e);
    }
  }

  if (!wasm) {
    const buf = await module.then((r) => r.arrayBuffer());
    wasm = await WebAssembly.instantiate(buf, imports);
  }

  const instance = {
    wasm,
    memory: wasm.instance.exports.memory,

    alloc: wasm.instance.exports.alloc,

    init: wasm.instance.exports.init,
    update: wasm.instance.exports.update,
    set_process_result: wasm.instance.exports.set_process_result,
    set_is_loading: wasm.instance.exports.set_is_loading,

    ui_set_mouse_position: wasm.instance.exports.set_mouse_position,
    ui_set_mouse_pressed: wasm.instance.exports.set_mouse_pressed,
    ui_set_mouse_wheel: wasm.instance.exports.set_mouse_wheel,
  };

  instance.memory.grow(1024);

  function console_log(ptr, len) {
    const message = new Uint8Array(instance.memory.buffer, ptr, len);
    console.log(new TextDecoder('utf-8').decode(message));
  }

  return instance;
}

function create_display() {
  const canvas = document.getElementById('main');

  if (canvas === null) {
    throw new Error('Canvas not found!');
  }

  attach_canvas_events(canvas);

  canvas.width = total_width;
  canvas.height = total_height;

  const ctx = canvas.getContext('2d');

  if (ctx === null) {
    throw new Error('2D context is not supported');
  }

  ctx.imageSmoothingEnabled = false;

  // Background canvas and context
  const bg_canvas = new OffscreenCanvas(total_width, total_height);
  const bg_ctx = bg_canvas.getContext('2d');

  if (bg_ctx === null) {
    throw new Error('2D context is not supported');
  }

  bg_ctx.imageSmoothingEnabled = false;

  return { ctx, bg_ctx };
}

async function create_app() {
  const wasm = await initWasm('../../popup.wasm');
  const display = create_display();

  return { wasm, display, coords: [], geojson_clipboard_params: [] };
}

document.addEventListener('DOMContentLoaded', async function () {
  app = await create_app();
  app.wasm.init();

  let start_timestamp = 0;

  const render_frame = (timestamp) => {
    const delta_time = (timestamp - start_timestamp) / 1000;
    start_timestamp = timestamp;

    app.wasm.update(delta_time, total_width, total_height);

    window.requestAnimationFrame(render_frame);
  };

  window.requestAnimationFrame((timestamp) => {
    start_timestamp = timestamp;
    window.requestAnimationFrame(render_frame);
  });
});

// Chrome messaging
function load_map() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'load-map' });
  });
}

function get_auto_coords() {
  app.wasm.set_is_loading(true);

  // console.log('@@ auto coords');
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: 'get-auto-coords' });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'process-image-done') {
    const { result } = message;

    const result_len = 36;
    const result_ptr = app.wasm.alloc(result_len);
    const r = new Int32Array(
      app.wasm.memory.buffer,
      result_ptr,
      result_len
    );

    const image_len = result.pixels.length;
    const image_ptr = app.wasm.alloc(image_len);
    const image = new Uint8Array(
      app.wasm.memory.buffer,
      image_ptr,
      image_len
    );

    image.set(result.pixels);

    const points_count = result.points.length;
    const points_len = points_count * 3;
    const points_ptr = app.wasm.alloc(points_len * 4);
    const points = new Int32Array(
      app.wasm.memory.buffer,
      points_ptr,
      points_len
    );

    points.set(
      result.points.map(({ x, y }) => [x, y]).flat()
    );

    r.set([
      image_len,
      image_ptr,
      result.width,
      result.height,
      result.offset_x,
      result.offset_y,
      points_count,
      points_count,
      points_ptr
    ]);

    app.wasm.set_process_result(result_ptr);
  }

  if (message.action === 'coords-loaded') {
    app.wasm.set_is_loading(false);

    app.coords = message.coords;
    geojson_to_clipboard(...app.geojson_clipboard_params);
  } else if (message.action === 'coords-not-loaded') {
    // TODO: Maybe add an error treatment
  }
});

// Registering mouse events

function attach_canvas_events(canvas) {
  canvas.addEventListener('mousemove', (e) => on_mouse_move(canvas, e));
  canvas.addEventListener('mousedown', () => on_mouse_down());
  canvas.addEventListener('mouseup', () => on_mouse_up());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    const delta = e.deltaY * 0.15;

    if (e.shiftKey) {
      app.wasm.ui_set_mouse_wheel(delta, 0);
    } else {
      app.wasm.ui_set_mouse_wheel(0, delta);
    }
  });
}

function on_mouse_move(canvas, event) {
  if (event && !event.clientX) {
    // use touches if touch and not mouse
    if (event.touches) {
      event = event.touches[0];
    } else if (event.changedTouches) {
      event = event.changedTouches[0];
    }
  }

  const w = total_width;
  const h = total_height;

  const rect = canvas.getBoundingClientRect();
  const sx = canvas.scrollWidth / w || 1;
  const sy = canvas.scrollHeight / h || 1;

  const x = 
    (event.clientX - rect.left) / sx;
  const y = 
    (event.clientY - rect.top) / sy;

  app.wasm.ui_set_mouse_position(
    (event.clientX - rect.left) / sx,
    (event.clientY - rect.top) / sy
  );
}

function on_mouse_up() {
  app.wasm.ui_set_mouse_pressed(false);
}

function on_mouse_down() {
  app.wasm.ui_set_mouse_pressed(true);
}

// Functions for canvas 2d context

function c2d_set_fill_color(r, g, b, a) {
  a = a / 255.0;
  app.display.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
}

function c2d_set_stroke_color(r, g, b, a) {
  a = a / 255.0;
  app.display.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
}

function c2d_line(x1, y1, x2, y2, width) {
  const { ctx } = app.display;

  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function c2d_quad(x, y, w, h, width) {
  const { ctx } = app.display;

  ctx.lineWidth = width;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [2]);
  ctx.stroke();
}

function c2d_fill_quad(x, y, w, h) {
  const { ctx } = app.display;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [2]);
  ctx.fill();
}

function c2d_circle(x, y, r, width) {
  const { ctx } = app.display;

  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r, 0, 0, 2 * Math.PI);
  ctx.stroke();
}

function c2d_fill_circle(x, y, r) {
  const { ctx } = app.display;

  ctx.beginPath();
  ctx.ellipse(x, y, r, r, 0, 0, 2 * Math.PI);
  ctx.fill();
}

function c2d_fill_text(ptr, len, x, y, size) {
  const message = new Uint8Array(app.wasm.memory.buffer, ptr, len);
  const text = new TextDecoder('utf-8').decode(message);

  app.display.ctx.textBaseline = 'top';
  app.display.ctx.font = `${size}px arial bold`;
  app.display.ctx.fillText(text, x, y);
}

function c2d_text_width(ptr, len, size) {
  const message = new Uint8Array(app.wasm.memory.buffer, ptr, len);
  const text = new TextDecoder('utf-8').decode(message);

  app.display.ctx.font = `${size}px normal`;
  return app.display.ctx.measureText(text).width;
}

let yyy = true; 

function c2d_image(ptr, x, y, w, h) {
  const pixels = new Uint8ClampedArray(app.wasm.memory.buffer, ptr, w * h * 4);

  app.display.bg_ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  app.display.ctx.drawImage(app.display.bg_ctx.canvas, 0, 0, w, h, x, y, w, h);
}

/*
 * xs, ys - position at source
 * xd, yd - position at destination
 * */
function c2d_image_a(ptr, xs, ys, xd, yd, w, h) {
  const pixels = new Uint8ClampedArray(app.wasm.memory.buffer, ptr, w * h * 4);

  app.display.bg_ctx.putImageData(new ImageData(pixels, w, h), -xs, -ys);
  app.display.ctx.drawImage(app.display.bg_ctx.canvas, 0, 0, w, h, xd, yd, w, h);
}

function c2d_image_s(ptr, x, y, w, h, dw, dh) {
  const pixels = new Uint8ClampedArray(app.wasm.memory.buffer, ptr, w * h * 4);

  app.display.bg_ctx.putImageData(new ImageData(pixels, w, h), 0, 0);
  app.display.ctx.drawImage(app.display.bg_ctx.canvas, 0, 0, w, h, x, y, dw, dh);
}

function geojson_to_clipboard(path_ptr, path_len, offset_x, offset_y) {
  if (app.coords.length < 2) {
    get_auto_coords();
    app.geojson_clipboard_params = [path_ptr, path_len, offset_x, offset_y];
    return;
  }

  const path = new Int32Array(
    app.wasm.memory.buffer,
    path_ptr,
    path_len * 2
  );

  const [coord1, coord2] = app.coords;

  const lng_per_pixel = (coord2.lng - coord1.lng) / (coord2.x - coord1.x);
  const lat_per_pixel = (coord2.lat - coord1.lat) / (coord2.y - coord1.y);

  const lnglats = [];

  for (let i = 0; i < path.length; i += 2) {
    const pt = { x: path[i], y: path[i + 1] };

    lnglats.push([
      lng_per_pixel * (pt.x + offset_x - coord1.x) + coord1.lng,
      lat_per_pixel * (pt.y + offset_y - coord1.y) + coord1.lat - 0.000085,
    ]);

    if (i < 3) {
      console.log(lng_per_pixel, pt.x, offset_x, coord1.x, coord1.lng);
    }
  }

  console.log(lnglats[0]);

  lnglats.push(lnglats[0]);

  const geojson = JSON.stringify({ type: 'Polygon', coordinates: [lnglats] });

  navigator.clipboard.writeText(geojson);
}
