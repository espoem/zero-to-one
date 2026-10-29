# Review: solidjs

## Hand-off (primary: Opus · 2026-10-29 · branch `track/solidjs`)

All work tests against the **real published packages**; the old shim (`examples/utils/solid2-runtime.ts`) and the old `node --conditions=browser` scripts are gone.

Pinned (exact): `solid-js`, `@solidjs/signals`, `@solidjs/web`, `@solidjs/compiler` 2.0.0-rc.19 · `@solidjs/vite-plugin` 3.0.0-next.52 · `@solidjs/testing-library` 1.0.0-rc.2 · Vite 8.3.5 · Vitest 5.0.5 · jsdom 30.1.3 · TypeScript 7.0.2 · `@types/node` 26.6.6 · `solid-js-1` = alias of `solid-js@1.9.17` (Module 10 comparison only). `.mise.toml`: node 26.

Harness: `vitest.config.ts` with two projects via `@solidjs/vite-plugin` — `client` (jsdom, dev build, diagnostics live) and `server` (node, SSR build, `*.server.test.tsx`). `examples/typescript/support/diagnostics.ts` wraps the real `OBSERVE.diagnostics.capture()` plus hand-settled deferreds (no timers).

Module by module (module + suite each, one commit each):
- **M01 reactive core** — formal graph model, push-pull pseudocode, glitch freedom (diamond test), commits/`flush(fn)`, lazy/writable memos, ownership/unwind order, owned-write invariant. 23 tests.
- **M02 effects & lifecycle** — split effects, render vs user effects (the old "render lane/user lane" wording was wrong: in 2.0 "lane" = optimistic overlay), error arm, `createReaction`, `createTrackedEffect` (`@deprecated` in rc.19), `onSettled`/`onCleanup`/`onFlush`, diagnostics table. 23 tests.
- **M03 components/props/DOM** — real `@solidjs/compiler` output (template + grouped effect + getter props), props rules, `merge` undefined, attributes/class/style, removed namespaces as compile errors, delegation, handler binds once, bound tuples, refs before attach, two-phase directives, form inputs incl. `UNCOMMITTED_INPUT_OVERWRITTEN`. 22 tests.
- **M04 control flow** — `<For>` three modes with row-identity proofs, keyed-map pseudocode, `<Repeat>`, `<Show>`/`<Switch>`, `dynamic()` (`<Dynamic>` deprecated per RFC 03), `children()`, `Portal`, context (`ContextNotFoundError`). 18 tests.
- **M05 stores** — draft setters, shallow return form, `storePath` (exported by `@solidjs/signals`, not re-exported by `solid-js`), `reconcile`, O(1) selection projection (1000 rows → 2 re-runs), `snapshot`/`deep`, shallow stores, negatives. 16 tests.
- **M06 colorless async** — async memos, `NotReadyError`, `UNTRACKED_READ_AFTER_AWAIT`, streams/`from`, `<Loading>` holds and `on`, `LOADING_ON_OUTSIDE_HOLD`, `isPending` vs `.loading`, `latest`, `createDeferred`, `loadingValue`, cancellation (positive + negative), `<Errored>` reset/self-heal, `<Reveal>`. 19 tests.
- **M07 actions & optimistic** — transaction/overlay model, generator actions, optimistic store/signal, revert on failure, `affects`, `until` (authoritative view, `TimeoutError`), out-of-order concurrency, `ACTION_CALLED_IN_OWNED_SCOPE`. 10 tests.
- **M08 SSR/start/server functions** — start mode (with `@solidjs/start@2.1.0` = Solid 1.9 warning), `renderToString`/`renderToStream` streaming proof, proven cross-request leak vs request-event isolation, real client transport → real `handleServerFunctionRequest` (codec, JSON args by default, CSRF 403, 405, `markSafeError`, redirect). 13 tests (server project).
- **M09 testing/debugging/perf** — Vitest postures, test patterns, build variants proved by spawning Node with each export-condition set, attribution (`EFFECT_RELAY_TEAR`, `subscriptions`), performance tracks, RC version-pin guard. 10 tests.
- **M10 migration & React comparison** — migration map/procedure, version history from npm dates, ecosystem peer-range table, React 19 vs Solid 2 (written once here); Solid 1.9.17 vs 2.0 executed side by side. 7 tests.
- **exams/** — README (no certification; interview-format fallback; coverage matrix D1–D7, no ❌), `interview.md` 60 questions (12/9/6/12/9/6/6), hands-on tasks mapped to tests, 25-question mock + scoring key.
- **GLOSSARY.md, CHEATSHEET.md, README.md** rewritten (README: syllabus, run instructions, Certifications & Exams, "Verified against … on 2026-10-28"; rc.8 references removed).
- TypeScript M13 runtime content absorbed into M01–M08 (tuple handlers verified via `BoundEventHandler`; `on:` claims there are now compile errors in 2.0 — see Proposals).

Test status (Node 26.12.1): `npm test` → **Test Files 10 passed (10), Tests 161 passed (161)**; `npm run typecheck` → clean. Relative-link check over all track markdown: 0 broken. Path/secret scan: clean.

## Remaining work (ordered)

1. **Depth**: modules are 186–358 lines (dense, long lines) versus the 400–900 rule of thumb. Extend M07, M09, M10 first (more worked examples, a frontend system-design case study for optimistic real-time sync, a full React execution-trace walkthrough).
2. **`mise.lock`**: hand-written node 26.12.1 entry without platform checksums (no mise binary here). Run `mise lock` on a machine with mise and commit.
3. **Router**: `@solidjs/router@2.0.0-next.43` is not covered by tests; add a routing section/suite once its API stabilises (and `setup` hook usage in start mode).
4. **Start-mode end-to-end**: `vite build` + `vite preview` (+ Playwright) as `test:integration`, skipping cleanly when browsers are unavailable.
5. **Hydration round-trip test**: SSR HTML (hydratable codegen) → `hydrate()` in jsdom; the client project is non-hydratable by plugin design, so this needs a dedicated config.
6. Optional CI job against `solid-js@next` (allowed to fail).
7. Update `.agents/STATUS.md` (not edited by the author per the kickoff boundaries) to 🟨.

## Least-certain claims (for the challenger)

- `onFlush` callbacks are not run by an explicit `flush()`; they run with the scheduled microtask flush (observed in rc.19, undocumented).
- `reconcile` keeps identity only for **observed** rows; an unobserved proxy grabbed earlier was not `===` after reconcile in a probe (M05 §3). Contradicts a literal reading of RFC 04 "preserving identity".
- `FLUSH_IN_EFFECT_CALLBACK` is a warning (no-op) in rc.19, while the `onSettled` JSDoc says "dev throws" for flush in forbidden scopes.
- In the `until` test, a read of the live store inside the action right after `until` resolved did not yet show the echoed row; the test asserts only the hold/release behaviour.
- Node resolved `--conditions=browser` to `dist/solid.js` although `node` precedes `browser` in the printed `exports` map (observed; M09 table is observational).
- 1.x version-history notes for 1.1–1.8 are dates only (feature notes marked unverified).
- Dossier said 34 betas April–August; npm shows `2.0.0-beta.0` on 2026-03-03 through `beta.33` on 2026-08-11 (M10 uses npm dates).
- Ecosystem table (Kobalte alpha pins rc.16 exactly; `@ark-ui/solid@6.0.0-next.0` still peers `>=1.6.0`) is a 2026-10-28 snapshot.
- Re-verify list resolved: v2.solidjs.com exists and covers the RC (no GA date); TC39 Signals at Stage 1 (README still says "effectively Stage 0" in places); server-function entry signature `handleServerFunctionRequest(request, options?)` verified and exercised; "render lane vs user lane" not Solid terminology (fixed).

## Proposals for integrator

- **Root glossary**: add *Glitch freedom* (konzistence bez glitchů), *Fine-grained reactivity* (jemnozrnná reaktivita), *Optimistic update* (optimistická aktualizace), *Export condition* (exportní podmínka), *Request isolation* (izolace požadavků) — cross-cutting with react/nodejs.
- **Ownership**: register "Solid build variants / export-condition test postures" under `technologies/solidjs` (cross-link from nodejs for condition resolution); "frontend optimistic UI patterns" could be shared with react (React owns `useOptimistic`, Solid owns overlays).
- **TypeScript track handover**: TS M13 13.5.4 teaches `on:click` native events — a compile error in Solid 2.0; 13.5.5 teaches `<Dynamic>` as primary — deprecated per RFC 03 (use `dynamic()`); 13.1.3 claims `flush()` from module scope after writes; fine. 13.6.3 imports `handleServerFunctionRequest` from `@solidjs/web` — correct path is `@solidjs/web/server-functions/server`. Replace 13.6.4 pointer ("7-Module", rc.8) with a link to this README.
- **React track**: link its comparison sections to `technologies/solidjs/modules/10-migration-and-react-comparison.md#4-react-19-vs-solid-2-the-mental-models`.
- **AGENTS.md conflict noted**: AGENTS prescribes `node --test` for TypeScript; this track uses Vitest because JSX compilation and the client/server postures require `@solidjs/vite-plugin` (brief's executable-proof strategy). Per AGENTS precedence this is recorded here for the integrator's decision.
