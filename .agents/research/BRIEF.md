# Research brief (shared by all research agents)

Context: `zero-to-one` is a personal curriculum repo for a senior software engineer (stack: TypeScript, SolidJS, Node.js, Python, SQL/NoSQL, Redis, GitLab) preparing for interviews and aiming for "master of the domain" depth. Each track = README (syllabus) + GLOSSARY (EN↔CZ) + modules/NN-*.md (one progressive narrative, no Beginner/Senior labels, formal definitions anchored in primary specs/official docs, internals/mechanics, production failure modes) + examples/ (deterministic, runnable test suites incl. negative tests, verified locally) + CHEATSHEET.md. Tooling pinned per track with mise (.mise.toml). Today is 2026-10-28; your training data may be stale — VERIFY every version/feature claim with WebSearch/WebFetch against official sources (release notes, docs, cert exam guides). Do not guess versions.

For EACH track assigned to you, produce a section with exactly these headings:

### <Track name> — `<proposed repo path>`
- **Current stable version(s)** (+ release date, source URL). Note anything in RC/preview that matters.
- **Authoritative syllabi used**: official docs ToC, official certification exam guides with domain weightings (e.g. CKA, Terraform Associate, AWS SAA-C03/its successor, AZ-104, GCP ACE/PCA), well-known university/industry courses. URLs.
- **Proposed modules** (8–14, numbered, progressive from foundations → internals → production/ops → expert). For each: title + 4–8 bullet subtopics. Must collectively cover the cert/syllabus domains.
- **Gotchas & production failure modes** (10–20 concrete, specific ones — the stuff that separates masters; e.g. "Redis KEYS in prod blocks event loop", not generic advice).
- **Interview hot topics** (8–12).
- **Executable-proof strategy**: how examples/ can be deterministic & runnable on a Mac dev box with mise (e.g. PGlite, testcontainers, kind/k3d, LocalStack, miniflare/wrangler dev, docker compose, terraform plan against local providers, pytest). Name the concrete tools and versions. Flag what cannot be proven locally and the fallback (e.g. config validation, plan snapshot tests, policy tests).
- **Overlaps / dedupe**: which concepts belong to a shared foundation track instead (name it), and what this track should only cross-link.

Rules: concise bullets, no filler; cite URLs inline; mark any claim you could not verify with "(unverified)". Write your full output to the file path given in your task, then reply with a ≤15-line summary (versions found + any surprises).
