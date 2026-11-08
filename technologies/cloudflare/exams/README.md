# Cloudflare Technical Interview & Architecture Assessment

This directory provides the preparation question bank, mock examination, and domain coverage matrix for the **Senior Edge Infrastructure & Distributed Systems Technical Interview Loop** specializing in Cloudflare Workers and edge computing architectures.

---

## Domain Coverage Matrix

| Domain & Architectural Objective | Weight | Target Modules | Runnable Proofs | Coverage Status |
| --- | --- | --- | --- | --- |
| **Domain 1: Edge Runtime, Isolate Mechanics & Request Lifecycle**<br>Anycast routing, V8 isolate memory boundaries (128 MB), CPU-time vs wall-clock quota accounting, `fetch` handlers, `ctx.waitUntil()`, and `workerd` security isolation. | 20% | Modules 01, 02, 03 | `examples/01-edge-lifecycle.test.ts` | ✅ full |
| **Domain 2: Caching Topologies & CDN Invalidation**<br>Cache API per-datacenter scope, Tiered Cache hierarchy, Cache-Control headers (`CDN-Cache-Control`), custom cache keys, stale-while-revalidate, and purge propagation. | 15% | Module 04 | `examples/02-kv-consistency.test.ts` | ✅ full |
| **Domain 3: Distributed State & Actor Models (KV & Durable Objects)**<br>Workers KV eventual consistency, edge TTL, negative lookup caching, Durable Object single-threaded actor isolation, input/output gates, SQLite persistence, and WebSocket hibernation. | 25% | Modules 05, 06 | `examples/02-kv-consistency.test.ts`, `examples/03-durable-objects.test.ts` | ✅ full |
| **Domain 4: Edge Relational Data, Object Storage & Workflows**<br>D1 serverless SQLite, read replication, Sessions API bookmarks, Hyperdrive connection pooling, R2 multipart uploads, Cloudflare Queues batching/DLQ, and Workflows durable replay. | 20% | Modules 07, 08, 09 | `examples/04-d1-hyperdrive.test.ts`, `examples/05-r2-workflows.test.ts` | ✅ full |
| **Domain 5: Service Composition & Zero Trust Security**<br>Zero-latency Service Bindings (`WorkerEntrypoint` RPC), Tail Workers, WAF rule ordering, Cloudflare Access JWT validation (`Cf-Access-Jwt-Assertion`), and `cloudflared` outbound tunnels. | 10% | Modules 10, 11 | `technologies/cloudflare/modules/10-service-bindings-and-composition.md` | ✅ full |
| **Domain 6: Observability, Resource Limits & Migration Playbooks**<br>Workers Logs, Logpush pipelines, CPU-ms pricing models, script size budgets, subrequest limits, and legacy Pages-to-Workers Static Assets migration strategies. | 10% | Module 12 | `technologies/cloudflare/modules/12-observability-limits-and-cost.md` | ✅ full |

---

## Examination Structure

- Total Questions in Question Bank: **65**
- Question Bank File: [`cloudflare-architectural-interview.md`](cloudflare-architectural-interview.md)
- Mock Examination Allocation: 30 Questions (timed 60-minute simulation with domain-weighted score rubric)
- Question Types: Single-choice (`single`), Multiple-select (`multi`), Scenario-based (`scenario`), and Chronological Ordering (`ordering`).
