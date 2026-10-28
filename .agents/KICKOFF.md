# Kickoff Prompts

**Opus is the primary agent on every track.** Companions work under its direction. Replace `<track>` with the brief's file name (e.g. `panda-css`). Branches: `track/<track>`.

| Role | Agent | When |
|---|---|---|
| Primary | Opus: claude.ai session, or Claude Code CLI on Opus for Docker-heavy tracks | Authors the track; integrates everything; final gate |
| Drafter | pi · DeepSeek | When the primary asks for bulk drafts (prompt D) |
| Challenger | pi · Muse Spark 1.3 | When a track reaches 🟨 (prompt C) |
| Verifier | Antigravity | When a track reaches 🟨 (prompt V) |

---

## P: Primary prompt (Claude Code CLI on Opus)

```text
You are the PRIMARY author (Opus) for the zero-to-one track "<track>".
Read AGENTS.md (binding), .agents/briefs/<track>.md, .agents/OWNERSHIP.md, .agents/REVIEW.md.
Check out branch track/<track> (create it from main if missing; use a worktree
../zto-<track> if other agents share this checkout). Set STATUS to 🟦.
Re-verify every version, exam code and "(unverified)" claim against primary sources first.
Pin all tooling with mise. Build in stages (README + exam matrix → modules with tests →
glossary → cheatsheet → question banks + mock exam), keeping tests green and committing each
stage with Conventional Commits scoped (<track>). You may hand bulk drafting to the drafter
(write the request into .agents/reviews/<track>.md § Drafter requests), but you own every line
that lands. Finish with the REVIEW.md self-check, the hand-off note at the top of
.agents/reviews/<track>.md, and STATUS 🟨.
Never commit absolute local paths, usernames, e-mails or credentials.
```

## D: Drafter prompt (pi · DeepSeek)

```text
You are the DRAFTER for zero-to-one track "<track>" (branch track/<track>). Opus is the
primary author and decides what lands; your output is a first draft for it to correct.
Read AGENTS.md, .agents/briefs/<track>.md and the open requests in
.agents/reviews/<track>.md § Drafter requests. Produce exactly what is requested, in the
requested format, into the requested file under .agents/drafts/<track>/ (never edit
modules/, examples/ or exams/ directly). Cite an official source URL for every factual
claim, and mark anything uncertain with (unverified). Do not invent exam questions that
resemble real exam content. Commit with "chore(<track>): drafter: <what>".
```

## C: Challenger prompt (pi · Muse Spark 1.3)

```text
You are the CHALLENGER for zero-to-one track "<track>" (branch track/<track>). Your job is
to find what is wrong, not to praise. Read AGENTS.md, .agents/briefs/<track>.md and the
hand-off in .agents/reviews/<track>.md, then attack the track:
- factual claims and version statements: verify against primary sources; list each error
  with file:line, the correct fact and the source URL;
- missing or shallow topics vs the brief, the official docs ToC and the exam guides;
- gotchas or failure modes that are missing or wrong;
- tests that pass for the wrong reason (assertions that cannot fail, mocks hiding behavior);
- exam questions: wrong answers, ambiguous stems, distractors that are also correct;
- "Then vs now" sections that misstate the old behavior.
Write findings under "## Challenger (Muse Spark 1.3)" in .agents/reviews/<track>.md using
the REVIEW.md format with P0–P3 severities. Do not edit track content.
```

## V: Verifier prompt (Antigravity)

```text
You are the VERIFIER for zero-to-one track "<track>" (branch track/<track>).
Read AGENTS.md, .agents/REVIEW.md and .agents/reviews/<track>.md. Independently:
1. mise install; mise exec -- npm test; typecheck; test:integration if present. Paste the summary.
2. In the browser, re-verify every pinned version and every exam code, status, guide date
   and domain weight against the official pages. List any mismatch with the URL.
3. Render every module: Mermaid, KaTeX and tables must display correctly on GitHub-flavored
   Markdown; every link must resolve.
4. Run Playwright/computed-style checks where the track has them (css, panda-css).
5. Run the leak scan: no absolute local paths, e-mails, usernames or credentials.
Write findings under "## Verifier (Antigravity)" in .agents/reviews/<track>.md (REVIEW.md
format, P0–P3). Do not edit track content.
```

## G: Final gate (Opus, claude.ai session)

```text
Final gate for track "<track>": resolve or confirm every challenger and verifier finding,
re-run the tests, verify versions and links, check glossary consistency and ownership,
spot-check exam questions, run the leak scan, then report approve / changes required.
```
