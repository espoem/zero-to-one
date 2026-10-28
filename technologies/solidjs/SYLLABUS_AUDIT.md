# SolidJS 2.0 — Syllabus Depth Audit

Audit of `technologies/solidjs/` against the repository Topic Module Standard (formal definitions, multi-tier progression, executable proofs, established terminology). Verified at commit time against `solid-js@2.0.0-rc.18`, `@solidjs/signals@2.0.0-rc.18`, `@solidjs/web@2.0.0-rc.18`. All 13 test suites in `examples/` pass (`npm test`).

## Verdict

The track's **API surface, migration guidance, and runnable proof coverage are excellent** (7 modules, ~2,400 lines, 13 green test suites, `tsc --noEmit` clean). It under-delivers on exactly one axis: the **formal theory of the reactive graph**. Module 01 teaches *how to use* push-pull signals but never lays out the *push-pull algorithm* — the dependency graph is invoked as an opaque noun ("reactive graph", "push-pull graph") and never formalized as a directed acyclic graph (DAG) with node taxonomy, edge semantics, dirty marking, topological evaluation order, or glitch freedom.

## Coverage Matrix — Critical Academic Principles

| Principle | Where | Status |
| :--- | :--- | :--- |
| Push-pull reactivity | `GLOSSARY.md` §1, `modules/01` §1 | **Partial** — the intuition ("producers push, subscribers pull") is stated, but the formal model (source node / memo node / effect node; edge = subscription; push = invalidate; pull = re-evaluate) is absent |
| Deterministic microtask batching | `modules/01` §2 (17× microtask, 77× flush) | **Excellent** |
| Synchronous vs microtask timing | `modules/01` §2 + §5 anti-pattern table | **Excellent** — stale-read semantics, `flush()`, `flush(fn)`, render/user lanes |
| Glitch freedom | — | **Missing** (0 mentions) |
| Topological ordering | — | **Missing** (0 mentions) |
| Graph dirty marking | 1 incidental "dirty-checking" aside (`modules/01` §3, `createReaction`) | **Missing** — no stale/clean/dirty node state machine, no invalidation-mark propagation |
| Diamond problem | — | **Missing** (0 mentions) |
| DAG formalization | "graph" 15× as opaque noun | **Missing** — 3 node/vertex/edge hits total, none structural |
| Memo caching invariant | implied throughout, never stated | **Missing** — "recompute iff a dependency is dirty; else return cached value" never written |
| Reentrancy / diamond-with-effects | 1 disposal-ordering note (`modules/04` §? ) | **Thin** |
| Hydration boundary | 6 passing mentions (`modules/01` §3, `modules/06` §1/§235) | **Thin** — no dedicated treatment |
| Context isolation | `modules/02` §4, `modules/06` §235, `GLOSSARY.md` §2 | **Adequate** — providerless context, `ContextNotFoundError`, per-request SSR isolation, server-components-cannot-inherit-client-providers, owner-context loss across suspension (`modules/04`) all present |

## Gap Analysis

### G1 — Glitch freedom, topological ordering, dirty marking, diamond problem (formal graph theory)

This is the single largest gap against the repository standard's "academic grounding / formal definitions" requirement. The four concepts are one connected story and should be taught together:

1. **DAG formalization.** The reactive graph is a directed acyclic graph whose vertices are *source nodes* (signals), *computation nodes* (memos), and *effect nodes*. An edge `a → b` means `b` subscribed to `a`. A write to a source *pushes* invalidation marks along outgoing edges only; it does not push values and does not re-evaluate anything.

2. **Dirty marking.** Each node carries a state: `clean` (cached value valid), `stale/dirty` (an upstream changed; cached value suspect), or (for async) `pending`. A signal write walks the fan-out and marks dependents dirty without recomputing. This is the algorithmic core that distinguishes `@solidjs/signals` from a naive "notify + re-run now" model.

3. **Topological ordering / glitch freedom.** When a downstream effect pulls, memos re-evaluate in topological order of the DAG (a memo only recomputes after all its dependencies are clean). This ordering is precisely what delivers **glitch freedom**: no observer ever sees a value derived from an inconsistent mix of old and new inputs.

4. **Diamond problem.** The canonical example: `A` feeds both `B` and `C`, and `D = f(B, C)`. A naive push model (notify-and-rerun on every push) recomputes `D` twice — once when `B` updates and once when `C` updates — and, if an effect observes mid-way, it glitches on `f(B_new, C_old)`. A push-pull model marks `B`, `C`, `D` dirty on the push, then recomputes `B`, `C`, `D` exactly once in dependency order when `D` is pulled.

**Recommended action:** add a "Reactive Graph Theory" section to `modules/01` (or a new `modules/01b`), with a runnable example that *proves* glitch freedom by instrumenting memo evaluation counts and asserting `D` recomputes exactly once across a diamond write.

### G2 — Hydration boundary (thin, not formalized)

Hydration is mentioned in passing (deferred user lane during hydration; `<Portal>` is client-only; server-components can't inherit client providers) but never defined as a first-class concept. Missing: the definition of hydration (attaching a reactive runtime to server-rendered DOM without re-rendering), the notion of a **hydration boundary** (where server HTML ends and client-owned reactivity begins), the divergence/mismatch failure mode, and the contrast with resumability (Qwik). This is the one gotcha in the prompt's list that lacks a dedicated section.

**Recommended action:** add a "Hydration & Hydration Boundaries" section covering: SSR HTML → `hydrate()` → signal-graph attachment; render-lane precedence during hydration; `<Loading>` boundaries held during hydration; mismatch handling; `installServerComponents()` ordering (`modules/06` §235 already flags this).

### G3 — Memoization invariant and reentrancy (implied only)

"Lazy memo" teardown/restart is covered, but the base memoization contract ("recompute iff ≥1 dependency is dirty; otherwise serve cached value") and the reentrant-update subtlety (a memo read during its own dependency's evaluation, or a diamond where a downstream effect writes upstream) are never stated.

## Terminology — Glossary Additions (English ↔ Czech)

The current `GLOSSARY.md` maps the API surface well but omits every reactive-graph-theory term. Additions follow the established-nomenclature rule: canonical English term, established Czech equivalent where one exists, descriptive Czech gloss otherwise (frontier terms are **retained in English** — the rule forbids neologisms).

| English Term | Czech Term | Notes |
| :--- | :--- | :--- |
| **Dependency Graph / Reactive Graph** | **Graf závislostí (reaktivní graf)** | Standard graph terminology |
| **Directed Acyclic Graph (DAG)** | **Orientovaný acyklický graf (DAG)** | Established graph theory |
| **Source Node / Computation Node / Effect Node** | **Zdrojový uzel / výpočetní uzel / efektový uzel** | Node taxonomy; "uzel" = vertex |
| **Dirty Marking** | **Označování za zneplatněné (dirty marking)** | "dirty" = zneplatněný/špinavý; cache & reactive literature |
| **Clean / Stale (dirty) node state** | **Stav uzlu: čistý / zastaralý (zneplatněný)** | State machine |
| **Invalidation** | **Zneplatnění (invalidace)** | Established |
| **Topological Ordering** | **Topologické uspořádání (topologické řazení)** | CLRS Czech also uses "topologické třídění" |
| **Glitch** | **Zákmitek (glitch)** | Established in digital-circuit/signal design; applied by analogy |
| **Glitch Freedom** | **Absence zákmitů (glitch freedom)** | Frontier term — retain English; descriptive Czech gloss |
| **Diamond Problem** | **Diamantový problém** | Established in reactivity literature |
| **Memoization** | **Memoizace** | Established CS |
| **Subscriber / Subscription** | **Odběratel / odběr (subscription)** | Observer-pattern terminology |
| **Hydration** | **Hydratace** | Established in SSR discourse |
| **Hydration Boundary** | **Hranice hydratace** | Frontier term; descriptive |
| **Resumability** | **Obnovitelnost (resumability)** | Qwik term; retain English |
| **Push (invalidate) / Pull (re-evaluate)** | **Push (zneplatnění) / Pull (přepočet)** | Retain English verbs; Czech gloss |
