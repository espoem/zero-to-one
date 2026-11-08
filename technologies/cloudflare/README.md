# Cloudflare: Edge Architecture & The Workers Runtime

A rigorous engineering curriculum covering edge compute, the `workerd` V8 isolate runtime, actor-model state with Durable Objects, distributed edge storage (KV, D1, R2), asynchronous event queues, and Zero Trust edge architecture.

Verified against `wrangler 4.158.0`, `workerd 1.20261108.1`, `@cloudflare/workers-types 5.20261108.1`, and `@cloudflare/vitest-plugin 1.6.0` on 2026-11-08.

---

## Curriculum Overview & Syllabus

1. [Module 01: Edge Model and Request Lifecycle](modules/01-edge-model-and-request-lifecycle.md) — BGP Anycast routing, PoP-to-isolate dispatch, execution pipeline (WAF, Cache, Worker), `fetch` handler semantics, and `ctx.waitUntil` lifecycle guarantees.
2. [Module 02: Runtime Internals and workerd](modules/02-runtime-internals-and-workerd.md) — V8 isolate architecture vs Linux containers/microVMs, memory overhead (128 MB limits), `workerd` capability-based nanoservices, compatibility flags, CPU-time vs wall-clock accounting, and Spectre mitigations.
3. [Module 03: Tooling, Configuration, and Deployments](modules/03-tooling-configuration-and-deployments.md) — `wrangler.jsonc` schema, typed capability bindings (`wrangler types`), Vite integration, gradual rollouts, deployment rollback mechanics, and Terraform Provider v5.
4. [Module 04: Caching and Edge Content Delivery](modules/04-caching-and-edge-content-delivery.md) — Cache API per-data-center limits, Tiered Cache hierarchy, Cache-Control headers (`CDN-Cache-Control`), cache keys, stale-while-revalidate, and purge propagation semantics.
5. [Module 05: Workers KV and Eventual Consistency](modules/05-workers-kv-and-eventual-consistency.md) — Central store vs edge cache propagation, negative-lookup caching, per-key write throughput limits, metadata storage, list pagination, and anti-patterns.
6. [Module 06: Durable Objects and Actor Model](modules/06-durable-objects-and-actor-model.md) — Globally unique single-threaded actors, SQLite storage backend, transactional guarantees, point-in-time recovery, scheduled alarms, WebSocket hibernation, and location hints.
7. [Module 07: D1 SQL and Hyperdrive](modules/07-d1-sql-and-hyperdrive.md) — D1 serverless SQLite architecture, single-writer replication, Sessions API bookmark consistency, Time Travel snapshots, and Hyperdrive connection pooling to regional relational engines.
8. [Module 08: R2 Object Storage and S3 Compatibility](modules/08-r2-object-storage-and-s3-compatibility.md) — Zero-egress object storage, S3 API compatibility, presigned uploads, multipart transfer invariants, custom domain routing, and event notifications.
9. [Module 09: Queues and Durable Workflows](modules/09-queues-and-durable-workflows.md) — At-least-once queue delivery, batch processing, dead-letter redrives, Cloudflare Workflows durable execution (`step.do`, `step.sleep`), replay idempotency, and Cron triggers.
10. [Module 10: Service Bindings and Composition](modules/10-service-bindings-and-composition.md) — Zero-latency RPC (`WorkerEntrypoint`), inter-worker capability security, Tail Workers, Workers for Platforms (dispatch namespaces), and DO-fronted containers.
11. [Module 11: Security and Zero Trust](modules/11-security-and-zero-trust.md) — WAF rule chains, IP rate limiting, Turnstile anti-bot verification, Cloudflare Tunnel (`cloudflared`), and Cloudflare Access JWT validation (`Cf-Access-Jwt-Assertion`).
12. [Module 12: Observability, Limits, and Cost](modules/12-observability-limits-and-cost.md) — Workers Logs, Logpush pipelines, distributed tracing spans, CPU-ms pricing models, script size budgets, and the Pages-to-Workers migration guide.

---

## Prerequisites

- Foundation knowledge from [`architecture/networking`](../../architecture/networking) (Anycast, TCP/UDP, TLS 1.3, HTTP/2 & HTTP/3).
- Foundation knowledge from [`architecture/distributed-systems`](../../architecture/distributed-systems) (Actor model, PACELC, linearizability, eventual consistency).
- TypeScript & Modern Web APIs (`fetch`, `Request`, `Response`, `ReadableStream`, `Crypto`).

---

## Runnable Verification Instructions

```bash
# Install toolchain and dependencies
mise install
mise exec -- npm ci

# Run deterministic simulation test suites
mise exec -- npm test

# Run static analysis and formatting checks
mise exec -- npm run typecheck
mise exec -- npm run lint
mise exec -- npm run fmt:check
```

---

## Certifications & Exams

- **Official Certification Status**: Cloudflare does not currently operate an active public vendor accreditation exam for Workers and developer platforms.
- **Recognized Assessment Standard**: This track targets the **Senior Edge Infrastructure & Distributed Systems Technical Interview Loop**, testing isolate boundaries, actor consistency models, edge caching topologies, and production failure recovery.
- **Practice Question Bank**: Located in [`exams/cloudflare-architectural-interview.md`](exams/cloudflare-architectural-interview.md), containing 65 questions mapped across all 6 core domains with distractor rationales, module citations, and a full mock examination scoring key.
