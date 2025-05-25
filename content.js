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

const SchemaTypes = {
  i32: 1,
  u32: 2,
  f32: 3,
  str: 4,
  str_ptr: 5,
  array: 6,
  array_ptr: 7,
  u8_array_ptr: 8,
};

function value_decoder(buffer, schema, offset0 = 0) {
  let result;

  const view = new DataView(buffer);
  let offset = offset0;

  let value;

  switch (schema.type) {
    case SchemaTypes.i32:
      value = view.getInt32(offset, true);
      offset += 4;
      break;
    case SchemaTypes.u32:
      value = view.getUint32(offset, true);
      offset += 4;
      break;
    case SchemaTypes.f32:
      value = view.getFloat32(offset, true);
      offset += 4;
      break;
    case SchemaTypes.str: {
      const len = view.getInt32(offset, true);
      offset += 4;
      value = new Uint8Array(buffer, offset, len);
      offset += len;
      value = new TextDecoder('utf-8').decode(value);
      break;
    }
    case SchemaTypes.str_ptr: {
      value = view.getInt32(offset, true);
      offset += 4;
      const ptr = view.getInt32(offset, true);
      offset += 4;

      value = new Uint8Array(buffer, ptr, value);
      value = new TextDecoder('utf-8').decode(value);
      break;
    }
    case SchemaTypes.array: {
      const items = [];

      const len = view.getInt32(offset, true); // array length
      offset += 4;

      for (let i = 0; i < len; i += 1) { 
        const [r2, off2] = schema.schema.length === 1 && !schema.schema[0].name
          ? value_decoder(buffer, schema.schema[0], offset)
          : obj_decoder(buffer, schema.schema, offset);

        items.push(r2);
        offset = off2;
      }

      value = items;
      break;
    }
    case SchemaTypes.array_ptr: {
      const items = [];

      const len = view.getInt32(offset, true); // array length
      offset += 4;

      let ptr = view.getInt32(offset, true);
      offset += 4;

      for (let i = 0; i < len; i += 1) { 
        const [r2, off2] = schema.schema.length === 1 && !schema.schema[0].name
          ? value_decoder(buffer, schema.schema[0], ptr)
          : obj_decoder(buffer, schema.schema, ptr);

        items.push(r2);
        ptr = off2;
      }

      value = items;
      break;
    }
    case SchemaTypes.u8_array_ptr: {
      value = view.getInt32(offset, true);
      offset += 4;
      const ptr = view.getInt32(offset, true);
      offset += 4;

      const arr = new Uint8Array(buffer, ptr, value);

      value = new Uint8Array(arr.length);
      value.set(arr);
      break;
    }
    default:
      console.log(schema);
      throw new Error('Invalid schema type');
  }

  result = value;

  return [result, offset];
}

function obj_decoder(buffer, schemas, offset0 = 0) {
  const result = {};

  let offset = offset0;

  for (const s of schemas) {
    const [value, off2] = value_decoder(buffer, s, offset);
    offset = off2;

    result[s.name] = value;
  }

  return [result, offset];
}

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

let tick_time = Date.now();
let total_tick_time = 0;
function tick(msg) {
  if (msg) {
    total_tick_time += (Date.now() - tick_time);

    console.log(
      'bg: %s: %f s, total: %f s',
      msg,
      (Date.now() - tick_time) / 1000,
      total_tick_time / 1000
    );
  } else {
    total_tick_time = 0;
  }

  tick_time = Date.now();
}

function process_image(message) {
  console.log('@ bg got msg');

    if (wasm_context.result) {
      console.log('@ returning a cached result');

      chrome.runtime.sendMessage({
        action: 'process-image-done',
        result: wasm_context.result,
      });
      return;
    }

    console.log('@ processing image', message);

    tick();
    const image_len = message.width * message.height * 4;
    const image_ptr = wasm_context.alloc(image_len);

    const image = new Uint8Array(
      wasm_context.memory.buffer,
      image_ptr,
      image_len
    );

    image.set(message.pixels);
    tick('copying');

    const result_ptr = wasm_context.points_of_interest(
      image_ptr,
      message.width,
      message.height
    );
    tick('processing');

    const [result] = obj_decoder(wasm_context.memory.buffer, schema, result_ptr);
    console.log('result_ptr', result_ptr);
    tick('decoding');

    console.log(result);

    wasm_context.free_all();

    chrome.runtime.sendMessage({ action: 'process-image-done', result });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('slept for', ms);
      resolve();
    }, ms);
  });
}

let auto_coord = null;

chrome.runtime.onMessage.addListener(async (message) => {
  console.log('@@ content got', message);
  if (message.action === 'load-map') {
    const all_canvas = document.getElementsByTagName('canvas');

    const canvas = all_canvas[0];

    if (!canvas) {
      console.log('@@ canvas not found');
      return;
    }

    let pixels = null;

    if (canvas.getContext('2d')) {
      const ctx = canvas.getContext('2d');

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      pixels = imageData.data;
    } else if (canvas.getContext('webgl')) {
      const ctx = canvas.getContext('webgl');

      pixels = new Uint8Array(canvas.width * canvas.height * 4);

      ctx.readPixels(0, 0, canvas.width, canvas.height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels);
    }

    process_image({
      pixels,
      width: canvas.width,
      height: canvas.height,
    });
  }

  if (message.action === 'get-auto-coords') {
    const all_canvas = document.getElementsByTagName('canvas');

    const canvas = all_canvas[0];

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

    console.log('coords', coords);

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
});

// content.js
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
