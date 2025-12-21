async function initWasm(module_path, imports) {
  module_path = chrome.runtime.getURL(module_path);

  const module = fetch(module_path);

  if (typeof WebAssembly.instantiateStreaming === 'function') {
    try {
      const wasm = await WebAssembly.instantiateStreaming(module, imports);
      return wasm;
    } catch (e) {
      console.log('Error to initializa wasm via instantiateStreaming', e);
    }
  }

  const buf = await module.then((r) => r.arrayBuffer());
  const wasm = await WebAssembly.instantiate(buf, imports);

  return wasm;
}

const wasm_context = {
  free_all: null,
  alloc: null,
  points_of_interest: null,
  memory: null,

  result: null,
};

let auto_coord = null;

(async function() {
  const wasm = await initWasm('hough.wasm', {
    'env': {
      sinf: Math.sin,
      cosf: Math.cos,
      console_log,
    },
  });

  console.log(wasm);

  const { free_all, alloc, points_of_interest, memory } = wasm.instance.exports;

  memory.grow(2048);

  function console_log(ptr, len) {
    const message = new Uint8Array(memory.buffer, ptr, len);
    console.log(new TextDecoder('utf-8').decode(message));
  }

  wasm_context.free_all = free_all;
  wasm_context.alloc = alloc;
  wasm_context.points_of_interest = points_of_interest;
  wasm_context.memory = memory;
})();

const schema = [
  { name: 'pixels', type: SchemaTypes.u8_array_ptr },
  { name: 'width', type: SchemaTypes.i32 },
  { name: 'height', type: SchemaTypes.i32 },
  { name: 'offset_x', type: SchemaTypes.i32 },
  { name: 'offset_y', type: SchemaTypes.i32 },
  { name: 'points_capacity', type: SchemaTypes.i32 },
  {
    name: 'points',
    type: SchemaTypes.array_ptr,
    schema: [
      { name: 'x', type: SchemaTypes.i32 },
      { name: 'y', type: SchemaTypes.i32 },
      { name: 'tag', type: SchemaTypes.i32 },
    ],
  },
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

function process_image(message) {
  if (wasm_context.result) {
    console.log('@ returning a cached result');

    chrome.runtime.sendMessage({
      action: 'process-image-done',
      result: wasm_context.result,
    });
    return;
  }

  const image_len = message.width * message.height * 4;
  const image_ptr = wasm_context.alloc(image_len);

  const image = new Uint8Array(
    wasm_context.memory.buffer,
    image_ptr,
    image_len
  );

  image.set(message.pixels);

  const result_ptr = wasm_context.points_of_interest(
    image_ptr,
    message.width,
    message.height,
    message.is_webgl ? 1 : 0
  );

  const [result] = Schema.decode(wasm_context.memory.buffer, schema, result_ptr);

  wasm_context.free_all();

  result.pixels = Array.from(result.pixels);

  return result;
}

// Load map and process its data
function load_map() {
  const all_canvas = document.getElementsByTagName('canvas');

  const [canvas, canvas2] = all_canvas;

  if (!canvas) {
    console.log('@@ canvas not found');
    return;
  }

  let is_webgl = false;
  let pixels = null;

  if (canvas.getContext('2d')) {
    const ctx = canvas.getContext('2d');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    pixels = imageData.data;
  } else if (canvas2) {
    // Getting pixels if the browser use webgl
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvas2.width;
    offscreenCanvas.height = canvas2.height;
    ctx = offscreenCanvas.getContext('2d');
    ctx.drawImage(canvas2, 0, 0);

    imageData = ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    pixels = imageData.data;

    is_webgl = true;
  }

  const result = process_image({
    pixels,
    width: canvas.width,
    height: canvas.height,
    is_webgl,
  });

  chrome.runtime.sendMessage({ action: 'process-image-done', result });
}

// Try to read lat/lng for 2 points in the map
async function get_auto_coords() {
  const all_canvas = document.getElementsByTagName('canvas');

  const [canvas] = all_canvas;

  const box = canvas.getBoundingClientRect();

  const x1 = canvas.clientWidth - 10;
  const x2 = x1 - 10;
  const y1 = canvas.clientHeight / 2;
  const y2 = y1 - 10;

  const event_positions = [
    {
      clientX: x1,
      clientY: y1,
    },
    {
      clientX: x2,
      clientY: y2,
    },
  ];

  const coords = [];

  let max_attempts = 6;
  let count = 1;

  while (count <= 2 && max_attempts > 0) {
    auto_coord = null;

    fire_mouse_event('mousedown', canvas, event_positions[count - 1]);
    await sleep(30);

    fire_mouse_event('mouseup', canvas, event_positions[count - 1]);
    fire_mouse_event('click', canvas, event_positions[count - 1]);

    await sleep(1000);

    if (auto_coord) {
      const layerX = event_positions[count - 1].clientX - box.x;
      const layerY = event_positions[count - 1].clientY - box.y;
      const x = layerX * (canvas.width / canvas.clientWidth);
      const y = layerY * (canvas.height / canvas.clientHeight);

      coords.push({
        x,
        y,
        ...auto_coord,
      });

      count += 1;
    }

    max_attempts -= 1;
  }

  // console.log('coords', coords);

  if (coords.length > 0) {
    chrome.runtime.sendMessage({
      action: 'coords-loaded',
      coords,
    });
  } else {
    chrome.runtime.sendMessage({
      action: 'coords-not-loaded',
    });
  }
}

chrome.runtime.onMessage.addListener(async (message) => {
  // console.log('@@ content got', message);
  if (message.action === 'load-map') {
    load_map();
  } else if (message.action === 'get-auto-coords') {
    await get_auto_coords();
  }
});

window.addEventListener('message', function(event) {
  if (event.source !== window) return;

  if (event.data.type && event.data.type === 'seeker-xhr-event') {
    console.log('Received message from injected script:', event.data);
    auto_coord = {
      lat: event.data.lat,
      lng: event.data.lng,
    }
  }
}, false);

function fire_mouse_event(type, target, options) {
  const event = target.ownerDocument.createEvent('MouseEvents');

  options = {
    type,
    canBubble: true,
    cancelable: true,
    view: target.ownerDocument.defaultView,
    detail: 1,
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    metaKey: false,
    button: 0, // 0 = left, 1 = middle, 2 = right
    relatedTarget: null,
    ...(options || {}),
  };

  event.initMouseEvent(
    options.type,
    options.canBubble,
    options.cancelable,
    options.view,
    options.detail,
    options.screenX,
    options.screenY,
    options.clientX,
    options.clientY,
    options.ctrlKey,
    options.altKey,
    options.shiftKey,
    options.metaKey,
    options.button,
    options.relatedTarget
  );

  target.dispatchEvent(event);
}
