# Exam & Interview Coverage Matrix: Python

This directory contains the certification and technical interview mapping for the `languages/python` curriculum, covering the **Python Institute PCAP™ (Certified Associate in Python Programming)**, the **Python Institute PCPP1™ (Certified Professional in Python Programming 1)**, and **Senior / Staff Python Software Engineering Interview Loops** (Tier-1 tech, infrastructure, high-throughput backend services).

---

## 1. Primary Reference Certifications & Standards

| Certification / Standard | Authority / Vendor | Verified Baseline | Exam Guide / Reference |
|---|---|---|---|
| **PCAP™ (Exam PCAP-31-03)** | OpenEDG Python Institute | Active (targets Python 3.x core) | [PCAP-31-03 Exam Syllabus](https://pythoninstitute.org/pcap) |
| **PCPP1™ (Exam PCPP-32-101)** | OpenEDG Python Institute | Active (Advanced OOP, Concurrency, Metaprogramming) | [PCPP-32-101 Exam Syllabus](https://pythoninstitute.org/pcpp1) |
| **Senior / Staff Python Engineering Loop** | Tier-1 Tech (Google, Meta, Bloomberg, Netflix) | 2026 Baseline | CPython internals, GIL/free-threading, asyncio architecture, typing (PEP 695), defensive security |

> [!NOTE] Exam Version Delta
> Official Python Institute PCAP and PCPP1 exams target a Python 3.8–3.10 baseline (e.g. legacy `typing.TypeVar`, standard `asyncio.gather()`, and synchronous signal handling). This track teaches modern Python 3.15 while explicitly covering legacy vs modern semantics in our **Then vs Now** sections (Module 14), preparing candidates for both legacy exam questions and cutting-edge production codebases.

---

## 2. Comprehensive Domain Coverage Matrix

| Domain & Topic | Weight | Curriculum Modules | Executable Proofs | Status |
|---|---|---|---|---|
| **1. Execution Model, Bytecode & Tooling**<br>CPython compiler pipeline (Tokenizer $\to$ PEG parser $\to$ AST $\to$ Symtable $\to$ Bytecode $\to$ VM eval loop), CPython vs PyPy/GraalPy, `uv` & `ruff`, `pyproject.toml`, interpreter startup & `-X` flags | 7% | [Module 01](../modules/01-execution-model-and-tooling.md) | `test_01_execution_model_and_tooling.py` | ✅ Full |
| **2. Names, Scopes & Objects**<br>PyObject anatomy (`ob_refcnt`, `ob_type`), identity vs equality (`is` vs `==`), small int cache `[-5, 256]`, string interning, mutability, LEGB lookup rules, `global`/`nonlocal`, mutable default arg trap, late-binding closure loop trap, PEP 649/749 `annotationlib` | 7% | [Module 02](../modules/02-names-scopes-and-objects.md) | `test_02_names_scopes_and_objects.py` | ✅ Full |
| **3. Data Model & Dunder Protocols**<br>String representations (`__repr__` vs `__str__`), hash invariant ($a == b \implies \text{hash}(a) == \text{hash}(b)$), automatic `__hash__ = None`, sequence slicing with `slice.indices()`, reflected arithmetic returning `NotImplemented`, `__slots__` layout, `__init_subclass__` (PEP 487) | 8% | [Module 03](../modules/03-data-model-and-dunder-protocols.md) | `test_03_data_model_and_dunder_protocols.py` | ✅ Full |
| **4. Descriptors, Metaclasses & Attributes**<br>Data vs non-data descriptors, method binding descriptor mechanics (`types.MethodType`), `__set_name__`, C3 Linearization MRO algorithm, cooperative `super()`, metaclass creation (`type.__new__`), ABCs & `__subclasshook__` structural registration | 8% | [Module 04](../modules/04-descriptors-metaclasses-and-attributes.md) | `test_04_descriptors_metaclasses_and_attributes.py` | ✅ Full |
| **5. Iteration, Generators & Context Managers**<br>Iteration protocol (`__iter__`/`__next__`), generator frame suspension states (`GEN_SUSPENDED`), bidirectional `.send()`, `.throw()`, `.close()`, `yield from` sub-generator delegation, context manager protocol (`__enter__`/`__exit__`), `contextlib.ExitStack`, PEP 654 `ExceptionGroup` and `except*` | 8% | [Module 05](../modules/05-iteration-generators-and-context-managers.md) | `test_05_iteration_generators_and_context_managers.py` | ✅ Full |
| **6. Modern Type System & Static Analysis**<br>PEP 695 generics (`class Box[T]:`, `type Alias[T] = ...`), PEP 696 type defaults, automatic variance inference, `typing.Protocol` with `@runtime_checkable`, `ParamSpec` & `Concatenate` decorators, PEP 742 `TypeIs` bidirectional narrowing, `@overload` | 8% | [Module 06](../modules/06-type-system-and-annotations.md) | `test_06_type_system_and_annotations.py` | ✅ Full |
| **7. Imports, Modules & Packaging**<br>Import machinery (`sys.meta_path`, `ModuleSpec`, `Loader`, `sys.modules`), circular import mechanics & diagnosis, PEP 810 explicit lazy imports, PEP 420 namespace packages, Wheel anatomy & modern `uv.lock` packaging | 7% | [Module 07](../modules/07-imports-modules-and-packaging.md) | `test_07_imports_modules_and_packaging.py` | ✅ Full |
| **8. CPython Internals & Bytecode Execution**<br>Bytecode disassembly (`dis`), PEP 659 Specialized Adaptive Interpreter (quickened instructions), Zero-cost exception tables, reference counting, PEP 683 immortal objects, cyclic generational garbage collection (tri-color trial deletion), `pymalloc` & `mimalloc` | 8% | [Module 08](../modules/08-cpython-internals-and-bytecode.md) | `test_08_cpython_internals_and_bytecode.py` | ✅ Full |
| **9. Concurrency: GIL, Threads & Subinterpreters**<br>GIL mechanics & switch intervals, PEP 703/779 free-threaded CPython (`python3.15t`), thread safety in pure Python, `threading.Lock`, multiprocessing start methods (`fork` vs `spawn` vs `forkserver`), PEP 734 subinterpreters (`InterpreterPoolExecutor`) | 7% | [Module 09](../modules/09-concurrency-gil-threads-and-subinterpreters.md) | `test_09_concurrency_gil_threads_and_subinterpreters.py` | ✅ Full |
| **10. Asyncio Architecture & Structured Concurrency**<br>Reactor pattern, coroutines, tasks, futures, `asyncio.TaskGroup` structured lifecycle, cancellation semantics (`CancelledError`), `asyncio.timeout`, `contextvars.ContextVar`, `asyncio.to_thread()`, `asyncio.Queue` backpressure & `Queue.shutdown()` | 8% | [Module 10](../modules/10-asyncio-internals-and-structured-concurrency.md) | `test_10_asyncio_internals_and_structured_concurrency.py` | ✅ Full |
| **11. Testing Practice: Pytest & Hypothesis**<br>Pytest fixture dependency injection & scopes, `@pytest.mark.parametrize`, Hypothesis property-based testing (shrinking, round-trip invariants), `unittest.mock.create_autospec` mock drift prevention, `pytest.raises` regex match, `pytest.warns` deprecation verification | 7% | [Module 11](../modules/11-testing-pytest-and-hypothesis.md) | `test_11_testing_pytest_and_hypothesis.py` | ✅ Full |
| **12. Performance Profiling & Optimization**<br>Profiling taxonomy (deterministic tracing vs statistical sampling), `cProfile` & `pstats` metrics (`tottime` vs `cumtime`), micro-optimizations (local variable caching, string `join`, `__slots__`), SIMD vectorization & Rust native extensions (PyO3) | 6% | [Module 12](../modules/12-performance-profiling-and-optimization.md) | `test_12_performance_profiling_and_optimization.py` | ✅ Full |
| **13. Production Python & Security Defenses**<br>Structured JSON logging, PEP 686 UTF-8 default mode, Unix signal orchestration (`SIGTERM` graceful draining), minimal multi-stage Docker builds with `uv`, security vulnerability mitigations: `pickle` RCE, `subprocess` command injection, path traversal | 6% | [Module 13](../modules/13-production-python-and-security.md) | `test_13_production_python_and_security.py` | ✅ Full |
| **14. Then vs Now, Evolution & Capstone**<br>Evolution from Python 2.7 $\to$ 3.8 $\to$ 3.11 $\to$ 3.15, Version history matrix, Capstone Project: High-Performance Distributed Asynchronous Task Orchestrator with backpressure, structured worker pools, context propagation, and graceful shutdown | 6% | [Module 14](../modules/14-then-vs-now-version-history-and-capstone.md) | `test_14_then_vs_now_and_capstone.py` | ✅ Full |

---

## 3. Question Bank Inventory

The question bank lives in [`interview.md`](./interview.md):
- **Total Questions**: 75 comprehensive questions covering PCAP, PCPP1, and Staff-level software engineering interview topics.
- **Difficulty Distribution**:
  - Difficulty 1 (Core Foundations / Syntax / Language Mechanics): 25 questions.
  - Difficulty 2 (Intermediate Invariants / Dunder Protocols / Operational Edge Cases): 35 questions.
  - Difficulty 3 (Staff-Level Architecture / CPython Internals / Security & Concurrency): 15 questions.
- **Timed Mock Examination**:
  - 1 full 90-minute mock examination simulating a Senior/Staff Python Engineering technical loop (4 progressive scenario-based architectural, debugging, and systems design challenges) with comprehensive scoring rubrics and solution guides.
