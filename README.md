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
├── technologies/              # Databases, containerization, cloud, and runtimes (.gitkeep)
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
