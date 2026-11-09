# Zero-to-One — Master Plan v1 (2026-10-28)

Status: **IN PROGRESS (Phase 4)**. Phase 0, 1, 2, and 3 are complete and merged to `main`. Phase 4 has 4 of 6 tracks complete (`cloud-foundations`, `aws`, `gcp`, `cloudflare`). Only 2 tracks remain: `technologies/azure` and `architecture/system-design`.

Inputs: six research dossiers in `.agents/research/` (A-frontend, B-data, C-runtimes, D-cs, E-platform, F-cloud). Their versions were checked against primary sources on 2026-10-27/28. Claims they could not check are marked `(unverified)` and **must be re-verified by the authoring agent before they are taught**.

---

## 1. Goal

Every track reaches "master of the domain" depth as defined in `AGENTS.md`:

- **Syllabus coverage:** official docs, current certification exam domains and canonical courses.
- **Production gotchas and failure modes.**
- **Executable proofs:** deterministic tests, including negative tests.
- **Bilingual glossary.**
- **Current versions.**

Knowledge is **deduplicated**: each concept has exactly one owner track, and every other track cross-links to it (§4).

## 2. Target taxonomy: 29 tracks (27 complete, 2 planned) and 340+ modules

| Root | Track | Mods | State | Phase |
| --- | --- | --: | --- | :-: |
| languages | `typescript` | 13 | ✅ merged: TS 7.0.2, dedupe 09–13 to typing only, 72-q bank, 132 tests | 1 |
| languages | `javascript` | 13 | ✅ merged: **foundation**: ECMA-262 2026 / Node 26.13, 78-q bank, 355 tests | 1 |
| languages | `python` | 14 | ✅ merged: Python 3.15.2 / uv 0.13.6, PCAP/PCPP1 75-q bank, 82 tests | 2 |
| languages | `css` | 14 | ✅ merged: **foundation** (D7): cascade, layout, `@property`, view transitions, 75-q bank, 26 Chromium tests | 1 |
| technologies | `react` | 12 | ✅ merged: React 19.3.1, Fiber/Flight/Actions/Compiler, 65-q bank, 228 tests | 1 |
| technologies | `solidjs` | 10 | ✅ merged: SolidJS 2.0-rc.19, fine-grained reactivity, 60-q bank, 216 tests | 1 |
| technologies | `panda-css` | 12 | ✅ merged: Panda CSS 2.4.0, build-time extraction, 60-q bank, 118 tests | 1 |
| technologies | `postgres` | 13 | ✅ merged: PostgreSQL 18.6, MVCC/WAL/PITR/pgvector, 65-q EDB bank, 24 tests | 1 |
| technologies | `nodejs` | 14 | ✅ merged: Node 26.13.0 LTS, libuv, streams, 80-q bank + 6 hands-on suites, 348 tests | 2 |
| technologies | `sqlite` | 12 | ✅ merged: SQLite 3.54.1 & libSQL/Turso, B-tree/WAL/VDBE, 75-q bank, 229 tests | 2 |
| technologies | `redis` | 12 | ✅ merged: Redis 8.10.3 & Valkey 9.1.3, RESP3, Streams, 65-q RCAD bank, 272 tests | 2 |
| technologies | `elasticsearch` | 12 | ✅ merged: ES 9.5.6 & Lucene 10, BM25, ES\|QL, vector search, 70-q ECE bank, 305 tests | 2 |
| technologies | `containers` | 12 | ✅ merged: Docker 29 & Podman 6, OCI, namespaces, cgroups v2, 65-q bank, 56 tests | 3 |
| technologies | `kubernetes` | 14 | ✅ merged: Kubernetes 1.37, control plane, CNI, 75-q CKA/CKAD/CKS bank, 55 tests | 3 |
| technologies | `terraform` | 12 | ✅ merged: Terraform 1.17 & OpenTofu 1.13, HCL, 65-q Associate 004 bank, 58 tests | 3 |
| technologies | `argocd` | 11 | ✅ merged: Argo CD 3.5 & Rollouts, GitOps, 67-q CGOA/CAPA bank, 12 tests | 3 |
| technologies | `gitlab-ci` | 9 | ✅ merged: GitLab CI, supply-chain security (SBOM, cosign, SLSA), 65-q bank, 54 tests | 3 |
| technologies | `observability` | 13 | ✅ merged: OTel, Prometheus, Grafana LGTM, alert burn rates, 65-q PCA/OTCA bank, 53 tests | 3 |
| technologies | `aws` | 14 | ✅ merged: AWS architecture, IAM, VPC, resilience, 65-q SAA-C03 bank, 38 tests | 4 |
| technologies | `gcp` | 10 | ✅ merged: Google Cloud architecture, IAM, Andromeda, BigQuery, 65-q ACE/PCA bank, 30 tests | 4 |
| technologies | `azure` | 9 | ⬜ brief ready: AZ-104, AZ-305, AI-200 (AZ-204 retired), Entra ID, ARM/Bicep | 4 |
| technologies | `cloudflare` | 12 | ✅ merged: Workers/workerd, Durable Objects, D1/R2/KV/Queues, 65-q bank, 16 tests | 4 |
| algorithms | `dsa` | 14 | ✅ merged: CLRS 4e / MIT 6.1210, 75-q bank, 169+ TS/Python/Rust/Nim tests | 2 |
| architecture | `data-systems` | 12 | ✅ merged: **foundation**: DDIA 2e ch. 3–8, 11–13, storage/WAL/MVCC, 65-q bank, 31 tests | 1 |
| architecture | `distributed-systems` | 14 | ✅ merged: MIT 6.5840, DDIA 2e ch. 9–10, Raft simulator, 75-q bank, 94 tests | 2 |
| architecture | `networking` | 14 | ✅ merged: **foundation**: RFC 9846 TLS 1.3, ECH, QUIC/HTTP3, 135-q bank, 33 tests | 1 |
| architecture | `security-identity` | 14 | ✅ merged: **foundation**: OWASP 2025, ASVS 5.0, OAuth 2.1, 75-q Security+ bank, 54 tests | 1 |
| architecture | `cloud-foundations` | 14 | ✅ merged: **foundation**: provider-neutral, AWS/GCP/Azure mapping, 65-q bank, 30 tests | 4 |
| architecture | `system-design` | 14 | ⬜ brief ready: **last**: composes every track, estimation, SLO math, Staff loop | 4 |

Module lists, gotchas, interview topics and proof strategy for each track: see the matching `.agents/research/*.md` section and `.agents/briefs/*.md`.

Many tracks assume these foundations as prerequisites:

- `architecture/networking`: TCP/IP, DNS, TLS 1.3, HTTP/1.1, HTTP/2 and HTTP/3, QUIC, BGP basics.
- `architecture/security-identity`: OAuth 2.1, OIDC, JWT, PKI and mTLS, secrets, OWASP.
- `architecture/data-systems`: Storage engines, transaction models, replication, and consensus storage.
- `architecture/cloud-foundations`: Provider-neutral primitives, IAM, VPC, and storage mapping.

## 3. Execution phases (dependency order)

| Phase | Content | Status | Deliverables |
| --- | --- | :-: | --- |
| 0 | Repo hygiene, `AGENTS.md` v2, ownership registry, briefs | ✅ Merged | All foundation briefs, ownership registry, hygiene gates green |
| 1 | Foundations (`javascript`, `css`, `data-systems`, `networking`, `security-identity`) & existing track updates (`typescript`, `react`, `solidjs`, `panda-css`, `postgres`) | ✅ Merged | 10 tracks, 127 modules, 696 exam questions, all tests passing |
| 2 | Runtimes and data stores (`nodejs`, `python`, `sqlite`, `redis`, `elasticsearch`, `dsa`, `distributed-systems`) | ✅ Merged | 7 tracks, 92 modules, 529 exam questions, all tests passing |
| 3 | Platform and DevOps (`containers`, `kubernetes`, `terraform`, `argocd`, `gitlab-ci`, `observability`) | ✅ Merged | 6 tracks, 71 modules, 392 exam questions, all tests passing |
| 4 | Cloud & System Design (`cloud-foundations`, `aws`, `gcp`, `cloudflare` complete; `azure`, `system-design` planned) | 🔄 In Progress | 4 of 6 tracks complete (50 modules, 260 exam questions); 2 tracks remaining |

### Phase 4 Remaining Tracks & Missing Deliverables

1. **`technologies/azure` (Phase 4)**:
   - **Brief**: `.agents/briefs/azure.md` (author: Opus · claude.ai; companion verifier: Antigravity).
   - **Target Exams**: AZ-104 (Azure Administrator Associate), AZ-305 (Azure Solutions Architect Expert), and AI-200 (AI Engineer, replacing retired AZ-204).
   - **Missing Deliverables**:
     - `technologies/azure/README.md`: Syllabus, prerequisites, exam guide alignments, verification guide.
     - `technologies/azure/GLOSSARY.md`: Bilingual English ↔ Czech terminology index (Entra ID, ARM/Bicep, VNets, Azure Storage, Cosmos DB, AKS, etc.).
     - `technologies/azure/modules/`: 9–12 comprehensive modules (minimum 400 lines each) covering Entra ID, governance & policy, VNet networking, compute (VMs, App Service, Functions, AKS), Cosmos DB multi-model consistency, messaging (Event Hubs, Service Bus), and monitoring. Each module ending with an Interview Drill.
     - `technologies/azure/examples/`: Runnable test suites in TypeScript with mise-pinned Node 26 tooling (using Azurite local emulator or typed SDK mocks).
     - `technologies/azure/exams/`: Coverage matrix and question bank (`exams/az-104.md`, `exams/az-305.md`) with >= 60 questions with distractor rationales and mock exam.
     - `technologies/azure/CHEATSHEET.md`: Quick lookup reference for Azure CLI, ARM/Bicep, and core CLI commands.

2. **`architecture/system-design` (Phase 4)**:
   - **Brief**: `.agents/briefs/system-design.md` (author: Opus · claude.ai; companion verifier: Antigravity). Built **last** as it composes all other 28 tracks.
   - **Target Format**: Senior / Staff / Principal System Design interview loop.
   - **Missing Deliverables**:
     - `architecture/system-design/README.md`: Framework overview, four-step design method, scope, prerequisites, verification.
     - `architecture/system-design/GLOSSARY.md`: Bilingual English ↔ Czech terminology index (capacity estimation, SLO math, back-of-the-envelope calculations, fault domains).
     - `architecture/system-design/modules/`: 14 comprehensive modules (minimum 400 lines each) synthesizing compute, storage, networking, security, caching, consensus, and cloud providers.
     - `architecture/system-design/examples/`: Deterministic calculation proofs, estimation scripts, and capacity modeling suites in TypeScript.
     - `architecture/system-design/exams/`: 65+ question Staff/Principal interview drill bank and complete 60-minute mock design loops with grading rubrics.
     - `architecture/system-design/CHEATSHEET.md`: Fast-reference numbers, latency numbers every programmer should know, estimation formulas, and design checklist.

**Phase 0 hygiene list:**

- ✅ Absolute local links replaced with relative ones (working tree and history).
- ✅ The root README lists the Solid glossary twice (resolved).
- ✅ Align `@types/node` (it is 22, 24 or 26 depending on the track) and pin Node 26 in every `.mise.toml`.
- ✅ `react` has `mise.lock`.
- ✅ `panda-css` has runtime test suite.
- ✅ `typescript` has example for module 06.
- ✅ Empty `.pi/tasks` dirs: gitignored.
- ✅ Add a `Verified against <versions> on <date>` line to every track README.

## 4. Dedupe: concept ownership (excerpt; full registry → `.agents/OWNERSHIP.md`)

| Concept | Owner | Cross-link only |
| --- | --- | --- |
| Event loop, job queues, closures, prototypes, Proxy, ESM/CJS semantics, `using`, Temporal | javascript | typescript, react, solidjs, nodejs |
| libuv phases, `nextTick`, streams/backpressure, V8 GC tuning, module loaders | nodejs | javascript, cloudflare |
| Type-level TS for JSX / components | typescript (module 12) | react, solidjs |
| Framework mechanics (Fiber, lanes, RSC, signals graph) | react / solidjs | typescript |
| Heaps, tries, graphs, Bloom/HLL/CMS math, consistent hashing _algorithm_ | dsa | data-systems, system-design, redis |
| B-tree vs LSM, WAL, MVCC theory, isolation levels, replication, sharding, CDC | data-systems | postgres, sqlite, redis, elasticsearch |
| Clocks, consistency hierarchy, consensus, leases/fencing, 2PC, CRDTs, delivery semantics | distributed-systems | data-systems, kubernetes (etcd), system-design |
| Composition under requirements, estimation, SLO math | system-design | everything |
| OCI specs, namespaces, cgroups | containers | kubernetes |
| SBOM, signing, SLSA | gitlab-ci | containers, kubernetes (CKS) |
| Policy-as-code (OPA/Rego, CEL, Kyverno, Terraform Policy) | terraform (one shared module) | kubernetes, argocd |
| ES storage, mappings, query DSL, ES\|QL, ILM | elasticsearch | observability (Kibana, APM, alerting) |
| IAM model, VPC/CIDR, storage classes, Well-Architected | cloud-foundations | aws, gcp, azure |

Root `GLOSSARY.md` holds cross-domain terms only. Every track glossary reuses the root definition and Czech translation verbatim for shared terms (`AGENTS.md` rule 2).

## 5. Multi-agent orchestration (revised 2026-10-28: Opus primary)

### Roles

| Role | Agent | Used for |
| --- | --- | --- |
| **Primary** | **Opus**: the claude.ai session (orchestrates Opus subagents, one per track; runs hermetic tests on Node 26 in its cloud workspace) and **Claude Code CLI on Opus** (Mac, with Docker and mise; takes Docker-heavy tracks and every `test:integration` lab) | Authoring, integration, final gate |
| Drafter | pi · DeepSeek | Cheap bulk first drafts on request: question banks, glossary candidates, cheatsheet tables, scaffolding |
| Challenger | pi · Muse Spark 1.3 | Adversarial review: fact attacks, missing gotchas, broken exam answers |
| Verifier | Antigravity | Browser checks of live docs and versions, render checks, Playwright, exam-guide comparison |

Companion output is input to Opus, never final content.

### Primary per track

- **Opus · Claude Code (Mac):** redis, elasticsearch, containers, kubernetes, argocd, observability, gitlab-ci, networking. These need Docker or Linux network tooling. It also adds the Docker `test:integration` labs for postgres, sqlite and distributed-systems.
- **Opus · claude.ai:** all other tracks.

### Per-track lifecycle

```
brief → Opus authors on track/<name> (Drafter used for bulk drafts)
      → hermetic tests green (Node 26) → hand-off in reviews/<name>.md
      → Challenger (Spark) + Verifier (Antigravity) findings in reviews/<name>.md
      → Opus resolves → final gate (tests, versions, links, glossary, ownership, leak scan)
      → owner merges to main
```

### Phase 1 waves

- **Wave 1 (started 2026-10-28):** typescript, react, solidjs, panda-css, javascript.
- **Wave 2:** postgres, css, data-systems, security-identity; networking (Claude Code).

### Repository hygiene (done 2026-10-28)

- History sanitized: 3 unpushed commits rewritten to remove 24 absolute local links. Pushed history was already clean, so no force-push is needed.
- Secret scan: no real secrets. Only teaching placeholders.
- Backups (local only, never push): branch `backup/pre-sanitize-2026-10-28` and `.git/backup-pre-sanitize-2026-10-28.bundle`.

## 6. Decisions

| # | Decision | Status |
| --- | --- | --- |
| D1 | Add `architecture/networking` and `architecture/security-identity` (research pending). Linux basics are folded into containers modules 2–4. The plan is now **28 tracks**. | ✅ decided 2026-10-28 |
| D2 | Pin the latest stable versions. Where an exam targets an older version, add an "exam delta" callout. **All tooling is pinned per track with mise** (`.mise.toml` and `mise.lock`): node, python/uv, rust, nim, go, java (TLA+), kubectl, kind, helm, terraform, opentofu and so on. No global installs. Global and project agent instructions apply. | ✅ decided |
| D3 | The second pi model is **Muse Spark 1.3** (Meta). It is a full peer: author and reviewer. | ✅ decided |
| D4 | Code languages, below. | ✅ decided |
| D5 | Panda: **option A**, a full migration to v2.4. **General rule:** track the latest versions, with "Then vs now" comparisons wherever practice changed (written into AGENTS.md § Version Currency). | ✅ decided |
| D8 | **Opus is the primary agent.** DeepSeek drafts, Muse Spark challenges, Antigravity verifies. All three are companions or helpers, never final authors. Git history is sanitized for paths, secrets and personal info. | ✅ decided 2026-10-28 |
| D7 | Add a CSS & web-platform foundation track, `languages/css`. Panda keeps only Panda-specific mechanics. | ✅ decided |
| D6 | AGENTS.md now requires certification/exam coverage: an exam list, a domain→module matrix, question banks with answers, and mock exams (`exams/` directory in every track). | ✅ decided, AGENTS.md updated 2026-10-28 |

### D4: code languages

- **Primary, always:** every algorithm or protocol gets
  - **pseudocode** in CLRS style, with 1-based arrays when CLRS uses them, and loop invariants stated.
  - **TypeScript**, with `node --test` and fast-check property tests.
- **Secondary, where applicable.** A secondary language is added only when it teaches something the primary pair cannot.
  - **Python**: interview live-coding idioms (`heapq`, `bisect`, `collections`, `functools.cache`), tested with pytest and hypothesis.
  - **Rust**: when ownership changes the design, e.g. linked structures, arena-allocated graphs, `Rc<RefCell<…>>` vs indices, and `unsafe` in intrusive structures. Tested with `cargo test` and proptest.
  - **Nim**: when value semantics, ARC/ORC memory, compile-time evaluation (`static`, macros) or zero-cost generics show something new. Tested with `testament` / `nimble test`.
- **Layout:** `examples/<lang>/…`, with one mise-pinned toolchain per language, and a `test` script that runs every language present.
- **Scope:** applies to `algorithms/dsa` fully; to `distributed-systems` and `data-systems` for core algorithms; to other tracks only where it helps.
