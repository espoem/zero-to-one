# Review: react · author Opus (primary) · branch track/react

## Hand-off (in progress — updated after every module commit)

**Status:** modules 01–10 rewritten at full depth with real-API Vitest proofs. Modules 11–12, exams, glossary, cheatsheet and README not yet done.

| Module | State | Proof file | Tests |
|---|---|---|---|
| 01 Elements, JSX & render model | done | `examples/01-elements/elements.test.tsx` | 20 |
| 02 Fiber reconciler & commit | done | `examples/02-fiber/fiber.test.tsx`, `keyed-diff.ts` (fast-check vs real DOM placements) | 20 |
| 03 State, hooks & closures | done (renamed from `03-hooks-closure-contracts.md`) | `examples/03-state/state.test.tsx`, `fetch-machine.ts` | 25 |
| 04 Effects & synchronization | done (renamed from `04-effects-and-ref-cleanup.md`) | `examples/04-effects/effects.test.tsx` | 22 |
| 05 Concurrency: lanes, transitions | done (renamed from `05-concurrent-lanes-and-transitions.md`) | `examples/05-concurrency/concurrency.test.tsx`, `lane-model.ts` (property test vs function extracted from installed react-dom build) | 17 |
| 06 Suspense, streaming SSR & hydration | done (renamed from `06-suspense-and-streaming-ssr.md`) | `examples/06-suspense-ssr/suspense-ssr.test.tsx`, `_shared/ssr.ts` | 20 |
| 07 Server Components & Flight | done (renamed from `07-rsc-and-flight-protocol.md`) | `examples/07-rsc/rsc.test.tsx` + `server.ts` (child process, `--conditions react-server`, NODE_ENV=production) | 13 |
| 08 Actions, forms & optimistic UI | done (renamed from `08-actions-and-optimistic-updates.md`) | `examples/08-actions/actions.test.tsx`, `hung-action.test.tsx` | 16 |
| 09 React Compiler 1.0 | done (renamed from `09-compiler-memoization-lowering.md`) | `examples/09-compiler/compiler.test.tsx`, `compile.ts` (real babel plugin + eslint Linter; compiled modules written to gitignored `.generated/`) | 17 |
| 10 Errors & resilience | done (renamed from `10-error-boundaries-and-resilience.md`) | `examples/10-errors/errors.test.tsx` | 14 |
| 11–12 | old ~70-line text (04–10) or missing (11, 12); their old synthetic examples were deleted in b5fd650 | — | — |

**Tooling:** Node 26.12.1 (local), Vitest 5.0.5 + jsdom 30.1.3, RTL 16.3.3, react/react-dom/react-server-dom-webpack 19.3.1, @types/react 19.3.0, babel-plugin-react-compiler 1.0.0 with @babel/core 8.0.9 (works), eslint 10.13.0 + eslint-plugin-react-hooks 7.1.1, fast-check 4.10.2, vite 8.3.5, TypeScript 7.0.2. `npm test` = `vitest run`; `npm run typecheck` = `tsc --noEmit`. Last run: 183/183 passing, typecheck clean.

## Remaining work (ordered)
5. M11 DOM platform (new); M12 Perf/testing/ops (new).
6. exams/README.md + exams/interview.md (≥60 Q, mock exam), GLOSSARY.md, CHEATSHEET.md, README (syllabus, Certifications & Exams, Verified-against line).
7. `mise.lock`: not generated (no mise binary; nodejs.org checksums unreachable). Run `mise lock` on the Mac CLI.
8. Playwright browser checks (ViewTransition, Fragment `observeUsing`) not added: no browsers here. Verifier (Antigravity) task.

## Least-certain claims (for the challenger)
- M09: pipeline description (HIR → SSA → effect inference → reactive scopes) is from public compiler talks/source structure, not re-verified pass by pass; tooling support list (Vite/Next ≥15.3.1/Expo 54/Rsbuild, SWC experimental) is from the 1.0 blog post. "Memo ✨" DevTools badge not re-verified.
- M09: finding — compiler 1.0 + lint preset do NOT flag `props.items.push(1)` (tested); a reviewer may want to check whether `immutability` catches other forms.
- M08: "a never-settling async action holds back every later transition" observed on 19.3.1 under act() in jsdom (`hung-action.test.tsx`); not verified in a real browser scheduler.
- M06: the 19.3 conditional-`use` warning only fires when React retries the same fiber (observed: root-level suspend, not inside a Suspense boundary). Module text says so. Production-mode SSR error output (digest only, no data-msg) is stated, not tested (tests run the DEV build).
- M06: useId history (`:r:` 18–19.0, `«r»` 19.1, `_r_` 19.2) from the 19.2 blog; server prefix `_R_` observed on 19.3.1.
- M05: lane names for bits 18–21 (TransitionDeferredLanes) and 22–25 (RetryLanes) inferred from `requestDeferredLane` and the Performance-track labels in the 19.3.1 build; the 19.2 `getHighestPriorityLanes` difference was checked by hand against a downloaded react-dom@19.2.9 tarball (not in tests). Untangled behaviour is tested only on 19.3.1.
- M05: `GestureLane` described as experimental API (not re-verified).
- Brief gotcha #14 ("useLayoutEffect on the server warns") is outdated: 19.3.1 prints nothing (tested in M04). M04 says the warning existed in ≤18.
- M04: React 18 "discrete-input renders flush passive effects synchronously at end of commit" — from React 18 notes, not tested directly.
- M02: lane-agnostic bailout condition paraphrased from `beginWork`; work-tag numbers taken from 19.3.1 build behaviour (tested for 0, 3, 5, 7).
- M03: "React 19 dims the second Strict Mode log" (from React 19 release notes, not re-fetched); rebase table in §3.3 is derived from the algorithm, not from a test.
- M01: `javascript:` URL blocking stated "React 19" (behaviour tested on 19.3.1; the version where blocking began was not re-verified).
- RSC CVE table (M07 §7.2): CVE-2026-23869 fixed versions inferred from affected ranges; CVE-2026-44907 (GHSA-wx67-qw84-cm4g) fixed 19.0.8/19.1.9/19.2.8 per corgea/releasealert, not the React blog; whether the 2026-10-14 releases are security releases is unknown. Gate test uses floors 19.0.8/19.1.9/19.2.8, any 19.3.
- Old note — RSC CVE fixed-version floor: 19.0.1/19.1.2/19.2.1 (RCE), 19.0.4/19.1.5/19.2.4 (DoS/source exposure + CVE-2026-23864), CVE-2026-23869 fixed versions inferred from affected ranges (≤19.2.4 → 19.2.5), CVE-2026-23870 fixed in 19.0.6/19.1.7/19.2.6 (GitLab advisory).

## Proposals for integrator
- Root glossary candidates: Tearing, Double buffering, Left-child/right-sibling tree, Tree edit distance.
- Cross-links also point at `technologies/nodejs/README.md` and `architecture/networking/README.md` (planned tracks).
- Cross-links point at `languages/javascript/README.md`, `languages/css/README.md` (not yet on main) and `languages/typescript/modules/12-react-19-and-modern-react-typescript.md` (will likely be renamed by the TS restructure — fix links at merge).
- Re-verify item resolved: there is no `technologies/web-platform` track. Proposed owners: HTTP caching/streaming → `architecture/networking`; CSP/Trusted Types → `architecture/security-identity` (register in OWNERSHIP.md).
- Upstream repo moved to `github.com/react/react` (package.json `repository` field in 19.3.1).
