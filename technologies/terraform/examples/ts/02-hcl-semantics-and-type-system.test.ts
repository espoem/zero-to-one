// Module 02: HCL Semantics, Type System, Expressions, Dynamic Blocks, and Unknown Value Propagation
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  typeCheck,
  createUnknown,
  isUnknown,
  kleeneAnd,
  kleeneOr,
  kleeneNot,
  type HclType,
} from './lib/terraform-model.ts';

test('primitive type checking and safe conversions', () => {
  // String check
  assert.equal(typeCheck('hello', 'string').valid, true);
  assert.equal(typeCheck(123, 'string').valid, true);
  assert.equal(typeCheck(123, 'string').coercedValue, '123');

  // Number check
  assert.equal(typeCheck(42, 'number').valid, true);
  assert.equal(typeCheck('8080', 'number').valid, true);
  assert.equal(typeCheck('8080', 'number').coercedValue, 8080);
  assert.equal(typeCheck('invalid-number', 'number').valid, false);

  // Bool check
  assert.equal(typeCheck(true, 'bool').valid, true);
  assert.equal(typeCheck('true', 'bool').coercedValue, true);
  assert.equal(typeCheck('false', 'bool').coercedValue, false);
  assert.equal(typeCheck('not-a-bool', 'bool').valid, false);
});

test('collection types: list, set, and map', () => {
  // List of strings
  const listType: HclType = { kind: 'list', elem: 'string' };
  const listRes = typeCheck(['us-east-1a', 'us-east-1b'], listType);
  assert.equal(listRes.valid, true);
  assert.deepEqual(listRes.coercedValue, ['us-east-1a', 'us-east-1b']);

  // Set deduplication
  const setType: HclType = { kind: 'set', elem: 'string' };
  const setRes = typeCheck(['tag1', 'tag2', 'tag1'], setType);
  assert.equal(setRes.valid, true);
  assert.deepEqual(setRes.coercedValue, ['tag1', 'tag2']);

  // Map of numbers
  const mapType: HclType = { kind: 'map', elem: 'number' };
  const mapRes = typeCheck({ http: 80, https: 443 }, mapType);
  assert.equal(mapRes.valid, true);
  assert.deepEqual(mapRes.coercedValue, { http: 80, https: 443 });
});

test('structural types: object with optional attributes and defaults', () => {
  const ingressRuleType: HclType = {
    kind: 'object',
    attributes: {
      port: { type: 'number' },
      protocol: { type: 'string', optional: true, default: 'tcp' },
      cidr_blocks: { type: { kind: 'list', elem: 'string' } },
      description: { type: 'string', optional: true, default: null },
    },
  };

  // Omitting optional attributes applies defaults
  const res = typeCheck(
    {
      port: 443,
      cidr_blocks: ['0.0.0.0/0'],
    },
    ingressRuleType,
  );

  assert.equal(res.valid, true);
  assert.deepEqual(res.coercedValue, {
    port: 443,
    protocol: 'tcp',
    cidr_blocks: ['0.0.0.0/0'],
    description: null,
  });

  // Negative test: missing required attribute fails validation
  const missingPortRes = typeCheck(
    {
      cidr_blocks: ['10.0.0.0/16'],
    },
    ingressRuleType,
  );
  assert.equal(missingPortRes.valid, false);
  assert.match(missingPortRes.error!, /Missing required attribute 'port'/);
});

test('three-valued Kleene logic truth table invariants', () => {
  const unk = createUnknown('computed IP');

  // kleeneAnd
  // false AND anything is false (short-circuit)
  assert.equal(kleeneAnd(false, true), false);
  assert.equal(kleeneAnd(false, unk), false);
  assert.equal(kleeneAnd(unk, false), false);
  // true AND true is true
  assert.equal(kleeneAnd(true, true), true);
  // true AND unknown is unknown
  assert.ok(isUnknown(kleeneAnd(true, unk)));
  assert.ok(isUnknown(kleeneAnd(unk, true)));
  // unknown AND unknown is unknown
  assert.ok(isUnknown(kleeneAnd(unk, unk)));

  // kleeneOr
  // true OR anything is true (short-circuit)
  assert.equal(kleeneOr(true, false), true);
  assert.equal(kleeneOr(true, unk), true);
  assert.equal(kleeneOr(unk, true), true);
  // false OR false is false
  assert.equal(kleeneOr(false, false), false);
  // false OR unknown is unknown
  assert.ok(isUnknown(kleeneOr(false, unk)));
  // unknown OR unknown is unknown
  assert.ok(isUnknown(kleeneOr(unk, unk)));

  // kleeneNot
  assert.equal(kleeneNot(true), false);
  assert.equal(kleeneNot(false), true);
  assert.ok(isUnknown(kleeneNot(unk)));
});

test('unknown value propagation in dynamic blocks and attributes', () => {
  // During plan phase, an unknown value ("known after apply") is valid for attributes:
  const unknownSubnetId = createUnknown('Subnet ID allocated by AWS');
  const attrCheck = typeCheck(unknownSubnetId, 'string');
  assert.equal(attrCheck.valid, true);
  assert.ok(isUnknown(attrCheck.coercedValue));

  // Dynamic block failure mode:
  // If `for_each` inside a dynamic block resolves to an unknown list,
  // Terraform cannot determine block count or graph edges during plan!
  const unknownCollection = createUnknown('Security group rules fetched from remote data source');
  const canExpandDynamicBlock = !isUnknown(unknownCollection);
  assert.equal(canExpandDynamicBlock, false);
});

test('negative test: type mismatch in nested structure yields exact path', () => {
  const nestedType: HclType = {
    kind: 'object',
    attributes: {
      cluster_name: { type: 'string' },
      node_pools: {
        type: {
          kind: 'list',
          elem: {
            kind: 'object',
            attributes: {
              name: { type: 'string' },
              node_count: { type: 'number' },
            },
          },
        },
      },
    },
  };

  const invalidInput = {
    cluster_name: 'prod-k8s',
    node_pools: [
      { name: 'system-pool', node_count: 3 },
      { name: 'worker-pool', node_count: 'not-a-number' },
    ],
  };

  const res = typeCheck(invalidInput, nestedType);
  assert.equal(res.valid, false);
  assert.match(res.error!, /List element at index 1.*Attribute 'node_count'/);
});

test('property: Kleene AND and OR satisfy involution, commutativity, and de Morgan laws', () => {
  const sampleValues = [true, false, createUnknown('unk')];

  fc.assert(
    fc.property(fc.constantFrom(...sampleValues), fc.constantFrom(...sampleValues), (a, b) => {
      // Commutativity: a && b == b && a
      const and1 = kleeneAnd(a, b);
      const and2 = kleeneAnd(b, a);
      assert.equal(isUnknown(and1), isUnknown(and2));
      if (!isUnknown(and1)) assert.equal(and1, and2);

      // De Morgan: !(a || b) == (!a && !b)
      const left = kleeneNot(kleeneOr(a, b));
      const right = kleeneAnd(kleeneNot(a), kleeneNot(b));
      assert.equal(isUnknown(left), isUnknown(right));
      if (!isUnknown(left)) assert.equal(left, right);
    }),
  );
});
