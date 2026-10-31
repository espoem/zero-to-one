🍄💬: Audit of `technologies/react` — 4 blocking issues (1 factual error contradicted by the pinned build, 2 broken/untrue harness claims, 1 diagram-rule violation set), plus 6 medium. Everything else in the track holds up, including versions and the lane model.

**What I could execute:** read/grep/find/ls only. No shell was available in this session, so `tools/mermaid-check`, `tools/table-check`, `npm test` and `npm run typecheck` were **not** run; the diagram findings below are static rule-checking against `tools/mermaid-check/README.md`, and factual claims were checked against the installed `react@19.3.1` / `react-dom@19.3.1` bundles in `technologies/react/node_modules`.

## P0 — wrong technical fact, and the track certifies it as source-verified

**1. `<Activity>` fiber tag is stale: 22 (Offscreen) → 31 (ActivityComponent).**

- `modules/02-fiber-reconciler-and-commit.md:49` — "`OffscreenComponent` 22 (backs `<Activity>` and Suspense content)"; also `:455` "Offscreen → `<Activity>`".
- `modules/05-concurrency-lanes-transitions.md:192` — "(stable since **19.2**, internally the `Offscreen` fiber, tag 22)".

Evidence from the pinned build, `node_modules/react-dom/cjs/react-dom-client.development.js`:

```js
case 31: return updateActivityComponent(current, workInProgress, renderLanes);   // L12629
case 22: return updateOffscreenComponent(current, workInProgress, renderLanes, …); // L12631
function getActivityInstanceFromFiber(fiber) { if (31 === fiber.tag) { … } }       // L144
```

So in 19.3.1: `ActivityComponent` = **31**, `OffscreenComponent` = **22** (Suspense offscreen content / legacy). Fix all three spots, and add a real-fiber assertion for Activity in `examples/02-fiber/fiber.test.tsx` next to "pointers and work tags of a real fiber", so the prose cannot drift again. `interview.md` and `CHEATSHEET.md` do not repeat the error, so the blast radius is 2 modules.

## P1 — claims a reader/CI will act on and be misled by

**2. `test:integration` points at a file that does not exist, and the README denies the script exists.**

- `package.json:13` — `"test:integration": "node scripts/integration.mjs"`; there is no `scripts/` directory in the track.
- `README.md:51` — "There is no `test:integration` script yet (no Docker or browser is needed by the current suites)."

Either delete the script (README is then true) or add `scripts/integration.mjs` that skips cleanly with a clear message, per AGENTS.md §Topic Depth 3. Right now `npm run test:integration` fails with `MODULE_NOT_FOUND`, which is the exact failure mode the standard forbids.

**3. `README.md:3` — "runs against the **real** React packages (no simulations)" is not true.**

Real React packages: yes. No simulations: no —
- `examples/11-dom-platform/fake-view-transitions.ts` is an explicit stand-in for `document.startViewTransition`;
- `examples/05-concurrency/concurrency.test.tsx` uses `scheduler/unstable_mock` (the module says so at §2);
- `examples/07-rsc/` hand-registers client references and fakes `__webpack_require__`.

Reword to something like "real React packages; browser APIs, the scheduler clock and the bundler transport are stubbed and labelled as such". This matters because Module 11 §6 already concedes the jsdom limit — the README contradicts it.

**4. Mermaid rule violations in sequence diagrams (AGENTS.md §Topic Depth 4 + `tools/mermaid-check/README.md`).**

- `modules/02-fiber-reconciler-and-commit.md:313` — `participant WL as Work loop (render)`
- `modules/02-fiber-reconciler-and-commit.md:317` — `participant P as Passive (later task)`
- `modules/08-actions-forms-and-optimistic-ui.md:32` — `participant A as Action (async)`
- `modules/02-fiber-reconciler-and-commit.md:320` — `BM->>M: ` (empty message text, trailing space)

The tool's own guidance is "quote any text containing `()`, `[]`, `{}`, `&`, `|`, `#` or `:`" — participant aliases are the one construct in this track that ignores it. Run `cd tools/mermaid-check && mise exec -- node check.mjs ../../technologies/react` and either quote the aliases (`participant WL as "Work loop (render)"`) or drop the parentheses; give the Mutation arrow a label (`BM->>M: flush mutation`). While you're there: no `;` appears inside any sequence text, so the `#59;` rule is otherwise respected.

## P2 — consistency and honesty of the surrounding text

**5. Syllabus titles do not match module H1s** (`README.md:15-30` vs `modules/*.md:1`). Seven are case-only differences; five differ in substance:

| README | Module H1 |
|---|---|
| 02 Fiber reconciler & commit | The Fiber Reconciler & the Commit Phase |
| 05 Concurrency: lanes, transitions & Activity | Concurrency: Lanes, Transitions, Deferred Values & `<Activity>` |
| 07 Server Components & Flight | Server Components & the Flight Protocol |
| 11 Animation & DOM platform | Animation & DOM Platform Integration |
| 12 Performance, testing & production | Performance, Testing, Upgrades & Production Operations |

AGENTS.md does not mandate literal equality, but a syllabus table is a navigation index; pick one canonical title per module and use it in both places.

**6. There is no `## Out of Scope` heading.** The content exists twice — `README.md:32` as a bold inline paragraph and `exams/README.md` "Out of scope (with reason)" (the anchor `#out-of-scope-with-reason` resolves, so the link works). AGENTS.md §Syllabus Completeness requires the topics "explicitly listed as out of scope", which is satisfied in substance; a real heading in the README would make it discoverable and consistent with how the other tracks are scanned.

**7. Diagram ordering risk in the two cross-boundary flows** (AGENTS.md §Topic Depth 4, "constrain layout so engines cannot permute or invert elements"):

- `modules/07-server-components-and-flight.md:21` — `flowchart LR` whose only cycle closes back into the Server subgraph (`RD -. "call Server Function…" .-> SR`). A cycle spanning both subgraphs is exactly what dagre's acyclic pass may reverse, which can place the Client subgraph left of the Server one, inverting the intended server → wire → client order.
- `modules/06-suspense-streaming-ssr-and-hydration.md:19` — `flowchart TD` with `W --> R` (retry loop back to the top node).

Confirm the rendered order visually after the check passes; if it inverted, split the return path into a separate subgraph, or use `flowchart RL` / invisible links (`~~~`) to pin the reading order.

**8. `(unverified)` is used once, but several inferred claims are missing the token.** `modules/07-server-components-and-flight.md:235-241`:

- `CVE-2026-23869 … 19.0.5 / 19.1.6 / 19.2.5 (inferred from affected ranges)` — the honest hedge is there, but AGENTS.md §Version Currency 4 prescribes the literal `(unverified)` marker;
- `CVE-2026-23870 | 2026-05` and `CVE-2026-44907 | 2026-07` — month-only dates, numerically the weakest rows in the table;
- `CVE-2025-67779 | 2025-12-11/12` — split date.

The one compliant marker is at `:240` ("*(unverified whether they contain security fixes)*"). Apply the same token to the three rows above, or resolve them against OSV/GitLab advisory pages and add the advisory IDs.

**9. `README.md:39` — "all 12 example suites".** There are 13 test files in 12 directories (`08-actions/` ships `actions.test.tsx` + `hung-action.test.tsx`). Say "all 13 suites" or "one suite per module".

**10. Heading convention is repo-wide inconsistent, not React-specific.** React uses the bare `## Prerequisites` / `## Syllabus` / `## Certifications & Exams` shape, identical to `languages/javascript`, `languages/typescript`, `technologies/solidjs`, `technologies/panda-css`; `architecture/*`, `algorithms/dsa` and `languages/python` use `## 1. Syllabus & Curriculum Structure` / `## 2. Certifications & Exams`. AGENTS.md mandates neither, so this is a normalisation decision for the primary, not a React defect — record the decision once rather than letting each track keep drifting.

## P3 — nits and watch items

- **11. Dates without links.** `modules/12-performance-testing-and-production.md:190-191` states 19.3 = 2026-09-09, 19.3.1 = 2026-10-14 and the React Foundation move = 2026-02-24; the table footer says "Dates of the 19.x releases are from the npm registry" but gives no URL/`time` field reference, and the Foundation move has no link. Add the two links (npm `time`, LF announcement) so a re-verifier can re-check in one hop.
- **12. Private-internals coupling.** `examples/_shared/internals.ts` is documented and pinned, but the tag constants live only in prose (`internals.ts` would be the right home for `ACTIVITY_TAG = 31`, `OFFSCREEN_TAG = 22` so P0-#1 cannot recur silently).
- **13. Verification date duplication.** `README.md:5` and `exams/README.md:3` each carry "2026-10-29"; a stale copy will eventually disagree. One line, one owner.
- **14. Cheatsheet/module wording nits** ("`<Activity hidden>`" at `CHEATSHEET.md:65` while the API is `mode="hidden"`) — cheap to fix during the P0 edit.

## Verified sound (no action)

- **Versions:** every number in `README.md:5` matches the installed artifacts and lockfiles — react/react-dom/react-server-dom-webpack 19.3.1, scheduler 0.28.0, `@types/react(-dom)` 19.3.0, `babel-plugin-react-compiler` 1.0.0, vitest 5.0.5, jsdom 30.1.3, TypeScript 7.0.2, node 26.12.1 (`mise.lock:6-7`, `package-lock.json`). No fabricated versions; `mise.lock` is committed and `[settings] lockfile = true` is set.
- **Lane model (`modules/05:37-49`) is bit-exact against the shipped build:** `lanes & 42` for blocking lanes, ten transition lanes each rendered alone (`lanes & -lanes`), `lanes & 3932160` for 18–21, `lanes & 62914560` for retries, `535870912`/`67108864` as listed. The 19.3 "untangled transitions" claim is consistent with that switch.
- **Public API claims exist in 19.3.1:** `Activity`, `ViewTransition`, `cacheSignal`, `useEffectEvent` (`react/cjs/react.development.js`), `browser()` (`react-dom.development.js:126`), `FragmentInstance` and `display: none !important` hiding (`hideInstance`, L24077).
- **Exams:** `exams/interview.md` has 65 questions, per-domain counts (8/11/9/6/8/5/8/5/5) match the coverage matrix exactly, question headers match the AGENTS.md template, mock interview + scoring key + coverage summary present; `exams/README.md` has the no-official-certification statement, format/duration fields, exam delta, and no ❌ rows.
- **Depth:** all 12 modules carry an Interview Drill with `<details>` answers (9 questions in M01); 40+ `NEGATIVE:` tests across the suite, including the unforgiving ones (tearing, index keys, forged elements, IDOR, hung action, compiler blind spot); formal definitions, `Then vs now` blocks in M01/M02/M03/M05/M07/M08/M12, and a version-history table in M12.
- **Tables:** static scan found no unescaped pipe inside cells or code spans; math uses `\mid` and `\mathbin{\&}` correctly (`modules/05:23-24`), which is what the escaping rule demands.
