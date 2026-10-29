# Review: solidjs

## Hand-off (primary: Opus, in progress)

Branch `track/solidjs`. All tests run against the real published packages (no shim):
`solid-js` / `@solidjs/signals` / `@solidjs/web` / `@solidjs/compiler` 2.0.0-rc.19,
`@solidjs/vite-plugin` 3.0.0-next.52, `@solidjs/testing-library` 1.0.0-rc.2, Vite 8.3.5,
Vitest 5.0.5, jsdom 30.1.3, TypeScript 7.0.2, Node 26.12.1.

Done so far (module by module):
- Harness: Vitest projects `client` (jsdom, dev build, diagnostics live) and `server` (node, SSR build) via `@solidjs/vite-plugin`; old `examples/utils/solid2-runtime.ts` shim deleted.
- M01 reactive core, M02 effects/lifecycle/diagnostics, M03 components/props/DOM, M04 control flow/composition: modules + suites.
- M05 stores: suite committed; module text in progress.

## Remaining work
See the ordered list at the end of this file (kept current).

## Least-certain claims
- `onFlush` callbacks are not run by an explicit `flush()` in rc.19 (observed, undocumented).
- Store row identity after `reconcile` is only guaranteed for observed rows (unobserved proxies were not identical in a probe).

## Proposals for integrator
- (pending)
