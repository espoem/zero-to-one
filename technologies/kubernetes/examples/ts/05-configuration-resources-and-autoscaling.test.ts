// Module 05: Configuration, Resources, and Autoscaling
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeSecret,
  encodeSecret,
  calculateHpaDesiredReplicas,
  MissingResourceRequestError,
} from './lib/kubernetes-model.ts';

test('negative test: base64 secrets are plain unencrypted data readable by any pod mounting them', () => {
  const sensitivePassword = 'SuperSecretDbPassword123!';
  const encoded = encodeSecret({ 'db-pass': sensitivePassword });

  // Stored in Secret metadata/data
  assert.notEqual(encoded['db-pass'], sensitivePassword);

  // Anyone with read access or pod mount can trivially decode without a key
  const decoded = decodeSecret(encoded);
  assert.equal(decoded['db-pass'], sensitivePassword);
});

test('negative test: HPA targeting CPU utilization fails when CPU requests are missing', () => {
  assert.throws(
    () =>
      calculateHpaDesiredReplicas({
        currentReplicas: 3,
        currentMetricValue: 80,
        targetMetricValue: 50,
        podHasRequest: false, // Gotcha: container missing resources.requests.cpu
      }),
    (err: unknown) => {
      assert.ok(err instanceof MissingResourceRequestError);
      assert.equal(err.resourceName, 'cpu');
      assert.ok(err.message.includes('request is not configured'));
      return true;
    },
  );
});

test('HPA v2 calculates desired replicas correctly when requests are present', () => {
  // Current: 2 replicas, current CPU usage: 80%, target CPU usage: 50%
  // ceil(2 * (80 / 50)) = ceil(3.2) = 4 replicas
  const replicas = calculateHpaDesiredReplicas({
    currentReplicas: 2,
    currentMetricValue: 80,
    targetMetricValue: 50,
    podHasRequest: true,
    minReplicas: 1,
    maxReplicas: 10,
  });

  assert.equal(replicas, 4);
});

test('HPA v1.37 scale-to-zero support when metric drops to zero and minReplicas is 0', () => {
  const scaledToZero = calculateHpaDesiredReplicas({
    currentReplicas: 2,
    currentMetricValue: 0,
    targetMetricValue: 50,
    podHasRequest: true,
    minReplicas: 0, // KEP-1070 scale-to-zero
    maxReplicas: 10,
  });

  assert.equal(scaledToZero, 0);
});
