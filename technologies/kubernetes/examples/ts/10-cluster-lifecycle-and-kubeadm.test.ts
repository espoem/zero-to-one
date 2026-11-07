// Module 10: Cluster Lifecycle, kubeadm, and Version Skew
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVersionSkew, verifyEtcdSnapshot } from './lib/kubernetes-model.ts';

test('version skew policy validates kubelet support range (N to N-3)', () => {
  // kube-apiserver is 1.37
  const apiserver = '1.37.2';

  // Kubelet 1.37, 1.36, 1.35, 1.34 are supported
  assert.equal(validateVersionSkew(apiserver, 'kubelet', '1.37.0').valid, true);
  assert.equal(validateVersionSkew(apiserver, 'kubelet', '1.36.2').valid, true);
  assert.equal(validateVersionSkew(apiserver, 'kubelet', '1.35.1').valid, true);
  assert.equal(validateVersionSkew(apiserver, 'kubelet', '1.34.0').valid, true);

  // Kubelet 1.33 lags by 4 minor versions -> invalid!
  const lag4 = validateVersionSkew(apiserver, 'kubelet', '1.33.0');
  assert.equal(lag4.valid, false);
  assert.ok(lag4.error?.includes('lags more than 3 minor versions'));

  // Kubelet cannot be newer than apiserver
  const newerKubelet = validateVersionSkew(apiserver, 'kubelet', '1.38.0');
  assert.equal(newerKubelet.valid, false);
  assert.ok(newerKubelet.error?.includes('cannot be newer'));
});

test('negative test: kube-controller-manager cannot lag apiserver by more than N-1', () => {
  const apiserver = '1.37.2';

  assert.equal(validateVersionSkew(apiserver, 'kube-controller-manager', '1.37.0').valid, true);
  assert.equal(validateVersionSkew(apiserver, 'kube-controller-manager', '1.36.0').valid, true);

  // Lagging by 2 versions (1.35) is forbidden for controller-manager
  const lag2 = validateVersionSkew(apiserver, 'kube-controller-manager', '1.35.0');
  assert.equal(lag2.valid, false);
  assert.ok(lag2.error?.includes('lags more than 1 minor version'));
});

test('kubectl client supports skew of +/- 1 minor version', () => {
  const apiserver = '1.37.0';

  assert.equal(validateVersionSkew(apiserver, 'kubectl', '1.36.0').valid, true);
  assert.equal(validateVersionSkew(apiserver, 'kubectl', '1.37.0').valid, true);
  assert.equal(validateVersionSkew(apiserver, 'kubectl', '1.38.0').valid, true);

  // kubectl 1.35 is too old for apiserver 1.37
  assert.equal(validateVersionSkew(apiserver, 'kubectl', '1.35.0').valid, false);
});

test('etcd snapshot backup verification detects corrupt or empty backups', () => {
  const validSnapshot = {
    sha256: 'a1b2c3d4e5f6',
    totalKeys: 15420,
    revision: 289412,
    sizeBytes: 15 * 1024 * 1024,
  };
  assert.equal(verifyEtcdSnapshot(validSnapshot).valid, true);

  const emptySnapshot = {
    sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    totalKeys: 0,
    revision: 0,
    sizeBytes: 0,
  };
  const result = verifyEtcdSnapshot(emptySnapshot);
  assert.equal(result.valid, false);
  assert.ok(result.error?.includes('empty or corrupted'));
});
