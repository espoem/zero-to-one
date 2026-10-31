# Drafter/Auditor Audit: languages/typescript
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `languages/typescript`
Date: 2026-10-31

---

## What holds up

- **Version/toolchain consistency is real, not asserted**: `README.md:5` names TS 7.0.2, Node 26.12.1, Zod 4.6.7, `@types/react` 19.3.0, `@solidjs/web` 2.0.0-rc.19, `@types/node` 26.6.6, expect-type 1.4.0, attw 0.18.5, publint 0.3.25. Every one of those is what `package-lock.json` pins (lines 36/158/174/191/750/951/1159/1279) and `mise.lock:8` pins node 26.12.1, matching `.mise.toml`.
- **Two high-risk TS 7 claims are corroborated by the installed artifact**: `node_modules/typescript/package.json` has `"exports": { ".": "./lib/version.cjs" }` plus `./unstable/sync|async|fs|proto|ast|ast/is|ast/factory|…`, exactly as `modules/01-toolchain-and-compiler-model.md:258-262` claims. `node_modules/zod/v4/core/schemas.d.ts:543` uses `T[k]["_zod"]["input"]`, matching `modules/11-runtime-boundaries-validation.md:44`.
- **Interview Drills**: all 13 modules end with `## Interview Drill`, question counts 6–8 except M11 (10) — inside the 5–10 rule — every answer in `<details><summary>`.
- **Exam bank**: 70 questions verified by ID enumeration (`M-001…M-035`, `S-001…S-035`), hands-on H-001/H-002 each backed by runnable tests (`examples/exams/h001-build-path.test.ts`, `h002-typed-emitter.test.ts`), mock exam = 40 questions + 2 challenges/135 min with a scoring key.
- **Hygiene**: no personal absolute paths or credentials.

---

## P0 — blocks the merge gate

| # | Finding | Evidence |
|---|---|---|
| 1 | **`@typescript/native` is taught as an installable alias but is unverified, and contradicts this repo's own research dossier**, which names the native preview package `@typescript/native-preview` (nightlies as `typescript@next`). No lockfile entry, no fixture, no test. | `modules/01:281`, `01:298`, `01:403`, `modules/13:289`, `CHEATSHEET.md:15`, `exams/certificates-dev-typescript.md:873` |
| 2 | **`README.md:5` claims verification against `@typescript/typescript6` 6.0.2, but that package is not installed, not in `package.json`, and absent from `package-lock.json`**. | `README.md:5`, `package.json:14-22`, `node_modules/@typescript/` |

---

## P1 — must fix before hand-off

1. **Residual `(unverified)` markers** — `AGENTS.md` forbids shipping them: `modules/01:151` (`--builders` default "Not stated in the announcement (unverified)") and `modules/01:380` (the whole 5.x date block). Either resolve against the release posts or delete the column/rows.
2. **Junior certification is marked ✅ without the questions to back it.** `exams/README.md:21-28` gives seven Junior domains, each ✅, by cross-listing Mid/Senior IDs. Downgrade those rows to 🟡 with the reason written in the matrix.
3. **`modules/07-generics-and-inference.md` is missing `## Then vs now`** required by AGENTS.md § Version Currency 3.
4. **Mermaid unescaped angle brackets**: `07:22-23` has `Map<K, V>` and `Promise<T>`; `10:18` has `Map<K, V>`. In Mermaid 11/12, unquoted/unescaped `<>` inside node text parse as HTML tags.
5. **Structural inconsistency between early and late modules**: `01, 06, 11, 12, 13` have `## 1. …`, `## 2. …`, etc. and explicit "Production failure modes" / "Then vs now" sections. `02, 03, 04, 05, 07, 08, 09, 10` are unnumbered H2s.
6. **Vitest claim at `modules/13:118`**: "vitest typecheck: in 3.0+ runs via TS 7 compiler API" carries no citation.

---

## P2 — technical debt

- **Verification block format**: `Verified against…` is a sub-clause inside a prose paragraph instead of being its own line as AGENTS prescribes.
- **Divergent version-history tables**: `modules/01:368-380` vs `modules/13:231-249`.
- **Exam `Ref:` lines don't follow the AGENTS format**: `[modules/03](../modules/03-unions-narrowing-and-control-flow.md)` vs mandated `[modules/NN-….md](../modules/NN-….md#anchor)`.
- **ID naming drift between matrix and bank**: matrix uses `M-001`, bank uses `Q-TSC-M-001`.
- **Integration test disclosure**: Track should explicitly state that no `test:integration` script exists because all tests are in-memory compiler checks.

---

## P3 — polish

- **Title drift README ↔ H1**: 5 titles have minor drift (`01`, `08`, `09`, `12`, `13`). Align them.
- **Table pipe escaping: no violations found**.
