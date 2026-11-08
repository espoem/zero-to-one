# Cloudflare Edge Architecture & Workers Runtime: Preparation Question Bank

A comprehensive assessment bank containing 65 scenario, multi-select, ordering, and architectural questions covering edge isolates, `workerd`, KV, Durable Objects, D1, R2, Queues, Workflows, and Zero Trust security.

---

### Q-CF-001 · Edge Runtime · difficulty 1 · single

How does Cloudflare dispatch incoming client HTTP requests to edge Workers across its global network?
- A) Centralized DNS geo-routing resolves client requests to a regional master proxy cluster.
- B) BGP Anycast advertises identical IP ranges globally, terminating TCP/TLS at the topologically nearest PoP where `workerd` dispatches to local isolates.
- C) Round-robin DNS distributes ingress connections across global virtual machines running Docker containers.
- D) Client browsers execute WebAssembly modules locally to determine the optimal regional origin server.
<details><summary>Answer</summary>

**B.** Cloudflare utilizes BGP Anycast to announce the same IP prefix from hundreds of Points of Presence (PoPs) worldwide. The internet's BGP routing automatically sends packets to the topologically closest edge data center, where local `workerd` processes execute the Worker in a V8 isolate.

- Why not A: Centralized geo-DNS introduces high latency and does not provide automatic failover at packet level like BGP Anycast.
- Why not C: Cloudflare Workers run inside lightweight V8 isolates in `workerd`, not Docker containers, and use Anycast rather than round-robin DNS.
- Why not D: Edge Workers execute on Cloudflare edge server infrastructure, not inside the client browser.
- Ref: [modules/01-edge-model-and-request-lifecycle.md](../modules/01-edge-model-and-request-lifecycle.md), https://developers.cloudflare.com/workers/reference/how-workers-works/

</details>

### Q-CF-002 · Edge Runtime · difficulty 2 · single

What occurs if a Worker's `fetch` handler returns a `Response` without awaiting an asynchronous promise and without passing that promise to `ctx.waitUntil()`?
- A) The runtime blocks the response from sending to the client until all outstanding event loop microtasks resolve.
- B) The unawaited promise is suspended and automatically resumes when the next HTTP request arrives at that isolate.
- C) The runtime cancels or terminates asynchronous execution immediately upon returning the response, causing incomplete background work.
- D) The runtime transfers the unawaited promise to a dedicated background container with uncapped CPU time.
<details><summary>Answer</summary>

**C.** In the Workers serverless model, returning a Response signals to the runtime that request processing is complete. Any pending asynchronous operations not registered with `ctx.waitUntil()` are canceled or abandoned when the isolate suspends execution.

- Why not A: Returning a Response terminates the active request context; it does not block waiting for unregistered asynchronous promises.
- Why not B: Unregistered promises are not preserved across request boundaries; isolate state may be evicted or reset.
- Why not D: Workers do not transparently provision background containers for unawaited promises.
- Ref: [modules/01-edge-model-and-request-lifecycle.md](../modules/01-edge-model-and-request-lifecycle.md), https://developers.cloudflare.com/workers/runtime-apis/context/

</details>

### Q-CF-003 · Edge Runtime · difficulty 2 · multi

Which statements accurately characterize the V8 isolate execution model of `workerd` compared to traditional container-based serverless runtimes? (Select TWO)
- A) Each incoming request boots an isolated Linux kernel namespace with dedicated virtualized hardware devices.
- B) Multiple independent tenant isolates execute within a single operating system process with shared runtime memory address space safety enforced by V8.
- C) Cold starts are typically sub-millisecond because instantiating a V8 isolate requires allocating heap memory rather than booting an OS kernel.
- D) Each isolate is allocated a dedicated 4 GB virtual memory space and full POSIX filesystem access.
<details><summary>Answer</summary>

**B and C.** V8 isolates provide lightweight sandboxing within a single host process. Instantiating an isolate only requires allocating a discrete V8 heap and context (taking under 5 ms, often sub-millisecond), eliminating the kernel boot and container image pull overhead of container-based runtimes.

- Why not A: Containers use Linux cgroups and namespaces to boot guest environments; `workerd` uses V8 isolates without spinning up OS kernels.
- Why not D: Workers isolates have a strict 128 MB memory limit and do not have access to an underlying POSIX local filesystem.
- Ref: [modules/02-runtime-internals-and-workerd.md](../modules/02-runtime-internals-and-workerd.md), https://developers.cloudflare.com/workers/learning/how-workers-works/

</details>

### Q-CF-004 · Edge Runtime · difficulty 2 · scenario

An engineer deploys an image processing Worker that parses raw multipart form payloads in memory. In production, requests handling 15 MB image files occasionally terminate with Error 1102. What is the root cause and remedy?
- A) The Worker exceeded the default 10 ms CPU-time limit; upgrade to Workers Paid to raise the CPU limit.
- B) The V8 isolate exceeded the 128 MB heap allocation ceiling during in-memory buffering; stream the payload via `TransformStream` instead of buffering `ArrayBuffer` instances in memory.
- C) Cloudflare WAF dropped the request because form uploads cannot exceed 10 MB; configure a custom WAF bypass rule.
- D) The edge server ran out of disk space; configure an R2 temporary directory mount in `wrangler.jsonc`.
<details><summary>Answer</summary>

**B.** Cloudflare Workers isolates have a hard memory ceiling of 128 MB per isolate across both Free and Paid tiers. Buffering large binary payloads and expanding them into memory structures easily exhausts the 128 MB limit, throwing Error 1102. The remedy is chunked streaming using `TransformStream`.

- Why not A: While CPU limits also produce Error 1102, large binary memory allocation specifically triggers heap exhaustion, which paid plans cannot fix without streaming.
- Why not C: Error 1102 is an isolate runtime resource failure, not a WAF rejection (which returns 403 Forbidden).
- Why not D: Isolates do not have disk mounts; all operations take place in memory or via capability bindings.
- Ref: [modules/02-runtime-internals-and-workerd.md](../modules/02-runtime-internals-and-workerd.md), https://developers.cloudflare.com/workers/platform/limits/

</details>

### Q-CF-005 · Edge Runtime · difficulty 3 · scenario

A distributed microservice relies on a module-scoped variable `let cachedToken: string | null = null;` inside `index.ts`. What catastrophic failure mode can occur in a multi-tenant or concurrent traffic environment?
- A) The V8 garbage collector crashes with a kernel segmentation fault when reading module-scoped variables.
- B) Multiple concurrent requests sharing the same isolate instance can overwrite or read each other's cached state, causing cross-tenant data leakage.
- C) The Cloudflare compiler rejects module-scoped mutable variables during TypeScript validation.
- D) Module-scoped variables prevent the Worker from deploying to more than one Point of Presence globally.
<details><summary>Answer</summary>

**B.** Cloudflare Workers reuse warm V8 isolates across sequential and overlapping requests. Global or module-scoped mutable variables persist across requests within that isolate. If sensitive client tokens or user IDs are stored in module scope, subsequent requests from different users routed to that warm isolate can access that shared memory state.

- Why not A: V8 handles JavaScript variables cleanly without OS segfaults; the issue is application security and tenant isolation.
- Why not C: TypeScript and V8 allow mutable module-level variables; the runtime does not prevent code execution.
- Why not D: Workers deploy identically to all global PoPs regardless of variable scoping.
- Ref: [modules/02-runtime-internals-and-workerd.md](../modules/02-runtime-internals-and-workerd.md), https://developers.cloudflare.com/workers/runtime-apis/request/

</details>

### Q-CF-006 · Edge Runtime · difficulty 1 · single

How does Cloudflare calculate billable compute usage on the Workers Paid standard plan?
- A) Total wall-clock time that the TCP socket remains open between client and edge.
- B) Active CPU execution time consumed by the isolate (measured in milliseconds) plus total request count.
- C) Dedicated physical CPU core reservation charged on an hourly billing cycle.
- D) Total ingress and egress network bandwidth consumed across the edge network.
<details><summary>Answer</summary>

**B.** The Workers Paid pricing model charges based on total request invocations plus actual CPU execution time consumed during JavaScript execution (CPU-ms). Time spent waiting on external I/O (such as subrequest fetch or database queries) does not incur CPU billing.

- Why not A: Wall-clock duration waiting for network responses is not billed on standard Workers CPU pricing.
- Why not C: Workers is a multi-tenant serverless platform without dedicated host core allocations.
- Why not D: Workers compute billing is distinct from network bandwidth; R2 also features zero egress fees.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/workers/platform/pricing/

</details>

### Q-CF-007 · Edge Runtime · difficulty 2 · single

What is the role of the `compatibility_date` setting in `wrangler.jsonc`?
- A) It specifies the minimum date after which Cloudflare automated deprecation scripts will delete the Worker.
- B) It locks runtime behavior, Node.js API polyfills, and global standard implementations to a fixed point in time, guarding against breaking engine updates.
- C) It instructs Cloudflare edge DNS to start routing production traffic to the Worker on that scheduled date.
- D) It synchronizes the Worker's system clock to a fixed historical timestamp to eliminate NTP drift.
<details><summary>Answer</summary>

**B.** Cloudflare continually updates `workerd` with new web standards and bug fixes. The `compatibility_date` ensures that runtime behavioral changes are only applied when the developer explicitly opts in by advancing the date, preventing regressions in production.

- Why not A: Workers are not automatically deleted based on compatibility dates; older dates remain supported.
- Why not C: DNS and traffic routing are governed by deployments and route configurations, not compatibility dates.
- Why not D: The system clock reports current UTC time; compatibility dates do not freeze the runtime clock.
- Ref: [modules/03-tooling-configuration-and-deployments.md](../modules/03-tooling-configuration-and-deployments.md), https://developers.cloudflare.com/workers/configuration/compatibility-dates/

</details>

### Q-CF-008 · Edge Runtime · difficulty 2 · scenario

An engineering team wants to run unit and integration tests inside the exact V8 `workerd` edge environment rather than a Node.js mock. Which test runner plugin is the recommended standard?
- A) `vitest-pool-workers` (version 0.23)
- B) `@cloudflare/vitest-plugin` (version 1.x)
- C) `jest-cloudflare-environment`
- D) `mocha-workerd-runner`
<details><summary>Answer</summary>

**B.** Cloudflare transitioned from `@cloudflare/vitest-pool-workers` to `@cloudflare/vitest-plugin`. The new plugin supports modern Vitest (including Vitest 5+) and runs test suites directly inside local `workerd` instances with isolated storage bindings.

- Why not A: `vitest-pool-workers` is legacy and incompatible with Vitest 5+.
- Why not C: Jest is not the primary supported runner for native `workerd` Miniflare 3+ simulation.
- Why not D: `mocha-workerd-runner` does not exist as an official Cloudflare testing package.
- Ref: [modules/03-tooling-configuration-and-deployments.md](../modules/03-tooling-configuration-and-deployments.md), https://developers.cloudflare.com/workers/testing/vitest-integration/

</details>

### Q-CF-009 · Edge Runtime · difficulty 1 · single

How are credentials, API keys, and database passwords passed to a Worker securely in production?
- A) Hardcoded in plain text inside `wrangler.jsonc` under the `vars` object.
- B) Committed as an encrypted `.env.vault` file in the git source repository.
- C) Encrypted via `wrangler secret put <NAME>` and accessed as properties on the `env` object at runtime.
- D) Fetched dynamically over unauthenticated HTTP from `http://169.254.169.254/metadata`.
<details><summary>Answer</summary>

**C.** Secrets in Cloudflare Workers are uploaded using `wrangler secret put <NAME>` or via the Cloudflare dashboard. They are encrypted at rest and injected directly into the runtime `env` context during Worker instantiation without appearing in source code.

- Why not A: Plaintext keys in `wrangler.jsonc` leak credentials into version control.
- Why not B: Cloudflare does not natively decrypt custom `.env.vault` files during edge isolate initialization.
- Why not D: 169.254.169.254 is the AWS EC2 instance metadata service, which is inaccessible and irrelevant in Cloudflare Workers.
- Ref: [modules/03-tooling-configuration-and-deployments.md](../modules/03-tooling-configuration-and-deployments.md), https://developers.cloudflare.com/workers/configuration/secrets/

</details>

### Q-CF-010 · Edge Runtime · difficulty 3 · scenario

A developer deploys a Worker with `ctx.passThroughOnException()`. When an unhandled runtime error occurs during a client request, what behavior does the client observe?
- A) The client immediately receives a Cloudflare Error 1101 page with full stack trace.
- B) The runtime catches the exception and proxies the request directly to the customer's origin server as if the Worker were not installed.
- C) The request restarts from the beginning inside a fresh isolate in another data center.
- D) The client connection is abruptly reset with a TCP RST packet.
<details><summary>Answer</summary>

**B.** `ctx.passThroughOnException()` instructs the edge routing pipeline to fail open. If the Worker throws an unhandled exception during execution, Cloudflare suppresses the 5xx error and forwards the original request directly to the origin web server.

- Why not A: Failing open specifically prevents the client from seeing an Error 1101 Worker exception page.
- Why not C: `passThroughOnException` forwards to the origin server, not another Worker isolate.
- Why not D: The connection is not severed; standard HTTP processing continues to the configured origin.
- Ref: [modules/01-edge-model-and-request-lifecycle.md](../modules/01-edge-model-and-request-lifecycle.md), https://developers.cloudflare.com/workers/runtime-apis/context/#passthroughonexception

</details>

### Q-CF-011 · Edge Runtime · difficulty 2 · single

What Spectre attack mitigation is enforced inside `workerd` to prevent cross-isolate side-channel memory leaks?
- A) Cloudflare runs every isolate inside its own dedicated hardware server blade.
- B) High-resolution timing APIs like `performance.now()` are coarsened and `SharedArrayBuffer` is restricted by default.
- C) JavaScript JIT compilation is completely disabled, running only slow bytecode interpretation.
- D) All network requests are encrypted using post-quantum Kyber keys.
<details><summary>Answer</summary>

**B.** Spectre side-channel attacks rely on measuring microscopic differences in CPU cache timing. To prevent one isolate from reading memory from a neighboring isolate in the same host process, `workerd` coarsens timer resolutions (reducing precision) and disables unconstrained shared memory structures like `SharedArrayBuffer`.

- Why not A: Dedicated physical blades for each isolate would destroy edge density and serverless economics.
- Why not C: `workerd` uses V8's JIT compilers (Ignition, Sparkplug, and TurboFan) for high performance.
- Why not D: Post-quantum cryptography protects network transit, not local CPU cache microarchitectural side channels.
- Ref: [modules/02-runtime-internals-and-workerd.md](../modules/02-runtime-internals-and-workerd.md), https://blog.cloudflare.com/mitigating-spectre-and-other-security-threats/

</details>

### Q-CF-012 · Edge Runtime · difficulty 2 · single

How does Smart Placement optimize Worker performance when connecting to regional backends?
- A) It copies the origin SQL database into local RAM on every edge PoP automatically.
- B) It analyzes subrequest latency and dynamically executes the Worker code in the Cloudflare data center closest to the backend database rather than the client.
- C) It reroutes user internet connections through specialized Starlink satellite uplinks.
- D) It rewrites SQL queries into GraphQL at edge network termination points.
<details><summary>Answer</summary>

**B.** If a Worker makes multiple round-trip queries to a central database located in US-East, running the Worker in Sydney causes multiple 200 ms cross-ocean round trips. Smart Placement detects this pattern and automatically shifts Worker execution to US-East, reducing database round-trip latency to sub-millisecond local network hops.

- Why not A: Smart Placement moves compute closer to data; it does not clone arbitrary regional databases to every PoP.
- Why not C: Smart Placement operates over Cloudflare's terrestrial Anycast network, not satellite links.
- Why not D: Smart Placement is a compute routing feature, not an API query language converter.
- Ref: [modules/01-edge-model-and-request-lifecycle.md](../modules/01-edge-model-and-request-lifecycle.md), https://developers.cloudflare.com/workers/configuration/smart-placement/

</details>

### Q-CF-013 · Edge Runtime · difficulty 2 · ordering

What is the correct chronological execution order when an incoming HTTP request matches a Worker route on a Cloudflare zone?
- A) BGP Anycast Ingress -> Origin Fetch -> Worker Isolate Execution -> L7 WAF Rules
- B) BGP Anycast Ingress -> L3/L4 DDoS & L7 WAF -> Worker Isolate Execution -> Subrequest Cache / Origin Fetch
- C) Worker Isolate Execution -> L7 WAF Rules -> BGP Anycast Ingress -> Origin Fetch
- D) Zone Cache Check -> Worker Isolate Execution -> L7 WAF Rules -> Origin Fetch
<details><summary>Answer</summary>

**B.** Incoming packets terminate at BGP Anycast and negotiate TLS; Cloudflare L3/L4 DDoS and L7 WAF rules evaluate first to challenge or block malicious traffic. For routed paths, the Worker isolate executes before the zone cache, intercepting the request and deciding whether to synthesize a response or fetch upstream through the edge cache.

- Why not A: WAF and DDoS filtering always execute prior to invoking custom Worker isolates or fetching upstream.
- Why not C: BGP Anycast and L7 ingress terminate before user-space Worker isolates are dispatched.
- Why not D: Routed Workers execute prior to the zone cache, giving code programmatic authority over cache lookups.
- Ref: [modules/01-edge-model-and-request-lifecycle.md](../modules/01-edge-model-and-request-lifecycle.md), https://developers.cloudflare.com/workers/reference/how-workers-works/

</details>

---

### Q-CF-014 · Caching · difficulty 1 · single

What is the geographical scope of Cloudflare's `caches.default` Cache API within a Worker?
- A) Globally distributed and synchronized with strong consistency across all 300+ PoPs instantly.
- B) Local to the specific data center (PoP) executing the Worker request.
- C) Scoped strictly to the individual V8 isolate and lost when the isolate terminates.
- D) Centralized in a single primary data center in Ashburn, Virginia.
<details><summary>Answer</summary>

**B.** The Cache API (`caches.default`) represents the local cache of the specific Cloudflare data center where the Worker is running. Writing to `caches.default` stores the response in that PoP's storage cluster; it does not write to other global data centers.

- Why not A: Synchronizing every HTTP response globally across 300+ PoPs would incur unsustainable network overhead and latency.
- Why not C: The edge cache is backed by data center NVMe/RAM clusters shared across isolates in that PoP, not isolate heap.
- Why not D: Cloudflare edge cache is distributed across edge PoPs, not funneled through Ashburn.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/workers/runtime-apis/cache/

</details>

### Q-CF-015 · Caching · difficulty 2 · scenario

An origin server returns `Cache-Control: public, max-age=60` and `CDN-Cache-Control: max-age=3600`. How do client browsers and Cloudflare edge caches handle this response?
- A) Both browser and edge cache the response for 60 seconds.
- B) Both browser and edge cache the response for 3600 seconds.
- C) Cloudflare edge caches the response for 3600 seconds (1 hour), while client browsers cache it for 60 seconds.
- D) Cloudflare edge rejects the response due to conflicting cache control headers.
<details><summary>Answer</summary>

**C.** Per RFC 9111 and Cloudflare CDN specifications, targeted directives like `CDN-Cache-Control` or `Cloudflare-CDN-Cache-Control` take precedence on intermediate CDN edge nodes, while downstream browser caches adhere to the standard `Cache-Control` directive.

- Why not A: Edge proxies explicitly obey `CDN-Cache-Control` over standard `Cache-Control`.
- Why not B: Browser user agents do not evaluate CDN-specific headers and obey `max-age=60`.
- Why not D: Having distinct edge and browser caching policies via targeted headers is standard HTTP architecture.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/cache/concepts/cache-control/

</details>

### Q-CF-016 · Caching · difficulty 2 · single

What does the Tiered Cache architecture accomplish in Cloudflare's CDN topology?
- A) It partitions cached content based on user payment tiers.
- B) It groups global PoPs into a hierarchy where regional upper-tier data centers absorb cache misses from lower-tier PoPs, minimizing origin load.
- C) It converts standard HTML responses into compressed gzip and Brotli formats automatically.
- D) It guarantees ACID transactional guarantees for cached REST APIs.
<details><summary>Answer</summary>

**B.** Without Tiered Cache, a cache miss in Prague, Berlin, and Vienna would each result in an independent request to the origin server. Tiered Cache routes misses through a designated regional upper-tier PoP (e.g., Frankfurt), which fetches from origin once and serves the surrounding edge PoPs.

- Why not A: Tiered Cache refers to network caching topography, not customer subscription pricing.
- Why not C: Compression is handled by edge encoding pipelines, not the Tiered Cache topology.
- Why not D: Caching is an eventually consistent HTTP optimization, not an ACID transaction manager.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/cache/how-to/tiered-cache/

</details>

### Q-CF-017 · Caching · difficulty 2 · scenario

A developer updates a static asset and executes a global purge via the Cloudflare API. However, an internal test using `caches.default.match()` inside a Worker in Tokyo still returns the old asset. What explains this?
- A) The Cache API does not share storage with the zone CDN cache and must be purged or invalidated independently.
- B) Cloudflare global purges take up to 48 hours to reach Asian data centers.
- C) The Tokyo data center does not participate in global purge broadcasts.
- D) Purge requests only affect HTTP/1.1 traffic, not HTTP/3.
<details><summary>Answer</summary>

**A.** Responses stored via custom keys or programmatic calls using the Worker `Cache API` (`caches.default.put`) operate independently from the Cloudflare zone CDN HTTP cache. Purging the zone cache via URL/tag through the dashboard or API does not automatically delete custom entries stored directly in `caches.default`.

- Why not B: Cloudflare global zone purges complete across global edge PoPs in under 150 milliseconds.
- Why not C: All Cloudflare global PoPs receive and process purge control plane signals.
- Why not D: Cache purges operate on URL and cache keys regardless of transport protocol (HTTP/1, 2, or 3).
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/workers/runtime-apis/cache/

</details>

### Q-CF-018 · Caching · difficulty 2 · single

What is the effect of configuring `stale-while-revalidate` in a `Cache-Control` header on edge requests?
- A) The edge returns an error 504 if the cached resource has expired.
- B) The edge serves the expired (stale) cached asset immediately to the client while asynchronously fetching a fresh copy from origin in the background.
- C) The client browser is forced to perform an unconditional hard reload on every page view.
- D) The origin server must maintain a stateful WebSocket connection to the edge.
<details><summary>Answer</summary>

**B.** `stale-while-revalidate` (RFC 5861) allows the CDN to serve stale content to the requester with zero origin latency penalty, while initiating a background subrequest to fetch and update the cache for subsequent users.

- Why not A: Serving stale content specifically avoids timeouts and latency spikes.
- Why not C: `stale-while-revalidate` reduces client wait time and avoids forced full reloads.
- Why not D: It operates over standard stateless HTTP request/response lifecycles.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/cache/concepts/cache-control/#stale-while-revalidate

</details>

### Q-CF-019 · Caching · difficulty 3 · scenario

An API endpoint serves user-specific content based on an `Authorization: Bearer <token>` header. By default, how does Cloudflare's CDN cache handle requests to this endpoint?
- A) It caches the response and serves the first user's data to all subsequent users.
- B) Cloudflare does not cache requests containing an `Authorization` header by default unless overridden by custom Cache Rules or Workers.
- C) It hashes the token into the default cache key automatically.
- D) It returns a 401 Unauthorized at the Anycast edge layer.
<details><summary>Answer</summary>

**B.** To prevent severe security and privacy leaks, Cloudflare's standard caching rules bypass the cache whenever an `Authorization` request header is present, forwarding the request directly to origin. Overriding this requires explicit Cache Rules or custom Worker caching logic.

- Why not A: Cloudflare's default safety rules prevent caching authorized responses to protect against data leakage.
- Why not C: Cloudflare does not automatically include `Authorization` headers in default cache keys.
- Why not D: Cloudflare forwards un-cached requests to the origin rather than rejecting them at the edge.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/cache/concepts/default-cache-behavior/

</details>

### Q-CF-020 · Caching · difficulty 2 · multi

Which of the following techniques can be used within a Cloudflare Worker to customize the cache key for an incoming request? (Select TWO)
- A) Constructing a custom `Request` URL containing normalized query parameters and using it as the key in `caches.default.match()`.
- B) Passing a `cf: { cacheKey: "<custom-key-url>" }` object in the options of an outbound `fetch()` subrequest.
- C) Modifying the client's physical MAC address header before invoking `fetch()`.
- D) Running `worker.setGlobalCacheKey()` during module initialization.
<details><summary>Answer</summary>

**A and B.** A Worker can either pass a synthetic `Request` object with customized URL/headers into `caches.default.match(customRequest)`, or use the Cloudflare-specific `cf: { cacheKey: "..." }` fetch option when fetching upstream resources through the edge cache.

- Why not C: MAC addresses are Layer 2 link-local identifiers stripped at the first router and inaccessible to HTTP workers.
- Why not D: There is no `worker.setGlobalCacheKey()` method; cache keys are evaluated per request.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/workers/runtime-apis/request/#cf-property-requestinitcfproperties

</details>

### Q-CF-021 · Caching · difficulty 2 · single

Why do Workers running on the default `*.workers.dev` subdomain exhibit different caching behavior compared to Workers routed on custom apex/subdomains?
- A) `workers.dev` domains do not have access to an enterprise Cloudflare zone cache and bypass zone CDN caching features.
- B) `workers.dev` domains execute exclusively in a single data center in London.
- C) `workers.dev` domains disable V8 garbage collection.
- D) `workers.dev` domains cannot make outbound `fetch` subrequests.
<details><summary>Answer</summary>

**A.** The `workers.dev` subdomain provides raw isolate compute without an attached Cloudflare Zone. Zone-level CDN features—such as Page Rules, Cache Rules, and automatic zone caching—only apply to Workers routed on domains within active Cloudflare zones.

- Why not B: `workers.dev` runs across all global Anycast PoPs worldwide.
- Why not C: V8 garbage collection runs identically across all deployment modes.
- Why not D: Outbound `fetch` subrequests work identically on `workers.dev`.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/workers/configuration/routing/workers-dev/

</details>

### Q-CF-022 · Caching · difficulty 1 · single

What HTTP status code is sent with 103 Early Hints to enable browsers to preload critical resources before the main HTML response is generated?
- A) 100 Continue
- B) 103 Early Hints
- C) 206 Partial Content
- D) 304 Not Modified
<details><summary>Answer</summary>

**B.** HTTP status 103 Early Hints allows the edge or origin server to send Link headers before the primary response body is ready, allowing modern browsers to begin downloading CSS, fonts, and scripts while server compute executes.

- Why not A: 100 Continue is used in `Expect: 100-continue` request negotiations.
- Why not C: 206 Partial Content is used for HTTP range requests.
- Why not D: 304 Not Modified indicates that a conditional GET validated successfully against cached ETag/Last-Modified.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/cache/advanced-specifications/early-hints/

</details>

### Q-CF-023 · Caching · difficulty 3 · scenario

A developer uses `cacheTtlByStatus: { "200-299": 3600, "404": 60, "500-599": 0 }` in a Worker `fetch()` call. If the origin returns a 500 Internal Server Error, what does Cloudflare cache?
- A) It caches the 500 error for 3600 seconds.
- B) It caches the 500 error for 60 seconds.
- C) It does not cache the 500 error at all, ensuring subsequent requests retry the origin.
- D) It permanently blacklists the origin domain.
<details><summary>Answer</summary>

**C.** A TTL of `0` in `cacheTtlByStatus` instructs Cloudflare not to store that response in cache. Subsequent client requests will bypass cache and fetch directly from origin.

- Why not A: 3600 seconds applies to successful 2xx responses per the range specification.
- Why not B: 60 seconds applies only to 404 Not Found responses.
- Why not D: 5xx errors do not blacklist the origin; they simply indicate temporary server failures.
- Ref: [modules/04-caching-and-edge-content-delivery.md](../modules/04-caching-and-edge-content-delivery.md), https://developers.cloudflare.com/workers/runtime-apis/request/#cf-property-requestinitcfproperties

</details>

---

### Q-CF-024 · Distributed State · difficulty 1 · single

What consistency model does Workers KV provide across Cloudflare global Points of Presence?
- A) Strict serializability with distributed two-phase commit.
- B) Linearizable read-your-writes consistency across all regions.
- C) Eventual consistency, where writes propagate asynchronously to edge data centers.
- D) Strong consistency backed by distributed Spanner Paxos groups.
<details><summary>Answer</summary>

**C.** Workers KV is optimized for high-frequency reads and low latency. Writes commit to a central durable storage cluster and propagate asynchronously to edge data center caches worldwide, exhibiting eventual consistency.

- Why not A: Two-phase commit is too slow for global edge latencies and does not scale to hundreds of PoPs.
- Why not B: Read-your-writes across different global PoPs is not guaranteed by KV; reads may observe stale data for up to 60 seconds.
- Why not D: Cloudflare KV is not built on Google Spanner and prioritizes read availability over immediate linearizability.
- Ref: [modules/05-workers-kv-and-eventual-consistency.md](../modules/05-workers-kv-and-eventual-consistency.md), https://developers.cloudflare.com/kv/concepts/how-kv-works/

</details>

### Q-CF-025 · Distributed State · difficulty 2 · scenario

A developer writes an inventory decrement service using Workers KV: `const val = await env.KV.get('stock'); await env.KV.put('stock', val - 1);`. Under high traffic, what failure mode occurs?
- A) Workers KV automatically serializes the requests using distributed row-level locks.
- B) Lost updates and race conditions occur because read-modify-write on KV is not atomic across concurrent isolates.
- C) The Worker crashes with Error 1000 due to incompatible integer types.
- D) Cloudflare KV blocks the second write until all global edge caches invalidate.
<details><summary>Answer</summary>

**B.** Workers KV has no atomic increment, CAS (Compare-And-Swap), or locking primitives. Concurrent isolates reading and rewriting the same key will overwrite each other's updates (lost updates). Atomic counters and synchronized state must use Durable Objects.

- Why not A: Workers KV is an eventually consistent key-value store without distributed locking.
- Why not C: JavaScript numbers and JSON strings are valid; the failure is architectural concurrency.
- Why not D: KV does not block writes for edge invalidation; it accepts writes asynchronously.
- Ref: [modules/05-workers-kv-and-eventual-consistency.md](../modules/05-workers-kv-and-eventual-consistency.md), https://developers.cloudflare.com/kv/concepts/how-kv-works/

</details>

### Q-CF-026 · Distributed State · difficulty 2 · scenario

A client issues `await env.KV.get("missing_key")` which returns `null`. Five seconds later, another system writes `"missing_key" = "fresh_value"`. When the client reads the key again immediately from the same edge PoP, it still returns `null`. Why?
- A) Workers KV permanently locks missing keys against future writes.
- B) Workers KV employs negative-lookup caching, caching the non-existence of a key at the local PoP for the cache TTL.
- C) The database partition in that PoP has suffered Byzantine fault corruption.
- D) The client browser must send a `Pragma: no-cache` header to refresh KV keys.
<details><summary>Answer</summary>

**B.** To protect central storage clusters from cache stampedes on non-existent keys, Cloudflare edge PoPs cache negative lookups (`null` results) for the duration of the cache TTL (default 60 seconds). Writes do not immediately invalidate local negative cache entries at remote PoPs.

- Why not A: Keys can be created at any time; they are not permanently locked.
- Why not C: Negative caching is standard CDN architecture, not a Byzantine corruption.
- Why not D: Browser request headers do not bypass Workers KV internal storage cache logic.
- Ref: [modules/05-workers-kv-and-eventual-consistency.md](../modules/05-workers-kv-and-eventual-consistency.md), https://developers.cloudflare.com/kv/concepts/how-kv-works/

</details>

### Q-CF-027 · Distributed State · difficulty 2 · single

What is the recommended maximum write rate per key in Workers KV to avoid throttling and degradation?
- A) Unlimited writes per second.
- B) Approximately 1 write per second per key.
- C) 100,000 writes per second per key.
- D) 10 writes per millisecond per key.
<details><summary>Answer</summary>

**B.** Cloudflare KV architecture is optimized for high read rates (millions/sec) and infrequent writes. The official guidance states that writes to the same key should not exceed approximately once per second. High-frequency writes to a single key should use Durable Objects.

- Why not A: Hardware and distributed replication limits make unlimited write throughput impossible.
- Why not C: 100,000 writes/sec to a single key will trigger severe 429 rate limiting on KV.
- Why not D: Microsecond-scale writes require dedicated in-memory actor state, which KV does not support.
- Ref: [modules/05-workers-kv-and-eventual-consistency.md](../modules/05-workers-kv-and-eventual-consistency.md), https://developers.cloudflare.com/kv/platform/limits/

</details>

### Q-CF-028 · Distributed State · difficulty 1 · single

What core concurrency guarantee does a Cloudflare Durable Object provide for a given ID?
- A) Multi-master active-active replication with automatic conflict-free resolution across every PoP.
- B) A single-threaded execution actor model where exactly one instance exists globally, serializing requests to that ID.
- C) Stateless round-robin load balancing across a Kubernetes pod replica set.
- D) Read-uncommitted eventual consistency with periodic snapshot flushing.
<details><summary>Answer</summary>

**B.** A Durable Object guarantees global uniqueness for a given ID: exactly one instance of that Durable Object runs in memory globally at any given moment. Incoming requests and RPC calls to that ID are routed to that single actor instance, which processes them on a single thread.

- Why not A: Durable Objects use a single-writer actor model, not multi-master CRDT replication.
- Why not C: Durable Objects are stateful actors running in `workerd`, not stateless Kubernetes pods.
- Why not D: Durable Objects provide strong consistency backed by transactional SQLite or KV storage.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/

</details>

### Q-CF-029 · Distributed State · difficulty 2 · scenario

An engineer migrates a Durable Object to use SQLite storage. Inside an actor method, they write:
```typescript
this.ctx.storage.sql.exec("UPDATE accounts SET balance = balance - 100 WHERE id = 'A'");
throw new Error("Validation failure");
this.ctx.storage.sql.exec("UPDATE accounts SET balance = balance + 100 WHERE id = 'B'");
```
Without wrapping in a transaction, what happens to account A's balance?
- A) Account A's balance remains deducted because SQLite statements execute and commit immediately when not enclosed in a transaction block.
- B) The runtime automatically detects the unhandled exception and rolls back all SQL executions executed during that HTTP request.
- C) The Durable Object isolate self-terminates and restores from the previous day's snapshot.
- D) Account B is credited anyway due to out-of-order execution.
<details><summary>Answer</summary>

**A.** Individual SQL statements execute and commit immediately unless wrapped in a transaction using `this.ctx.storage.transactionSync(() => { ... })`. When the error is thrown, the first update has already committed, resulting in an inconsistent state.

- Why not B: Automatic rollback only occurs inside an explicit transaction block; bare `sql.exec` calls commit immediately.
- Why not C: The isolate does not restore from backups on application logic errors.
- Why not D: JavaScript executes sequentially on a single thread; the third line is never reached.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/api/sql-storage/

</details>

### Q-CF-030 · Distributed State · difficulty 3 · scenario

In a Durable Object method, a developer writes:
```typescript
const count = await this.ctx.storage.get("count");
await fetch("https://api.external.com/validate");
await this.ctx.storage.put("count", count + 1);
```
What subtle concurrency issue can occur here despite Durable Objects being single-threaded?
- A) The Durable Object crashes with an out-of-memory exception.
- B) While awaiting the external `fetch()`, the DO's input gate opens, allowing concurrent requests to interleave and execute, leading to race conditions on `count`.
- C) External `fetch()` calls are strictly forbidden inside Durable Objects.
- D) The V8 isolate freezes permanently due to a deadlocked lock manager.
<details><summary>Answer</summary>

**B.** Durable Object input gates serialize requests to guarantee consistency. However, when an actor awaits an external asynchronous operation (like `fetch` or non-storage promises), the input gate is unlocked to prevent deadlocks. During that await, other incoming requests can execute, modifying state before the original method resumes.

- Why not A: Awaiting external I/O does not cause memory leaks or OOM crashes.
- Why not C: Durable Objects can make outbound `fetch()` requests freely.
- Why not D: Input gates unlock specifically to prevent deadlocks during external I/O.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://blog.cloudflare.com/durable-objects-easy-fast-correct#input-gates

</details>

### Q-CF-031 · Distributed State · difficulty 2 · single

What capability does the WebSocket Hibernation API provide for Durable Objects?
- A) It compresses WebSocket text payloads into binary protobufs before transmission.
- B) It allows a Durable Object to sleep and evict its V8 isolate from memory while edge infrastructure maintains active client TCP/WebSocket connections.
- C) It reroutes WebSocket frames through UDP/QUIC streams automatically.
- D) It replicates WebSocket messages to an Apache Kafka cluster.
<details><summary>Answer</summary>

**B.** Without hibernation, a Durable Object handling 10,000 idle WebSocket connections must keep its V8 isolate active in memory, incurring continuous memory duration costs. WebSocket Hibernation serializes actor state and shuts down the isolate; edge infrastructure holds the open connections and wakes the actor only when a message arrives.

- Why not A: Frame compression is handled by standard WebSocket per-message deflate, not hibernation.
- Why not C: Hibernation is a serverless lifecycle optimization, not a Layer 4 protocol translation.
- Why not D: Kafka integration is completely unrelated to isolate hibernation.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/best-practices/websockets/#websocket-hibernation-api

</details>

### Q-CF-032 · Distributed State · difficulty 2 · scenario

A real-time gaming backend routes all global players to a single Durable Object named `"global-leaderboard"`. As traffic grows to 5,000 requests per second, players experience severe latency and timeouts. What is the cause and architectural fix?
- A) Cloudflare Anycast cannot route more than 1,000 requests per minute; provision additional custom domain names.
- B) A single Durable Object instance is CPU-bound on a single thread (~1,000 req/s capacity); shard traffic across multiple Durable Objects by region or bucket and aggregate asynchronously.
- C) SQLite storage is corrupted; restore from backup.
- D) The V8 garbage collector cannot manage more than 100 WebSocket connections simultaneously.
<details><summary>Answer</summary>

**B.** Because each Durable Object instance executes on a single thread in a single data center, funneling all global traffic through one instance creates a global serialization bottleneck. The solution is sharding state across multiple DOs (e.g., by room, tenant, or hash bucket) or using a tree hierarchy.

- Why not A: Cloudflare Anycast handles tens of millions of requests per second globally.
- Why not C: Slowdown under 5,000 req/s on a single actor is CPU queuing, not SQLite file corruption.
- Why not D: A hibernating Durable Object can manage thousands of WebSockets cleanly when properly architected.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/best-practices/scaling/

</details>

### Q-CF-033 · Distributed State · difficulty 2 · single

How do Durable Object Alarms function?
- A) They send SMS text alerts to developers when unhandled errors occur.
- B) They schedule a durable timer that wakes or instantiates the Durable Object at a designated future timestamp to run the `alarm()` handler.
- C) They sound an audible alert in Cloudflare's Network Operations Center.
- D) They trigger external webhooks to AWS SNS.
<details><summary>Answer</summary>

**B.** Durable Object Alarms (`this.ctx.storage.setAlarm(timestamp)`) schedule a guaranteed future wake-up call managed by Cloudflare infrastructure. Even if the DO is evicted from memory, the system instantiates it at the specified time and executes its `alarm()` method.

- Why not A: Alarms are program execution timers, not developer notification paging systems.
- Why not C: They are software runtime primitives, not physical datacenter alarms.
- Why not D: Alarms execute internal code within the DO isolate rather than publishing to third-party queues.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/api/alarms/

</details>

### Q-CF-034 · Distributed State · difficulty 2 · multi

Which criteria make Workers KV the superior architectural choice over Durable Objects? (Select TWO)
- A) Read-heavy workloads requiring sub-millisecond edge reads with infrequent, latency-tolerant writes.
- B) Workloads requiring atomic increment counters and distributed mutexes.
- C) Caching static configuration, feature flags, or redirects accessed globally millions of times per day.
- D) Real-time collaborative document editing with bidirectional WebSocket connections.
<details><summary>Answer</summary>

**A and C.** Workers KV is optimized for high-volume, read-heavy workloads where eventual consistency is acceptable and content must be served from the local edge cache instantly (such as user profiles, feature toggles, and redirects).

- Why not B: Atomic counters require strong consistency and atomic operations, which require Durable Objects.
- Why not D: Collaborative editing and WebSockets require coordinated stateful actors, which are built on Durable Objects.
- Ref: [modules/05-workers-kv-and-eventual-consistency.md](../modules/05-workers-kv-and-eventual-consistency.md), https://developers.cloudflare.com/workers/platform/storage-options/

</details>

### Q-CF-035 · Distributed State · difficulty 2 · single

What is the maximum size of an individual value that can be stored in Workers KV?
- A) 1 KB
- B) 25 MiB
- C) 500 MB
- D) 5 GB
<details><summary>Answer</summary>

**B.** Workers KV supports values up to 25 MiB per key (with key lengths up to 512 bytes and metadata up to 1024 bytes). For storing larger files or binary blobs, Cloudflare R2 is the appropriate storage solution.

- Why not A: 1 KB is too restrictive; KV supports rich payloads up to 25 MiB.
- Why not C: 500 MB exceeds KV's per-value limit and belongs in R2.
- Why not D: Multi-gigabyte objects must be stored in R2 object storage.
- Ref: [modules/05-workers-kv-and-eventual-consistency.md](../modules/05-workers-kv-and-eventual-consistency.md), https://developers.cloudflare.com/kv/platform/limits/

</details>

### Q-CF-036 · Distributed State · difficulty 3 · scenario

An engineering team wants to guarantee that a customer's Durable Object is provisioned and executed strictly within the European Union to satisfy GDPR compliance. What mechanism enforces this?
- A) Tagging the `wrangler.jsonc` file with `"region": "eu-central-1"`.
- B) Using Jurisdiction Restrictions when deriving the ID: `env.MY_DO.newUniqueId({ jurisdiction: "eu" })`.
- C) Blocking all client IP addresses originating outside Europe via WAF.
- D) Hosting the SQLite database on a private Raspberry Pi in Brussels.
<details><summary>Answer</summary>

**B.** Durable Objects support Jurisdictional Restrictions. By specifying `{ jurisdiction: "eu" }` when creating IDs or namespaces, Cloudflare guarantees that both the in-memory actor instance and all persisted storage never leave the European Union data centers.

- Why not A: Durable Objects do not use AWS-style region strings in top-level config.
- Why not C: Blocking non-EU client IPs does not restrict where the storage and actor are physically located inside Cloudflare's network.
- Why not D: Running private hardware undermines the serverless managed edge model.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/reference/data-location/

</details>

### Q-CF-037 · Distributed State · difficulty 1 · single

How does a Worker obtain a reference to invoke an RPC method on a Durable Object?
- A) By making a plaintext HTTP request to `http://localhost:8080/do`.
- B) By obtaining an `id` from the namespace binding (`env.MY_DO.idFromName("name")`), then getting the stub (`env.MY_DO.get(id)`).
- C) By importing the Durable Object class directly and instantiating it with `new MyDO()`.
- D) By querying Redis for the IP address of the container.
<details><summary>Answer</summary>

**B.** The Worker uses its capability binding to resolve or generate an ID (`idFromName`, `idFromString`, or `newUniqueId`), then calls `get(id)` to obtain a typed RPC stub. Methods called on this stub invoke the target actor directly across the edge network.

- Why not A: Durable Objects communicate over internal zero-trust RPC channels, not insecure localhost HTTP.
- Why not C: Instantiating with `new` runs a local class instance in the caller's isolate without global singleton routing or persistent storage.
- Why not D: Workers do not use Redis for actor discovery; routing is handled natively by `workerd` fabric.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/api/namespace/

</details>

### Q-CF-038 · Distributed State · difficulty 2 · single

What happens if a Durable Object class migration declaration in `wrangler.jsonc` is deleted or incorrectly renamed?
- A) Cloudflare automatically runs an AI model to recover lost schema definitions.
- B) Deleting or improperly modifying migration tags can cause permanent data loss by signaling to the control plane that the storage class has been decommissioned.
- C) The Worker silently falls back to in-memory non-persistent storage.
- D) The Cloudflare dashboard freezes all deployments across the entire account.
<details><summary>Answer</summary>

**B.** Durable Object migrations in `wrangler.jsonc` are declarative instructions to the Cloudflare storage subsystem. Deleting a class migration or renaming without an explicit migration transfer step informs the system that the storage is no longer needed, which can permanently delete underlying data.

- Why not A: Cloudflare does not use speculative AI to guess database schemas.
- Why not C: Durable Objects do not silently change persistence guarantees to volatile RAM.
- Why not D: Only the affected Worker's deployments are impacted, not the entire account.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/reference/migrations/

</details>

### Q-CF-039 · Distributed State · difficulty 3 · scenario

A real-time whiteboard application needs to notify 50 connected clients of a cursor movement. How should the Durable Object broadcast this message efficiently?
- A) Spawn 50 separate Worker subrequests to AWS SNS.
- B) Loop over active WebSocket connections stored in memory and call `ws.send(payload)` directly on the open sockets.
- C) Write the cursor coordinates to Workers KV and tell clients to poll every 50 ms.
- D) Trigger a Durable Object Alarm for each client.
<details><summary>Answer</summary>

**B.** Because the Durable Object holds the active WebSocket sessions (or resumes from hibernation upon event), broadcasting involves iterating over the internal set of active WebSocket instances and invoking `ws.send()`. This occurs in memory with single-digit millisecond latency.

- Why not A: External subrequests introduce massive latency, egress cost, and external dependencies.
- Why not C: Polling KV at 50 ms violates KV write/read guidance and creates massive eventual consistency lag.
- Why not D: Alarms are scheduled background execution timers, not real-time event emitters.
- Ref: [modules/06-durable-objects-and-actor-model.md](../modules/06-durable-objects-and-actor-model.md), https://developers.cloudflare.com/durable-objects/best-practices/websockets/

</details>

---

### Q-CF-040 · Relational Data & Storage · difficulty 1 · single

What underlying database engine powers Cloudflare D1?
- A) PostgreSQL
- B) MySQL
- C) SQLite
- D) MongoDB
<details><summary>Answer</summary>

**C.** Cloudflare D1 is a serverless, distributed relational database engine built on SQLite. It provides standard ANSI SQL query semantics, transactions, and foreign keys while distributing read replicas across Cloudflare's edge network.

- Why not A: PostgreSQL is an external relational engine (which Hyperdrive connects to), not the engine powering D1.
- Why not B: MySQL is not the storage engine of D1.
- Why not D: MongoDB is a document database, whereas D1 is a relational SQL engine.
- Ref: [modules/07-d1-sql-and-hyperdrive.md](../modules/07-d1-sql-and-hyperdrive.md), https://developers.cloudflare.com/d1/

</details>

### Q-CF-041 · Relational Data & Storage · difficulty 2 · scenario

A user submits a profile update to a Worker writing to D1. Immediately on the next page reload, the user's browser queries a read replica and sees the old profile. What D1 feature solves this read-your-writes replication lag?
- A) Increasing the DNS TTL on the customer domain.
- B) Using the Sessions API with bookmark tokens to ensure subsequent queries read from replicas that have applied the write.
- C) Running `env.DB.exec("PRAGMA synchronous = OFF")` on every request.
- D) Restarting the primary D1 master database node.
<details><summary>Answer</summary>

**B.** D1 uses a single-primary architecture for writes and distributes changes asynchronously to edge read replicas. The Sessions API allows a client session to pass a cryptographic bookmark token representing its last write; D1 ensures that queries within that session read from a replica that has caught up to that bookmark (or routes to primary).

- Why not A: DNS caching has no impact on database replication state within D1.
- Why not C: PRAGMA settings do not synchronize distributed read replicas across edge PoPs.
- Why not D: D1 is a managed serverless platform where users do not manually restart underlying database master nodes.
- Ref: [modules/07-d1-sql-and-hyperdrive.md](../modules/07-d1-sql-and-hyperdrive.md), https://developers.cloudflare.com/d1/learning/consistency/

</details>

### Q-CF-042 · Relational Data & Storage · difficulty 2 · single

What problem does Cloudflare Hyperdrive solve for edge applications?
- A) It provides high-speed GPU rendering for 3D video games in edge Workers.
- B) It maintains pooled, authenticated connections and caches queries to existing regional PostgreSQL/MySQL databases, eliminating TCP/TLS handshake latency from edge PoPs.
- C) It automates hard drive disk defragmentation on Linux origin servers.
- D) It automatically converts relational schemas into NoSQL JSON documents.
<details><summary>Answer</summary>

**B.** Connecting to a regional database (like AWS RDS or Supabase) from edge Workers requires negotiating TCP and TLS handshakes on every invocation across thousands of edge nodes, exhausting database connection limits. Hyperdrive pools established connections globally and caches read queries at the edge.

- Why not A: Hyperdrive is a database acceleration service, not a GPU rendering engine.
- Why not C: Hyperdrive is a network proxy service, not an OS disk defragmenter.
- Why not D: Hyperdrive passes standard SQL protocols through to target engines without schema mutation.
- Ref: [modules/07-d1-sql-and-hyperdrive.md](../modules/07-d1-sql-and-hyperdrive.md), https://developers.cloudflare.com/hyperdrive/

</details>

### Q-CF-043 · Relational Data & Storage · difficulty 1 · single

What is a defining economic differentiator of Cloudflare R2 object storage compared to Amazon S3?
- A) R2 charges no data egress bandwidth fees when downloading stored objects.
- B) R2 requires upfront multi-year capacity reservations.
- C) R2 is completely free for petabyte-scale storage.
- D) R2 charges double for API requests that write data.
<details><summary>Answer</summary>

**A.** Cloudflare R2 is built on an S3-compatible API model but eliminates data egress fees (\$0.00/GB). Customers pay only for the storage volume stored per month and standard Class A/B read/write API operations.

- Why not B: R2 is serverless pay-as-you-go without upfront capacity reservations.
- Why not C: Storage capacity in R2 is billed per GB-month (with a free tier of 10 GB/month); petabytes are not free.
- Why not D: R2 Class A write operations are competitively priced and do not carry punitive surcharges.
- Ref: [modules/08-r2-object-storage-and-s3-compatibility.md](../modules/08-r2-object-storage-and-s3-compatibility.md), https://developers.cloudflare.com/r2/pricing/

</details>

### Q-CF-044 · Relational Data & Storage · difficulty 2 · scenario

An application allows users to upload 2 GB video files directly to R2 from their browser without routing traffic through a Worker isolate. Which mechanism makes this possible?
- A) Opening anonymous public write permissions on the entire R2 bucket.
- B) Generating an S3-compatible Presigned URL in the Worker and returning it to the browser for direct `PUT` upload.
- C) Embedding Cloudflare account admin API tokens inside client-side JavaScript.
- D) Uploading the video as base64-encoded URL query parameters.
<details><summary>Answer</summary>

**B.** Presigned URLs provide temporary, cryptographically signed permission for a client to upload a specific object directly to R2 within an expiration window. This bypasses the Worker's memory and CPU limits and eliminates intermediate compute costs.

- Why not A: Granting public write access allows anyone on the internet to overwrite or fill the storage bucket with malicious data.
- Why not C: Exposing account admin tokens in browser code allows total compromise of the Cloudflare account.
- Why not D: URLs have strict length limits (around 2 KB to 8 KB) and cannot carry 2 GB video payloads.
- Ref: [modules/08-r2-object-storage-and-s3-compatibility.md](../modules/08-r2-object-storage-and-s3-compatibility.md), https://developers.cloudflare.com/r2/api/s3/presigned-urls/

</details>

### Q-CF-045 · Relational Data & Storage · difficulty 2 · single

What is the delivery guarantee provided by Cloudflare Queues?
- A) Exactly-once delivery with zero duplicate messages under all failure scenarios.
- B) At-least-once delivery, meaning consumers must be designed to handle potential duplicate messages idempotently.
- C) Best-effort delivery with unacknowledged messages dropped after 10 seconds.
- D) Strict FIFO ordering across all distributed consumer worker isolates worldwide.
<details><summary>Answer</summary>

**B.** Cloudflare Queues guarantees at-least-once delivery. If network interruptions or worker isolate crashes occur before an acknowledgment is recorded, the queue redelivers the message. Consumer logic must be idempotent to safely handle retries.

- Why not A: In distributed messaging, exactly-once delivery across network partitions is impossible without consumer idempotency.
- Why not C: Queues persist unacknowledged messages and retry them according to retry policies rather than dropping them.
- Why not D: High-throughput distributed queues do not guarantee strict global FIFO ordering across concurrent consumers.
- Ref: [modules/09-queues-and-durable-workflows.md](../modules/09-queues-and-durable-workflows.md), https://developers.cloudflare.com/queues/reference/delivery-guarantees/

</details>

### Q-CF-046 · Relational Data & Storage · difficulty 2 · scenario

A queue consumer Worker processes a batch of 50 messages. Message #12 throws an uncaught database error. By default, what happens to the batch if per-message acknowledgment is not implemented?
- A) Message #12 is dropped and the other 49 messages are deleted.
- B) The entire batch of 50 messages fails and is marked for redelivery, re-processing messages 1 through 11.
- C) The Worker permanently pauses all queue consumption across the account.
- D) The database automatically corrects the error.
<details><summary>Answer</summary>

**B.** If an unhandled exception escapes the `queue()` handler without individual message acknowledgments (`msg.ack()`), Cloudflare Queues considers the entire batch failed and schedules all 50 messages for redelivery. Explicitly calling `msg.ack()` on processed messages and `msg.retry()` on failed ones isolates failures.

- Why not A: Queues does not silently drop failed messages without retry attempts.
- Why not C: Other queue batches and isolates continue processing normally.
- Why not D: Application database constraint errors require application code fixes.
- Ref: [modules/09-queues-and-durable-workflows.md](../modules/09-queues-and-durable-workflows.md), https://developers.cloudflare.com/queues/configuration/batching-retries/

</details>

### Q-CF-047 · Relational Data & Storage · difficulty 3 · scenario

A developer writes a long-running multi-day business process using Cloudflare Workflows:
```typescript
const user = await step.do("fetch-user", async () => fetchUser(id));
const rand = Math.random();
await step.sleep("wait-for-approval", "3 days");
await step.do("send-result", async () => sendEmail(user, rand));
```
What fundamental workflow rule is violated regarding `rand`, and what is the consequence?
- A) Workflows cannot execute for more than 10 minutes.
- B) Non-deterministic values generated outside `step.do` re-evaluate on every replay, causing `rand` to change when the workflow resumes after sleep.
- C) `step.sleep` only accepts durations measured in milliseconds.
- D) Email sending is blocked by Cloudflare Workflows security filters.
<details><summary>Answer</summary>

**B.** Cloudflare Workflows execute durably by replaying code from the top upon resumption. Results of `step.do()` calls are memoized and returned without re-execution. However, code outside `step.do` runs on every replay; generating non-deterministic values like `Math.random()`, UUIDs, or timestamps outside a step produces new, inconsistent values upon resume.

- Why not A: Workflows are durable state machines that can sleep and execute over days or weeks.
- Why not C: `step.sleep` accepts human-readable string durations such as `"3 days"` or `"1 hour"`.
- Why not D: Network requests inside `step.do` execute standard HTTP calls without special email filtering.
- Ref: [modules/09-queues-and-durable-workflows.md](../modules/09-queues-and-durable-workflows.md), https://developers.cloudflare.com/workflows/build/determinism/

</details>

### Q-CF-048 · Relational Data & Storage · difficulty 2 · single

What underlying technology powers the durable persistence and state management of Cloudflare Workflows?
- A) Redis Enterprise clusters
- B) Durable Objects
- C) AWS DynamoDB Streams
- D) Cloudflare Workers KV
<details><summary>Answer</summary>

**B.** Cloudflare Workflows are built on top of Durable Objects. Each workflow instance is backed by a Durable Object actor that manages the execution state machine, step memoization, and scheduled wake-up alarms.

- Why not A: Cloudflare does not rely on third-party Redis clusters for core infrastructure.
- Why not C: Cloudflare Workflows run natively on Cloudflare's edge rather than AWS services.
- Why not D: Workers KV is eventually consistent and cannot provide the strong consistency needed for durable step execution.
- Ref: [modules/09-queues-and-durable-workflows.md](../modules/09-queues-and-durable-workflows.md), https://developers.cloudflare.com/workflows/

</details>

### Q-CF-049 · Relational Data & Storage · difficulty 1 · single

What feature allows D1 databases to be restored to any historical point in time within the retention window?
- A) D1 Flashback
- B) D1 Time Travel
- C) D1 Snapshot Revert
- D) D1 Undo Log
<details><summary>Answer</summary>

**B.** D1 Time Travel provides point-in-time recovery, allowing developers to inspect or restore a D1 database to any specific minute within the 30-day retention window using bookmark or timestamp references.

- Why not A: "Flashback" is Oracle database terminology.
- Why not C: "Snapshot Revert" is generic virtualization terminology.
- Why not D: "Undo Log" is an internal MySQL InnoDB data structure.
- Ref: [modules/07-d1-sql-and-hyperdrive.md](../modules/07-d1-sql-and-hyperdrive.md), https://developers.cloudflare.com/d1/learning/time-travel/

</details>

### Q-CF-050 · Relational Data & Storage · difficulty 2 · scenario

A company processes incoming order invoices through an R2 bucket. They want a Worker to automatically run whenever a new PDF object is uploaded. What is the most decoupled, fault-tolerant pattern?
- A) Have clients invoke the Worker directly before uploading to R2.
- B) Configure R2 Event Notifications to publish `object-create` events directly to a Cloudflare Queue consumed by the processing Worker.
- C) Run a Cron Trigger every 1 second to poll `env.BUCKET.list()` for new files.
- D) Write an infinite `while(true)` loop inside a Worker isolate.
<details><summary>Answer</summary>

**B.** R2 Event Notifications emit lifecycle events (such as object creation and deletion) directly to Cloudflare Queues. The consumer Worker processes events asynchronously with automatic batching, concurrency scaling, and retries.

- Why not A: Direct client invocation fails if the client crashes or disconnects between upload and API call.
- Why not C: Polling `list()` every second is expensive, misses changes between polls, and scales poorly.
- Why not D: Infinite loops in Workers terminate immediately when CPU time limits are reached.
- Ref: [modules/08-r2-object-storage-and-s3-compatibility.md](../modules/08-r2-object-storage-and-s3-compatibility.md), https://developers.cloudflare.com/r2/buckets/event-notifications/

</details>

### Q-CF-051 · Relational Data & Storage · difficulty 2 · multi

Which requirements must be met when executing a multipart upload in Cloudflare R2? (Select TWO)
- A) Each part uploaded must be at least 5 MiB (except for the final part).
- B) Part numbers in the completion manifest must be listed in strictly ascending numerical order.
- C) All parts must be uploaded from the exact same client IP address.
- D) The entire multipart upload must complete within 60 seconds.
<details><summary>Answer</summary>

**A and B.** Conforming to S3 API standards, R2 requires parts in a multipart upload to be at least 5 MiB (5,242,880 bytes), except the final chunk. When calling `completeMultipartUpload`, parts must be listed in ascending order by `partNumber` along with their corresponding ETags.

- Why not C: Parts can be uploaded concurrently from multiple different clients or edge workers.
- Why not D: Multipart uploads can remain open for days (subject to bucket lifecycle rules).
- Ref: [modules/08-r2-object-storage-and-s3-compatibility.md](../modules/08-r2-object-storage-and-s3-compatibility.md), https://developers.cloudflare.com/r2/api/s3/api/#multipart-upload

</details>

### Q-CF-052 · Relational Data & Storage · difficulty 1 · single

How does D1 handle multi-statement transactional atomicity across batch SQL queries?
- A) Multi-statement transactions are strictly unsupported in D1.
- B) By passing an array of prepared statements to `db.batch([stmt1, stmt2])`, which executes atomically in a single network round-trip.
- C) By manually typing `BEGIN TRANSACTION` and keeping the HTTP connection open across multiple requests.
- D) By acquiring a distributed Zookeeper lock.
<details><summary>Answer</summary>

**B.** D1 provides `db.batch()`, which sends multiple SQL statements in a single network request. The underlying SQLite engine executes them sequentially within a transaction; if any statement fails, the entire batch rolls back.

- Why not A: D1 fully supports transactional batches via `db.batch()`.
- Why not C: HTTP request boundaries cannot hold open SQLite transactions across network round-trips.
- Why not D: D1 does not use Apache Zookeeper.
- Ref: [modules/07-d1-sql-and-hyperdrive.md](../modules/07-d1-sql-and-hyperdrive.md), https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#batch-statements

</details>

---

### Q-CF-053 · Service Composition & Security · difficulty 1 · single

What performance and networking advantage do Service Bindings provide when one Worker calls another?
- A) Requests route over the public internet with mTLS encryption.
- B) Invocations execute in-process via direct memory capability calls with zero network serialization overhead and zero HTTP round-trip latency.
- C) Requests bypass all Cloudflare access control policies.
- D) The caller Worker borrows the callee Worker's CPU quota.
<details><summary>Answer</summary>

**B.** Service Bindings connect two Workers directly within the `workerd` runtime. Calls invoke the target Worker's entrypoint directly via memory-level capability bindings, bypassing public DNS, IP routing, TLS negotiation, and HTTP serialization.

- Why not A: Routing over public IP/DNS adds 20-50 ms of avoidable latency; Service Bindings run directly in `workerd`.
- Why not C: Capability bindings are strictly governed by explicit configuration in `wrangler.jsonc`.
- Why not D: Each Worker executes in its own isolate with its own discrete resource accounting.
- Ref: [modules/10-service-bindings-and-composition.md](../modules/10-service-bindings-and-composition.md), https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/

</details>

### Q-CF-054 · Service Composition & Security · difficulty 2 · scenario

An organization exposes an internal microservice using Cloudflare Tunnel (`cloudflared`). How does `cloudflared` establish connectivity to Cloudflare's edge?
- A) It opens inbound TCP ports 80 and 443 on the company's edge perimeter firewall.
- B) It establishes outbound-only encrypted QUIC or HTTP/2 tunnels to nearby Cloudflare edge PoPs, requiring zero inbound open firewall ports.
- C) It provisions an IPSec VPN gateway on the host machine.
- D) It modifies the origin machine's BIOS firmware to broadcast BGP routes.
<details><summary>Answer</summary>

**B.** `cloudflared` runs as a lightweight daemon inside the private network. It initiates outbound connections to Cloudflare PoPs over port 7844 (QUIC) or 443 (HTTP/2). Incoming traffic routed to that hostname flows down this established tunnel, eliminating the need to expose public IP addresses or open inbound firewall ports.

- Why not A: Eliminating open inbound firewall ports is the primary security value proposition of Cloudflare Tunnel.
- Why not C: Cloudflare Tunnel operates as a lightweight user-space daemon, not an IPSec tunnel.
- Why not D: BIOS modifications are impossible and unnecessary.
- Ref: [modules/11-security-and-zero-trust.md](../modules/11-security-and-zero-trust.md), https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/

</details>

### Q-CF-055 · Service Composition & Security · difficulty 2 · scenario

An edge Worker sits behind Cloudflare Access to protect an internal administrative API. How should the Worker cryptographically verify that the request passed Cloudflare Access authentication?
- A) Check for the presence of a cookie named `"user_logged_in=true"`.
- B) Inspect and cryptographically validate the `Cf-Access-Jwt-Assertion` header using the public keys published at the team's `https://<team>.cloudflareaccess.com/certs` endpoint.
- C) Ping the client's laptop over ICMP.
- D) Trust any request whose client IP matches a Cloudflare Anycast range.
<details><summary>Answer</summary>

**B.** Cloudflare Access attaches an identity JWT in the `Cf-Access-Jwt-Assertion` request header. Applications and Workers verify this token's cryptographic signature against Cloudflare Access public signing keys (JWKS), asserting user identity, email, and session validity.

- Why not A: Plaintext cookies can be forged easily by attackers.
- Why not C: ICMP ping cannot verify identity or cryptographic authenticity.
- Why not D: Anycast IP validation only confirms traffic came through Cloudflare; it does not prove the user logged in via Access.
- Ref: [modules/11-security-and-zero-trust.md](../modules/11-security-and-zero-trust.md), https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

</details>

### Q-CF-056 · Service Composition & Security · difficulty 1 · single

What modern, privacy-preserving CAPTCHA replacement does Cloudflare provide to protect Workers from automated scrapers and bots?
- A) Google reCAPTCHA v2 (identifying traffic lights)
- B) Cloudflare Turnstile
- C) SMS One-Time Passcode challenge
- D) Biometric retinal scan
<details><summary>Answer</summary>

**B.** Cloudflare Turnstile is a non-interactive, privacy-first bot detection service. It evaluates browser environment signals and cryptographic proofs-of-work without forcing users to solve interactive puzzle challenges.

- Why not A: reCAPTCHA v2 requires interactive image labeling and collects extensive cross-site tracking data.
- Why not C: SMS OTP is an authentication factor, not an automated bot challenge.
- Why not D: Web browsers do not expose retinal scan hardware APIs to websites.
- Ref: [modules/11-security-and-zero-trust.md](../modules/11-security-and-zero-trust.md), https://developers.cloudflare.com/turnstile/

</details>

### Q-CF-057 · Service Composition & Security · difficulty 2 · single

What is the role of a Tail Worker in a microservice architecture?
- A) It processes trailing slash URL redirects.
- B) It is a Worker that receives structured telemetry, console logs, and unhandled exception data produced by another Worker after its execution finishes.
- C) It compresses responses before returning them to client devices.
- D) It enforces Layer 3 firewall packet filtering.
<details><summary>Answer</summary>

**B.** Tail Workers are attached to producer Workers. When the primary Worker completes request execution, Cloudflare dispatches an event containing execution timestamps, console logs, and error traces to the Tail Worker, which can filter or stream telemetry to external monitoring platforms.

- Why not A: URL normalization is handled by URL rewriting rules.
- Why not C: HTTP response compression is handled automatically by edge proxy gzip/Brotli modules.
- Why not D: Layer 3 packet filtering is handled by Magic Transit and edge firewalls.
- Ref: [modules/10-service-bindings-and-composition.md](../modules/10-service-bindings-and-composition.md), https://developers.cloudflare.com/workers/observability/tail-workers/

</details>

### Q-CF-058 · Service Composition & Security · difficulty 3 · scenario

A SaaS provider allows its enterprise customers to upload custom JavaScript code to run on their subdomains. Which Cloudflare Workers platform architecture is specifically designed for this multi-tenant programmatic execution?
- A) Cloudflare Workers for Platforms (Dispatch Namespaces)
- B) Cloudflare Pages Functions
- C) Hardcoded `eval()` execution inside a shared global Worker
- D) Docker containers running on AWS Fargate
<details><summary>Answer</summary>

**A.** Workers for Platforms provides Dispatch Namespaces. SaaS providers can programmatically create, deploy, and execute thousands of tenant-uploaded Workers dynamically, managing tenant routing and resource quotas without deploying separate Cloudflare services manually.

- Why not B: Pages Functions are designed for static site full-stack applications, not dynamic multi-tenant customer code hosting.
- Why not C: Running untrusted tenant code through `eval()` inside a shared Worker isolate creates massive security vulnerabilities and cross-tenant memory leakage.
- Why not D: Third-party containers on AWS defeat the latency and operational advantages of Cloudflare's edge platform.
- Ref: [modules/10-service-bindings-and-composition.md](../modules/10-service-bindings-and-composition.md), https://developers.cloudflare.com/cloudflare-for-platforms/workers-for-platforms/

</details>

### Q-CF-059 · Service Composition & Security · difficulty 2 · single

How does RPC invocation via `WorkerEntrypoint` differ from standard `fetch()` handlers in Service Bindings?
- A) It requires wrapping all parameters in XML SOAP envelopes.
- B) It allows direct invocation of named TypeScript methods with native JavaScript argument passing, eliminating HTTP Request/Response wrapping and serialization.
- C) It is limited strictly to integer payloads.
- D) It routes through an external WebSocket gateway.
<details><summary>Answer</summary>

**B.** `WorkerEntrypoint` enables direct RPC across Service Bindings. Instead of constructing synthetic `Request` objects and parsing JSON `Response` objects, developers invoke methods directly (e.g., `await env.AUTH.validateToken(token)`), which `workerd` executes via structured cloning in memory.

- Why not A: SOAP XML is a legacy web service protocol completely absent from modern Workers RPC.
- Why not C: Structured cloning supports objects, arrays, buffers, strings, numbers, and errors.
- Why not D: Service Bindings execute in-process or via local IPC without WebSocket proxies.
- Ref: [modules/10-service-bindings-and-composition.md](../modules/10-service-bindings-and-composition.md), https://developers.cloudflare.com/workers/runtime-apis/rpc/

</details>

---

### Q-CF-060 · Observability & Economics · difficulty 2 · single

What is the hard ceiling on maximum script bundle size for an individual Worker deployed to Cloudflare?
- A) 500 KB
- B) 64 MiB uncompressed (`workerd` bundled limit; 10 MB compressed for upload)
- C) 500 MB
- D) 2 GB
<details><summary>Answer</summary>

**B.** Cloudflare Workers allows scripts up to 64 MiB uncompressed (with a maximum compressed gzipped upload size of 10 MB on paid plans, or 1 MB on free plans). Keeping bundles well under these limits ensures rapid isolate instantiation and low cold-start latency.

- Why not A: 500 KB is too small for modern bundled TypeScript applications with complex dependencies.
- Why not C: 500 MB exceeds the maximum allowable script bundle size by an order of magnitude.
- Why not D: 2 GB belongs in R2 storage, not in an executable V8 isolate bundle.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/workers/platform/limits/

</details>

### Q-CF-061 · Observability & Economics · difficulty 2 · scenario

An engineering team migrates a full-stack Next.js project from legacy Cloudflare Pages to modern Workers. Which migration change is necessary in `wrangler.jsonc`?
- A) Replace `pages_build_output_dir` with the modern `assets` configuration pointing to the static build directory.
- B) Re-architect the application into C++ WebAssembly.
- C) Change all client HTTP traffic from port 443 to port 8080.
- D) Purchase an enterprise Cloudflare hardware appliance.
<details><summary>Answer</summary>

**A.** Cloudflare Pages has unified under Cloudflare Workers. Modern static and full-stack deployments use Workers with Static Assets, replacing the legacy `pages_build_output_dir` property with `"assets": { "directory": "./dist" }` in `wrangler.jsonc`.

- Why not B: Next.js and full-stack frameworks compile to JavaScript/TypeScript and do not need C++ WebAssembly rewrites.
- Why not C: Production edge traffic continues to terminate on standard ports 80 and 443.
- Why not D: Cloudflare Workers is entirely cloud-native; no hardware purchases are required.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/

</details>

### Q-CF-062 · Observability & Economics · difficulty 2 · single

How does Cloudflare Logpush deliver edge telemetry data to customer SIEM platforms (such as Datadog, Splunk, or AWS S3)?
- A) Workers write logs to local edge hard drives, which engineers must retrieve via SSH.
- B) Cloudflare control planes stream batches of high-volume structured JSON logs directly to the configured cloud storage or SIEM endpoint in near real-time.
- C) Logpush requires customers to install an on-premise proxy daemon on every edge server.
- D) Telemetry is sent via DNS TXT records.
<details><summary>Answer</summary>

**B.** Cloudflare Logpush is a fully managed pipeline that streams batched, structured JSON log events directly from edge data centers to destination endpoints (AWS S3, Datadog, BigQuery, Snowflake, etc.) within seconds, handling high throughput without impacting Worker execution performance.

- Why not A: Workers do not have local hard drives or SSH access.
- Why not C: Logpush is a managed cloud-to-cloud integration requiring no customer daemons on Cloudflare servers.
- Why not D: DNS TXT records cannot handle the massive volume of high-throughput application logs.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/logs/about-logpush/

</details>

### Q-CF-063 · Observability & Economics · difficulty 1 · single

What subrequest concurrency limit applies to a single incoming request on the Workers Standard Paid plan?
- A) Maximum 5 subrequests.
- B) Up to 1,000 subrequests per request invocation.
- C) Exactly 1 subrequest.
- D) Unlimited subrequests with no throttling.
<details><summary>Answer</summary>

**B.** On the standard Workers Paid plan, a single request invocation can issue up to 1,000 subrequests (such as `fetch()`, KV reads, or D1 queries), up from the 50 subrequest limit on the Free tier.

- Why not A: 5 subrequests is far below the platform limit.
- Why not C: Workers commonly issue multiple parallel or sequential subrequests during request processing.
- Why not D: Limits are necessary to prevent uncontrolled recursive fan-out attacks or accidental infinite loops.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/workers/platform/limits/#subrequests

</details>

### Q-CF-064 · Observability & Economics · difficulty 2 · scenario

A developer uses Zod schema validation inside a Worker. After upgrading dependencies, memory usage increases noticeably and occasionally fails on edge memory limits. What version of Zod is recommended by Cloudflare's platform engineering team for isolate efficiency?
- A) Zod 1.0
- B) Zod 4.5.0 or higher, which optimizes memory footprint and avoids heavy prototype allocation patterns.
- C) Zod is strictly banned by the V8 isolate compiler.
- D) Any version, because schema validation has zero memory cost.
<details><summary>Answer</summary>

**B.** Cloudflare's official Workers limits documentation specifically recommends Zod version 4.5.0 or later because earlier versions generated extensive in-memory schema metadata and prototype trees that consumed excessive memory in 128 MB V8 isolates.

- Why not A: Zod 1.0 is legacy and inefficient.
- Why not C: Zod is widely used in TypeScript Workers; it is not banned by the compiler.
- Why not D: Schema compilation and recursive object validation allocate heap memory, which matters in a 128 MB isolate budget.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/workers/platform/limits/

</details>

### Q-CF-065 · Observability & Economics · difficulty 3 · scenario

An architect must select storage backends for three application components:
1. Low-latency user session tokens accessed globally with high read volume.
2. Real-time collaborative document editing requiring strict consistency and atomic state synchronization.
3. 50 MB invoice PDF storage downloaded by clients. Which mapping represents the correct Cloudflare architectural choice?
- A) 1: D1 SQL, 2: Workers KV, 3: Durable Objects
- B) 1: Workers KV, 2: Durable Objects, 3: R2 Object Storage
- C) 1: R2 Object Storage, 2: D1 SQL, 3: Workers KV
- D) 1: Durable Objects, 2: R2 Object Storage, 3: Hyperdrive
<details><summary>Answer</summary>

**B.** Workers KV is optimized for globally distributed, read-heavy session validation; Durable Objects provide the single-threaded actor isolation and atomic SQLite transactions required for collaborative editing; R2 Object Storage is the zero-egress S3-compatible storage designed for multi-megabyte binary documents.

- Why not A: Storing large binary PDFs in Durable Objects exhausts memory limits, and KV cannot coordinate collaborative editing.
- Why not C: R2 is inefficient for small token lookups, and KV cannot store 50 MB PDFs (max value 25 MiB).
- Why not D: Hyperdrive is a connection pooler for external relational databases, not a document storage system.
- Ref: [modules/12-observability-limits-and-cost.md](../modules/12-observability-limits-and-cost.md), https://developers.cloudflare.com/workers/platform/storage-options/

</details>

---

## Mock Examination (Timed 60-Minute Assessment)

The following 30-question diagnostic exam simulates the Senior Edge Infrastructure & Distributed Systems Interview Loop.

### Mock Exam Question Allocation

- **Domain 1: Edge Runtime & Lifecycle**: Q-CF-001, Q-CF-002, Q-CF-003, Q-CF-004, Q-CF-007, Q-CF-010
- **Domain 2: Caching Topologies & CDN**: Q-CF-014, Q-CF-015, Q-CF-016, Q-CF-017, Q-CF-019
- **Domain 3: Distributed State & Actor Models**: Q-CF-024, Q-CF-025, Q-CF-026, Q-CF-028, Q-CF-029, Q-CF-030, Q-CF-031, Q-CF-032
- **Domain 4: Relational Data, Storage & Workflows**: Q-CF-040, Q-CF-041, Q-CF-042, Q-CF-043, Q-CF-044, Q-CF-047
- **Domain 5: Service Composition & Security**: Q-CF-053, Q-CF-054, Q-CF-055
- **Domain 6: Observability, Limits & Economics**: Q-CF-060, Q-CF-065

### Scoring Rubric & Grading Standard

- **Total Score**: 30 Points (1 point per question)
- **Passing Threshold**: 24 / 30 (80%)
- **Score Breakdown**:
  - `28 - 30 Points`: **Staff Edge Architect / Principal Systems Specialist** — Comprehensive mastery of V8 isolate boundaries, actor concurrency, distributed storage consistency, and edge security architectures.
  - `24 - 27 Points`: **Senior Edge Systems Engineer (Pass)** — Solid operational grasp of `workerd` runtime mechanics, Durable Object transactions, KV caching dynamics, and production troubleshooting.
  - `20 - 23 Points`: **Developing Edge Practitioner (Needs Targeted Study)** — Gaps in concurrency race conditions (input gates), eventual consistency negative caching, or memory isolate ceilings.
  - `< 20 Points`: **Unprepared** — Review all 12 modules and re-run simulation test suites in `examples/`.

### Mock Examination Answer Key

| Question # | Target Objective | Correct Option | Primary Architectural Reference |
| --- | --- | --- | --- |
| 1 | Q-CF-001 · Edge Ingress | B | Module 01 · BGP Anycast Routing |
| 2 | Q-CF-002 · Execution Context | C | Module 01 · `ctx.waitUntil()` Contract |
| 3 | Q-CF-003 · V8 Isolate Architecture | B, C | Module 02 · Isolate Sandboxing |
| 4 | Q-CF-004 · Memory Quotas | B | Module 02 · 128 MB Heap Ceilings |
| 5 | Q-CF-007 · Runtime Compatibility | B | Module 03 · Compatibility Dates |
| 6 | Q-CF-010 · Fault Tolerance | B | Module 01 · `ctx.passThroughOnException()` |
| 7 | Q-CF-014 · Cache API Scope | B | Module 04 · Per-Colo Cache API |
| 8 | Q-CF-015 · Header Precedence | C | Module 04 · `CDN-Cache-Control` |
| 9 | Q-CF-016 · CDN Topology | B | Module 04 · Tiered Cache Aggregation |
| 10 | Q-CF-017 · Invalidation Semantics | A | Module 04 · Cache API vs Zone Cache |
| 11 | Q-CF-019 · Security Invariants | B | Module 04 · Authorization Cache Bypass |
| 12 | Q-CF-024 · KV Consistency | C | Module 05 · Eventual Consistency |
| 13 | Q-CF-025 · Anti-Patterns | B | Module 05 · Lost Updates on Counters |
| 14 | Q-CF-026 · Negative Lookups | B | Module 05 · Negative Cache TTL |
| 15 | Q-CF-028 · Actor Model | B | Module 06 · Global Actor Uniqueness |
| 16 | Q-CF-029 · SQLite Transactions | A | Module 06 · Transaction Atomicity |
| 17 | Q-CF-030 · Concurrency Gates | B | Module 06 · Input Gate Interleaving |
| 18 | Q-CF-031 · WebSocket Lifecycle | B | Module 06 · Hibernation API |
| 19 | Q-CF-032 · High-Throughput Sharding | B | Module 06 · Single-Threaded Limits |
| 20 | Q-CF-040 · Relational Architecture | C | Module 07 · Serverless SQLite |
| 21 | Q-CF-041 · Sequential Consistency | B | Module 07 · Sessions API Bookmarks |
| 22 | Q-CF-042 · Connection Pooling | B | Module 07 · Hyperdrive Acceleration |
| 23 | Q-CF-043 · Object Storage Economics | A | Module 08 · Zero Egress Pricing |
| 24 | Q-CF-044 · Presigned Offloading | B | Module 08 · S3 Presigned URLs |
| 25 | Q-CF-047 · Durable Execution | B | Module 09 · Replay Determinism |
| 26 | Q-CF-053 · Service Composition | B | Module 10 · Zero-Latency RPC |
| 27 | Q-CF-054 · Zero Trust Tunnel | B | Module 11 · Outbound-Only Tunnels |
| 28 | Q-CF-055 · Identity Assertion | B | Module 11 · `Cf-Access-Jwt-Assertion` |
| 29 | Q-CF-060 · Script Size Limits | B | Module 12 · 64 MiB Script Budgets |
| 30 | Q-CF-065 · Storage Selection | B | Module 12 · Storage Selection Matrix |
