// oxlint-disable-next-line typescript/triple-slash-reference -- required for vitest cloudflare-test types
/// <reference path="../node_modules/@cloudflare/vitest-plugin/types/cloudflare-test.d.ts" />
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from './lib/worker-entrypoint.ts';

declare global {
  namespace Cloudflare {
    interface Env {
      TEST_KV: KVNamespace;
    }
  }
}

describe('workerd Native Binding Proofs', () => {
  it('reads and writes to TEST_KV inside native workerd runtime', async () => {
    await env.TEST_KV.put('live-key', 'workerd-value');
    const val = await env.TEST_KV.get('live-key');
    expect(val).toBe('workerd-value');
  });

  it('dispatches HTTP requests through fetch entrypoint inside workerd', async () => {
    const req = new Request('http://example.com/kv?key=ping', { method: 'POST', body: 'pong' });
    const ctx = createExecutionContext();
    const res = await worker.fetch(req, env, ctx);
    await waitOnExecutionContext(ctx);
    expect(res.status).toBe(201);

    const getReq = new Request('http://example.com/kv?key=ping');
    const getRes = await worker.fetch(getReq, env, ctx);
    expect(await getRes.text()).toBe('pong');
  });
});
