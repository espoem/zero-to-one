# Review: languages/scala · reviewer challenger & verifier · 2026-11-20 · branch track/scala-fp

## Summary

Verdict: **approved after resolution**. All mechanical, schema, depth, leak, and test gates passed (`25/25` Scala 3.10.1 MUnit/ScalaCheck tests passing under `-Werror -Wunused:all` and `scalafmt --check`, `65/65` exam questions, `0` broken links/tables/Mermaid/KaTeX/headings). Challenger reported 3 P0, 3 P1, 3 P2, and 2 P3 findings: P0 #1 (`fs2-core:3.16.0`) was disproven against live Maven Central classpath resolution (`repo1.maven.org/maven2/co/fs2/fs2-core_3/3.16.0/fs2-core_3-3.16.0.jar`); all remaining P0/P1/P2/P3 findings were confirmed and resolved.

## Findings

- [x] **P0 (disproven by live Maven Central resolution)** `languages/scala/examples/project.scala:4`: Challenger flagged `co.fs2::fs2-core:3.16.0` as non-existent based on web search without shell access. Live `scala compile --print-class-path examples` and `mise run test` confirmed `https://repo1.maven.org/maven2/co/fs2/fs2-core_3/3.16.0/fs2-core_3-3.16.0.jar` resolves and passes all 6 FS2/Cats Effect tests. Kept `3.16.0`.
- [x] **P0** `languages/scala/modules/10:239,405`, `modules/01:168`, `exams/scala-epfl-interview.md:1136,1234` (`Q-SCALA-059`, `Q-SCALA-064`): Misstated `-Ytasty-reader` directionality and Scala 3.7 cutoff → corrected Mermaid diagram, prose, and both exam questions to state that Scala 3 reads 2.13 `.class` pickles natively while Scala 2.13's `-Ytasty-reader` supports Scala 3 TASTy up to Scala 3.7.
- [x] **P0** `languages/scala/modules/01:261`: Incorrectly stated `@tailrec` allows self-calls inside `finally` → corrected to state `try`, `catch`, and `finally` all reject `@tailrec` and recommended `scala.util.Try` outside `try`/`catch`/`finally`.
- [x] **P1** `languages/scala/modules/08:239-251`: Single-flight cache `getOrCompute` left `Deferred` uncompleted on error/cancelation → switched to `Deferred[IO, Either[Throwable, String]]` with `IO.uncancelable` + `guaranteeCase` completing `fresh` on error and cancelation.
- [x] **P1** `languages/scala/modules/07:213`: Invalid Ox syntax `repeatWhile(true):` → fixed to `repeatWhile:`.
- [x] **P1** `languages/scala/modules/03:14,275`: Contradictory `-Yexplicit-nulls` parent type (`Matchable` vs `Any`) → fixed both Mermaid node and prose to direct subtype of `Any`.
- [x] **P2** `languages/scala/GLOSSARY.md:68,76,94`: Czech terminology errors (`Vláknové vlákno`, `Univerzální typová rovnost`, `Opákní alias typu`) → corrected to `Vlákno na úrovni runtime (_fiber_)`, `Multiverzální rovnost (\`CanEqual\`)`, and `Neprůhledný typový alias (\`opaque type\`)`.
- [x] **P2** `languages/scala/modules/02:76-85`: Stranded `Vector` 32-way radix-trie table in Section 1 → moved to Section 4 alongside immutable collection internals.
- [x] **P2** `languages/scala/modules/05:266-322`: Duplicated `ST` derivation owned by `architecture/functional-programming` M12 → replaced with concise Scala 3 delta (`PolyFunction` + `opaque type` comparison table) cross-linking FP M12.
- [x] **P3** `languages/scala/modules/04:169` & `exams/scala-epfl-interview.md` (`Q-SCALA-009`, `031`, `041`, `056`, `064`): Removed `"Wait: ..."` prose self-talk and added consistent `A–D` options + distractor rationales to all 5 ordering questions.

## Agent Provenance

- Orchestration & integration: Antigravity (root)
- Implementation workers (`flash` tier, disjoint lanes validated via `lane-check.ts`): `scala-modules-1` (M01–M05), `scala-modules-2` (M06–M10), `scala-meta-code` (README, GLOSSARY, CHEATSHEET, exams, Scala 3.10.1 proofs)
- Independent read-only verification (`flash`): `zto-verifier` (PASS across all gates)
- Adversarial challenge (`flash`, read-only): `zto-challenger`

## Resolution

- [x] All confirmed P0, P1, P2, and P3 findings fixed on `track/scala-fp`; `mise run test`, `mise run lint`, `mise run fmt:check`, `bun tools/check-questions.ts`, and `npm run check` re-verified exit code `0`.
