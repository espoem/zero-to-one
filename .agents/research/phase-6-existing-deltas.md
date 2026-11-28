# Research Dossier — Stack, Security Standards, Architecture, LB, Caching, Deadlocks

Research date: 2026-11-28. Versions verified against GitHub releases / RFC Editor / OpenID.net today.

## 1. HTTP frameworks & security standards

### Express 5

- Latest stable: **5.3.0** (released 2026-10-09), https://github.com/expressjs/express/releases/tag/v5.3.0
- Deltas: promise-aware handlers (rejected promises → error handler), `app.render(..., null)` accepted, `req.fresh` now covers `QUERY`, `res.send()` keeps params when adding charset, body-parser `^2.3.0` (CVE-2026-12590 fail-open limit fix), qs `^6.16.0` (CVE-2026-2391/82417/82562), proxy-addr `^2.0.8` (CVE-2026-90711).
- Node: CI builds on 26; pin `24` (active to 2027-10-27) recommended.

### FastAPI

- Latest stable: **0.165.0** (released 2026-11-18), https://github.com/fastapi/fastapi/releases/tag/0.165.0
- New: configurable form parsing limits. Underlying: Starlette + Pydantic v2; async-first, OpenAPI 3.1.

### OAuth 2.1 / RFC 9700 — OAuth 2.0 Security BCP

- RFC 9700, "Best Current Practice for OAuth 2.0 Security", BCP 240, January 2025, https://www.rfc-editor.org/rfc/rfc9700.html; updates RFC 6749/6750/6819.
- Mandates: exact redirect URI matching (except localhost ports); PKCE (S256) MUST for public, RECOMMENDED for confidential; implicit grant SHOULD NOT be used; ROPC MUST NOT be used; sender-constrained access tokens via mTLS (RFC 8705) or DPoP (RFC 9449); audience restriction; refresh token rotation/sender-constraint for public clients; no open redirectors; CSRF via state or PKCE; mix-up defense via `iss` (RFC 9207) or distinct redirect URIs.
- OAuth 2.1 (draft) incorporates these; adds PKCE to all clients, removes implicit & ROPC.

### RFC 8725 — JWT Best Current Practices

- RFC 8725, BCP 225, February 2020, https://www.rfc-editor.org/rfc/rfc8725.html; updates RFC 7519.
- Rules: strict `alg` verification (allow-list, one key→one alg); reject `none` unless transport-protected; validate all crypto ops; `iss`/`sub`/`aud` validation; explicit `typ` (`dpop+jwt`, `at+jwt`); mutually exclusive validation profiles for distinct JWT kinds; sufficient key entropy; no compression before encryption; UTF-8 only; validate ECDH-ES curve points (NIST SP 800-56A §5.6.2.3.4); ECDSA use deterministic RFC 6979.

### RFC 9449 — DPoP

- RFC 9449, Standards Track, September 2023, https://www.rfc-editor.org/rfc/rfc9449.html.
- Mechanism: client holds EC/RSA keypair; each request carries `DPoP: <jwt>` proof (JOSE `typ: dpop+jwt`, `alg` asymmetric, `jwk` public key; claims `jti`, `htm`, `htu`, `iat`, plus `ath` = base64url(SHA-256(access token)) on resource access, `nonce` when server requires).
- Token request: `DPoP` header at token endpoint → AS binds token via `cnf.jkt` (JWK SHA-256 thumbprint, RFC 7638); response `token_type: DPoP`.
- Resource access: `Authorization: DPoP <token>` + `DPoP` proof; RS verifies `ath` hash, key match, time window, `htm`/`htu`.
- Replay defense: server-issued `DPoP-Nonce` header; `use_dpop_nonce` / `invalid_dpop_proof` errors.
- Metadata: `dpop_signing_alg_values_supported`; client reg `dpop_bound_access_tokens`.
- Refresh tokens: bound to DPoP key for public clients; confidential clients keep client-auth sender-constraint.
- Gotchas: DPoP is NOT client auth; no message integrity (relies on TLS); XSS can still use key in browser context; pre-computed proofs mitigated by nonce + `ath` binding.

### OIDC Core 1.0 & BFF cookie patterns

- OpenID Connect Core 1.0 incorporating errata set 2, final, 2023-12-15, https://openid.net/specs/openid-connect-core-1_0.html. Flows: Authorization Code (`code`), Implicit (`id_token`, `id_token token`), Hybrid. ID Token is signed JWT with `iss`, `sub`, `aud`, `exp`, `iat`, `nonce`, `auth_time`, `acr`, `amr`, `azp`.
- BFF pattern (Sam Newman, 2015, https://samnewman.io/patterns/architectural/bff/): one backend per UI experience, inside the perimeter; client (SPA/native) holds no tokens.
- BFF cookie pattern: use OIDC Authorization Code flow + PKCE; backend exchanges code for tokens server-side, stores them server-side, issues an `httpOnly`, `Secure`, `SameSite` (Lax/Strict) session cookie to the browser; refresh handled server-side; CSRF protection via `state`/`nonce` and SameSite cookies; no access token in browser storage. Aligns with RFC 9700 (no implicit, PKCE, sender-constrained tokens).

## 2. Backend architecture patterns (canonical sources & trade-offs)

| Pattern | Canonical source | Core idea | Trade-offs |
| --- | --- | --- | --- |
| Layered N-tier | Fowler, _Patterns of Enterprise Application Architecture_ (2002) | Dependencies point downward; presentation/domain/data | Simple, testable at boundaries; risk of anemic layers, leaky abstractions, pass-through overhead |
| Hexagonal (Ports & Adapters) | Alistair Cockburn, "Hexagonal Architecture" technical report 2005-09-04, https://alistair.cockburn.us/hexagonal-architecture/ | Application core isolated; primary/secondary ports with swappable adapters; test with FIT/mocks | Testability, swap infra without core changes; ports/interfaces overhead; discipline required |
| Modular Monolith | Kamil Grzybek, "Modular Monolith" (2019); Shopify; Fowler "MonolithFirst" | Single deployable, modules with explicit boundaries, shared process/DB but module ownership | Simpler ops/deploy, ACID, low latency; boundaries erode without enforcement (arch tests), all-or-nothing scaling |
| Microservices | Lewis & Fowler, "Microservices", 2014-03-25, https://martinfowler.com/articles/microservices.html | Small independently deployable services around business capabilities, smart endpoints/dumb pipes, decentralized data | Independent deploy/scale, team autonomy, polyglot; distributed complexity, network latency, eventual consistency, ops overhead |
| Event-Driven | Hohpe & Woolf, _Enterprise Integration Patterns_ (2003); Fowler "Event-Driven Architecture" | Components communicate via events (pub/sub, event sourcing, CQRS); loose coupling, async | Scalability, decoupling, audit log; eventual consistency, ordering/duplicate handling, debugging difficulty, schema evolution |
| Serverless (FaaS) | AWS Lambda docs; Roberts, "Serverless architectures", 2016 | Functions triggered by events, scale-to-zero, managed infra | Zero ops, elastic, pay-per-use; cold starts, vendor lock-in, stateless constraints, debugging/observability harder, cost at high steady load |
| CQRS | Greg Young (originator); Fowler, "CQRS", 2011-07-14, https://martinfowler.com/bliki/CQRS.html | Separate command (write) and query (read) models; often paired with event sourcing | Independent read/write scaling, optimized read models; significant complexity, eventual consistency, overkill for CRUD domains |

Trade-off summary: monolith first → extract services when boundaries/pain justify; microservices pay off only with mature CI/CD, observability, and domain boundaries. CQRS only in specific bounded contexts with complex domains or read/write disparity.

## 3. Load balancing algorithms

### Round Robin (RR)

- Cyclic assignment 1,2,...,N. O(1) per request. Assumes homogeneous backends and similar request cost. No session affinity.

### Weighted Round Robin (WRR)

- Server i gets weight w_i; ideal share w_i / Σw. Naive WRR (block) causes bursts. **Nginx smooth WRR** (https://nginx.org/en/docs/http/ngx_http_upstream_module.html): each server has `current_weight`; per request add `weight` to all, select max, subtract total weight from selected → smooth interleaving. Example: weights 5,1,1 → 7 requests distributed 5:1:1 smoothly.

### Least Connections (LC)

- Route to server with fewest active connections, adjusted by weight: `effective_load = active_conns / weight`. Good for long-lived connections (WebSockets, DB). Nginx `least_conn`.

### Least Response Time / EWMA + P2C

- Nginx `least_time` (header or last_byte): combines avg response time + active connections, weighted.
- EWMA: `rt_ewma = (1-α)*rt_ewma + α*sample` (α∈(0,1), e.g. 0.1–0.3); smooths noisy latency.
- Power of Two Choices (P2C): pick 2 random backends, route to the one with lower load (connections or EWMA). Mitzenmacher, "The Power of Two Choices in Randomized Load Balancing", IEEE TPDS 2001. Reduces max load from O(log n / log log n) to O(log log n) vs pure random; near-optimal with O(1) state. Used by gRPC/Envoy.

### IP Hash

- Hash client IP (first 3 octets IPv4 / full IPv6) → sticky server. Nginx `ip_hash`. Session affinity without cookies; breaks when client IP changes (NAT, mobile); poor balance if few clients.

### Consistent Hashing

- Karger et al., STOC 1997, "Consistent Hashing and Random Trees", https://doi.org/10.1145/258533.258660. Keys and nodes mapped to a ring (unit circle); key → next node clockwise. Adding/removing a node remaps only ~1/N keys. Virtual nodes (vnodes, weight) reduce skew. Lookup O(log N) via BST/binary search. Variants: ketama (nginx `hash ... consistent`), jump consistent hash (Lamping & Veach, 2014, arxiv 1406.2294), rendezvous (HRW). Used by Dynamo, Cassandra, Memcached, gRPC consistent-hash LB.

### Production gotchas

- Health checks + circuit breakers required; slow_start for recovering nodes; avoid synchronous call chains (multiplicative downtime); keepalive connections; max_conns per server.

## 4. Caching strategies

### Write-around

- On write, write directly to backing store, bypass cache (no-write-allocate). Cache populated only on read miss. Pair with write-through or write-back. Good when writes are rarely re-read (large objects, logs); avoids cache pollution. Trade-off: first read after write is a miss (higher latency) unless invalidated/prefetched. (Wikipedia, "Cache (computing)" §Write policies.)

### Event-driven CDC invalidation

- Capture DB changes via CDC (Debezium/binlog/WAL) → publish to bus (Kafka) → cache invalidator evicts/updates keys. Decouples DB from cache; near-real-time. Gotchas: at-least-once delivery → idempotent handlers; ordering per key; lag → stale reads; schema changes; poison messages; need outbox pattern to avoid dual-write inconsistency.

### Request coalescing / singleflight

- Deduplicate concurrent identical in-flight requests: first request fetches, others await the same result (Go `singleflight`, Caffeine, Redis `SET NX`). Prevents cache stampede/thundering herd. Gotchas: error propagation to all waiters; context cancellation (Go); key cardinality; memory for in-flight map; must distinguish "not found" caching.

## 5. Database deadlocks

### Conditions (Coffman)

- Mutual exclusion, hold-and-wait, no preemption, circular wait. All four required for deadlock (single-instance resources).

### Wait-for graph

- Directed graph: node = transaction/process, edge T_i→T_j if T_i waits for a lock held by T_j. Deadlock iff cycle (conjunctive case) or knot (disjunctive). DB engines (PostgreSQL, MySQL/InnoDB) detect via wait-for graph / timeout and abort one transaction (victim) with error (PG: "deadlock detected", SQLSTATE 40P01; InnoDB auto-rollback). Distributed: phantom deadlocks possible due to delays.

### Prevention algorithms

- **Wait-die**: lower-priority transaction is aborted (dies) when it requests a lock held by higher priority; higher waits. (Timestamps as priority.)
- **Wound-wait**: higher-priority transaction aborts (wounds) the lower-priority holder; lower waits when requesting lock held by higher. Both use transaction timestamps as priority; both prevent circular wait by ordering. Trade-offs: wait-die causes more aborts of younger txns; wound-wait causes more preemption/rollback of older (holding) txns; both reduce throughput vs detection but avoid detection overhead and are deadlock-free.

### Production gotchas

- Keep transactions short; consistent lock acquisition order (index order); avoid user input inside tx; retry on deadlock (40001/40P01) with backoff; index to reduce lock scope (row vs gap/next-key locks in InnoDB); watch for lock escalation; long-running txns increase deadlock probability.

## Sources (primary)

- Express releases: https://github.com/expressjs/express/releases
- FastAPI releases: https://github.com/fastapi/fastapi/releases
- RFC 9700: https://www.rfc-editor.org/rfc/rfc9700.html
- RFC 8725: https://www.rfc-editor.org/rfc/rfc8725.html
- RFC 9449: https://www.rfc-editor.org/rfc/rfc9449.html
- OIDC Core 1.0: https://openid.net/specs/openid-connect-core-1_0.html
- Microservices (Lewis/Fowler): https://martinfowler.com/articles/microservices.html
- CQRS (Fowler): https://martinfowler.com/bliki/CQRS.html
- Hexagonal (Cockburn): https://alistair.cockburn.us/hexagonal-architecture/
- BFF (Newman): https://samnewman.io/patterns/architectural/bff/
- Nginx upstream module: https://nginx.org/en/docs/http/ngx_http_upstream_module.html
- Consistent hashing (Karger et al.): https://doi.org/10.1145/258533.258660
- Cache write policies (Wikipedia): https://en.wikipedia.org/wiki/Cache_(computing)
- Wait-for graph (Wikipedia): https://en.wikipedia.org/wiki/Wait-for_graph
- Deadlock prevention (Wikipedia): https://en.wikipedia.org/wiki/Deadlock_prevention_algorithms
