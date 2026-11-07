/**
 * Shared helpers for the exam verification tests (`exam-*.itest.ts`). Each test performs the
 * reference answer of one hands-on task of exams/elastic-certified-engineer.md as a REST
 * transcript (`rest.call('PUT', '/catalog', body)`) and asserts the task's success criteria.
 * Like every integration test they skip cleanly when no cluster is reachable.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, errors } from '@elastic/elasticsearch';
import { connect, ES_URL } from './cluster.ts';

export type J = any;

export const fixtures = join(import.meta.dirname, '..', 'fixtures');

export interface Rest {
  /** Performs the request and returns the parsed JSON body; any 4xx/5xx rejects. */
  call(
    method: string,
    path: string,
    body?: unknown,
    querystring?: Record<string, string | number | boolean>,
  ): Promise<J>;
  /** NDJSON bulk request. */
  bulk(
    path: string,
    lines: unknown[],
    querystring?: Record<string, string | number | boolean>,
  ): Promise<J>;
  /** Asserts that the request is rejected with the given HTTP status (and error type, if given). */
  fails(
    method: string,
    path: string,
    body: unknown,
    status: number | number[],
    type?: RegExp,
    querystring?: Record<string, string | number | boolean>,
  ): Promise<J>;
  /** Like call, but returns undefined on 404 (for cleanup). */
  tryCall(method: string, path: string, body?: unknown): Promise<J | undefined>;
}

export function rest(client: Client): Rest {
  const call: Rest['call'] = async (method, path, body, querystring) =>
    client.transport.request({
      method,
      path,
      ...(body !== undefined ? { body: body as Record<string, unknown> } : {}),
      ...(querystring ? { querystring } : {}),
    });
  return {
    call,
    bulk: (path, lines, querystring) =>
      client.transport.request({
        method: 'POST',
        path,
        bulkBody: lines as Record<string, unknown>[],
        ...(querystring ? { querystring } : {}),
      }),
    async fails(method, path, body, status, type, querystring) {
      try {
        await call(method, path, body, querystring);
      } catch (e) {
        assert.ok(
          e instanceof errors.ResponseError,
          `expected a ResponseError for ${method} ${path}, got ${String(e)}`,
        );
        const allowed = Array.isArray(status) ? status : [status];
        assert.ok(
          allowed.includes(e.statusCode ?? 0),
          `${method} ${path}: expected HTTP ${allowed.join('/')}, got ${e.statusCode}: ${JSON.stringify(e.body)}`,
        );
        if (type)
          assert.match(
            JSON.stringify(e.body?.error ?? e.body),
            type,
            `${method} ${path}: error type`,
          );
        return e.body;
      }
      assert.fail(
        `${method} ${path} was expected to fail with HTTP ${String(status)} but succeeded`,
      );
    },
    async tryCall(method, path, body) {
      try {
        return await call(method, path, body);
      } catch (e) {
        if (e instanceof errors.ResponseError && e.statusCode === 404) return undefined;
        throw e;
      }
    },
  };
}

/** Connects once per test file; use inside `before`. */
export async function setup(): Promise<{
  client: Client | null;
  r: Rest | null;
  skip: string | false;
}> {
  const { client, skip } = await connect();
  return { client, r: client ? rest(client) : null, skip };
}

/** Removes leftovers by name, ignoring 404s: data streams first, then indices, then templates. */
export async function wipe(
  r: Rest,
  what: {
    streams?: string[];
    indices?: string[];
    templates?: string[];
    components?: string[];
    pipelines?: string[];
    policies?: string[];
    scripts?: string[];
    synonyms?: string[];
  },
): Promise<void> {
  for (const s of what.streams ?? []) await r.tryCall('DELETE', `/_data_stream/${s}`);
  for (const i of what.indices ?? []) await r.tryCall('DELETE', `/${i}`);
  for (const t of what.templates ?? []) await r.tryCall('DELETE', `/_index_template/${t}`);
  for (const c of what.components ?? []) await r.tryCall('DELETE', `/_component_template/${c}`);
  for (const p of what.pipelines ?? []) await r.tryCall('DELETE', `/_ingest/pipeline/${p}`);
  for (const p of what.policies ?? []) await r.tryCall('DELETE', `/_ilm/policy/${p}`);
  for (const s of what.scripts ?? []) await r.tryCall('DELETE', `/_scripts/${s}`);
  for (const s of what.synonyms ?? []) await r.tryCall('DELETE', `/_synonyms/${s}`);
}

/** Polls until the check returns a truthy value (or throws nothing); fails after the timeout. */
export async function eventually<T>(
  check: () => Promise<T | false | undefined>,
  what: string,
  timeoutMs = 60_000,
  everyMs = 500,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  for (;;) {
    try {
      const v = await check();
      if (v) return v;
    } catch (e) {
      last = e;
    }
    if (Date.now() > deadline)
      assert.fail(
        `timed out after ${timeoutMs} ms waiting for: ${what}${last ? ` (last error: ${String(last)})` : ''}`,
      );
    await new Promise((res) => setTimeout(res, everyMs));
  }
}

// ---------------------------------------------------------------------------
// Datasets named by the question bank
// ---------------------------------------------------------------------------

interface ProductsFile {
  mapping: Record<string, unknown>;
  docs: Record<string, Record<string, unknown>>;
}
export const productsFile = JSON.parse(
  readFileSync(join(fixtures, 'products.json'), 'utf8'),
) as ProductsFile;

interface EsqlDataset {
  indices: Record<string, Record<string, unknown>[]>;
  lookup: Record<string, Record<string, unknown>[]>;
}
export const esqlDataset = JSON.parse(
  readFileSync(join(fixtures, 'esql', 'dataset.json'), 'utf8'),
) as EsqlDataset;

/** The *products* dataset: index with the fixture mapping and p1..p7, one shard, no replicas. */
export async function loadProducts(r: Rest, index = 'products'): Promise<void> {
  await wipe(r, { indices: [index] });
  await r.call('PUT', `/${index}`, {
    settings: { number_of_shards: 1, number_of_replicas: 0 },
    mappings: productsFile.mapping,
  });
  for (const [id, doc] of Object.entries(productsFile.docs))
    await r.call('PUT', `/${index}/_doc/${id}`, doc);
  await r.call('POST', `/${index}/_refresh`);
}

/** The *employees* dataset (index `employees`). */
export async function loadEmployees(r: Rest): Promise<void> {
  await wipe(r, { indices: ['employees'] });
  await r.call('PUT', '/employees', {
    settings: { number_of_shards: 1, number_of_replicas: 0 },
    mappings: {
      properties: {
        emp_no: { type: 'integer' },
        first_name: { type: 'keyword' },
        dept: { type: 'keyword' },
        languages: { type: 'integer' },
        salary: { type: 'integer' },
        height: { type: 'double' },
        skills: { type: 'keyword' },
      },
    },
  });
  await r.bulk(
    '/_bulk',
    esqlDataset.indices['employees']!.flatMap((d) => [{ index: { _index: 'employees' } }, d]),
    { refresh: 'true' },
  );
}

/** The *logs-web* dataset: plain indices `logs-web-2026.11.03` and `logs-web-2026.11.04`. */
export async function loadLogsWeb(r: Rest): Promise<void> {
  // a data stream template for logs-web-* (task Q-ECE-054) would refuse plain indices of this pattern.
  // Overriding template at priority 200 prevents ES's built-in logs template (priority 100, data_stream: {}) from matching.
  await wipe(r, { streams: ['logs-web-*'], templates: ['logs-web'] });
  await r.call('PUT', '/_index_template/logs-web', {
    index_patterns: ['logs-web-*'],
    priority: 200,
    template: {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
    },
  });
  const names = ['logs-web-2026.11.03', 'logs-web-2026.11.04'];
  for (const name of names) {
    await wipe(r, { indices: [name] });
    await r.call('PUT', `/${name}`, {
      settings: { number_of_shards: 1, number_of_replicas: 0 },
      mappings: {
        properties: {
          '@timestamp': { type: 'date' },
          host: { type: 'keyword' },
          status: { type: 'short' },
          bytes: { type: 'long' },
        },
      },
    });
    await r.bulk(
      '/_bulk',
      esqlDataset.indices[name]!.flatMap((d) => [{ index: { _index: name } }, d]),
      { refresh: 'true' },
    );
  }
}

export const hitIds = (res: J): string[] => (res.hits.hits as { _id: string }[]).map((h) => h._id);
export const sortedIds = (res: J): string[] => hitIds(res).sort();
export const total = (res: J): number =>
  typeof res.hits.total === 'number' ? res.hits.total : res.hits.total.value;

export { ES_URL };

// ---------------------------------------------------------------------------
// Secured lab (compose.secure.yml): role, user and API key tasks need security on
// ---------------------------------------------------------------------------

export const ES_SECURE_URL = process.env['ES_SECURE_URL'] ?? 'http://localhost:9202';

/** Admin client for the secured single node; skip reason when it is not running or ES_PASSWORD is unset. */
export async function setupSecure(): Promise<{
  admin: Client | null;
  r: Rest | null;
  skip: string | false;
}> {
  const password = process.env['ES_PASSWORD'];
  if (!password) {
    const reason =
      'Secured lab not configured: set ES_PASSWORD and start it with `ES_PASSWORD=... docker compose -f compose.secure.yml up -d --wait`. Skipping.';
    console.log(reason);
    return { admin: null, r: null, skip: reason };
  }
  try {
    const admin = new Client({ node: ES_SECURE_URL, auth: { username: 'elastic', password } });
    await admin.info();
    return { admin, r: rest(admin), skip: false };
  } catch (e) {
    const reason = `Secured Elasticsearch not reachable at ${ES_SECURE_URL} (${(e as Error).message}). Skipping.`;
    console.log(reason);
    return { admin: null, r: null, skip: reason };
  }
}

export const clientAs = (
  auth: { username: string; password: string } | { apiKey: string },
): Client => new Client({ node: ES_SECURE_URL, auth });
