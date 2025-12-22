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

function value_decoder(buffer, schema, offset0) {
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

function obj_decoder(buffer, schemas, offset0) {
  const result = {};

  let offset = offset0;

  for (const s of schemas) {
    const [value, off2] = value_decoder(buffer, s, offset);
    offset = off2;

    result[s.name] = value;
  }

  return [result, offset];
}

const Schema = {
  decode: (buffer, schemas, offset) => obj_decoder(buffer, schemas, offset),
};
