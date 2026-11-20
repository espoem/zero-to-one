import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AZURITE_ACCOUNT_KEY,
  AZURITE_ACCOUNT_NAME,
  buildAccountSasUrl,
  buildBlobServiceSasUrl,
  isTcpReachable,
} from './lib/azure-models.ts';

const BLOB_ENDPOINT = 'http://127.0.0.1:10000';
const ACCOUNT_BASE = `${BLOB_ENDPOINT}/${AZURITE_ACCOUNT_NAME}`;
const CONTAINER = 'proofs';
const BLOB = 'hello.txt';
const PAYLOAD = 'azurite-proof-payload';

function blobSas(permissions: string, startMs: number, expiryMs: number): string {
  // Blob operations address the blob path with sr=b.
  return buildBlobServiceSasUrl(ACCOUNT_BASE, {
    accountName: AZURITE_ACCOUNT_NAME,
    accountKeyBase64: AZURITE_ACCOUNT_KEY,
    container: CONTAINER,
    blob: BLOB,
    permissions,
    startMs,
    expiryMs,
    resource: 'b',
  }).url;
}

/** Create/delete container requires the account-SAS scope (a service SAS gets 403). */
function containerSasQuery(startMs: number, expiryMs: number): string {
  const { url } = buildAccountSasUrl(ACCOUNT_BASE, {
    accountName: AZURITE_ACCOUNT_NAME,
    accountKeyBase64: AZURITE_ACCOUNT_KEY,
    services: 'b',
    resourceTypes: 'sco',
    permissions: 'rwdlacup',
    startMs,
    expiryMs,
  });
  const query = url.split('?')[1] ?? '';
  return query;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(5_000) });
}

describe('Azurite integration (Blob REST via Service SAS)', () => {
  test('container + blob round-trip, conditional ETag 412, expired SAS 403', async (t) => {
    const reachable = await isTcpReachable('127.0.0.1', 10_000, 1_000);
    if (!reachable) {
      t.skip(
        'Azurite not running on 127.0.0.1:10000 — start with npx azurite or Docker mcr.microsoft.com/azure-storage/azurite',
      );
      return;
    }

    const nowMs = Date.now();
    const startMs = nowMs - 5 * 60_000;
    const expiryMs = nowMs + 60 * 60_000;

    // 1. Create the container with an account SAS (201 on fresh create).
    const containerQuery = containerSasQuery(startMs, expiryMs);
    const createUrl = `${ACCOUNT_BASE}/${CONTAINER}?${containerQuery}&restype=container`;
    const createRes = await fetchWithTimeout(createUrl, { method: 'PUT' });
    assert.ok(
      createRes.status === 201 || createRes.status === 409,
      `container create: expected 201/409, got ${createRes.status}`,
    );
    await createRes.arrayBuffer().catch(() => undefined);

    // 2. Upload a block blob with a service SAS.
    const putRes = await fetchWithTimeout(blobSas('rwc', startMs, expiryMs), {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-version': '2021-12-02',
        'Content-Type': 'text/plain',
      },
      body: PAYLOAD,
    });
    assert.equal(putRes.status, 201);
    await putRes.arrayBuffer().catch(() => undefined);

    // 3. Download it back with a read SAS.
    const getUrl = blobSas('r', startMs, expiryMs);
    const getRes = await fetchWithTimeout(getUrl, { method: 'GET' });
    assert.equal(getRes.status, 200);
    const downloaded = await getRes.text();
    assert.equal(downloaded, PAYLOAD);
    const etag = getRes.headers.get('etag');
    assert.ok(etag, 'Azurite must return an ETag header');

    // 4. Conditional read with a stale If-Match ETag must return 412.
    const staleRes = await fetchWithTimeout(getUrl, {
      method: 'GET',
      headers: { 'If-Match': '"stale-etag-does-not-match"' },
    });
    assert.equal(staleRes.status, 412);
    await staleRes.arrayBuffer().catch(() => undefined);

    // 5. A SAS whose validity window already ended must return 403.
    const expiredUrl = blobSas('r', nowMs - 3_600_000, nowMs - 1_000);
    const expiredRes = await fetchWithTimeout(expiredUrl, { method: 'GET' });
    assert.equal(expiredRes.status, 403);
    await expiredRes.arrayBuffer().catch(() => undefined);

    // 6. A tampered signature must return 403.
    const goodUrl = blobSas('r', startMs, expiryMs);
    const tamperedUrl = goodUrl.slice(0, -1) + (goodUrl.endsWith('A') ? 'B' : 'A');
    const tamperedRes = await fetchWithTimeout(tamperedUrl, { method: 'GET' });
    assert.equal(tamperedRes.status, 403);
    await tamperedRes.arrayBuffer().catch(() => undefined);

    // 7. Best-effort cleanup so re-runs stay deterministic.
    const deleteUrl = `${ACCOUNT_BASE}/${CONTAINER}?${containerQuery}&restype=container`;
    await fetchWithTimeout(deleteUrl, { method: 'DELETE' }).catch(() => undefined);
  });
});
