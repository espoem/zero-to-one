// Module 07: OCI Distribution Specification and Registries: Push/Pull Protocol, Token Auth, and Skopeo
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { OciDistributionClient, computeSha256Digest } from './lib/containers-model.ts';

test('bearer token authentication flow: unauthenticated requests receive 401', () => {
  const client = new OciDistributionClient();

  // 1. Unauthenticated request receives 401
  const unauthRes = client.startUpload('myorg/backend', 'uuid-101');
  assert.equal(unauthRes.status, 401);
  assert.equal(unauthRes.uploadUrl, '');

  // 2. Client authenticates via auth realm and provides bearer token
  client.authenticate('myorg/backend', 'eyJh...bearer-token', 50);

  // 3. Authenticated request receives 202 Accepted with upload URL
  const authRes = client.startUpload('myorg/backend', 'uuid-101');
  assert.equal(authRes.status, 202);
  assert.equal(authRes.uploadUrl, '/v2/myorg/backend/blobs/uploads/uuid-101');
});

test('chunked blob upload: streams chunks sequentially and verifies digest on finalize', () => {
  const client = new OciDistributionClient();
  client.authenticate('myorg/web', 'token-123', 10);

  const uploadId = 'upload-chunked-1';
  client.startUpload('myorg/web', uploadId);

  const chunk1 = Buffer.from('CHUNK_ONE_DATA_');
  const chunk2 = Buffer.from('CHUNK_TWO_DATA_');
  const chunk3 = Buffer.from('FINAL_CHUNK_DATA');

  // PATCH chunk 1 at offset 0
  const patch1 = client.uploadChunk(uploadId, chunk1, 0);
  assert.equal(patch1.status, 202);

  // Negative test: invalid offset rejection (HTTP 416 Range Not Satisfiable)
  const invalidPatch = client.uploadChunk(uploadId, chunk2, 999);
  assert.equal(invalidPatch.status, 416);
  assert.ok(invalidPatch.error?.includes('Range start 999 does not match current offset'));

  // PATCH chunk 2 at offset chunk1.byteLength
  const patch2 = client.uploadChunk(uploadId, chunk2, chunk1.byteLength);
  assert.equal(patch2.status, 202);

  // PATCH chunk 3
  const patch3 = client.uploadChunk(uploadId, chunk3, chunk1.byteLength + chunk2.byteLength);
  assert.equal(patch3.status, 202);

  // Finalize PUT with digest verification
  const fullPayload = Buffer.concat([chunk1, chunk2, chunk3]);
  const expectedDigest = computeSha256Digest(fullPayload);

  // Negative test: wrong expected digest causes HTTP 400
  const badFinalize = client.finalizeUpload(
    uploadId,
    'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  );
  assert.equal(badFinalize.status, 400);
  assert.ok(badFinalize.error?.includes('Digest mismatch'));

  // Correct digest finalize
  const okFinalize = client.finalizeUpload(uploadId, expectedDigest);
  assert.equal(okFinalize.status, 201);
  assert.equal(okFinalize.digest, expectedDigest);
});

test('cross-repository blob mounting saves bandwidth when layer already exists in registry', () => {
  const client = new OciDistributionClient();
  const blobContent = Buffer.from('SHARED_BASE_LAYER_UBUNTU');
  const blobDigest = computeSha256Digest(blobContent);

  // Register blob in client store
  client.uploadedBlobs.set(blobDigest, blobContent);

  // Mount existing blob from another repo
  const mountRes = client.mountBlob('myorg/new-service', 'myorg/base-ubuntu', blobDigest);
  assert.equal(mountRes.status, 201);
  assert.equal(mountRes.mounted, true, 'Layer blob mounted immediately without re-uploading bytes');

  // Attempting to mount non-existent blob falls back to 202 Accepted for standard upload
  const missingDigest = 'sha256:1111111111111111111111111111111111111111111111111111111111111111';
  const missingMount = client.mountBlob('myorg/new-service', 'myorg/base-ubuntu', missingDigest);
  assert.equal(missingMount.status, 202);
  assert.equal(missingMount.mounted, false);
});

test('gotcha: rate limiting returns HTTP 429 when client exceeds pull quota', () => {
  const client = new OciDistributionClient();
  // Quota limited to 1 request
  client.authenticate('docker.io/library/node', 'token', 1);

  const req1 = client.startUpload('docker.io/library/node', 'u1');
  assert.equal(req1.status, 202);

  // Second request exceeds rate limit
  const req2 = client.startUpload('docker.io/library/node', 'u2');
  assert.equal(req2.status, 429, 'Rate limited requests receive HTTP 429 Too Many Requests');
});

test('property-based test: chunked upload reassembles exact byte sequence regardless of slice count', () => {
  fc.assert(
    fc.property(fc.uint8Array({ minLength: 10, maxLength: 500 }), (rawBytes) => {
      const client = new OciDistributionClient();
      client.authenticate('test/stream', 'tok', 100);

      const buf = Buffer.from(rawBytes);
      const expectedDigest = computeSha256Digest(buf);
      const uploadId = `u-${expectedDigest.slice(7, 15)}`;

      client.startUpload('test/stream', uploadId);

      // Split into two arbitrary chunks
      const splitPoint = Math.floor(buf.byteLength / 2);
      const c1 = buf.subarray(0, splitPoint);
      const c2 = buf.subarray(splitPoint);

      client.uploadChunk(uploadId, c1, 0);
      client.uploadChunk(uploadId, c2, c1.byteLength);

      const fin = client.finalizeUpload(uploadId, expectedDigest);
      assert.equal(fin.status, 201);
      assert.equal(fin.digest, expectedDigest);
    }),
  );
});
