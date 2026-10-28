# Agent Guidelines for Zero-to-One

This document specifies conventions and operating constraints for AI agents maintaining the `zero-to-one` repository.

## Repository Taxonomy and Layout

Organize all educational materials into four root directories:
- `languages/`: Programming language curricula and type systems (e.g., `languages/typescript/`, `languages/rust/`).
- `technologies/`: Runtimes, databases, platforms, and toolchains (e.g., `technologies/docker/`, `technologies/postgres/`).
- `algorithms/`: Data structures, algorithm design, computational complexity, and problem sets.
- `architecture/`: System design, distributed systems, and architectural patterns.

## Topic Module Standard

Every self-contained learning track MUST follow this uniform directory structure:
- `README.md`: Curriculum overview, syllabus, prerequisites, and runnable instructions.
- `GLOSSARY.md`: Bilingual English ↔ Czech terminology index.
- `modules/`: Self-contained markdown lesson files ordered numerically (e.g., `01-introduction.md`).
- `examples/`: Runnable, verified code examples and test suites proving concepts.
- `CHEATSHEET.md`: Fast-lookup reference covering key syntax, operators, and rules.

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
3. Resolve and pin all project tooling dependencies locally using a project-level mise configuration (`.mise.toml` within the track directory).
4. Verify all examples before committing. Run deterministic type checks and test scripts within the module directory.
