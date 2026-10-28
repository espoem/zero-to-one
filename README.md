# Zero to One: Engineering & Computer Science Curriculum

A comprehensive, rigorous curriculum and reference repository covering programming languages, runtimes, data systems, platform engineering, cloud, algorithms, and distributed architectures.

Every topic in this repository is built around deep theoretical principles, verified code implementations, executable test suites, certification and interview preparation, and standardized bilingual terminology.

---

## 1. Repository Architecture & Taxonomy

The curriculum is structured into four core technical domains:

```text
zero-to-one/
├── AGENTS.md          # Binding conventions for every agent (structure, rigor, exams, tooling, workflow)
├── GLOSSARY.md        # Central bilingual (EN ↔ CZ) computer science & systems glossary
├── README.md          # This roadmap
├── .agents/           # Multi-agent coordination: PLAN, OWNERSHIP, STATUS, briefs, reviews, research
├── languages/         # typescript · javascript · python · css
├── technologies/      # react · solidjs · panda-css · postgres · nodejs · sqlite · redis · elasticsearch ·
│                      # containers · kubernetes · argocd · terraform · gitlab-ci · observability ·
│                      # aws · gcp · azure · cloudflare
├── algorithms/        # dsa
└── architecture/      # data-systems · distributed-systems · networking · security-identity ·
                       # cloud-foundations · system-design
```

### Track Standard

Every track adheres to the uniform structure defined in [AGENTS.md](./AGENTS.md):
1. `README.md` — Curriculum roadmap, prerequisites, learning outcomes, **Certifications & Exams**, and verification guide.
2. `GLOSSARY.md` — Bilingual (English ↔ Czech) dictionary of established terms.
3. `modules/` — Progressive chapter-by-chapter lessons, each ending with an Interview Drill.
4. `examples/` — Runnable, verified implementations and test suites (pseudocode + TypeScript primary; Python, Rust, Nim where applicable).
5. `exams/` — Exam-domain coverage matrix, original preparation question banks with answers, and mock exams.
6. `CHEATSHEET.md` — Rapid desk reference.

All tooling is pinned per track with [mise](https://mise.jdx.dev/) (`.mise.toml` + `mise.lock`).

---

## 2. Curriculum Roadmap & Status

29 tracks. Work is phased by dependency; see [.agents/PLAN.md](./.agents/PLAN.md) for the plan and [.agents/STATUS.md](./.agents/STATUS.md) for live status.

| Domain | Track | Scope | Status | Path |
| :--- | :--- | :--- | :---: | :--- |
| `languages/` | **CSS & web platform** | Foundation: cascade/@layer/@scope, layout, container queries, @property, rendering pipeline, view transitions | 🟡 Planned (Phase 1) | `languages/css/` |
| `languages/` | **JavaScript** | Foundation; decorators listed at Stage 2.7 — re-verify | 🟡 Planned (Phase 1) | `languages/javascript/` |
| `languages/` | **TypeScript** | Modules 09–13 cut to typing-only; TS 7 tsconfig defaults break M04; no programmatic API in 7.0 | 🟠 Restructuring (Phase 1) | [languages/typescript/](./languages/typescript/) |
| `languages/` | **Python** | Free-threading still optional build; pin ≥3.14.5 if on 3.14 | 🟡 Planned (Phase 2) | `languages/python/` |
| `technologies/` | **Panda CSS** | Repo on ^0.51 — two breaking majors; createStyleContext, panda ship, studio removed; Oxc compiler | 🟠 Restructuring (Phase 1) | [technologies/panda-css/](./technologies/panda-css/) |
| `technologies/` | **PostgreSQL** | Failover slots mislabelled PG18 (are PG17); no partitioning/PL/pgSQL/PgBouncer; PGlite single-session | 🟠 Restructuring (Phase 1) | [technologies/postgres/](./technologies/postgres/) |
| `technologies/` | **React** | Modules ~70 lines each; missing Activity, useEffectEvent, ViewTransition, CVE-2025-55182 | 🟠 Restructuring (Phase 1) | [technologies/react/](./technologies/react/) |
| `technologies/` | **SolidJS** | README says rc.8; start mode lives in @solidjs/vite-plugin, @solidjs/start 2.x is Solid 1.9 | 🟠 Restructuring (Phase 1) | [technologies/solidjs/](./technologies/solidjs/) |
| `technologies/` | **Elasticsearch** | Version not confirmed on elastic.co; Elastic cert still on 8.1 | 🟡 Planned (Phase 2) | `technologies/elasticsearch/` |
| `technologies/` | **Node.js** | JSNAD/JSNSD retired 2025-09-30; new yearly release model from v27 | 🟡 Planned (Phase 2) | `technologies/nodejs/` |
| `technologies/` | **Redis** | Tri-licence since 8.0; cert offline since Jan 2026 | 🟡 Planned (Phase 2) | `technologies/redis/` |
| `technologies/` | **SQLite** | Turso = module 12; libSQL stuck on SQLite 3.45.1; bundled versions differ per binding | 🟡 Planned (Phase 2) | `technologies/sqlite/` |
| `technologies/` | **Argo CD** | CGOA fits better than CAPA (48% Workflows/Events) | 🟡 Planned (Phase 3) | `technologies/argocd/` |
| `technologies/` | **Containers** | cgroup v1 gone in Podman 6; containerd store default in Docker 29 | 🟡 Planned (Phase 3) | `technologies/containers/` |
| `technologies/` | **GitLab CI** | Owns SBOM/cosign/SLSA | 🟡 Planned (Phase 3) | `technologies/gitlab-ci/` |
| `technologies/` | **Kubernetes** | CKA/CKAD on 1.37, CKS still 1.34; Ingress-NGINX retired Mar 2026 | 🟡 Planned (Phase 3) | `technologies/kubernetes/` |
| `technologies/` | **Observability** | Promtail EOL Mar 2026 → Alloy | 🟡 Planned (Phase 3) | `technologies/observability/` |
| `technologies/` | **Terraform** | Associate 004 tests 1.12; 1.17 is one week old | 🟡 Planned (Phase 3) | `technologies/terraform/` |
| `technologies/` | **AWS** | LocalStack now needs auth token → moto baseline | 🟡 Planned (Phase 4) | `technologies/aws/` |
| `technologies/` | **Azure** | AZ-204 retired; no default outbound for new VNets (verify date) | 🟡 Planned (Phase 4) | `technologies/azure/` |
| `technologies/` | **Cloudflare** | vitest-pool-workers → @cloudflare/vitest-plugin | 🟡 Planned (Phase 4) | `technologies/cloudflare/` |
| `technologies/` | **GCP** | PCA renewal centred on gen-AI case study | 🟡 Planned (Phase 4) | `technologies/gcp/` |
| `algorithms/` | **DSA** | TS examples, Python translation table | 🟡 Planned (Phase 2) | `algorithms/dsa/` |
| `architecture/` | **Data systems** | Foundation; toy engines + property tests | 🟡 Planned (Phase 1) | `architecture/data-systems/` |
| `architecture/` | **Networking** | Foundation: TCP/IP, DNS, TLS, HTTP/1.1–3, QUIC, load balancing; Linux labs in Docker VM | 🟡 Planned (Phase 1) | `architecture/networking/` |
| `architecture/` | **Security & identity** | Foundation: crypto for engineers, PKI/mTLS, OAuth/OIDC, WebAuthn, authz models, threat modeling | 🟡 Planned (Phase 1) | `architecture/security-identity/` |
| `architecture/` | **Distributed systems** | Raft in TS on deterministic simulator; Porcupine cross-check | 🟡 Planned (Phase 2) | `architecture/distributed-systems/` |
| `architecture/` | **Cloud Foundations** | Concept → AWS/GCP/Azure mapping table (~35 rows) | 🟡 Planned (Phase 4) | `architecture/cloud-foundations/` |
| `architecture/` | **System design** | Built last: composes all tracks | 🟡 Planned (Phase 4) | `architecture/system-design/` |

---

## 3. Bilingual Terminology & Glossaries (EN ↔ CZ)

To bridge technical English documentation with accurate, established Czech academic and professional terminology:
- **[Central Systems & CS Glossary](./GLOSSARY.md)** covers universal concepts (e.g., *Referential Transparency*, *Idempotency*, *Time Complexity*, *CAP Theorem*).
- **[TypeScript & Type-System Glossary](./languages/typescript/GLOSSARY.md)** covers type theory, compiler analysis, and language features.
- **[React Glossary](./technologies/react/GLOSSARY.md)** covers Fiber reconciliation, concurrent priority lanes, selective hydration, the Flight protocol, Server Actions, and React Compiler lowering.
- **[SolidJS 2.x Glossary](./technologies/solidjs/GLOSSARY.md)** covers fine-grained push-pull reactivity, glitch freedom, draft stores and projections, colorless async, optimistic transactions, and server functions.
- **[Panda CSS Glossary](./technologies/panda-css/GLOSSARY.md)** covers static extraction, design tokens, recipes, slot recipes, and conditions.
- **[PostgreSQL Glossary](./technologies/postgres/GLOSSARY.md)** covers the process model, shared buffers, asynchronous I/O, MVCC internals, indexing, PITR, and pgvector.

New tracks add their glossary here when they land. All glossaries follow the discipline recorded in [AGENTS.md](./AGENTS.md): shared terms reuse the root definition and Czech translation verbatim; no fabricated neologisms.

---

