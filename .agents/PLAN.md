# Zero-to-One — Master Plan v1 (2026-10-28)

Status: **APPROVED 2026-10-28**. Phase 0 is done by Claude; Phase 1 briefs are in `.agents/briefs/`.

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

## 2. Target taxonomy: 29 tracks (5 existing, 24 new) and about 355 modules

| Root | Track | Mods | State | Phase |
|---|---|---:|---|:-:|
| languages | `typescript` | 13 | existing: TS 7 update, dedupe 09–13 to typing only | 1 |
| languages | `javascript` | 13 | **new foundation**: ECMA-262 2026 semantics | 1 |
| languages | `python` | 13 | new: 3.15 | 2 |
| languages | `css` | 14 | **new foundation** (D7): cascade, layout, container queries, `@property`, view transitions, rendering pipeline | 1 |
| technologies | `react` | 12 | existing: expand ~5× (modules are ~70 lines today), add 19.2/19.3 | 1 |
| technologies | `solidjs` | 10 | existing: rc.18 → rc.19, `@solidjs/vite-plugin` start mode | 1 |
| technologies | `panda-css` | 12 | existing: **^0.51 → 2.4 (two breaking majors)** | 1 |
| technologies | `postgres` | 13 | existing: restructure 10 → 13, fix PG17/18 mislabels, PG19 deltas | 1 |
| technologies | `nodejs` | 14 | new: Node 26 LTS | 2 |
| technologies | `sqlite` | 11+1 | new: 3.54; module 12 = libSQL/Turso (not its own track until Turso 1.0) | 2 |
| technologies | `redis` | 12 | new: Redis 8.10 and the Valkey 9.x deltas | 2 |
| technologies | `elasticsearch` | 12 | new: ES 9.5 / Lucene 10; OpenSearch deltas | 2 |
| technologies | `containers` | 12 | new: Docker 29 + Podman 6, OCI, namespaces, cgroups v2 | 3 |
| technologies | `kubernetes` | 14 | new: 1.37; CKA, CKAD, CKS | 3 |
| technologies | `terraform` | 12 | new: 1.17 + OpenTofu 1.13; Associate 004 | 3 |
| technologies | `argocd` | 11 | new: Argo CD 3.5 + Rollouts; CGOA plus the CAPA Argo CD parts | 3 |
| technologies | `gitlab-ci` | 9 | new: owns supply-chain security (SBOM, cosign, SLSA) | 3 |
| technologies | `observability` | 13 | new: OTel, Prometheus, Grafana LGTM, Kibana/Elastic Observability | 3 |
| technologies | `aws` | 10 | new, thin: SAA-C03, DVA-C03, SAP-C03 | 4 |
| technologies | `gcp` | 9 | new, thin: ACE, PCA | 4 |
| technologies | `azure` | 9 | new, thin: AZ-104, AZ-305, AI-200 (AZ-204 retired) | 4 |
| technologies | `cloudflare` | 12 | new: Workers/workerd, Durable Objects, D1/R2/KV/Queues | 4 |
| algorithms | `dsa` | 14 | new: CLRS 4e / MIT 6.1210; TypeScript + fast-check | 2 |
| architecture | `data-systems` | 12 | **new foundation**: DDIA 2e ch. 3–8, 11–13 | 1 |
| architecture | `distributed-systems` | 14 | new: MIT 6.5840, DDIA 2e ch. 9–10; Raft simulator | 2 |
| architecture | `cloud-foundations` | 14 | **new foundation**: provider-neutral; concept → AWS/GCP/Azure mapping | 4 |
| architecture | `system-design` | 14 | new, **last**: composes every other track | 4 |

Module lists, gotchas, interview topics and proof strategy for each track: see the matching `.agents/research/*.md` section.

### Added by decision D1 (research: `.agents/research/G-foundations.md`)
| architecture | `networking` | 14 | **new foundation**: RFC-anchored; TLS 1.3 = RFC 9846, ECH = RFC 9849, QUIC/HTTP3 | 1 |
| architecture | `security-identity` | 14 | **new foundation**: OWASP Top 10:2025, ASVS 5.0, OAuth 2.1 (draft-16), RFC 10017, WebAuthn L3 | 1 |

Many tracks assume these as prerequisites:
- `architecture/networking`: TCP/IP, DNS, TLS 1.3, HTTP/1.1, HTTP/2 and HTTP/3, QUIC, BGP basics.
- `architecture/security-identity`: OAuth 2.1, OIDC, JWT, PKI and mTLS, secrets, OWASP.
- `technologies/linux`: processes, signals, filesystems, systemd, nftables.

## 3. Execution phases (dependency order)

| Phase | Content | Why first |
|---|---|---|
| 0 | Repo hygiene, `AGENTS.md` v2, ownership registry, briefs: done by Claude (this session) | Every agent needs the contract |
| 1 | Fix the 5 existing tracks; build `javascript` and `data-systems` | Stops content going stale; creates the foundations everything links to |
| 2 | nodejs, python, dsa, sqlite, redis, elasticsearch, distributed-systems | Runtimes and stores |
| 3 | containers → kubernetes → argocd; terraform; gitlab-ci; observability | Platform, in prerequisite order |
| 4 | cloud-foundations → aws, gcp, azure, cloudflare → system-design | Composes everything above |

**Phase 0 hygiene list:**
- ✅ Absolute local links replaced with relative ones (working tree and history).
- The root README lists the Solid glossary twice.
- Align `@types/node` (it is 22, 24 or 26 depending on the track) and pin Node 26 in every `.mise.toml`.
- `react` has no `mise.lock`.
- `panda-css` has no runtime test.
- `typescript` has no example for module 06.
- Empty `.pi/tasks` dirs: gitignore them.
- Add a `Verified against <versions> on <date>` line to every track README.

## 4. Dedupe: concept ownership (excerpt; full registry → `.agents/OWNERSHIP.md`)

| Concept | Owner | Cross-link only |
|---|---|---|
| Event loop, job queues, closures, prototypes, Proxy, ESM/CJS semantics, `using`, Temporal | javascript | typescript, react, solidjs, nodejs |
| libuv phases, `nextTick`, streams/backpressure, V8 GC tuning, module loaders | nodejs | javascript, cloudflare |
| Type-level TS for JSX / components | typescript (module 12) | react, solidjs |
| Framework mechanics (Fiber, lanes, RSC, signals graph) | react / solidjs | typescript |
| Heaps, tries, graphs, Bloom/HLL/CMS math, consistent hashing *algorithm* | dsa | data-systems, system-design, redis |
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
|---|---|---|
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
|---|---|---|
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
