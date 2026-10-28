# Brief: Python (`languages/python`)

| | |
|---|---|
| Phase | 2 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/python` · `../zto-python` |
| Depends on | phase 1 foundations |
| Research dossier | `.agents/research/C-runtimes.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- None beyond the dossier and AGENTS.md.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Python data model, typing, asyncio, CPython internals, packaging (uv)
- Python-specific security (pickle, framework security)

**Cross-link only (do not re-explain):**
- Concurrency models, locks, data races, lock-free structures (language-neutral) → owned by `algorithms/dsa` (proposed extra module, TBD)
- Crypto primitives, password hashing, KDFs, AEAD, signatures → owned by `architecture/security-identity`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Python — `languages/python`

- **Current stable version(s)** (python.org/downloads + cpython git tags)
  - **Python 3.15** — 3.15.0 released 2026-10-09 (slipped from early Oct; beta 1 postponed to 2026-05-07 per secondary press); latest **3.15.2 (2026-10-25)**; bugfix until 2031-10 — https://www.python.org/downloads/ , https://docs.python.org/3.15/whatsnew/3.15.html
  - **Python 3.14** — latest 3.14.10 (2026-10-25), bugfix; 3.13/3.12/3.11 security-only; **3.10 EOL 2026-10**. 3.16 planned 2027-10-06.
  - 3.15 highlights: PEP 810 explicit lazy imports (`lazy import x`), PEP 814 `frozendict`, PEP 661 `sentinel`, **PEP 686 UTF-8 default encoding**, PEP 798 unpacking in comprehensions, PEP 799 `profiling` package with **Tachyon sampling profiler** (`profile` module deprecated → removal 3.17), PEP 829 startup config files, PEP 831 frame pointers on by default, upgraded experimental JIT, typing PEP 728 (TypedDict extra items), PEP 747 `TypeForm`, PEP 800 disjoint bases, `asyncio.TaskGroup.cancel()`, stable ABI for free-threading `abi3t` (PEP 803/820/793).
  - 3.14 highlights: PEP 649/749 deferred annotations (`annotationlib`), PEP 750 t-strings, PEP 734 `concurrent.interpreters` + `InterpreterPoolExecutor`, **PEP 779 free-threading officially supported**, PEP 784 `compression.zstd`, PEP 768 `sys.remote_exec`, `python -m asyncio ps/pstree`, tail-call interpreter, PEP 758/765. **Surprise: incremental GC shipped in 3.14.0–3.14.4 was reverted in 3.14.5** back to 3.13-style generational GC — https://docs.python.org/3.14/whatsnew/3.14.html
  - **Free-threading status**: still a separate, optional build (not default) in 3.15; macOS installers now install it by default alongside; single-thread overhead ~1% (macOS arm64) to ~8% (x86-64 Linux); importing a non-FT-marked C extension re-enables the GIL with a warning (`PYTHON_GIL`, `-X gil`) — https://docs.python.org/3.15/howto/free-threading-python.html . No date for making it default.
  - Tooling (PyPI, 2026-10-27/28): uv 0.13.6, ruff 0.17.3, pytest 9.2.0, pytest-asyncio 1.4.1, hypothesis 6.170.12, mypy 2.4.0, pyright 1.1.414, ty 0.0.93 (Astral type checker, still 0.0.x preview).
- **Authoritative syllabi used**
  - Python Language Reference (data model §3, execution model §4, import system §5) — https://docs.python.org/3.15/reference/
  - Library reference & HOWTOs (descriptors, free-threading, asyncio, logging) — https://docs.python.org/3.15/howto/
  - Typing spec — https://typing.python.org/en/latest/spec/ ; PEP index — https://peps.python.org/
  - CPython Developer's Guide + internals docs (`InternalDocs/` in repo: interpreter, GC, frames, exception table) — https://devguide.python.org/ , https://github.com/python/cpython/tree/main/InternalDocs
  - Packaging: PyPA guide (pyproject, PEP 621/517/518/660, PEP 751 `pylock.toml`) — https://packaging.python.org/ ; uv docs — https://docs.astral.sh/uv/
  - Certs: Python Institute PCEP-30-02 / PCAP-31-03 / PCPP1 (PCPP-32-101) — https://pythoninstitute.org/certification-roadmap (current exam codes unverified this pass; low signal for senior roles — use only to check coverage of basics/OOP/stdlib).
  - Books: "Fluent Python" 2e (Ramalho), "CPython Internals" (Shaw), "Architecture Patterns with Python", "High Performance Python" 3e.
- **Proposed modules**
  1. **Execution model & tooling baseline** — CPython vs PyPy/GraalPy; `uv` (python install, venvs, `uv run`, lock, workspaces, tools/`uvx`), `pyproject.toml`, ruff (lint+format), interpreter startup, `-X` options, REPL; versions & support policy (PEP 602 annual).
  2. **Names, scopes, objects** — everything is an object, identity/equality/hash, mutability, LEGB & `nonlocal`, closures & late binding, default-argument trap, comprehension scopes, PEP 649 lazy annotations, `sentinel`.
  3. **Data model** — dunder protocols (`__eq__/__hash__`, `__len__`, `__iter__`, `__getitem__`, `__enter__/__exit__`, numeric reflected ops, `__format__`), attribute lookup order, `__slots__`, `__init_subclass__`, `__class_getitem__`, `frozendict`, dataclasses & `attrs`.
  4. **Descriptors, metaclasses & attribute machinery** — data vs non-data descriptors, `property`/`classmethod`/`staticmethod`/functions as descriptors, `__set_name__`, `__getattr__` vs `__getattribute__`, MRO (C3), `super()`, metaclasses vs class decorators vs `__init_subclass__`, ABCs.
  5. **Iteration, generators & context managers** — iterator protocol, generator internals (frame suspension), `yield from`, `send/throw/close`, itertools, `contextlib` (`ExitStack`, `contextmanager`), exception groups & `except*`, PEP 758/765.
  6. **Typing** — gradual typing, mypy/pyright/ty, PEP 695 generics & `type` aliases, PEP 696 defaults, variance inference, Protocols (structural), TypedDict (`ReadOnly`, extra items PEP 728), `ParamSpec`/`Concatenate`, `TypeVarTuple`/`Unpack`, `Self`, `Never`, `TypeIs`/`TypeGuard`, overloads, `TypeForm`, runtime annotations via `annotationlib`, t-strings & `Template` typing.
  7. **Imports & packaging** — import system (finders/loaders, `sys.modules`, `__init__` side effects, circular imports), lazy imports PEP 810, namespace packages, building wheels (hatchling/uv_build), entry points, versioning & resolver, lockfiles (`uv.lock`, `pylock.toml`), private indexes, publishing with trusted publishing.
  8. **CPython internals** — compile pipeline (tokenizer→PEG parser→AST→symtable→bytecode), `dis`, specializing adaptive interpreter (PEP 659), frames, exception tables, refcounting & immortal objects, cyclic GC (generations; 3.14 incremental GC revert), memory allocator (pymalloc/mimalloc), JIT (copy-and-patch) & tail-call interpreter.
  9. **Concurrency: GIL, threads, processes, subinterpreters** — what the GIL protects; free-threaded build (biased refcounting, per-object locks, `Py_GIL_DISABLED`, `sys._is_gil_enabled()`, C-extension readiness), `threading`, `concurrent.futures`, `multiprocessing` (spawn vs fork vs forkserver default changes), `concurrent.interpreters`, choosing the model.
  10. **asyncio internals** — event loop, coroutines vs tasks vs futures, `TaskGroup` (+`cancel()`), structured concurrency, cancellation semantics (`CancelledError`, `uncancel`), timeouts (`asyncio.timeout`), `contextvars`, executors for blocking calls, uvloop, introspection (`asyncio ps/pstree`), backpressure with streams/queues (`Queue.shutdown`).
  11. **Testing** — pytest (fixtures scopes, parametrization, markers, `tmp_path`, `monkeypatch`, plugins), pytest-asyncio modes, Hypothesis property-based testing, coverage, mocking pitfalls (`autospec`), snapshot testing, testing free-threaded builds (`pytest-run-parallel`, unverified).
  12. **Performance & profiling** — `profiling.sampling` (Tachyon) / `profiling.tracing`, py-spy, `tracemalloc`, memray, `timeit`/pyperf; algorithmic wins, vectorization (NumPy), Cython/mypyc/Rust (PyO3) extensions, `__slots__`, string building, avoiding attribute lookups; frame pointers & `perf`.
  13. **Production Python** — logging config, settings, UTF-8 default mode (PEP 686) migration, signal handling, fork-safety, Docker images (uv in containers, `--compile-bytecode`), security (pickle, `eval`, `subprocess` shell, `yaml.load`, supply chain, `sys.remote_exec` hardening), upgrade strategy across minors.
- **Gotchas & production failure modes**
  - Mutable default argument `def f(x=[])` shared across calls.
  - Late-binding closures in loops (`lambda: i`) all see last `i`.
  - Defining `__eq__` without `__hash__` makes instances unhashable (`__hash__ = None`).
  - Calling a blocking function (`requests.get`, `time.sleep`, sync DB driver) inside `async def` freezes the whole event loop.
  - Fire-and-forget `asyncio.create_task()` without keeping a reference ⇒ task may be garbage-collected mid-flight.
  - Swallowing `CancelledError` (bare `except Exception` is fine since 3.8, but `except BaseException`/`finally: return`) breaks cancellation and TaskGroup shutdown.
  - `multiprocessing` with `fork` after threads exist ⇒ deadlocks (inherited held locks); default start method on Linux changed from `fork` (3.14 → `forkserver`, unverified exact version) breaks code relying on inherited globals.
  - Free-threaded build: importing one non-FT C extension silently re-enables the GIL (only a warning) ⇒ no speedup; plus data races in pure-Python code that "worked" under the GIL (e.g., check-then-act on dicts/lists).
  - PEP 686: code relying on locale encoding (cp1252 on Windows) now reads UTF-8 in 3.15 ⇒ `UnicodeDecodeError` / mojibake on legacy files.
  - `isinstance(x, dict)` is False for `frozendict` ⇒ validation code rejects it; use `collections.abc.Mapping`.
  - Circular imports surface as `ImportError: cannot import name … (most likely due to a circular import)` / partially initialized module; lazy imports can move the failure to first use (later, in production path).
  - `pickle.loads`/`yaml.load` on untrusted input ⇒ RCE.
  - `datetime.utcnow()` naive datetimes (deprecated) compared with aware ones ⇒ `TypeError` or silent off-by-hours.
  - Memory "leak" from reference cycles with `__del__`, or from `functools.lru_cache` on methods holding `self`.
  - Float `round(2.5) == 2` (banker's rounding); `Decimal` for money.
  - Unpinned transitive deps / no lockfile ⇒ broken deploys; `pip install` into system Python; `uv sync --frozen` in CI.
  - 3.14.0–3.14.4 incremental GC memory-pressure regression — pin ≥ 3.14.5.
- **Interview hot topics**
  - GIL: what it is, why, free-threading (PEP 703/779) trade-offs; threads vs processes vs asyncio vs subinterpreters.
  - Descriptors & how `@property`/methods bind; MRO & `super()`.
  - Metaclasses vs class decorators vs `__init_subclass__`.
  - Generators & lazy evaluation; implement an iterator/context manager.
  - asyncio: event loop, task cancellation, structured concurrency, blocking-call detection.
  - Memory management: refcounting + cyclic GC; `__slots__`; weakref.
  - Typing: Protocol vs ABC, variance, generics PEP 695, `TypeVarTuple`.
  - Mutability/identity traps (default args, `is` vs `==`, int caching).
  - Packaging & dependency management (uv, lockfiles, wheels).
  - Profiling a slow Python service; when to drop to C/Rust.
  - What's new in 3.13/3.14/3.15 (JIT, FT, t-strings, lazy imports).
- **Executable-proof strategy**
  - `.mise.toml`: `python = "3.15.2"`, plus `python = "3.15.2t"`/free-threaded variant leg (mise/uv support for `3.15t` via python-build-standalone — `uv python install 3.15t` verified naming unverified), `uv = "0.13.6"`; project via `uv init`, `uv sync --frozen`, `uv run pytest`.
  - pytest 9.2 + pytest-asyncio 1.4 (strict mode) + Hypothesis for property tests; negative tests with `pytest.raises(..., match=...)`; `pytest.warns` for deprecations; `-W error` in CI.
  - Internals made deterministic: `dis` output snapshot tests per pinned minor (bytecode changes each minor — tie snapshot to `sys.version_info[:2]`); `sys.getrefcount` deltas; `gc.get_referrers`/`gc.collect()` returns; `tracemalloc` snapshot diffs with tolerances.
  - Free-threading proof: test that runs CPU-bound threads and asserts `sys._is_gil_enabled() is False` on the `t` build and speedup ratio > 1.5 (mark `slow`, skip on GIL build); data-race demo asserting non-determinism via repeated runs is flaky ⇒ make it a script, not a gate.
  - asyncio: deterministic ordering with `asyncio.Event`s; cancellation tests; blocking detection via `loop.slow_callback_duration` + debug mode log capture (`caplog`).
  - Typing: `mypy --strict` and `pyright` runs as tests over `examples/typing/` with expected-error files (`# type: ignore[...]` / `reveal_type` + `assert_type`); "negative" typing cases checked by expecting specific error codes (pyright `--outputjson` parsed in pytest).
  - Profiling: `python -m profiling.sampling` producing collapsed stacks — assert hot function appears in top N (tolerant); not CI-gating.
  - Packaging: build a wheel with `uv build` and install into a temp venv, import entry point (fully local, no network with `--offline` after cache warmup).
  - Not provable locally / flaky: real multi-core speedup on shared CI runners, JIT effects (experimental, build-dependent), Windows-encoding behavior (run PEP 686 demo by forcing `PYTHONUTF8=0` + `encoding='locale'` with `LC_ALL=C` instead).
- **Overlaps / dedupe**
  - Shared **`languages/javascript`** concepts are analogues only (closures, event loop) — write a short "JS ↔ Python" comparison table in Python README; don't duplicate.
  - asyncio vs Node event loop: Node track owns libuv; Python track owns asyncio; a shared "concurrency models" foundation page (e.g., `foundations/concurrency`, if the curriculum has one) should own threads/processes/async theory, locks, memory models, data races.
  - SQL/Redis tracks own DB drivers & pooling (cross-link SQLAlchemy/asyncpg/redis-py usage only).
  - Data/ML (NumPy/pandas) out of scope — cross-link if a data track exists.
  - Docker/CI tracks own container builds & GitLab CI; Python track just gives the uv-in-Docker recipe.
  - Testing philosophy (test pyramid, property-based testing theory) → shared testing foundation if present; this track owns pytest/Hypothesis mechanics.

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- Certs: Python Institute PCEP-30-02 / PCAP-31-03 / PCPP1 (PCPP-32-101) — https://pythoninstitute.org/certification-roadmap (current exam codes unverified this pass; low signal for senior roles — use only to check coverage of basics/OOP/stdlib).
- 11. **Testing** — pytest (fixtures scopes, parametrization, markers, `tmp_path`, `monkeypatch`, plugins), pytest-asyncio modes, Hypothesis property-based testing, coverage, mocking pitfalls (`autospec`), snapshot testing, testing free-threaded builds (`pytest-run-parallel`, unverified).
- `multiprocessing` with `fork` after threads exist ⇒ deadlocks (inherited held locks); default start method on Linux changed from `fork` (3.14 → `forkserver`, unverified exact version) breaks code relying on inherited globals.
- `.mise.toml`: `python = "3.15.2"`, plus `python = "3.15.2t"`/free-threaded variant leg (mise/uv support for `3.15t` via python-build-standalone — `uv python install 3.15t` verified naming unverified), `uv = "0.13.6"`; project via `uv init`, `uv sync --frozen`, `uv run pytest`.

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/python` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(python)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/python.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/python.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
