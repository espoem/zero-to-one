# Review: panda-css

## Hand-off (primary author, Opus) · in progress · updated 2026-10-29

**Status:** examples/tests migrated to Panda CSS 2.4.0; module restructure 13 → 12 in progress.

Done:
- Toolchain: `@pandacss/dev` 2.4.0 (+ preset-base, preset-panda, vite 2.4.0), TypeScript 7.0.2, Vite 8.3.5, React 19.3.1, Solid 1.9.17, Node 26. ESM-only package.
- Tests (`npm test`, node --test): CSS snapshot fixtures (one CLI cssgen per fixture), negative fixtures (dynamic values, default/namespace imports, shadowed `css`, unsupported pure helper, config recipe with runtime variant, string concatenation), v1→v2 misconfig configs (no preset-base, `containerSizes`, breakpoints without extend, `propertyFallback`), runtime class-string tests, CLI oracles (doctor/analyze/debug JSON, codegen --check), Playwright computed-style tests on React + Solid builds with and without `transform: true`, plus a vanilla build proving runtime removal (19,811 → 923 bytes). Type tests via `@ts-expect-error` in `examples/react/src/type-tests.ts`.
- Last run: `npm run typecheck` OK; `npm test` 78/78 pass.
- Modules written: see the module log below.

Module log:
- M01 mental model & v2 architecture: done.

## Remaining work (ordered)
1. Modules 02–12 per brief (delete superseded old modules as each lands).
2. exams/README.md + exams/interview.md (≥60 Q, mock exam).
3. GLOSSARY.md, CHEATSHEET.md, README.md rewrite (Verified-against line, Certifications & Exams).

## Least-certain claims
- `mise.lock` is hand-written without platform checksums (nodejs.org blocked in the sandbox); run `mise lock` on a networked machine.
- Playwright: the e2e suite uses the machine's Playwright (here 1.63.0 / Chromium 153 via NODE_PATH), not 1.64.1, because browsers are tied to the Playwright build. It skips cleanly when unavailable.
- `@park-ui/panda-preset` 0.43.1 (2024-11-22) v2 compatibility: only statically checked (no `containerSizes`/`defineParts`; nests `@pandacss/preset-base`); not run.

## Proposals for integrator
- (to be filled)

## Brief/contract conflicts
- Brief §7.1 says set STATUS.md to 🟦; AUTHOR_PROMPT forbids editing STATUS.md. Followed AUTHOR_PROMPT.
- Brief proposes vitest; AGENTS.md mandates `node --test` for TypeScript. Used `node --test` (AGENTS.md wins).
