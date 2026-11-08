import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { S3BucketPartitionSimulation } from './lib/aws-models.ts';

describe('S3 Prefix Partitioning & Conditional Writes', () => {
  test('Conditional Write: If-None-Match: * succeeds on initial put and fails on overwrite', () => {
    const s3 = new S3BucketPartitionSimulation();
    const key = 'orders/2026/11/order-001.json';
    const payload = JSON.stringify({ orderId: '001', amount: 450 });

    // Initial write with If-None-Match: * must succeed
    const firstPut = s3.putObject({
      key,
      content: payload,
      ifNoneMatch: '*',
    });

    assert.equal(firstPut.statusCode, 200);
    assert.ok(firstPut.etag);
    assert.ok(firstPut.data?.versionId);

    // Second write to the exact same key with If-None-Match: * must fail with HTTP 412 Precondition Failed
    const duplicatePut = s3.putObject({
      key,
      content: JSON.stringify({ orderId: '001', amount: 999 }),
      ifNoneMatch: '*',
    });

    assert.equal(duplicatePut.statusCode, 412);
    assert.match(duplicatePut.error ?? '', /PreconditionFailed/);

    // Unconditional overwrite or matching If-Match succeeds
    const updatePut = s3.putObject({
      key,
      content: JSON.stringify({ orderId: '001', amount: 999 }),
      ifMatch: firstPut.etag,
    });
    assert.equal(updatePut.statusCode, 200);
  });

  test('Rate limit scaling: Exceeding 3,500 PUT/s triggers partition splitting', () => {
    const s3 = new S3BucketPartitionSimulation();
    const prefix = 'telemetry/v1/';

    assert.equal(s3.getSplitCount(), 0);

    // Issue 3,500 requests within the threshold
    for (let i = 0; i < 3500; i++) {
      s3.putObject({
        key: `${prefix}sensor-${i}.log`,
        content: `sample-${i}`,
      });
    }

    assert.equal(s3.getSplitCount(), 0);

    // Exceeding 3,500 requests on the same prefix triggers partition split
    s3.putObject({
      key: `${prefix}sensor-3501.log`,
      content: 'overflow',
    });

    assert.equal(s3.getSplitCount(), 1);
  });

  test('Read rate limits: Exceeding 5,500 GET/s on prefix triggers partition splitting', () => {
    const s3 = new S3BucketPartitionSimulation();
    const key = 'assets/images/logo.png';
    s3.putObject({ key, content: 'image-binary-data' });

    assert.equal(s3.getSplitCount(), 0);

    // Perform 5,500 reads
    for (let i = 0; i < 5500; i++) {
      const res = s3.getObject(key);
      assert.equal(res.statusCode, 200);
    }
    assert.equal(s3.getSplitCount(), 0);

    // 5,501st read triggers split
    const resOverflow = s3.getObject(key);
    assert.equal(resOverflow.statusCode, 200);
    assert.equal(s3.getSplitCount(), 1);
  });
});
