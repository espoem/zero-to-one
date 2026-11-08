import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generatePresignedUrl, validatePresignedUrl } from './lib/aws-models.ts';

describe('S3 Presigned URL & SigV4 Simulator', () => {
  const secretKey = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
  const accessKeyId = 'AKIAIOSFODNN7EXAMPLE';
  const bucket = 'prod-data-lake';
  const region = 'eu-central-1';
  const key = 'invoices/2026/nov-statement.pdf';

  test('Generates valid SigV4 presigned URL and verifies authentic signature', () => {
    const timestamp = new Date('2026-11-08T12:00:00Z');
    const expiresInSeconds = 900; // 15 mins

    const url = generatePresignedUrl({
      bucket,
      region,
      key,
      method: 'GET',
      accessKeyId,
      secretKey,
      expiresInSeconds,
      timestamp,
    });

    assert.ok(url.startsWith(`https://${bucket}.s3.${region}.amazonaws.com/`));
    assert.ok(url.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256'));
    assert.ok(url.includes('X-Amz-Signature='));

    // Verify at 5 minutes after issuance
    const checkTime = new Date('2026-11-08T12:05:00Z');
    const validation = validatePresignedUrl(url, 'GET', secretKey, checkTime);

    assert.equal(validation.valid, true);
    assert.equal(validation.bucket, bucket);
    assert.equal(validation.key, key);
  });

  test('Rejects presigned URL after expiration window has elapsed', () => {
    const timestamp = new Date('2026-11-08T12:00:00Z');
    const expiresInSeconds = 300; // 5 mins

    const url = generatePresignedUrl({
      bucket,
      region,
      key,
      method: 'GET',
      accessKeyId,
      secretKey,
      expiresInSeconds,
      timestamp,
    });

    // Check at 6 minutes after issuance (expired)
    const checkTime = new Date('2026-11-08T12:06:00Z');
    const validation = validatePresignedUrl(url, 'GET', secretKey, checkTime);

    assert.equal(validation.valid, false);
    assert.equal(validation.expired, true);
    assert.ok(validation.error?.includes('expired'));
  });

  test('Detects signature tampering if HTTP method or parameters are altered', () => {
    const timestamp = new Date('2026-11-08T12:00:00Z');
    const expiresInSeconds = 900;

    const url = generatePresignedUrl({
      bucket,
      region,
      key,
      method: 'GET',
      accessKeyId,
      secretKey,
      expiresInSeconds,
      timestamp,
    });

    // Attacker tries to use GET presigned URL for PUT
    const checkTime = new Date('2026-11-08T12:01:00Z');
    const putValidation = validatePresignedUrl(url, 'PUT', secretKey, checkTime);

    assert.equal(putValidation.valid, false);
    assert.ok(putValidation.error?.includes('Signature mismatch'));

    // Attacker tampers with secret key
    const wrongKeyValidation = validatePresignedUrl(
      url,
      'GET',
      'WRONG_SECRET_KEY_FOR_TESTING',
      checkTime,
    );
    assert.equal(wrongKeyValidation.valid, false);
    assert.ok(wrongKeyValidation.error?.includes('Signature mismatch'));
  });
});
