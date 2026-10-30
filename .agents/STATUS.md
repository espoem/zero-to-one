# Status Board

Update this file when a track changes state. Keep the history in `reviews/<track>.md` and in git.

**Roles** (AGENTS.md § Multi-Agent Workflow):
- Primary author: **Opus**, either the claude.ai session with Opus subagents or Claude Code CLI on the Mac.
- Companions on every track: **pi · DeepSeek** (drafter), **pi · Muse Spark 1.3** (challenger), **Antigravity** (verifier).

States: ⬜ brief ready → 🟦 authoring → 🟨 challenge + verify → 🟧 resolving findings → 🟪 final gate → ✅ merged. ⛔ blocked (state why in Notes).

| Phase | Track | Primary | Branch | State | Notes |
|:-:|---|---|---|---|---|
| 1 | `languages/typescript` | Opus · claude.ai | `track/typescript` | ✅ merged | Merged 2026-10-30: 132 tests passing, TS 7.0.2 pinned, 72-q bank, challenger & verifier gates complete. |
| 1 | `technologies/panda-css` | Opus · claude.ai | `track/panda-css` | ✅ merged | Merged 2026-10-30: 118 tests passing (45 in Chromium), Panda 2.4.0, 60-q bank, challenger & verifier gates complete. |
| 1 | `technologies/postgres` | Opus · claude.ai | `track/postgres` | ✅ merged | Merged 2026-10-30: 13 modules, 13 PGlite tests passing hermetically, PG18.6 / Node 26.12.1 pinned, 65-q EDB bank, challenger & verifier gates complete. |
| 1 | `technologies/react` | Opus · claude.ai | `track/react` | ✅ merged | Merged 2026-10-30: 222 tests passing, React 19.3.1, 65-q bank, challenger & verifier gates complete. |
| 1 | `technologies/solidjs` | Opus · claude.ai | `track/solidjs` | ✅ merged | Merged 2026-10-30: 216 tests passing, SolidJS 2.0-rc.19, 60-q bank, challenger & verifier gates complete. |
| 1 | `architecture/data-systems` | Opus · claude.ai | `track/data-systems` | ✅ merged | Merged 2026-10-30: 12 modules, 31 tests passing hermetically, Node 26.12.1 / TS 7.0.2 pinned, 65-q bank, challenger & verifier gates complete. |
| 1 | `architecture/networking` | Opus · Claude Code | `track/networking` | ✅ merged | Merged 2026-10-30: 14 modules, 33 tests passing hermetically, Node 26.12.1 / TS 7.0.2 pinned, CompTIA Network+ N10-009 75-q bank & 90-min mock exam, challenger & verifier gates complete. |
| 1 | `architecture/security-identity` | Opus · claude.ai | `track/security-identity` | ⬜ brief ready | |
| 1 | `languages/css` | Opus · claude.ai | `track/css` | ✅ merged | Merged 2026-10-30: 14 modules, 26 tests passing in Playwright/Node 26, 75-q senior interview bank, challenger & verifier gates complete. |
| 1 | `languages/javascript` | Opus · claude.ai | `track/javascript` | ✅ merged | Merged 2026-10-30: 355 tests passing, Node 26.12.1 / ES2026, 78-q bank, challenger & verifier gates complete. |
| 2 | `algorithms/dsa` | Opus · claude.ai | `track/dsa` | ⬜ brief ready | |
| 2 | `architecture/distributed-systems` | Opus · claude.ai | `track/distributed-systems` | ⬜ brief ready | |
| 2 | `languages/python` | Opus · claude.ai | `track/python` | ⬜ brief ready | |
| 2 | `technologies/elasticsearch` | Opus · Claude Code | `track/elasticsearch` | ⬜ brief ready | |
| 2 | `technologies/nodejs` | Opus · claude.ai | `track/nodejs` | ⬜ brief ready | |
| 2 | `technologies/redis` | Opus · Claude Code | `track/redis` | ⬜ brief ready | |
| 2 | `technologies/sqlite` | Opus · claude.ai | `track/sqlite` | ⬜ brief ready | |
| 3 | `technologies/argocd` | Opus · Claude Code | `track/argocd` | ⬜ brief ready | |
| 3 | `technologies/containers` | Opus · Claude Code | `track/containers` | ⬜ brief ready | |
| 3 | `technologies/gitlab-ci` | Opus · Claude Code | `track/gitlab-ci` | ⬜ brief ready | |
| 3 | `technologies/kubernetes` | Opus · Claude Code | `track/kubernetes` | ⬜ brief ready | |
| 3 | `technologies/observability` | Opus · Claude Code | `track/observability` | ⬜ brief ready | |
| 3 | `technologies/terraform` | Opus · claude.ai | `track/terraform` | ⬜ brief ready | |
| 4 | `architecture/cloud-foundations` | Opus · claude.ai | `track/cloud-foundations` | ⬜ brief ready | |
| 4 | `architecture/system-design` | Opus · claude.ai | `track/system-design` | ⬜ brief ready | |
| 4 | `technologies/aws` | Opus · claude.ai | `track/aws` | ⬜ brief ready | |
| 4 | `technologies/azure` | Opus · claude.ai | `track/azure` | ⬜ brief ready | |
| 4 | `technologies/cloudflare` | Opus · claude.ai | `track/cloudflare` | ⬜ brief ready | |
| 4 | `technologies/gcp` | Opus · claude.ai | `track/gcp` | ⬜ brief ready | |

## Dependencies
- Phase 1 foundations (javascript, css, data-systems, networking, security-identity) run alongside the existing-track fixes. The existing tracks add cross-links to the foundations as those merge.
- containers → kubernetes → argocd; terraform runs in parallel; gitlab-ci after containers; observability after kubernetes.
- cloud-foundations → aws, gcp, azure; cloudflare is independent; system-design runs last.
