import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

export interface FieldDefinition {
  tag: number;
  name: string;
  type: 'int' | 'string';
  required: boolean;
  defaultValue?: any;
}

export interface Schema {
  version: number;
  fields: FieldDefinition[];
}

export class BinarySchemaSerializer {
  // Simple binary encoder: [tag (1B)] [type (1B)] [length (2B)] [data (NB)]
  static encodeRecord(data: Record<string, any>, schema: Schema): Uint8Array {
    const buffers: Uint8Array[] = [];

    for (const field of schema.fields) {
      if (data[field.name] !== undefined) {
        const val = data[field.name];
        let typeCode = 1;
        let payload: Uint8Array;

        if (field.type === 'int') {
          typeCode = 1;
          payload = new Uint8Array(4);
          new DataView(payload.buffer).setInt32(0, val as number, true);
        } else {
          typeCode = 2;
          payload = new TextEncoder().encode(String(val));
        }

        const header = new Uint8Array(4);
        header[0] = field.tag;
        header[1] = typeCode;
        new DataView(header.buffer).setUint16(2, payload.length, true);

        buffers.push(header, payload);
      } else if (field.required && field.defaultValue === undefined) {
        throw new Error(`Serialization failed: missing required field ${field.name}`);
      }
    }

    const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of buffers) {
      result.set(b, offset);
      offset += b.length;
    }
    return result;
  }

  static decodeRecord(bytes: Uint8Array, readerSchema: Schema): Record<string, any> {
    const parsedFields = new Map<number, any>();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 0;

    // Scan binary stream and extract tagged fields
    while (offset < bytes.length) {
      const tag = view.getUint8(offset);
      const typeCode = view.getUint8(offset + 1);
      const len = view.getUint16(offset + 2, true);
      offset += 4;

      const payload = bytes.slice(offset, offset + len);
      offset += len;

      let value: any;
      if (typeCode === 1) {
        value = new DataView(payload.buffer, payload.byteOffset, payload.byteLength).getInt32(0, true);
      } else {
        value = new TextDecoder().decode(payload);
      }

      parsedFields.set(tag, value);
    }

    // Materialize into reader schema
    const result: Record<string, any> = {};
    for (const field of readerSchema.fields) {
      if (parsedFields.has(field.tag)) {
        result[field.name] = parsedFields.get(field.tag);
      } else if (field.defaultValue !== undefined) {
        result[field.name] = field.defaultValue;
      } else if (field.required) {
        throw new Error(`Deserialization failed: missing required field ${field.name} (tag ${field.tag})`);
      }
    }

    return result;
  }
}

describe('Binary Schema Evolution & Wire Compatibility', () => {
  const schemaV1: Schema = {
    version: 1,
    fields: [
      { tag: 1, name: 'userId', type: 'int', required: true },
      { tag: 2, name: 'username', type: 'string', required: true },
    ],
  };

  it('demonstrates Backward Compatibility: new reader schema reads old serialized data', () => {
    // V2 adds an optional field 'email' with default value
    const schemaV2: Schema = {
      version: 2,
      fields: [
        { tag: 1, name: 'userId', type: 'int', required: true },
        { tag: 2, name: 'username', type: 'string', required: true },
        { tag: 3, name: 'email', type: 'string', required: false, defaultValue: 'unknown@example.com' },
      ],
    };

    // Producer encodes with V1
    const v1Bytes = BinarySchemaSerializer.encodeRecord({ userId: 101, username: 'alice' }, schemaV1);

    // Consumer decodes with V2 (New code reading old data)
    const decodedV2 = BinarySchemaSerializer.decodeRecord(v1Bytes, schemaV2);

    assert.equal(decodedV2.userId, 101);
    assert.equal(decodedV2.username, 'alice');
    // Field absent in old data populated with default!
    assert.equal(decodedV2.email, 'unknown@example.com');
  });

  it('demonstrates Forward Compatibility: old reader schema reads new serialized data', () => {
    const schemaV2: Schema = {
      version: 2,
      fields: [
        { tag: 1, name: 'userId', type: 'int', required: true },
        { tag: 2, name: 'username', type: 'string', required: true },
        { tag: 3, name: 'bio', type: 'string', required: false },
      ],
    };

    // Producer encodes with V2 (including new field bio)
    const v2Bytes = BinarySchemaSerializer.encodeRecord(
      { userId: 202, username: 'bob', bio: 'Distributed systems architect' },
      schemaV2
    );

    // Consumer decodes with V1 (Old code reading new data)
    const decodedV1 = BinarySchemaSerializer.decodeRecord(v2Bytes, schemaV1);

    assert.equal(decodedV1.userId, 202);
    assert.equal(decodedV1.username, 'bob');
    // Unrecognized tag 3 safely ignored without throwing!
    assert.equal(decodedV1.bio, undefined);
  });

  it('negative test: adding a required field with no default breaks backward compatibility', () => {
    const breakingSchemaV2: Schema = {
      version: 2,
      fields: [
        { tag: 1, name: 'userId', type: 'int', required: true },
        { tag: 2, name: 'username', type: 'string', required: true },
        // REQUIRED FIELD WITHOUT DEFAULT: BREAKS OLD DATA!
        { tag: 4, name: 'securityToken', type: 'string', required: true },
      ],
    };

    const v1Bytes = BinarySchemaSerializer.encodeRecord({ userId: 303, username: 'charlie' }, schemaV1);

    assert.throws(
      () => BinarySchemaSerializer.decodeRecord(v1Bytes, breakingSchemaV2),
      /Deserialization failed: missing required field securityToken/
    );
  });
});
