# Review: react · author Opus (primary) · branch track/react

## Hand-off (in progress — updated after every module commit)

**Status:** modules 01–04 rewritten at full depth with real-API Vitest proofs. Modules 05–12, exams, glossary, cheatsheet and README not yet done.

| Module | State | Proof file | Tests |
|---|---|---|---|
| 01 Elements, JSX & render model | done | `examples/01-elements/elements.test.tsx` | 20 |
| 02 Fiber reconciler & commit | done | `examples/02-fiber/fiber.test.tsx`, `keyed-diff.ts` (fast-check vs real DOM placements) | 20 |
| 03 State, hooks & closures | done (renamed from `03-hooks-closure-contracts.md`) | `examples/03-state/state.test.tsx`, `fetch-machine.ts` | 25 |
| 04 Effects & synchronization | done (renamed from `04-effects-and-ref-cleanup.md`) | `examples/04-effects/effects.test.tsx` | 22 |
| 05–12 | old ~70-line text (04–10) or missing (11, 12); their old synthetic examples were deleted in b5fd650 | — | — |

**Tooling:** Node 26.12.1 (local), Vitest 5.0.5 + jsdom 30.1.3, RTL 16.3.3, react/react-dom/react-server-dom-webpack 19.3.1, @types/react 19.3.0, babel-plugin-react-compiler 1.0.0 with @babel/core 8.0.9 (works), eslint 10.13.0 + eslint-plugin-react-hooks 7.1.1, fast-check 4.10.2, vite 8.3.5, TypeScript 7.0.2. `npm test` = `vitest run`; `npm run typecheck` = `tsc --noEmit`. Last run: 87/87 passing, typecheck clean.

## Remaining work (ordered)
2. M05 Concurrency (lane model checked against `getHighestPriorityLanes` extracted from the shipped react-dom build: 19.3 returns each transition lane individually = untangled transitions; `scheduler/unstable_mock` ships in scheduler@0.28.0; `<Activity>`; untangled-transition test).
3. M06 Suspense/SSR (use(promise) caching, renderToPipeableStream, prerender+resume, hydration mismatch via onRecoverableError, `browser()` + `onBrowserBailout`, useId `_r_`).
4. M07 RSC/Flight: feasible without a bundler — spawn `node --conditions react-server` child with NODE_ENV=production (dev rows leak absolute file paths), decode with `react-server-dom-webpack/client.node` `createFromNodeStream(stream, {moduleMap:{}, serverModuleMap:null, moduleLoading:null})`. CVE section + version-gate test.
5. M08 Actions; M09 Compiler (babel transform fixtures, eslint Linter runs); M10 Errors; M11 DOM platform (new); M12 Perf/testing/ops (new).
6. exams/README.md + exams/interview.md (≥60 Q, mock exam), GLOSSARY.md, CHEATSHEET.md, README (syllabus, Certifications & Exams, Verified-against line).
7. `mise.lock`: not generated (no mise binary; nodejs.org checksums unreachable). Run `mise lock` on the Mac CLI.
8. Playwright browser checks (ViewTransition, Fragment `observeUsing`) not added: no browsers here. Verifier (Antigravity) task.

## Least-certain claims (for the challenger)
- Brief gotcha #14 ("useLayoutEffect on the server warns") is outdated: 19.3.1 prints nothing (tested in M04). M04 says the warning existed in ≤18.
- M04: React 18 "discrete-input renders flush passive effects synchronously at end of commit" — from React 18 notes, not tested directly.
- M02: lane-agnostic bailout condition paraphrased from `beginWork`; work-tag numbers taken from 19.3.1 build behaviour (tested for 0, 3, 5, 7).
- M03: "React 19 dims the second Strict Mode log" (from React 19 release notes, not re-fetched); rebase table in §3.3 is derived from the algorithm, not from a test.
- M01: `javascript:` URL blocking stated "React 19" (behaviour tested on 19.3.1; the version where blocking began was not re-verified).
- RSC CVE fixed-version floor: 19.0.1/19.1.2/19.2.1 (RCE), 19.0.4/19.1.5/19.2.4 (DoS/source exposure + CVE-2026-23864), CVE-2026-23869 fixed versions inferred from affected ranges (≤19.2.4 → 19.2.5), CVE-2026-23870 fixed in 19.0.6/19.1.7/19.2.6 (GitLab advisory).

## Proposals for integrator
- Root glossary candidates: Tearing, Double buffering, Left-child/right-sibling tree, Tree edit distance.
- Cross-links point at `languages/javascript/README.md`, `languages/css/README.md` (not yet on main) and `languages/typescript/modules/12-react-19-and-modern-react-typescript.md` (will likely be renamed by the TS restructure — fix links at merge).
- Re-verify item resolved: there is no `technologies/web-platform` track. Proposed owners: HTTP caching/streaming → `architecture/networking`; CSP/Trusted Types → `architecture/security-identity` (register in OWNERSHIP.md).
- Upstream repo moved to `github.com/react/react` (package.json `repository` field in 19.3.1).
