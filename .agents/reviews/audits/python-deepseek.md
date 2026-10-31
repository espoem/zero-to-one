# DeepSeek Flash 4.1 Audit: languages/python

Verified against the real toolchain. Versions are current and the code passes, but module 01's pipeline narrative and its `dis` output are written for ~3.13, not 3.15, and the "certifications" section doesn't meet the repo standard.

**What was run:** `pytest` (82 passed), `mypy examples` (clean, 14 files), `ruff check .` (clean), `ruff format --check` (29 files would reformat), `tools/mermaid-check` (30 diagrams, 0 failing), `python -V` → 3.15.2, `uv --version` → 0.13.6, PyPI/endoflife for latest versions.

## 1. Headings & formatting

- **Module titles diverge from README §1 in 7 of 14 cases** — e.g. README "Execution Model, Bytecode & Modern Tooling" vs H1 "Execution Model & Tooling Baseline"; same for M02, M06, M08, M09, M13, M14. Pick README as the index of record and align H1s.
- README §2 is headed **"Certifications & Academic Standards"**; `AGENTS.md` mandates **"Certifications & Exams"** with status, exam-guide version/date, format, duration and passing score. The table has 4 columns and none of those fields.
- `AGENTS.md` requires per-exam banks at `exams/<exam-code>.md`; only `exams/interview.md` exists. 75 questions and a 0 ❌ / 0 🟡 matrix are true as claimed, but `pcap-31-03.md` / `pcpp-32-101.md` are missing.
- Otherwise consistent: every module uses `## N. …` + a final `## N. Interview Drill`, all with exactly 5 questions (floor of the 5–10 range). Only M01 and M14 carry "Then vs Now"; M02 (PEP 649), M06 (PEP 695), M09 (free-threading) changed practice and should link to M14 rather than re-explain.
- **§4's `pyproject.toml` sample contradicts the track's own `pyproject.toml`**: `testpaths = ["tests"]` vs `["examples"]`, `requires-python = ">=3.14"` vs `>=3.15`, `[project.optional-dependencies] dev` vs `[dependency-groups]`, ruff `select` superset vs the repo's `["E","F","W","I"]`, and `license = { text = "MIT" }` (PEP 639-deprecated). Copy-paste produces config the track itself doesn't use.
- README advertises "code formatting… validation" but `ruff format` isn't in the verification block and fails on 29 files.
- Nits: "Micropython" → MicroPython; mixes `$O(1)$` LaTeX with plain "4–10x".

## 2. Verified vs stale information

**Correct:** Python 3.15.2 is the latest patch (2026-10-25); `uv 0.13.6`, `ruff 0.17.3`, `mypy 2.4.1`, `pytest 9.2.0`, `hypothesis 6.170.14` are all current on PyPI; `mise.lock` checksums and pybi tags match; `ruff target-version = "py315"` and `mypy --python-version 3.15` are valid; `python3.15t` exists (`sys._is_gil_enabled()` → False) and `lazy import` / `-X lazy_imports` are real in 3.15.

**Wrong or unverified for 3.15:**
- **§1.4 disassembly is not reproducible.** Real 3.15.2 output: `LOAD_FAST_BORROW` (new in 3.14), `LOAD_CONST 0 (1.0)` (not 1), **no offset column** (`dis.dis` defaults `show_offsets=False`), and line numbers 3/4/5, not 2/3. The doc's own test file already encodes the modern behaviour (`LOAD_FAST_BORROW`, superinstructions).
- **"Peep-Hole Optimizer" stage doesn't exist.** `Python/peephole.c` is gone; folding lives in `Python/optimizer.c` (AST) plus `flowgraph.c` (`assemble.c` does exist). Rename to "CFG optimizer + assembler".
- **"CST → AST Lowering" is the pre-3.9 pipeline.** PEP 617 removed the intermediate CST explicitly; the PEG parser builds AST nodes directly. The diagram currently teaches the legacy parser it just deprecated.
- `co_positions` is **a method** (`code.co_positions()`), not a field; `co_exceptiontable`, `co_stacksize`, `co_flags` are missing from the code-object list.
- **`-X gil=0` is fatal on the pinned build**: `config_read_gil: Disabling the GIL is not supported by this build` (exit 1), and `-X gil` only appears in `--help-xoptions` of the `t` build. `.mise.toml` pins only the GIL build, so README's `python3.15t` has no reproduction path (uv-installed build only).
- `-X dev` lists 3 effects; 3.15 docs list 6+ (warnings filter/ResourceWarning, encoding/errors checks, `io.IOBase` destructor logging).
- Missing operational flags: `-X importtime`, `-X lazy_imports`, `-X int_max_str_digits`, `-X cpu_count`, `-X context_aware_warnings`, `-X thread_inherit_context`, `-X disable-remote-debug`, `-X perf_jit`, `-X frozen_modules`, `-S/-I/-s/-E`, `PYTHONSAFEPATH`, `--check-hash-based-pycs`.
- Uncited numbers ("PyPy 4–10x", "venv < 50 ms", "ruff 10–100x / < 100 ms") carry no `(unverified)` marker as `AGENTS.md` §Version Currency 4 requires.
- §6 claims PEP 686 gives "UTF-8 everywhere"; PEP 686 covers the locale encoding default, not source encoding, and PEP 263 coding cookies still override.

## 3. Depth

- **VM eval loop is named once and never explained** (`_PyEval_EvalFrameDefault`). No frame/`f_localsplus` anatomy, value stack, `DISPATCH()`/computed-goto dispatch, `RESUME` semantics, 3.11→3.13 tiering (specialized → micro-op tier 2 → copy-and-patch JIT), `LOAD_FAST_BORROW` borrowing rules, or superinstructions.
- **Symtable stops at C-level flag names** (`DEF_LOCAL`…) with no public API (`is_local()`, `is_cell()`, `is_free_class()`, `is_type_parameter()`), no localsplus layout (`varnames|cellvars|freevars` order), no code flags, no class-scope-not-enclosing rule. On 3.15 `get_children()` now yields a PEP 649 `annotation` table **first** — the track's test filters it, the doc never mentions it.
- **Tokenizer section omits the 3.12+ reality**: `tokenize` is C-backed (`_tokenize`), f-strings are tokenized per PEP 701, PEP 263 encoding cookies, `NL` vs `NEWLINE`.
- **AST section omits** `ast.PyCF_*` flags, `compile(optimize=)`, `ast.unparse`, `NodeVisitor`/`NodeTransformer`, AST-level constant folding.
- JIT row doesn't note it's opt-in: `sys._jit.is_available()` True but `is_enabled()` False on the pinned build.
