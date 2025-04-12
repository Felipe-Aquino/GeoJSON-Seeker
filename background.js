async function initWasm(module_path, imports) {
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
};

(async function() {
  const wasm = await initWasm('./hough.wasm', {
    'env': {
      sinf: Math.sin,
      cosf: Math.cos,
      console_log,
    },
  });

  const { free_all, alloc, points_of_interest, memory } = wasm.instance.exports;

  // memory.grow(1440);
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
  { name: '_', type: SchemaTypes.i32 },
  {
    name: 'points',
    type: SchemaTypes.array_ptr,
    schema: [
      { name: 'x', type: SchemaTypes.f32 },
      { name: 'y', type: SchemaTypes.f32 },
      { name: 'tag', type: SchemaTypes.f32 },
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('@ bg got msg');

  if (message.action === 'process-image') {
    console.log('@ processing image', message);
    // sendResponse({ magic: true });

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

    console.log('result_ptr', result_ptr);
    const [result] = obj_decoder(wasm_context.memory.buffer, schema, result_ptr);
    tick('decoding');

    console.log(result);
    wasm_context.free_all();

    chrome.runtime.sendMessage({ action: 'process-image-done', result });
  }
});
