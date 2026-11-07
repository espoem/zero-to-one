# Hand-off to Claude Code (Mac)

These are the tasks the claude.ai session cannot do itself: it has no Docker, no mise, no macOS, and its network is restricted. Run each prompt in Claude Code (Opus) from the repository root on the Mac.

## Branch rule for this hand-off

The claude.ai session is still committing to some `track/*` branches in its own workspace and copies them to this repository. To avoid diverging history:

- **Never commit to `main` or any `track/*` branch.**
- Work on a new branch per task, named `mac/<task>` (for example `mac/redis-integration`), created from the branch named in the prompt.
- Commit with your own git identity, using Conventional Commits and no trailers (AGENTS.md § Multi-Agent Workflow rule 7).
- When finished, tell the claude.ai session which `mac/*` branches exist. It merges them into the right track branches and runs the final gate.

Before every commit, from the repository root:

```bash
npm ci && npm run check
```

`npm run check` runs oxfmt, oxlint and the wrap, table, link and Mermaid checks. Also run each touched track's `npm test` and `npm run typecheck`.

---

## Prompt 1: run every Docker and integration suite and fix what fails

```text
You are working in the zero-to-one repository on my Mac. Read AGENTS.md and .agents/HANDOFF-CLAUDE-CODE.md (branch rule) first.

None of the integration suites below has ever run against real services, because the authoring
workspace had no Docker. For each one: create the branch shown, make sure Docker is running, run the
suite, and fix every failure. Fix the TEST when the assertion encoded a wrong expectation, and fix the
MODULE TEXT or EXAM ANSWER when the prose taught the wrong behaviour. Record every finding and fix in
the track's .agents/reviews/<track>.md under "## Integration run (<date>, Claude Code)", including
the exact service versions used.

1. technologies/postgres (from main → mac/postgres-integration):
   `cd technologies/postgres && mise install && npm ci && npm run test:integration`
   (docker compose; multi-session MVCC/locking, replication, PgBouncer, PITR, AIO).
2. technologies/react (from main → mac/react-integration):
   `npm run test:integration` (Playwright browser checks: view transitions, fragment refs,
   Trusted Types, hung action outside act()). Run `npx playwright install chromium` once.
3. technologies/elasticsearch (from track/elasticsearch → mac/elasticsearch-integration):
   a) `docker compose up -d` then `npm run test:integration` (single node, 9.5.6)
   b) `ES_NODES=3` with compose.3node.yml
   c) compose.secure.yml with ES_PASSWORD set
   The review file lists the least-certain assertions (highlight output, PIT paging, ILM timing,
   error statuses, allocation explain wording). Also confirm whether path.repo=/tmp/es-snapshots
   works as configured.
4. technologies/redis (from track/redis → mac/redis-integration):
   run `npm run test:integration` against Redis 8.10.x (default image), then again with
   `REDIS_IMAGE=valkey/valkey:9.1.3`. 13 tests have only ever skipped (8.x-only: hash-field
   expiry, HGETEX, LRM eviction, DELEX, INCREX, JSON, Query Engine, Bloom, Vector Sets, WAITAOF,
   HOTKEYS). Reply shapes for FT.SEARCH, HTTL, VADD/VSIM and HOTKEYS GET are the likeliest to need
   fixes. Also bring up the docker-compose labs in the track and check they start.
5. technologies/nodejs (from track/nodejs → mac/nodejs-integration):
   `npm run test:integration` (Docker: PID 1 signal handling, memory-limit / heap sizing).
6. technologies/sqlite (from track/sqlite → mac/sqlite-integration):
   run the Turso/libSQL integration test against a local `sqld` (or Turso Cloud if available,
   via TURSO_DATABASE_URL). Confirm or correct the module 12 claims marked unverified
   (readYourWrites, embedded-replica behaviour).

Work through them one at a time and commit per track. Finish with a table: track → passed/failed/fixed, versions used.
```

## Prompt 2: regenerate `mise.lock` files and verify a clean macOS setup

```text
Read AGENTS.md and .agents/HANDOFF-CLAUDE-CODE.md first. Branch: from main → mac/mise-locks.

Several mise.lock files were hand-written or copied in a sandbox without mise: technologies/nodejs
(no checksums at all), technologies/elasticsearch, technologies/redis and technologies/sqlite
(copied from other tracks). For each of those four tracks, check out the track branch's version of
the directory into your branch (git checkout track/<name> -- technologies/<name>/.mise.toml), run
`mise lock` there, and commit only the regenerated mise.lock files. Use one branch per track if that
is simpler: mac/mise-lock-<name>.

Then, for EVERY track that has a .mise.toml on main, verify a clean macOS setup works:
`mise install && mise exec -- npm ci && mise exec -- npm test` (Python: `mise exec -- uv sync --locked
&& mise exec -- uv run pytest`). Report any track that does not install or pass on macOS, and fix it
if the cause is the setup (lockfile, pin, platform binary) rather than the content.
```

## Prompt 3: fetch the primary sources the sandbox could not reach

```text
Read AGENTS.md and .agents/HANDOFF-CLAUDE-CODE.md first. The authoring sandbox could not download
these official sources (blocked hosts or browser-only pages). Fetch each one (curl, or open it in a
browser), then update the exam coverage matrices and the domain weights in the exam banks:

1. Redis Certified Associate Developer exam guide (PDF linked from redis.io/university, hosted on
   cdn.sanity.io). Replace the provisional domain weights in technologies/redis/exams/README.md §1
   and the bank header, and re-balance question counts if a domain is under-covered.
   Branch: from track/redis → mac/redis-exam-guide.
2. Elastic Certified Engineer exam objectives for the 9.3-based exam (elastic.co training /
   certification pages). Compare them with technologies/elasticsearch/exams/README.md and fix the
   matrix. Branch: from track/elasticsearch → mac/elasticsearch-exam-guide.
3. OpenJS JSNSD domain weights (retired exam; use the Wayback Machine if needed). They are marked
   (unverified) in technologies/nodejs/exams/README.md. Branch: from track/nodejs →
   mac/nodejs-exam-guide.

Cite the exact source URL and retrieval date next to each updated weight.
```

## Prompt 4: author the Docker-heavy Phase 3 tracks (Claude Code is primary)

```text
You are the PRIMARY author (Opus) for the zero-to-one track "containers" (then "kubernetes").
Read AGENTS.md (binding), .agents/HANDOFF-CLAUDE-CODE.md (branch rule; for authoring a NEW track
the branch is track/<name> created from main, which you own end to end), .agents/briefs/<name>.md,
.agents/OWNERSHIP.md and .agents/REVIEW.md.

Follow .agents/KICKOFF.md prompt P. Bar to match: the merged tracks on main (for example
languages/javascript, architecture/data-systems, technologies/postgres). Every module must be at
least 400 meaningful lines, with formal mechanics, production failure modes, "Then vs now" where
practice changed, parsable Mermaid diagrams, and an Interview Drill. Every claim that can be executed
needs a test, including negative tests. Hermetic tests go in `test`. Docker, kind or k3d labs go in
`test:integration` and run for real here, because this machine has Docker.

Exams: CKA, CKAD and CKS for kubernetes; for containers, use the recognised interview format plus
any current Docker or Podman certification if one exists. Write ≥60 original questions per exam,
with hands-on tasks verified by scripts, and a distinct mock exam. Pin every tool with mise
(docker CLI excluded; kind, kubectl and helm pinned). `npm run check` must pass on every commit.
No trailers. Write the hand-off in .agents/reviews/<name>.md and set STATUS to 🟨 when done.
Start with containers; do kubernetes after containers is 🟨.
```

---

## Not for Claude Code: these are yours

- **Push.** `main` and the `track/*` branches are unpushed. Push when you're happy.
- **Commit signing.** GitHub shows the commits as "Unverified" because they are unsigned. Set up SSH or GPG signing if you want the badge.
- **Challenger and verifier passes.** Run prompts **C** (pi · Muse Spark 1.3) and **V** (Antigravity) from `.agents/KICKOFF.md` on every track marked 🟨 in `.agents/STATUS.md`.
