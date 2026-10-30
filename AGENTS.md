# Agent Guidelines for Zero-to-One

This document specifies conventions and operating constraints for AI agents maintaining the `zero-to-one` repository. It binds every agent working here: Claude, Claude Code, pi (any model), Antigravity, and any future tool.

## Repository Taxonomy and Layout

Organize all educational materials into four root directories:
- `languages/`: Programming language curricula and type systems (e.g., `languages/typescript/`, `languages/rust/`).
- `technologies/`: Runtimes, databases, platforms, and toolchains (e.g., `technologies/docker/`, `technologies/postgres/`).
- `algorithms/`: Data structures, algorithm design, computational complexity, and problem sets.
- `architecture/`: System design, distributed systems, and architectural patterns.

Coordination material for multi-agent work lives in `.agents/` (see [Multi-Agent Workflow](#multi-agent-workflow)). It is never learning content.

## Topic Module Standard

Every self-contained learning track MUST follow this uniform directory structure:
- `README.md`: Curriculum overview, syllabus, prerequisites, runnable instructions, a **Certifications & Exams** section (see below), and a `Verified against <tool versions> on <YYYY-MM-DD>` line.
- `GLOSSARY.md`: Bilingual English ↔ Czech terminology index.
- `modules/`: Self-contained markdown lesson files ordered numerically (e.g., `01-introduction.md`).
- `examples/`: Runnable, verified code examples and test suites proving concepts.
- `exams/`: Certification and exam coverage matrix plus preparation question banks (see [Certification and Exam Coverage](#certification-and-exam-coverage)).
- `CHEATSHEET.md`: Fast-lookup reference covering key syntax, operators, and rules.

## Topic Depth and Technical Rigor

Apply these requirements when creating or updating any topic module:

1. **Academic Grounding and Formal Definitions**:
   - Provide formal definitions for core concepts (algebraic, axiomatic, or operational semantics where applicable).
   - Anchor definitions in primary specifications (RFCs, ISO/ECMA standards) and seminal computer science literature.
   - Detail underlying mechanics: abstract syntax trees, compiler lowering, desugaring, runtime memory layout, cache behavior, and hardware or OS boundaries.

2. **Continuous Multi-Tier Progression**:
   - Span the complete spectrum from foundational mechanics to senior-level architectural and operational concerns.
   - Do not partition content by audience tier or insert labels such as "Beginner", "Medior", or "Senior". Structure each topic as a single progressive narrative that deepens naturally.
   - Cover expert topics, niche edge cases, subtle semantics, and production failure modes (such as race conditions, memory leaks, false sharing, and boundary violations).

3. **Executable Proofs and Edge Cases**:
   - Accompany theoretical principles with runnable, deterministic test suites in `examples/`.
   - Provide negative tests and counterexamples demonstrating compiler rejections, runtime exceptions, and subtle anti-patterns.
   - Verify every example with the local compiler and test runner before committing changes.
   - Keep hermetic tests in `test`. Tests that need containers or external services go in `test:integration` (or the language's equivalent), and must skip cleanly with a clear message when the service is unavailable.

4. **Diagrams Must Parse and Preserve Intended Order**:
   - Every Mermaid diagram (` ```mermaid ` fence) must be syntactically valid. It must parse with both Mermaid 11 and Mermaid 12, so it renders on GitHub whichever major GitHub ships.
   - Run `tools/mermaid-check` (`mise exec -- node check.mjs ../..` from that directory, or point it at the track) before every commit that touches Markdown. Never commit a diagram that fails the check.
   - Prefer quoted labels (`A["text (x)"]`, `-->|"label & more"|`) and write `#59;` instead of a literal `;` inside sequence-diagram text.
   - Ensure diagrams with ordered components, pipeline stages, network stack layers, or lifecycle sequences strictly follow the intended chronological, architectural, or memory layout order. Constrain layout explicitly via directed flows (`flowchart TD` / `flowchart LR`) or invisible links (`~~~`) so layout engines cannot permute or invert elements.

5. **Syllabus Completeness**:
   - Before writing, derive the syllabus from current authoritative sources: the official documentation table of contents, official certification exam guides, and recognised university or industry courses.
   - Every topic in those sources must map to a module or be explicitly listed as out of scope, with a reason.
   - End each module with an **Interview Drill**: 5–10 questions an experienced interviewer would ask about the module, with model answers in collapsible `<details>` blocks.

6. **Markdown Tables and Escaped Delimiters**:
   - In all Markdown tables, every literal pipe character (`|`) occurring inside cell text, inline code spans (e.g. `A \| B`), math, or descriptions MUST be escaped as `\|` or `&#124;` unless it functions as a table column grid mark.
   - Unescaped pipes inside cells fragment row parsing, creating phantom columns and corrupting table alignment across GitHub and Markdown renderers. Always verify table column count consistency.

## Version Currency

1. Target the latest stable release of every language, runtime, framework, and tool. Verify each version against a primary source (official release notes, the package registry, or upstream tags) at the time of writing. Never rely on model memory for versions.
2. Release candidates and previews are taught only when the track is explicitly about them (e.g., SolidJS 2.0 RC). Label them clearly.
3. **Teach the latest version, and compare with earlier ones where practice changed.** Whenever recommended practice, defaults, APIs, or semantics differ from earlier versions still common in production, add a **"Then vs now"** comparison with:
   - the old approach, the version range it applied to, and why it changed;
   - the current approach, with side-by-side code where useful;
   - migration steps and the pitfalls of mixing old and new.

   Each track's final or migration module also carries a version history table of the major releases relevant to practitioners. Do not silently rewrite history, and do not teach removed APIs as current.
4. Mark any claim that could not be verified against a primary source with `(unverified)`, and resolve it before the track is merged.

## Certification and Exam Coverage

Every track MUST cover the official certifications and exams for its topic. Where none exist, it MUST cover the generally recognised substitutes.

1. **Identify the exams.** List them in the README's **Certifications & Exams** section, with:
   - the exam name and code, the vendor, and a link to the official exam guide;
   - the exam guide version or date verified, plus the product version the exam targets;
   - the status (active, beta, retiring on <date>, retired → successor);
   - the format: question types, performance-based or hands-on tasks, duration, passing score where published.

   **Priority order:**
   1. Official vendor or foundation certifications (e.g., CKA/CKAD/CKS, Terraform Associate, AWS/GCP/Azure exams, Elastic Certified Engineer).
   2. Widely recognised third-party or academic exams (e.g., the OpenJS, Linux Foundation and CNCF catalogue; university course exams such as MIT 6.1210 / 6.5840 problem sets).
   3. Where no certification exists (e.g., SolidJS, Panda CSS), the recognised technical interview format for the topic: senior frontend loop, system-design round, DSA coding round.

   State explicitly when no certification exists.
2. **Map domains to modules.** `exams/README.md` contains a coverage matrix: every exam domain and objective, its official weight, the module(s) and examples that teach it, and its coverage status (✅ full / 🟡 partial / ❌ gap). There must be no ❌ rows at merge time. Any 🟡 row needs a reason.
3. **Exam version deltas.** When an exam targets an older product version than the track (e.g., Terraform Associate → 1.12 while the track teaches 1.17), add an "Exam delta" callout in the affected modules and in `exams/README.md`. The callout states what the exam expects versus current behaviour.
4. **Preparation question banks.** Write one file per exam, `exams/<exam-code>.md` (or `exams/interview.md` for interview-format prep), containing:
   - **Coverage:** at least 5 questions per exam domain, and at least 60 questions per certification overall. Distribute them roughly in proportion to the official domain weights.
   - **Question types that mirror the real format:** single choice, multiple select, scenario-based, ordering, and **hands-on tasks** for performance-based exams (CKA, CKAD, CKS, Red Hat-style). Every hands-on task has a runnable verification script or test in `examples/`.
   - **Difficulty:** each question is tagged 1–3. Every bank includes questions harder than the real exam.
   - **Answers:** in a collapsible `<details>` block, containing the correct answer, a concise explanation, why each distractor is wrong, and references to the teaching module and the official documentation page.
   - **Format** for each question:

     ```markdown
     ### Q-<EXAM>-<NNN> · <Domain> · difficulty <1-3> · <single|multi|scenario|ordering|hands-on>
     <question text>
     - A) …
     - B) …
     <details><summary>Answer</summary>

     **B.** <explanation>
     - Why not A: …
     - Ref: [modules/NN-….md](../modules/NN-….md#anchor), <official doc URL>
     </details>
     ```
   - **Mock exam:** at least one full mock exam section that matches the real exam's question count, time limit and domain mix, with a scoring key.
5. **Integrity.** Write only original questions. Never reproduce, paraphrase or solicit actual exam content ("braindumps"); that breaches certification NDAs. Base questions on the public exam guide objectives and the official documentation.
6. **Upkeep.** Re-check exam guides when you update a track. Retirements, renamed codes and changed domain weights update the README, the matrix and the question banks in the same change.

## Code Example Languages

1. **Primary (always):** each algorithm, protocol or data structure is given as CLRS-style **pseudocode** (with loop invariants stated) and as a tested **TypeScript** implementation (`node --test`, fast-check for property tests).
2. **Secondary (where applicable):** add **Python**, **Rust** and/or **Nim** only when the language teaches something the primary pair cannot:
   - Python: interview live-coding idioms.
   - Rust: ownership, borrowing and memory layout.
   - Nim: value semantics, ARC/ORC, compile-time evaluation and macros.
3. Layout: `examples/<language>/…`. Each language has its own mise-pinned toolchain and native test runner (pytest, `cargo test`, `testament`/`nimble test`). The track's `test` script runs every language present.
4. Language tracks (e.g., `languages/python`) use their own language as the primary implementation language.

## Knowledge Ownership and Deduplication

1. Every concept has exactly one owning track, recorded in `.agents/OWNERSHIP.md`. The owner gives the full treatment. Other tracks cross-link to it and add only their own delta (names, limits, defaults, pitfalls specific to that technology).
2. Before writing a section, check `.agents/OWNERSHIP.md`. If the concept is owned elsewhere, link to it instead of re-explaining it. If the concept is unregistered, register it in the same change.
3. Foundation tracks (`languages/javascript`, `architecture/data-systems`, `architecture/distributed-systems`, `architecture/networking`, `architecture/security-identity`, `architecture/cloud-foundations`) are the default owners of cross-cutting theory.

## Terminology and Glossary Discipline

Follow these rules when creating or updating any `GLOSSARY.md` file:
1. **Established Terminology Only**: Use standard terms established in official documentation, academic computer science literature, and authoritative reference publications. Never invent neologisms or colloquial translations.
2. **Universal Consistency**: When a concept spans multiple areas (e.g., *Immutability*, *Idempotency*, *Pure Function*, *Covariance*), maintain consistent definitions and translations across all module glossaries and the root glossary.
3. **Bilingual Mapping with English Prose**: Write all explanations, definitions, headings, and notes entirely in English. Present terms with their precise English canonical name, established Czech equivalent, concise English definition, and primary source / reference.
4. **Two-Level Scope**:
   - Repository Root `GLOSSARY.md`: General computer science, systems engineering, and algorithmic concepts.
   - Module `GLOSSARY.md`: Language-specific and technology-specific terms (e.g., TypeScript type-system operators and compiler mechanics).

## Isolation and Polyglot Tooling

1. Keep dependencies isolated within each track directory (e.g., `languages/typescript/package.json`). Do not configure a single global package root that couples heterogeneous tech stacks.
2. For every project using TypeScript (existing, in-progress, or future), target and use the latest available stable TypeScript release.
3. Resolve and pin **all** project tooling locally using a project-level mise configuration (`.mise.toml` within the track directory). Commit `mise.lock`. This covers language runtimes (node, python/uv, rust, nim, go, java) and CLIs (kubectl, kind, helm, terraform, opentofu, and so on). Never rely on globally installed tools or system interpreters.
4. Run every command through the pinned toolchain (`mise exec -- <cmd>`, or mise-activated shells). Container images are pinned by exact tag (and preferably digest) in compose files.
5. Verify all examples before committing. Run deterministic type checks and test scripts within the module directory.

## Multi-Agent Workflow

Several agents work in this repository. **Opus is the primary agent**: it plans, authors, integrates and makes the final call. Every other model is a companion that works under Opus's direction, on cheaper or independent tasks.

### Roles
| Role | Who | Does | Never does |
|---|---|---|---|
| **Primary (author + integrator)** | Claude Opus: the claude.ai orchestration session (with Opus subagents) and Claude Code CLI running Opus on the Mac (for Docker/mise-heavy tracks) | Owns each track end to end: syllabus, modules, examples, exams, glossary, cheatsheet. Integrates companion output. Final gate. | Merges companion output without reading it |
| **Drafter** | pi · DeepSeek | Bulk first drafts on request from the primary: question-bank drafts, glossary candidates, cheatsheet tables, example boilerplate, test scaffolding | Decides syllabus or structure; commits to `main` |
| **Challenger** | pi · Muse Spark 1.3 | Adversarial review: attacks factual claims, hunts subtle errors and missing gotchas, tries to break tests and exam answers, argues the strongest counter-position | Rewrites content directly (it reports findings) |
| **Verifier** | Antigravity | Independent checks: live docs and version re-verification in the browser, rendering (Mermaid, KaTeX, links), Playwright runs, exam-guide comparison | Changes the syllabus |

Companion output is input to the primary, never final content. The primary reads, corrects and integrates it, and records what was used in `.agents/reviews/<track>.md`.

### Coordination files
| File | Purpose |
|---|---|
| `.agents/PLAN.md` | Master plan, phases, decisions |
| `.agents/OWNERSHIP.md` | Concept → owning track registry |
| `.agents/STATUS.md` | Board: track, primary, companions, branch, state |
| `.agents/briefs/<track>.md` | Self-contained task brief for a track |
| `.agents/REVIEW.md` | Review checklist derived from this file |
| `.agents/reviews/<track>.md` | Hand-off notes, challenger/verifier findings and their resolution |
| `.agents/KICKOFF.md` | Copy-paste prompts for each role |
| `.agents/research/` | Research dossiers (versions, syllabi, gotchas) |

### Rules
1. **One track, one branch.** Work happens on `track/<name>` (in a dedicated worktree when several agents share a checkout). Never edit another track's branch.
2. **Follow the brief.** Start from `.agents/briefs/<track>.md`. If the brief conflicts with this file, this file wins; record the conflict in the review file.
3. **Every track is challenged and verified** by at least one companion before the final gate. The final gate is always Opus: tests re-run, versions and links verified, glossary and ownership checked.
4. **Update `.agents/STATUS.md`** when a track changes state.
5. **Commits:** Conventional Commits scoped to the track (e.g., `feat(redis): …`, `fix(postgres): …`), one logical change per commit, tests passing.
6. **No leaks.** Never commit absolute local paths (`/Users/…`, `/home/…`), usernames, e-mail addresses, hostnames, tokens, or real credentials. Use relative links and obvious placeholders (`example.com`, `postgres:postgres@localhost`). Run the secret and path scan before pushing.
7. **Commit authorship.** Author and committer are always the operator's git identity. Never add `Co-Authored-By`, `Claude-Session`, or any other agent, model, or tool trailer to a commit message, and never commit from an agent service account. Record which agent produced what in `.agents/reviews/<track>.md` instead. The operator's e-mail address is permitted in local commit metadata only; it must never appear in tracked file contents.
