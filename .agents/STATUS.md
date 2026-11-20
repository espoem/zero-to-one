# Status Board

Update this file when a track changes state. Keep the history in `reviews/<track>.md` and in git.

**Roles** (AGENTS.md § Multi-Agent Workflow):

- Primary author: **Opus**, either the claude.ai session with Opus subagents or Claude Code CLI on the Mac.
- Companions on every track: **pi · DeepSeek** (drafter), **pi · Muse Spark 1.3** (challenger), **Antigravity** (verifier).

States: ⬜ brief ready → 🟦 authoring → 🟨 challenge + verify → 🟧 resolving findings → 🟪 final gate → ✅ merged. ⛔ blocked (state why in Notes).

| Phase | Track | Primary | Branch | State | Notes |
| :-: | --- | --- | --- | --- | --- |
| 1 | `languages/typescript` | Opus · claude.ai | `track/typescript` | ✅ merged | Merged 2026-10-30: 132 tests passing, TS 7.0.2 pinned, 72-q bank, challenger & verifier gates complete. |
| 1 | `technologies/panda-css` | Opus · claude.ai | `track/panda-css` | ✅ merged | Merged 2026-10-30: 118 tests passing (45 in Chromium), Panda 2.4.0, 60-q bank, challenger & verifier gates complete. |
| 1 | `technologies/postgres` | Opus · claude.ai | `track/postgres` | ✅ merged | Merged 2026-10-30 (integration updated 2026-11-07): 13 modules, 13 PGlite hermetic + 11 live PG 18.6 integration tests passing, 65-q EDB bank, challenger & verifier gates complete. |
| 1 | `technologies/react` | Opus · claude.ai | `track/react` | ✅ merged | Merged 2026-10-30 (Playwright integration updated 2026-11-07): 222 unit + 6 Chromium Playwright tests passing, React 19.3.1, 65-q bank, challenger & verifier gates complete. |
| 1 | `technologies/solidjs` | Opus · claude.ai | `track/solidjs` | ✅ merged | Merged 2026-10-30: 216 tests passing, SolidJS 2.0-rc.19, 60-q bank, challenger & verifier gates complete. |
| 1 | `architecture/data-systems` | Opus · claude.ai | `track/data-systems` | ✅ merged | Merged 2026-10-30: 12 modules, 31 tests passing hermetically, Node 26.12.1 / TS 7.0.2 pinned, 65-q bank, challenger & verifier gates complete. |
| 1 | `architecture/networking` | Opus · Claude Code | `track/networking` | ✅ merged | Merged 2026-10-30; deepened 2026-11-08: 14 modules, 33 tests passing hermetically, CompTIA Network+ N10-009 75-q bank, Senior Systems Interview 60-q bank & mock exam, 30-concept master matrix, all gates clean. |
| 1 | `architecture/security-identity` | Opus · claude.ai | `track/security-identity` | ✅ merged | Merged 2026-10-30: 14 modules, 54 tests passing hermetically, Node 26.12.1 / TS 7.0.2 pinned, CompTIA Security+ SY0-701 75-q bank & 90-min mock exam, challenger & verifier gates complete. |
| 1 | `languages/css` | Opus · claude.ai | `track/css` | ✅ merged | Merged 2026-10-30: 14 modules, 26 tests passing in Playwright/Node 26, 75-q senior interview bank, challenger & verifier gates complete. |
| 1 | `languages/javascript` | Opus · claude.ai | `track/javascript` | ✅ merged | Merged 2026-10-30 (pedagogy & Temporal deepened 2026-11-07): 14 modules, 355 tests passing, Node 26.13.0 / ES2026, 100-q bank, challenger & verifier gates complete. Just JavaScript adaptation 2026-11-09 on `track/javascript-just-javascript`: quiz payload captured, Q-JSI-007–016, 025–027, 041–049 added, modules 02/03 extended; bank renumbered in reading order 2026-11-10. |
| 2 | `algorithms/dsa` | Opus · claude.ai | `track/dsa` | ✅ merged | Merged 2026-10-30 (deepened 2026-11-07): 14 modules (incl. M13 concurrency & Rust/Nim proofs), 120 TS + 49 Python + Rust + Nim tests passing, 75-q MIT 6.1210/6.1220J & FAANG bank + mock, challenger & verifier gates complete. |
| 2 | `architecture/distributed-systems` | Opus · claude.ai | `track/distributed-systems` | ✅ merged | Merged 2026-10-30 (deepened 2026-11-07): 14 modules (400+ lines each), 94 hermetic tests passing, Node 26.12.1 / TS 7.0.2 pinned, 75-q MIT 6.5840 & Staff loop bank + mock, challenger & verifier gates complete. |
| 2 | `languages/python` | Opus · claude.ai | `track/python` | ✅ merged | Merged 2026-10-30: 14 modules, 82 tests passing hermetically in 0.76s, Python 3.15.2 / uv 0.13.6 pinned, PCAP/PCPP1 & Senior loop 75-q bank + 90-min mock exam, challenger & verifier gates complete. |
| 2 | `technologies/elasticsearch` | Opus · Claude Code | `track/elasticsearch` | ✅ merged | Merged 2026-11-07: 12 modules (402–461 lines), 253 hermetic + 52 live ES 9.5.6 integration tests passing, 70-q ECE 9.3 bank + 12-task mock, challenger, verifier & final gates complete. |
| 2 | `technologies/nodejs` | Opus · claude.ai | `track/nodejs` | ✅ merged | Merged 2026-11-07: 14 modules (400–435 lines), 345 hermetic + 3 Docker PID 1/heap integration tests passing, Node 26.13.0 / TS 7.0.2 pinned, 80-q bank + 40-q mock + 6 hands-on suites, challenger, verifier & final gates complete. |
| 2 | `technologies/redis` | Opus · Claude Code | `track/redis` | ✅ merged | Merged 2026-11-07: 12 modules (404–488 lines), 184 hermetic + 88 live Redis 8.10.3 / Valkey 9.1.3 integration tests passing, 65-q RCAD bank + mock aligned to 5 official domains, challenger, verifier & final gates complete. |
| 2 | `technologies/sqlite` | Opus · claude.ai | `track/sqlite` | ✅ merged | Merged 2026-11-07: 12 modules (400–447 lines), 222 TS + 7 Python hermetic + live `sqld` integration tests passing, SQLite 3.54.1 / Node 26.12.1 pinned, 75-q bank + 30-q mock, challenger, verifier & final gates complete. |
| 3 | `technologies/argocd` | Opus · Claude Code | `track/argocd` | ✅ merged | Merged 2026-11-07: 11 modules (402–512 lines), 11 hermetic + 1 integration tests passing, 67-q CGOA/CAPA bank + mock, challenger & verifier gates complete. |
| 3 | `technologies/containers` | Opus · Claude Code | `track/containers` | ✅ merged | Merged 2026-11-07: 12 modules (401–518 lines), 55 hermetic + 1 integration tests passing, 65-q bank + mock, challenger & verifier gates complete. |
| 3 | `technologies/gitlab-ci` | Opus · Claude Code | `track/gitlab-ci` | ✅ merged | Merged 2026-11-07: 9 modules (451–677 lines), 52 hermetic + 2 integration tests passing, 65-q bank + mock, challenger & verifier gates complete. |
| 3 | `technologies/kubernetes` | Opus · Claude Code | `track/kubernetes` | ✅ merged | Merged 2026-11-07: 14 modules (433–718 lines), 54 hermetic + 1 integration tests passing, 75-q CKA/CKAD/CKS bank + 3 mocks, challenger & verifier gates complete. |
| 3 | `technologies/kubernetes` (roadmap.sh integration) | Opus · Claude Code | `track/kubernetes-roadmap` | ✅ merged | 2026-11-10: roadmap coverage matrix; 186-question bank (61 CKA / 61 CKAD / 64 CKS, sequential reading-order IDs); 3 full mocks with scoring keys; 12-q interview bank; module additions (kubeconfig, DR design, cost optimization, immutable infrastructure); Gateway API v1.7.0; mise pins refreshed. Challenger and verifier gates complete; all findings resolved. |
| 3 | `technologies/observability` | Opus · Claude Code | `track/observability` | ✅ merged | Merged 2026-11-07: 13 modules (401–530 lines), 52 hermetic + 1 integration tests passing, 65-q PCA/OTCA bank + mock, challenger & verifier gates complete. |
| 3 | `technologies/terraform` | Opus · claude.ai | `track/terraform` | ✅ merged | Merged 2026-11-07: 12 modules (405–520 lines), 57 hermetic + 1 integration tests passing, 65-q Associate 004 bank + mock, challenger & verifier gates complete. |
| 4 | `architecture/cloud-foundations` | Opus · claude.ai | `track/cloud-foundations` | ✅ merged | Merged 2026-11-07: 14 modules (400+ lines), 30 tests passing, MAPPING.md, 65-q exam bank + mock, challenger, verifier & final gates complete. |
| 4 | `technologies/aws` | Opus / Antigravity | `main` | ✅ merged | Merged 2026-11-08: 14 modules (400+ lines), 65-q SAA-C03 bank + mock, 38 hermetic tests passing, challenger & verifier gates resolved and complete. |
| 4 | `technologies/gcp` | Opus / Antigravity | `main` | ✅ merged | Merged 2026-11-08: 10 modules (400+ lines), 65-q ACE bank + mock, full PCA matrix, 30 hermetic tests passing, challenger & verifier gates resolved and complete. |
| 4 | `technologies/cloudflare` | Opus / Antigravity | `main` | ✅ merged | Merged 2026-11-08: 12 modules, 65-q exam bank + mock, 16 hermetic + workerd tests passing, challenger & verifier gates resolved and complete. |
| 4 | `technologies/azure` | Opus / Antigravity | `track/azure` | ✅ merged | Merged 2026-11-20: 10 modules (6,500+ lines), 62 hermetic + 1 Azurite integration tests passing, 190-q AZ-104/AZ-305/AI-200 banks + 3 mocks, verifier & Grok-4.7 challenger findings resolved. |
| 4 | `architecture/system-design` | Opus / Antigravity | `track/system-design` | ✅ merged | Merged 2026-11-20: 14 modules (6,600+ lines), 33 hermetic + 3 optional Redis integration tests passing, 70-q Staff/Principal bank + 50-q mock + 2× 60m design loops, verifier & pro challenger findings resolved. |
| 5 | `architecture/functional-programming` | Antigravity | `track/scala-fp` | ✅ merged | Merged 2026-11-20: 12 modules (424–483 lines each), 52-term glossary, 65-q bank + mock, 26 TS + 12 Scala 3 tests passing; challenger & verifier gates resolved and clean. |
| 5 | `languages/scala` | Antigravity | `track/scala-fp` | ✅ merged | Merged 2026-11-20: 10 modules (400–453 lines each; Scala 3.10.1 / 3.9 LTS / JDK 25 / Cats 2.13 / CE3 3.7.1 / FS2 3.16.0 / ZIO 2.1.26), 57-term glossary, 65-q EPFL/interview bank + mock, 25 Scala 3 tests passing; challenger & verifier gates resolved and clean. |

## Progress Summary (as of 2026-11-20)

- **Total Tracks**: 31
- **Completed & Merged**: 31 tracks (Phase 1: 10/10, Phase 2: 7/7, Phase 3: 6/6, Phase 4: 6/6, Phase 5: 2/2)
- **Remaining**: 0 tracks
- **Total Authored Modules**: 386 modules (all verified, >= 400 lines average, with interview drills)
- **Total Exam Questions**: 2,329+ questions (all original with distractor rationales and mock exams)
- **Verification Gates**: 100% clean (`npm run check` green, 0 broken links, 0 pending links, 0 table/katex/mermaid errors)

## Dependencies

- Phase 1 foundations (javascript, css, data-systems, networking, security-identity) run alongside the existing-track fixes. The existing tracks add cross-links to the foundations as those merge.
- containers → kubernetes → argocd; terraform runs in parallel; gitlab-ci after containers; observability after kubernetes.
- cloud-foundations → aws, gcp, azure; cloudflare is independent; system-design runs last.
