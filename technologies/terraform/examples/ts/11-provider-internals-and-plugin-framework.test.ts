// Module 11: Provider Internals and the Plugin Framework: gRPC Protocol, Schemas, Plan Modifiers, and CRUD
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PluginFrameworkSimulator,
  createUnknown,
  isUnknown,
  type ProviderSchema,
  type PlanModifier,
} from './lib/terraform-model.ts';

test('provider schema validation and diagnostics', () => {
  const schema: ProviderSchema = {
    providerAttributes: {
      region: 'string',
    },
    resources: {
      aws_subnet: {
        vpc_id: { type: 'string', required: true },
        cidr_block: { type: 'string', required: true },
        availability_zone: { type: 'string', required: false },
        arn: { type: 'string', computed: true },
      },
    },
  };

  const sim = new PluginFrameworkSimulator(schema);

  // Valid config
  const valid = sim.validateConfig('aws_subnet', {
    vpc_id: 'vpc-123456',
    cidr_block: '10.0.1.0/24',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.diagnostics.length, 0);

  // Negative test: Missing required attribute fails validation
  const missing = sim.validateConfig('aws_subnet', {
    cidr_block: '10.0.1.0/24',
  });
  assert.equal(missing.valid, false);
  assert.match(missing.diagnostics[0]!, /Missing required attribute 'vpc_id'/);

  // Negative test: Unknown resource type in provider
  const unknownRes = sim.validateConfig('aws_nonexistent_service', {});
  assert.equal(unknownRes.valid, false);
  assert.match(unknownRes.diagnostics[0]!, /Unknown resource type/);
});

test('plan modifiers: UseStateForUnknown retains prior state when config is unchanged', () => {
  const schema: ProviderSchema = {
    providerAttributes: {},
    resources: {
      aws_s3_bucket: {
        bucket: { type: 'string', required: true },
        arn: { type: 'string', computed: true },
      },
    },
  };

  // Plan modifier: UseStateForUnknown
  // If config value is unknown or omitted, but prior state exists, preserve prior state!
  const useStateForUnknown: PlanModifier = {
    attribute: 'arn',
    modify: (priorVal, configVal) => {
      if ((configVal === undefined || isUnknown(configVal)) && priorVal !== undefined) {
        return priorVal; // Keep existing ARN
      }
      return configVal ?? createUnknown('Computed by AWS');
    },
  };

  const sim = new PluginFrameworkSimulator(schema, [useStateForUnknown]);

  // Case 1: First creation -> prior state is null -> arn is unknown
  const planCreate = sim.planResourceChange('aws_s3_bucket', null, { bucket: 'my-bucket' });
  assert.ok(isUnknown(planCreate['arn']));

  // Case 2: Update with unchanged config -> prior state had arn 'arn:aws:s3:::my-bucket'
  // UseStateForUnknown preserves the known ARN instead of making it unknown!
  const priorState = { bucket: 'my-bucket', arn: 'arn:aws:s3:::my-bucket' };
  const planUpdate = sim.planResourceChange('aws_s3_bucket', priorState, { bucket: 'my-bucket' });
  assert.equal(planUpdate['arn'], 'arn:aws:s3:::my-bucket');
});

test('CRUD lifecycle simulation: Create, Read, Update, Delete', () => {
  interface SimulatedCloudResource {
    id: string;
    name: string;
    sizeGb: number;
    status: 'ACTIVE' | 'DELETED';
  }

  const cloudApi = new Map<string, SimulatedCloudResource>();

  // Provider CRUD implementations
  const createResource = (name: string, sizeGb: number): SimulatedCloudResource => {
    const id = `res-${Math.floor(Math.random() * 100000)}`;
    const obj: SimulatedCloudResource = { id, name, sizeGb, status: 'ACTIVE' };
    cloudApi.set(id, obj);
    return obj;
  };

  const readResource = (id: string): SimulatedCloudResource | null => {
    const res = cloudApi.get(id);
    return res && res.status === 'ACTIVE' ? res : null;
  };

  const updateResource = (id: string, newSize: number): SimulatedCloudResource => {
    const existing = readResource(id);
    if (!existing) throw new Error('Resource not found');
    existing.sizeGb = newSize;
    return existing;
  };

  const deleteResource = (id: string): void => {
    const existing = readResource(id);
    if (!existing) throw new Error('Resource not found');
    existing.status = 'DELETED';
  };

  // 1. Create
  const created = createResource('disk-01', 50);
  assert.equal(created.status, 'ACTIVE');

  // 2. Read
  const read = readResource(created.id);
  assert.deepEqual(read, created);

  // 3. Update
  const updated = updateResource(created.id, 100);
  assert.equal(updated.sizeGb, 100);

  // 4. Delete
  deleteResource(created.id);
  assert.equal(readResource(created.id), null);
});
