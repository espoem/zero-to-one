/**
 * Shared helper for integration tests: connects to ES_URL (default http://localhost:9200)
 * and reports a skip reason when no cluster is reachable, so `npm run test:integration`
 * passes cleanly (all tests skipped) on machines without Docker.
 */
import { Client } from '@elastic/elasticsearch';
import { execFileSync } from 'node:child_process';

export const ES_URL = process.env['ES_URL'] ?? 'http://localhost:9200';
export const ES_NODES = Number(process.env['ES_NODES'] ?? '1');

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function connect(): Promise<{ client: Client | null; skip: string | false }> {
  try {
    const res = await fetch(ES_URL, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { client: new Client({ node: ES_URL }), skip: false };
  } catch (e) {
    const hint = dockerAvailable()
      ? 'start it with `docker compose up -d --wait`'
      : 'Docker is not available on this machine';
    const reason = `Elasticsearch not reachable at ${ES_URL} (${(e as Error).message}); ${hint}. Skipping integration tests.`;
    console.log(reason);
    return { client: null, skip: reason };
  }
}

export async function fresh(
  client: Client,
  index: string,
  body: Record<string, unknown>,
): Promise<void> {
  await client.indices.delete({ index, ignore_unavailable: true });
  await client.indices.create({ index, ...body });
}
