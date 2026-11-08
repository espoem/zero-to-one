# Cloudflare & Workers Runtime Cheatsheet

A rapid reference for configuring `wrangler.jsonc`, managing capability bindings, executing edge storage operations, and navigating platform resource quotas.

---

## Configuration: `wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "edge-service-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-11-01",
  "compatibility_flags": [
    "nodejs_compat"
  ],
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "kv_namespaces": [
    { "binding": "CACHE_KV", "id": "0123456789abcdef0123456789abcdef" }
  ],
  "durable_objects": {
    "bindings": [
      { "name": "CHAT_ROOM", "class_name": "ChatRoom" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["ChatRoom"] }
  ],
  "d1_databases": [
    { "binding": "DB", "database_name": "prod-db", "database_id": "xxxx-xxxx-xxxx" }
  ],
  "r2_buckets": [
    { "binding": "BUCKET", "bucket_name": "media-storage" }
  ],
  "queues": {
    "producers": [
      { "binding": "INGEST_QUEUE", "queue": "ingest-events" }
    ],
    "consumers": [
      { "queue": "ingest-events", "max_batch_size": 50, "max_batch_timeout": 5, "max_retries": 3, "dead_letter_queue": "ingest-events-dlq" }
    ]
  },
  "workflows": [
    { "name": "order-fulfillment", "binding": "FULFILLMENT_WORKFLOW", "class_name": "OrderWorkflow" }
  ],
  "services": [
    { "binding": "AUTH_SERVICE", "service": "auth-worker" }
  ],
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "yyyyyyyyyyyyyyyy" }
  ],
  "vars": {
    "ENVIRONMENT": "production"
  }
}
```

---

## Wrangler CLI Reference

| Command | Description |
| --- | --- |
| `wrangler dev` | Starts a local development server running `workerd` (port `8787` by default). |
| `wrangler dev --remote` | Runs the Worker against live remote edge bindings and state. |
| `wrangler deploy` | Builds, bundles, and deploys the Worker to the Cloudflare edge network. |
| `wrangler deploy --dry-run --outdir dist/` | Builds the bundle without deploying; useful for bundle size verification. |
| `wrangler types` | Generates TypeScript ambient types (`worker-configuration.d.ts`) from bindings. |
| `wrangler secret put <KEY>` | Securely uploads an encrypted environment variable to edge configuration. |
| `wrangler tail` | Streams real-time console and error telemetry logs from live edge invocations. |
| `wrangler kv key put --binding=<B> <k> <v>` | Sets a key-value pair in the specified KV namespace. |
| `wrangler d1 execute <DB> --file=./schema.sql` | Runs SQL DDL/DML statements against the specified D1 database. |
| `wrangler d1 migrations apply <DB> --remote` | Applies pending D1 migrations against the production remote database. |
| `wrangler r2 object put <BUCKET>/<key> --file=<f>` | Uploads a binary object directly to an R2 storage bucket. |
| `wrangler queues list` | Lists all active message queues in the configured Cloudflare account. |

---

## Runtime Handler & Context APIs

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Extend execution life beyond response return
    ctx.waitUntil(
      logAnalyticsEvent(request.headers.get("cf-ray"), Date.now())
    );

    // Failover directly to origin if uncaught runtime exception occurs
    ctx.passThroughOnException();

    return new Response("OK", { status: 200 });
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(performHourlyCleanup(env));
  },

  async queue(batch: MessageBatch<QueuePayload>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await processJob(msg.body);
        msg.ack();
      } catch (err) {
        msg.retry({ delaySeconds: 10 });
      }
    }
  }
};
```

---

## Edge Storage & Actor APIs

### Workers KV (`env.KV`)

```typescript
// Read with explicit cache TTL and response type
const data = await env.CACHE_KV.get<UserProfile>("user:42", { type: "json", cacheTtl: 300 });

// Put with TTL expiration and custom metadata
await env.CACHE_KV.put("session:abc", JSON.stringify(session), {
  expirationTtl: 86400,
  metadata: { role: "admin", createdAt: Date.now() }
});

// Paginated listing
const { keys, cursor, list_complete } = await env.CACHE_KV.list({ prefix: "session:", limit: 100 });
```

### Durable Objects (`env.DO`)

```typescript
export class ChatRoom implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(request: Request): Promise<Response> {
    // In-memory SQLite transaction with automatic rollback
    const result = this.state.storage.transactionSync(() => {
      this.state.storage.sql.exec("INSERT INTO messages (user, text) VALUES (?, ?)", "Alice", "Hello");
      return this.state.storage.sql.exec("SELECT count(*) as total FROM messages").toArray();
    });

    // Schedule an alarm
    await this.state.storage.setAlarm(Date.now() + 60_000);

    return Response.json(result);
  }

  async alarm(): Promise<void> {
    // Scheduled actor maintenance
    this.state.storage.sql.exec("DELETE FROM messages WHERE created_at < datetime('now', '-7 days')");
  }
}
```

### D1 Relational SQL (`env.DB`)

```typescript
// Parameterized query execution
const { results, success, meta } = await env.DB.prepare(
  "SELECT id, username, email FROM users WHERE org_id = ? AND status = ?"
).bind(orgId, "active").all<UserRow>();

// Batch execution in a single network round-trip
const batchResults = await env.DB.batch([
  env.DB.prepare("UPDATE accounts SET balance = balance - ? WHERE id = ?").bind(100, accountA),
  env.DB.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").bind(100, accountB),
]);

// Read-your-writes sequential consistency with Sessions API
const bookmark = session.getBookmark();
const sessionDb = env.DB.withSession(bookmark);
const freshData = await sessionDb.prepare("SELECT balance FROM accounts WHERE id = ?").bind(accountA).first();
```

### R2 Object Storage (`env.BUCKET`)

```typescript
// Put binary stream with custom metadata and Content-Type
await env.BUCKET.put("reports/monthly.pdf", pdfStream, {
  httpMetadata: { contentType: "application/pdf" },
  customMetadata: { generatedBy: "billing-cron" }
});

// Get object stream
const object = await env.BUCKET.get("reports/monthly.pdf");
if (!object) return new Response("Not Found", { status: 404 });

// Multipart Upload for large objects
const multipart = await env.BUCKET.createMultipartUpload("backups/large.tar.gz");
const part1 = await multipart.uploadPart(1, chunk1);
await multipart.complete([{ partNumber: 1, etag: part1.etag }]);
```

---

## Quotas & Resource Limits

| Resource / Quota | Free Plan | Paid Standard / Enterprise Plan |
| --- | --- | --- |
| Max Isolate Memory Heap | 128 MB | 128 MB |
| CPU-Time Quota per Request | 10 ms | 30 s default (up to 5 min for Workflows / Queues) |
| Wall-Clock Execution Time | Capped only by client timeout | Capped only by client timeout |
| Subrequests per Request | 50 concurrent | 1,000 subrequests (up to 10,000 Enterprise) |
| Max Simultaneous Outbound Conns | 6 connections | 6 connections waiting for initial response headers |
| Uncompressed Script Size | 1 MB | 64 MB (`workerd` bundled limit) |
| KV Max Value Size | 25 MiB | 25 MiB |
| KV Eventual Propagation Delay | 60 s edge TTL default | 60 s edge TTL default |
| D1 Max Database Size | 500 MB | 10 GB (standard tier) |
| R2 Egress Bandwidth Fees | \$0.00 / GB | \$0.00 / GB (zero egress fee model) |
