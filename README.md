# Zero to One: Engineering & Computer Science Curriculum

A comprehensive, rigorous curriculum and reference repository covering programming languages, system software, algorithms, data structures, and distributed architectures.

Every topic in this repository is built around deep theoretical principles, verified code implementations, executable test suites, and standardized bilingual terminology.

---

## 1. Repository Architecture & Taxonomy

The curriculum is structured into four core technical domains:

```text
zero-to-one/
├── AGENTS.md                  # Autonomous agent conventions & glossary standards
├── GLOSSARY.md                # Central bilingual (EN ↔ CZ) Computer Science & Systems Glossary
├── README.md                  # Root curriculum roadmap and navigation
├── languages/                 # Programming languages and type systems
│   └── typescript/            # Complete Total TypeScript + React 19 + SolidJS 2.x curriculum
├── technologies/              # Databases, containerization, cloud, and runtimes
│   ├── panda-css/             # Complete build-time zero-runtime CSS-in-JS & design system curriculum
│   └── solidjs/               # Complete SolidJS 2.x (@solidjs/signals, @solidjs/web, Start Mode) track
├── algorithms/                # Data structures, algorithmic complexity, and problem solving (.gitkeep)
└── architecture/              # System design, distributed systems, and architectural patterns (.gitkeep)
```

### Module Standard

Every track within the repository adheres to a uniform structure:
1. `README.md` — Curriculum roadmap, prerequisites, learning outcomes, and verification guide.
2. `GLOSSARY.md` — Bilingual (English ↔ Czech) dictionary of established terms derived from official documentation and standard literature.
3. `modules/` — Structured, chapter-by-chapter theoretical lessons with code examples.
4. `examples/` — Zero-dependency, runnable, verified code implementations and type-level test suites.
5. `CHEATSHEET.md` — Rapid desk reference for syntax, operators, idioms, and compiler flags.

---

## 2. Curriculum Roadmap & Status

| Domain | Topic / Technology | Scope & Description | Status | Reference Link |
| :--- | :--- | :--- | :---: | :--- |
| `languages/` | **TypeScript** | Complete 26-week Total TypeScript syllabus (476 lessons) + Modern JS/TS 5.x–7.0, React 19, and SolidJS 2.x | 🟢 Complete | [languages/typescript/](./languages/typescript/) |
| `technologies/` | **Panda CSS** | Build-time zero-runtime CSS-in-JS, static AST extraction, design tokens, atomic and config recipes, slot recipes, layout patterns, container queries, and 25 production best practices | 🟢 Complete | [technologies/panda-css/](./technologies/panda-css/) |
| `technologies/` | **SolidJS 2.x** | Complete Solid 2.0 RC (`@solidjs/signals`, `@solidjs/web`, Oxc/Rust compiler, draft-first stores, `createProjection`, colorless async, `action`/`createOptimisticStore`, Start Mode & `"use server"`) | 🟢 Complete | [technologies/solidjs/](./technologies/solidjs/) |
| `languages/` | **Rust** | Ownership, lifetimes, borrow checker, async runtime, and systems programming | 🟡 Planned | `languages/rust/` |
| `languages/` | **Python** | Python data model, metaprogramming, static typing (`mypy`), and async I/O | 🟡 Planned | `languages/python/` |
| `algorithms/` | **Data Structures & Algorithms** | CLRS-aligned data structures, sorting, graph algorithms, and dynamic programming | 🟡 Planned | `algorithms/` |
| `architecture/` | **Distributed Systems** | Consensus algorithms (Raft, Paxos), CAP/BASE, event-driven architectures, and messaging | 🟡 Planned | `architecture/` |
| `technologies/` | **Databases & Storage Engines** | Relational internals (PostgreSQL, B-Trees, WAL), LSM-trees, and query optimization | 🟡 Planned | `technologies/` |
| `technologies/` | **Containers & Virtualization** | Linux namespaces, cgroups, OCI runtime specifications, and Docker/Kubernetes | 🟡 Planned | `technologies/` |

---

## 3. Bilingual Terminology & Glossaries (EN ↔ CZ)

To bridge technical English documentation with accurate, established Czech academic and professional terminology:
- **[Central Systems & CS Glossary](./GLOSSARY.md)** covers universal concepts (e.g., *Referential Transparency*, *Idempotency*, *Time Complexity*, *CAP Theorem*).
- **[TypeScript & Type-System Glossary](./languages/typescript/GLOSSARY.md)** covers specific type theory, compiler analysis, and language features (e.g., *Discriminated Unions*, *Type Narrowing*, *Mapped Types*, *Branded Types*, *Variance*).
- **[Panda CSS Build-Time & Design System Glossary](./technologies/panda-css/GLOSSARY.md)** covers static AST extraction, design tokens, atomic and config recipes, slot recipes, conditions, and container queries.
- **[SolidJS 2.x Reactive & Full-Stack Glossary](./technologies/solidjs/GLOSSARY.md)** covers fine-grained push-pull reactivity, deterministic microtask batching, store projections, colorless async, optimistic transactions, and server functions.

All glossaries strictly follow the discipline recorded in [AGENTS.md](./AGENTS.md): terms must be verified against official documentation, standards (ISO/IEC, ECMA, IEEE), and academic literature without fabricated neologisms.

---

## 4. Getting Started & Verification

Each track operates as an isolated polyglot environment. Dependencies are localized within their respective track directories to prevent cross-stack interference.

### Running the TypeScript Track

```bash
# Navigate to the TypeScript module
cd languages/typescript

# Run the test suite (Node.js native execution)
npm test

# Run the TypeScript strict compiler check
npm run typecheck
```

Refer to [languages/typescript/README.md](./languages/typescript/README.md) for the full 13-module syllabus and [languages/typescript/CHEATSHEET.md](./languages/typescript/CHEATSHEET.md) for quick lookups.

### Running the SolidJS 2.x Track

```bash
# Navigate to the SolidJS 2.x module
cd technologies/solidjs

# Run all 7 module verification suites (Node.js native execution)
npm test

# Run the TypeScript strict compiler check
npm run typecheck
```

Refer to [technologies/solidjs/README.md](./technologies/solidjs/README.md) for the complete 7-module syllabus and [technologies/solidjs/CHEATSHEET.md](./technologies/solidjs/CHEATSHEET.md) for the `solid-js@2.0.0-rc.8` API and migration reference.
