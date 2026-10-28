# Brief: Cloudflare (`technologies/cloudflare`)

| | |
|---|---|
| Phase | 4 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/cloudflare` · `../zto-cloudflare` |
| Depends on | phase 3 foundations |
| Research dossier | `.agents/research/F-cloud.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Tests use `@cloudflare/vitest-plugin` (it replaces `vitest-pool-workers`). Pin wrangler/workerd via npm and node via mise.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Edge isolates, Workers runtime, Durable Objects, KV/R2/D1/Queues, Zero Trust

**Cross-link only (do not re-explain):**
- libuv phases, `process.nextTick`, threadpool, streams & backpressure, CJS loader, `require(esm)`, GC tuning flags → owned by `technologies/nodejs`
- Caching theory (consistency, dual writes, invalidation, stampede) → owned by `architecture/data-systems`
- Libsql/Turso → owned by `technologies/sqlite` (M12)
- Clocks (Lamport, vector, HLC, TrueTime), consistency hierarchy, linearizability checking → owned by `architecture/distributed-systems`
- TLS on the wire (handshake, RTTs, SNI/ALPN/ECH, PQ size impact), QUIC → owned by `architecture/networking`
- HTTP/1.1, HTTP/2, HTTP/3, WebSockets, gRPC, HTTP caching (RFC 9111), CDNs, L4/L7 load balancing → owned by `architecture/networking`
- PKI/X.509 validation, mTLS identity, cert lifecycle → owned by `architecture/security-identity`
- OAuth 2.1, OIDC, PKCE, DPoP, JWT pitfalls, sessions/cookies, WebAuthn/passkeys → owned by `architecture/security-identity`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Cloudflare — `technologies/cloudflare`

- **Current stable version(s) (npm registry, 2026-10-28):**
  - **wrangler 4.154.0** (2026-10-27; engines `node >=22`)
  - **workerd 1.20261028.1**
  - **miniflare 4.20260730.0**
  - **@cloudflare/workers-types 5.20261028.1**
  - **@cloudflare/vite-plugin 1.65.0**
  - **Testing package changed: `@cloudflare/vitest-plugin` 1.4.9** (first published 2026-08-20; peer `vitest ^4.1.0 || ^5.0.0`) **replaces `@cloudflare/vitest-pool-workers`**. The latter is at 0.23.0 with peer `vitest ^4.1.0` only, so it is **incompatible with current vitest 5.0.5**. A codemod exists: `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin`. Source: https://developers.cloudflare.com/workers/testing/vitest-integration/migration-guides/migrate-to-vitest-plugin/
  - Terraform `cloudflare/cloudflare` **5.28.1** (2026-10-20). v5 is the Stainless-generated rewrite with breaking schema changes vs v4 (unverified detail).
  - **Platform status:**
    - **Workflows GA 2025-04-07** (https://developers.cloudflare.com/changelog/post/2025-04-07-workflows-ga/); jurisdiction-restricted Workflows (`eu`/`us`/`fedramp`) 2026-10-27, needs wrangler ≥4.152.0
    - **Containers and Sandboxes GA 2026-04-13** (https://developers.cloudflare.com/changelog/post/2026-04-13-containers-sandbox-ga/)
    - D1 undelete limited to 7 days (2026-10-23)
    - `workers-ai-provider` deprecated in favour of `createAI` (2026-10-21)
    - Source for the last three: https://developers.cloudflare.com/changelog/
  - **Pages → Workers:**
    - Pages is not formally deprecated, but Workers with Static Assets is the recommended target. Workers-only features: Vite plugin, gradual deployments, Workers Logs, Tail Workers, Cron, Queue consumers and more.
    - Migration: `pages_build_output_dir` → `assets.directory`, `not_found_handling`, `run_worker_first`, explicit `ASSETS` binding, `.assetsignore`, port 8788 → 8787.
    - Source: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- **Authoritative syllabi used:**
  - No Cloudflare certification is anchored here (none verified as current).
  - Official docs ToC:
    - Workers: https://developers.cloudflare.com/workers/
    - Durable Objects: https://developers.cloudflare.com/durable-objects/
    - KV: https://developers.cloudflare.com/kv/
    - R2, D1, Queues, Hyperdrive, Workflows
    - Cache: https://developers.cloudflare.com/cache/
    - Zero Trust: https://developers.cloudflare.com/cloudflare-one/
  - Limits page: https://developers.cloudflare.com/workers/platform/limits/
  - workerd design docs (GitHub `cloudflare/workerd`)
  - Cloudflare blog posts on isolates ("Cloud Computing without Containers") and on Durable Objects / SQLite-in-DO (unverified URLs; cite at authoring)
  - Hono docs (common framework)
- **Proposed modules:**
  1. **Edge model and request lifecycle**
     - Anycast; PoP → Worker routing (routes vs custom domains vs `workers.dev`)
     - Order of products (WAF → cache → Worker, configurable)
     - `fetch` handler, `ctx.waitUntil`, `passThroughOnException`
     - Smart Placement
  2. **Runtime internals**
     - V8 isolates vs containers/microVMs (no cold-start VM boot, shared process, memory 128 MB per isolate)
     - workerd architecture (nanoservices, capability-based bindings)
     - Compatibility dates and flags; `nodejs_compat`
     - CPU-time vs wall-time accounting
     - Spectre mitigations (timer coarsening, no multithreading)
  3. **Tooling and configuration**
     - `wrangler.jsonc`; environments; secrets (`.dev.vars`)
     - Bindings as capabilities; type generation (`wrangler types`)
     - Vite plugin; local vs remote bindings in dev
     - Gradual deployments/versions; Workers Builds; Terraform provider v5
  4. **Caching and CDN**
     - Cache keys, Cache Rules, Tiered Cache, `cache-control`/`CDN-Cache-Control`
     - Cache API (per-colo, not global); purge semantics
     - `cf` fetch options; stale-while-revalidate; Early Hints
  5. **Workers KV**
     - Eventually consistent global store; central stores plus edge caching
     - `cacheTtl` (default 60 s), up to 60 s+ propagation, negative-lookup caching
     - Per-key write-rate guidance; list pagination; metadata; use cases vs anti-patterns
  6. **Durable Objects**
     - Single-threaded actor per ID; global uniqueness; input/output gates
     - SQLite storage backend vs KV backend; transactional storage; Point-in-Time Recovery
     - Alarms; WebSocket Hibernation API
     - Location hints and jurisdictions; RPC; sharding patterns; eviction behaviour
  7. **D1 and Hyperdrive**
     - D1 = SQLite per database (size limits, single-writer primary, read replication / Sessions API for sequential consistency), migrations, Time Travel
     - Hyperdrive = connection pooling plus query caching to external Postgres/MySQL; `pg`/`postgres.js` in Workers
  8. **R2 and object workflows**
     - S3-compatible API subset; no egress fees
     - Presigned URLs; multipart; event notifications → Queues
     - Lifecycle rules, Infrequent Access class
     - Public buckets vs custom domains; data catalog (unverified)
  9. **Queues and Workflows**
     - Queues at-least-once delivery, batching, retries/DLQ, consumer concurrency, pull consumers
     - Workflows: durable steps (`step.do`, `step.sleep`, `step.waitForEvent`), retry config, idempotency inside steps, built on Durable Objects
     - Cron Triggers
  10. **Service composition**
      - Service bindings and RPC (`WorkerEntrypoint`); Tail Workers
      - Workers for Platforms (dispatch namespaces)
      - Containers (Durable Object–fronted containers, GA); Workers AI / AI Gateway / Agents SDK (brief)
  11. **Security and Zero Trust**
      - WAF, rate limiting, Turnstile, mTLS, API Shield
      - Cloudflare One: Access (identity-aware proxy, service tokens, JWT validation `Cf-Access-Jwt-Assertion`), Tunnel (`cloudflared`), Gateway, WARP
      - Secrets handling
  12. **Observability, limits and cost**
      - Workers Logs, Logpush, tail, source maps, OTel spans
      - Limits (Free 10 ms CPU, Paid up to 5 min CPU (default 30 s), 128 MB, subrequests 50 vs 10k, 64 MiB script, 1 s startup)
      - Pricing model (requests + CPU ms, DO duration/requests/storage)
      - Pages → Workers migration playbook
- **Gotchas & production failure modes:**
  1. KV is eventually consistent, so read-after-write from another PoP can be stale for ≥60 s. Missing keys are negatively cached too, so "create then read elsewhere" fails. Never use KV for counters, locks or sessions that need consistency. Use DOs.
  2. KV per-key write rate: hot-key writes (tens to hundreds per second) get rate-limited (https://developers.cloudflare.com/kv/concepts/how-kv-works/).
  3. Global mutable state in module scope leaks across requests in the same isolate (cross-tenant data bleed). Isolates are reused, but you can't rely on reuse for caching.
  4. Unawaited promises: work not `await`ed or passed to `ctx.waitUntil()` is cancelled when the response returns. `waitUntil` is capped at 30 s after the response.
  5. A CPU-time limit exceeded (Free 10 ms) gives Error 1102. Memory >128 MB per isolate, also 1102. Large JSON parsing / Zod <4.5 schemas inflate memory (the limits page explicitly recommends Zod ≥4.5.0).
  6. A Durable Object is single-threaded per ID. Funnelling all traffic through one global DO (e.g. "rate limiter" ID) creates a global bottleneck (~1k req/s per DO order of magnitude, unverified). Shard by key.
  7. DO input gates are released while awaiting `fetch()` to external services, so interleaving can occur. Read-modify-write across an external `await` is not atomic.
  8. Durable Object migrations (`new_sqlite_classes`, renames, deletes) are declarative in wrangler config. Deleting a class migration destroys data. KV-backed DOs can't be converted to SQLite in place (unverified current status).
  9. The Cache API is per data center and not purged globally by `cache.delete`. `fetch` with `cf.cacheTtl` behaves differently from Cache Rules. Workers on `workers.dev` don't use the zone cache.
  10. The `compatibility_date` freezes runtime behaviour. Bumping it can change semantics (e.g. `nodejs_compat` polyfills, formData parsing). Treat it as a migration.
  11. Six simultaneous outbound connections waiting for headers per invocation. Fan-out beyond this queues silently and adds latency.
  12. Queues are at-least-once, so consumers must be idempotent. Unacked messages in a batch retry the whole batch unless you use per-message `ack()`/`retry()`.
  13. Workflows replay: code outside `step.do` re-executes on every resume. Non-deterministic values must be produced inside steps. Step return values must be serialisable and are size-limited.
  14. D1 is single-primary. Without the Sessions API/bookmarks, read replicas may serve stale reads after writes. Large migrations can time out.
  15. Local vs prod drift: miniflare simulates KV/DO/D1 locally with **strong** consistency and no PoP distribution. Tests passing locally do not prove KV staleness handling.
  16. `vitest-pool-workers` (0.x) vs the new `@cloudflare/vitest-plugin` (1.x): mixing them, or upgrading vitest to 5 with pool-workers, breaks the suite.
  17. Workers custom domains require the zone on Cloudflare nameservers. Pages allowed external-DNS custom domains, which blocks some Pages → Workers migrations.
- **Interview hot topics:**
  - Isolates vs containers vs microVMs (cold start, multi-tenancy, security)
  - KV vs DO vs D1 vs R2 selection by consistency/latency
  - Designing a rate limiter / collaborative doc with Durable Objects (sharding, hibernating WebSockets)
  - Edge caching strategy and cache-key design
  - `waitUntil` and the request lifecycle
  - Durable execution (Workflows) vs Queues
  - Connecting to a regional Postgres from the edge (Hyperdrive, Smart Placement)
  - Zero Trust access in front of internal apps (Access + Tunnel)
  - Cost/limits reasoning (CPU-ms billing)
  - Pages → Workers migration
- **Executable-proof strategy (Cloudflare is the most locally provable of the four):**
  - **Primary harness:** `@cloudflare/vitest-plugin` 1.4.9 + `vitest` (4.1.x or 5.x) runs tests **inside workerd** via miniflare, with per-test-file isolated storage. Deterministic suites:
    - KV CRUD + `list` pagination
    - DO counter with concurrent requests proving serialisation; DO alarm firing via `runDurableObjectAlarm` (unverified helper name in the plugin API)
    - DO SQLite transactions and rollback (negative test)
    - D1 migrations + constraint-violation negative test
    - R2 multipart + presigned flow
    - Queues consumer with `retry()` → DLQ
    - Workflows step retries (local Workflows support in miniflare: unverified depth)
    - Outbound `fetch` mocking via `@msw/cloudflare` (per the migration guide)
  - **Integration:** `wrangler dev` (local mode, port 8787) + Playwright/`fetch` smoke tests; `unstable_startWorker`/`getPlatformProxy` from wrangler for Node-side tests (unverified current API names).
  - **Static checks:** `wrangler types` diff test (generated `worker-configuration.d.ts` committed, CI fails on drift); `wrangler deploy --dry-run --outdir` bundle-size budget test (assert < limit); `tsc --noEmit` against `@cloudflare/workers-types`.
  - **Cannot prove locally:**
    - Global KV propagation delay: simulate with a fake KV wrapper that injects staleness, and label it a model, not proof.
    - Anycast/PoP behaviour, Cache Rules/Tiered Cache, WAF/Zero Trust Access policies, DO placement/latency, real CPU-limit enforcement (local workerd does not enforce production CPU limits (unverified)).
    - Fallback: a free-tier account "lab" with `wrangler deploy` to `workers.dev` and scripted `curl` assertions, kept out of CI.
  - **Mise:** `node = "22"` (wrangler ≥22), npm deps pinned exactly (`wrangler@4.154.0`, `@cloudflare/vitest-plugin@1.4.9`, `vitest@5.0.5` or `4.1.x`), `terraform 1.17.0` for the provider examples, `cloudflared` (pin, unverified version).
- **Overlaps / dedupe:**
  - CDN/HTTP caching semantics (RFC 9111) → web/HTTP track.
  - Actor model and consistency theory → distributed-systems track.
  - SQLite internals → databases track.
  - S3 API semantics → Cloud Foundations storage module.
  - Zero Trust/OIDC/JWT validation → security track.
  - Queue semantics → Cloud Foundations messaging module.
  - Keep only Cloudflare-specific runtime, limits and APIs here.

---

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Terraform `cloudflare/cloudflare` **5.28.1** (2026-10-20). v5 is the Stainless-generated rewrite with breaking schema changes vs v4 (unverified detail).
- Cloudflare blog posts on isolates ("Cloud Computing without Containers") and on Durable Objects / SQLite-in-DO (unverified URLs; cite at authoring)
- Public buckets vs custom domains; data catalog (unverified)
- 6. A Durable Object is single-threaded per ID. Funnelling all traffic through one global DO (e.g. "rate limiter" ID) creates a global bottleneck (~1k req/s per DO order of magnitude, unverified). Shard by key.
- 8. Durable Object migrations (`new_sqlite_classes`, renames, deletes) are declarative in wrangler config. Deleting a class migration destroys data. KV-backed DOs can't be converted to SQLite in place (unverified current status).
- DO counter with concurrent requests proving serialisation; DO alarm firing via `runDurableObjectAlarm` (unverified helper name in the plugin API)
- Workflows step retries (local Workflows support in miniflare: unverified depth)
- **Integration:** `wrangler dev` (local mode, port 8787) + Playwright/`fetch` smoke tests; `unstable_startWorker`/`getPlatformProxy` from wrangler for Node-side tests (unverified current API names).
- Anycast/PoP behaviour, Cache Rules/Tiered Cache, WAF/Zero Trust Access policies, DO placement/latency, real CPU-limit enforcement (local workerd does not enforce production CPU limits (unverified)).
- **Mise:** `node = "22"` (wrangler ≥22), npm deps pinned exactly (`wrangler@4.154.0`, `@cloudflare/vitest-plugin@1.4.9`, `vitest@5.0.5` or `4.1.x`), `terraform 1.17.0` for the provider examples, `cloudflared` (pin, unverified version).

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/cloudflare` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(cloudflare)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/cloudflare.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/cloudflare.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
