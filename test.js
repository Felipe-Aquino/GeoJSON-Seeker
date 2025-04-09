const fs = require('fs');

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

      value = new Uint8Array(buffer, ptr, value);
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

async function init() {
  const wasmBuffer = fs.readFileSync('./hough-test.wasm');

  const wasm = await WebAssembly.instantiate(
    wasmBuffer,
    {
      'env': {
        sinf: Math.sin,
        cosf: Math.cos,
        console_log,
      }
    }
  );

  // console.log(wasm.instance.exports);
  const { free_all, alloc, points_of_interest, memory } = wasm.instance.exports;

  function console_log(ptr, len) {
    const message = new Uint8Array(memory.buffer, ptr, len);
    console.log(new TextDecoder('utf-8').decode(message));
  }

  const width = 12;
  const height = 12;

  const pixels_len = width * height * 4;
  const pixels_js = new Uint8Array(pixels_len);

  for (let i = 0; i < width; ++i) {
    for (let j = 0; j < height; ++j) {
      const p = 4 * (j * width + i);
      pixels_js[p + 0] = 0xff;
      pixels_js[p + 1] = 0xff;
      pixels_js[p + 2] = 0xff;
      pixels_js[p + 3] = 0xff;

      if (i > 0 && j > 0 && i < width - 1 && j < height - 1) {
        if (i == j || i == 1 || j == 1 || i == width - 2 || j == height - 2) {
          pixels_js[p + 0] = 0;
          pixels_js[p + 1] = 0;
          pixels_js[p + 2] = 0;
        }
      }
    }
  }

  const pixels_ptr = alloc(pixels_len);
  const pixels = new Uint8Array(
    memory.buffer,
    pixels_ptr,
    pixels_len 
  );

  pixels.set(pixels_js);

  const result_ptr = points_of_interest(pixels_ptr, width, height);

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

  const [result] = obj_decoder(memory.buffer, schema, result_ptr);
  console.log(result);

  // const pts_dyn_arr = new Int32Array(memory.buffer, r, 3);
  // const pts = {
  //   size: pts_dyn_arr[0],
  //   capacity: pts_dyn_arr[1],
  //   data: pts_dyn_arr[2],
  // };

  // console.log(r, pts_dyn_arr);

  // const values = new Float32Array(
  //   memory.buffer,
  //   pts.data,
  //   pts.size * 3
  // );

  // for (let i = 0; i < values.length; i += 3) {
  //   console.log(i, values[i], values[i + 1], values[i + 2]);
  // }
}

init();

function decoder_test() {
  const convert_i32a_to_u8a = (arr) => {
    const aux = new Int32Array(arr);
    return new Uint8Array(aux.buffer);
  };

  const encoder = new TextEncoder();

  const s = 'Hello, World';
  const arr1 = encoder.encode(s);

  const farr2 = new Float32Array([1, 2, 3]);
  const arr2 = new Uint8Array(farr2.buffer);

  const iarr3 = new Int32Array([4, 5, 6, 7]);
  const arr3 = new Uint8Array(iarr3.buffer);

  const farr4 = new Float32Array([42.5]);
  const arr4 = new Uint8Array(farr4.buffer);

  const iarr5 = new Int32Array([42]);
  const arr5 = new Uint8Array(iarr5.buffer);

  let result = new Uint8Array([...arr4, ...arr5, ...arr1, ...arr2]);

  const arr1_offset = 8;
  result = new Uint8Array([...result, ...convert_i32a_to_u8a([arr1.length, arr1_offset])]);

  const arr2_offset = 20;
  result = new Uint8Array([...result, ...convert_i32a_to_u8a([farr2.length, arr2_offset])]);

  result = new Uint8Array([...result, ...convert_i32a_to_u8a([iarr3.length])]);
  result = new Uint8Array([...result, ...arr3]);

  const schema1 = [
    { name: 'num1', type: SchemaTypes.f32 },
    { name: 'num2', type: SchemaTypes.i32 },
  ];

  const schema2 = [
    { name: 'msg', type: SchemaTypes.str_ptr },
    { name: 'floats', type: SchemaTypes.array_ptr, schema: [{ type: SchemaTypes.f32 }] },
    { name: 'ints', type: SchemaTypes.array, schema: [{ type: SchemaTypes.i32 }] },
  ];

  // console.log(result.slice(0, 8));
  // console.log(result.slice(8, 24));
  // const [info1, _1] = obj_decoder(result.buffer, schema1);
  const [info2, _2] = obj_decoder(result.buffer, schema2, 32);

  //console.log(info1);
  console.log(info2);
}

// decoder_test();
