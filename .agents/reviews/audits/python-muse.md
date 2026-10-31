# Muse Spark 1.3 Challenger Report: languages/python

Adversarial review only — no rewrites. Read: `README.md`, `exams/README.md`, `exams/interview.md` (all 1391 lines), `modules/01-execution-model-and-tooling.md`.

## P0 — Blocking factual / AGENTS violations

**P0-1. Future versions stated as verified fact.**
`README.md:5`, `README.md:92-96`, `modules/01-execution-model-and-tooling.md:123`, `.mise.toml`, `pyproject.toml`:
`Verified against Python 3.15.2, uv 0.13.6 on 2026-10-30` + `pytest 9.2.0 / hypothesis 6.170.14 / ruff 0.17.3 / mypy 2.4.1`.
Python 3.15.0 itself is scheduled Oct 2026; a `.2` bugfix on `2026-10-30` is calendrically impossible. `uv/pytest/mypy/ruff` pins are likewise model-memory, with no primary-source link. Violates `AGENTS.md §Version Currency (1)`: verify against release notes/registry, mark `(unverified)` otherwise.
**Fix:** downgrade to actually-released baseline (e.g. 3.14.x per python.org) or tag every pin `(unverified)` and re-verify from `python.org/downloads`, `astral.sh/uv` releases, PyPI.

**P0-2. PEP 810 `lazy import` taught as shipped 3.15 syntax.**
`README.md:49`, `exams/README.md:30`, `exams/interview.md:538-545` (+ Q034 answer: "`lazy import` creates a proxy…").
PEP 810 *Explicit lazy imports* is a **draft, unaccepted PEP**; no `lazy import foo` statement exists in any CPython grammar through 3.14. Presenting it alongside PEP 420/427 as current packaging is false.
**Fix:** delete from syllabus/matrix or move to Module 14 "proposals" with `Status: Draft — not in 3.15` + link `peps.python.org/pep-0810/`.

**P0-3. PEP 713 misattribution for `asyncio.Queue.shutdown()`.**
`README.md:52`, `exams/README.md:33`, `exams/interview.md:784-791,1270`, Q050/Q071/Scenario-2 refs.
PEP 713 is *Callable modules*, not queues. `Queue.shutdown()/QueueShutDown` shipped in 3.13 via the asyncio issue tracker, no PEP. Citing `peps.python.org/pep-0713/` as proof is a wrong-primary-source failure.
**Fix:** drop all `PEP 713` prefixes; ref `docs.python.org/3/library/asyncio-queue.html#asyncio.Queue.shutdown`.

**P0-4. Exam-bank structure violates AGENTS.md certification rules.**
`exams/README.md:41-47`, `exams/interview.md:1-75-count`, `README.md:60-73`:
(a) One combined `interview.md` (75 Q total) instead of required one-file-per-exam (`exams/<exam-code>.md`); (b) requires **≥60 Q per certification** — PCAP + PCPP1 + Staff loop would need ~120-180, not 75 shared; (c) requires mock exam matching *each real exam's* count/time/mix — only a Staff-style 4-scenario 90-min mock is given, no PCAP/PCPP1 mock; (d) matrix claims 14× `✅ Full` with zero `🟡/❌`, i.e. no gap analysis performed.
**Fix:** split banks per exam code, top up to ≥60 each with domain-weight proportionality, add per-exam mocks; or explicitly mark gaps `🟡/❌` with reasons.

## P1 — Wrong answers / broken solutions

**P1-1. Stale specialization example.** `exams/interview.md:64` (Q004): "`BINARY_OP_ADD_INT`". That adaptive family was renamed to micro-ops (`_BINARY_OP_ADD_INT`, `_GUARD_*`) in 3.12+. As written it fails `dis` on the claimed 3.15.
**Fix:** version-scope: "3.11: `BINARY_OP_ADAPTIVE→ADD_INT`; 3.12+: `_BINARY_OP_*` micro-ops".

**P1-2. Wrong deprecation version.** `exams/interview.md:1062-1069` (Q068): "`asyncio.iscoroutinefunction()` deprecated in 3.15, removal in 3.16". Upstream deprecation began in **3.12** (`DeprecationWarning`, removal originally 3.14, since slipped). Off-by-three-versions.
**Fix:** "Deprecated since 3.12; use `inspect.iscoroutinefunction()`" + check `3.15 whatsnew` before asserting removal version.

**P1-3. Scenario-2 reference solution is buggy.** `exams/interview.md:1289-1305`:
`except (CancelledError, QueueShutDown): break` + `finally: queue.task_done()`. If `get()` raises, `task_done()` is called with no item → `ValueError: task_done() called too many times`. Catching `CancelledError` around `get()` then `w.cancel()` from outside also double-cancels; no `CancelledError` re-raise discipline.
**Fix:** move `task_done()` inside the success path only; use sentinel/`shutdown()` + `join()` then cancel workers.

**P1-4. Scenario-4 conflation + wrong tooling.** `exams/interview.md:~1340-1360`: recommends "`python3.15t` with `InterpreterPoolExecutor` fallback" (subinterpreters executor is a *different* model, not a fallback), and "run test suites under ThreadSanitizer (`-X dev`)". TSan requires a TSan-instrumented build, not `-X dev`.
**Fix:** pick one model with rationale; TSan → `python3.15t` TSan build / `./configure --with-thread-sanitizer`.

**P1-5. Q072 tautology.** `exams/interview.md:~1120`: "raising `TimeoutError` (which subclasses `TimeoutError`)". Since 3.11 `asyncio.TimeoutError is builtins.TimeoutError`.
**Fix:** "converts cancellation into builtin `TimeoutError` (alias of `asyncio.TimeoutError` since 3.11)".

**P1-6. Heading / cross-ref inconsistency.** `modules/01-…md:1` (`…& Tooling Baseline`) vs `README.md:43` (`Module 01: Execution Model, Bytecode & Modern Tooling`); `README.md:60` says `Certifications & Academic Standards` but AGENTS mandates `Certifications & Exams`; Q005 (`interview.md:~90`, import ordering) filed under `Execution Model & Tooling` domain.
**Fix:** unify titles; rename §2; retag Q005 domain to Imports.

## P2 — Missing edge cases / flawed questions

* **Q007 `is` vs small ints (`interview.md:~130`):** tests `[-5,256]` caching as cert knowledge with no "implementation detail — never use `is` for values; same-code-object constant folding can also make `c is d` True" warning. Add negative test.
* **Q022 `send()` (`~300`):** omits that `send(None)` is legal as prime (equivalent to `next()`); only non-`None` raises. Incomplete.
* **Q024 `__exit__` (`~330`):** omits `except*`/`ExceptionGroup` cannot be suppressed by returning `True` from `__exit__` (must return value from `__exit__*` path / 3.14 semantics). Gotcha missing.
* **Q032 circular imports (`~500`):** "fix with `import a; a.func_a()`" not stated; no mention of deferred/`TYPE_CHECKING`/function-local import — the actual remediation the module promises.
* **Scenario-1/3 `__slots__` + `weakref`:** refactored `EventNode` uses `weakref.ref(self)` but `__slots__` omits `"__weakref__"` → `TypeError: cannot create weak reference` on real run. Classic gotcha untested. Same for `ValidatedField` storing `private_name` without `__set_name__` collision when reused on two attributes (needs per-owner dict or `__slotnames__` guard).
* **Q073 `set_int_max_str_digits` (`~1139`):** omits default *is* 4300 and that limit applies symmetrically int↔str; `4300` as example reads as API constant.
* **Q044 option C (`~700`):** lists `exec` as a multiprocessing start method — valid set is `fork/spawn/forkserver` only. Distractor is nonsense, not a plausible misconception.

## P3 — Nits that erode trust

* `modules/01-…md` pipeline: "peephole optimizer folds `1+2→3`" — classic peepholer removed in 3.11+; now AST constant-folding. Reword.
* `modules/01-…md §5.1` / Q002: `-X dev` "installs faulthandler" — dev mode *enables* faulthandler-equivalent output; `‑X faulthandler` alongside is redundant. Clarify.
* Q001 answer: "builds a CST using a PEG parser" — CPython's PEG (`pegen`) builds the AST directly; CST is a `pegen` debug artifact. Reword to "PEG grammar → AST".
* Q017-D, Q027-C ("GIL prohibits covariance") style distractors are absurd rather than diagnostic; replace with real misconceptions (e.g. `__getattr__` vs `__getattribute__` order).
* `README.md:81` "82 hermetic tests" — unverified count; `ls examples/` shows 14 files, no count proof. Either assert via CI or drop number.
