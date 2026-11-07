// Module 09: Storage, CSI Architecture, and Volume Binding Modes
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindPvc } from './lib/kubernetes-model.ts';

test('negative test: Immediate volumeBindingMode causes VolumeZoneMismatch if pod is scheduled in another zone', () => {
  const pvc = { volumeBindingMode: 'Immediate' as const, requestedStorageMb: 10000 };
  const pvInZoneA = { capacityMb: 20000, zone: 'us-east-1a' };

  // PVC is bound immediately to PV in us-east-1a
  const initialBinding = bindPvc(pvc, pvInZoneA);
  assert.equal(initialBinding.bound, true);

  // Later, scheduler places pod on a node in us-east-1b (zone mismatch!)
  const podPlacement = bindPvc(pvc, pvInZoneA, 'us-east-1b');
  assert.equal(podPlacement.bound, false);
  assert.ok(podPlacement.error?.includes('VolumeZoneMismatch'));
});

test('WaitForFirstConsumer delays PVC binding until scheduler chooses the pod node zone', () => {
  const pvc = { volumeBindingMode: 'WaitForFirstConsumer' as const, requestedStorageMb: 10000 };
  const pvInZoneB = { capacityMb: 20000, zone: 'us-east-1b' };

  // Before scheduling, binding is delayed
  const beforeSchedule = bindPvc(pvc, pvInZoneB, undefined);
  assert.equal(beforeSchedule.bound, false);
  assert.ok(beforeSchedule.error?.includes('WaitForFirstConsumer'));

  // After scheduler selects us-east-1b, PV in us-east-1b binds cleanly
  const afterSchedule = bindPvc(pvc, pvInZoneB, 'us-east-1b');
  assert.equal(afterSchedule.bound, true);
});

test('negative test: insufficient PV capacity prevents binding', () => {
  const pvc = { volumeBindingMode: 'Immediate' as const, requestedStorageMb: 50000 };
  const smallPv = { capacityMb: 10000, zone: 'us-east-1a' };

  const result = bindPvc(pvc, smallPv);
  assert.equal(result.bound, false);
  assert.ok(result.error?.includes('capacity insufficient'));
});
