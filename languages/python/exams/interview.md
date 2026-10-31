# Python Certification & Technical Interview Question Bank

Comprehensive preparation question bank covering the **Python Institute PCAP™ (PCAP-31-03)**, **PCPP1™ (PCPP-32-101)**, and **Senior / Staff Python Engineering Technical Interview Loops**.

---

## Question Bank (75 Questions)

### Q-PYTHON-001 · Execution Model & Tooling · difficulty 1 · single
What are the primary pipeline stages CPython traverses from raw source text to bytecode execution?
- A) Lexer $\to$ Tokenizer $\to$ LLVM IR $\to$ Machine Code
- B) Tokenizer $\to$ PEG Parser $\to$ AST $\to$ Symbol Table $\to$ Bytecode $\to$ Evaluation Loop
- C) Preprocessor $\to$ Bytecode Compiler $\to$ Linker $\to$ Native Assembler
- D) CST Parser $\to$ Type Inference Engine $\to$ Bytecode Generator $\to$ JIT Optimizer
<details><summary>Answer</summary>

**B.** CPython's execution pipeline tokenizes text into lexical tokens, builds a Concrete Syntax Tree using a PEG parser, converts it to an Abstract Syntax Tree (AST), computes symbol scopes via the symbol table pass, compiles the AST into bytecode instructions, and executes them in the virtual machine evaluation loop.
- Why not A: CPython does not compile to LLVM IR or native machine code; it compiles to CPython bytecode.
- Why not C: Python has no C-style preprocessor or native linker.
- Why not D: CPython's standard pipeline does not enforce static type inference.
- Ref: [modules/01-execution-model-and-tooling.md](../modules/01-execution-model-and-tooling.md#1-the-cpython-compilation-pipeline), https://docs.python.org/3/reference/executionmodel.html
</details>

### Q-PYTHON-002 · Execution Model & Tooling · difficulty 2 · scenario
An engineer notices that a test script executing `python -X dev -X faulthandler script.py` crashes with a SIGSEGV during native C extension calls, but now outputs a C-level traceback. What does `-X dev` enable?
- A) It enables the Rust JIT compiler and disables the GIL.
- B) It enables the CPython Development Mode, turning on memory allocator debug hooks, asyncio debug mode, and warnings for unclosed resources.
- C) It compiles all Python files directly to shared object (`.so`) libraries.
- D) It enables interactive debugging with `pdb` on every line.
<details><summary>Answer</summary>

**B.** The `-X dev` flag enables Python Development Mode. It activates `asyncio` debug mode, memory allocator debug hooks (`PYTHONMALLOC=debug`), and warns about unclosed files, sockets, and un-awaited coroutines.
- Why not A: Free-threading is enabled via `--disable-gil` at build time or `python3.15t`, not `-X dev`.
- Why not C: CPython never compiles Python files to native `.so` libraries automatically.
- Why not D: `-X dev` does not launch `pdb`.
- Ref: [modules/01-execution-model-and-tooling.md](../modules/01-execution-model-and-tooling.md#4-runtime-execution-cli-flags--configuration), https://docs.python.org/3/using/cmdline.html#cmdoption-X
</details>

### Q-PYTHON-003 · Execution Model & Tooling · difficulty 2 · single
Why is `uv` significantly faster than legacy `pip` when resolving and installing Python dependencies?
- A) It skips cryptographic hash validation of wheels.
- B) It is written in Rust, uses PubGrub resolution algorithms, parallelizes network requests, and hard-links wheels from a global cache into virtualenvs.
- C) It converts Python packages into WebAssembly modules.
- D) It executes package `setup.py` scripts concurrently in parallel threads.
<details><summary>Answer</summary>

**B.** `uv` is written in Rust and uses the PubGrub version resolution algorithm. It queries PyPI metadata without downloading entire wheels, downloads wheels concurrently, and installs them using copy-on-write or hard links from a content-addressed global cache.
- Why not A: `uv` strictly validates wheel cryptographic hashes against lockfiles.
- Why not C: `uv` installs standard Python wheels and sdists, not WebAssembly.
- Why not D: Executing arbitrary `setup.py` scripts concurrently is unsafe; `uv` prioritizes static PEP 517/PEP 621 metadata.
- Ref: [modules/01-execution-model-and-tooling.md](../modules/01-execution-model-and-tooling.md#3-modern-tooling-ecosystem-uv--ruff), https://docs.astral.sh/uv/
</details>

### Q-PYTHON-004 · Execution Model & Tooling · difficulty 3 · multi
Which of the following statements regarding the CPython bytecode evaluation loop are TRUE? (Select TWO)
- A) In Python 3.11+, bytecode instructions are 16 bits (2 bytes) wide: 1 byte for opcode and 1 byte for oparg.
- B) Bytecode instructions can dynamically rewrite themselves in memory into specialized quickened opcodes at runtime.
- C) The evaluation loop runs directly on the CPU hardware registers without an evaluation stack.
- D) Python bytecodes are completely platform-independent and can be executed across major Python versions (e.g. 3.8 `.pyc` running on 3.15).
<details><summary>Answer</summary>

**A and B.**
- A is TRUE: Since Python 3.11, CPython uses 16-bit wordcode instructions (1 byte opcode, 1 byte oparg).
- B is TRUE: Under PEP 659 (Adaptive Specializing Interpreter), frequently executed instructions are replaced in-memory with specialized opcodes (e.g. `BINARY_OP_ADD_INT`).
- Why not C: CPython is a stack machine, not a register-based VM.
- Why not D: `.pyc` bytecode is specific to the exact minor Python version and magic number.
- Ref: [modules/01-execution-model-and-tooling.md](../modules/01-execution-model-and-tooling.md#1-the-cpython-compilation-pipeline), https://peps.python.org/pep-0659/
</details>

### Q-PYTHON-005 · Execution Model & Tooling · difficulty 2 · ordering
Order the following phases of a standard Python import resolution:
1. Check `sys.modules` cache.
2. Iterate through `sys.meta_path` finders to find a `ModuleSpec`.
3. Create a module object and insert it into `sys.modules`.
4. Call `loader.exec_module(module)` to execute top-level code.
- A) 1 $\to$ 2 $\to$ 3 $\to$ 4
- B) 2 $\to$ 1 $\to$ 4 $\to$ 3
- C) 1 $\to$ 3 $\to$ 2 $\to$ 4
- D) 3 $\to$ 1 $\to$ 2 $\to$ 4
<details><summary>Answer</summary>

**A.** Python first checks if the module already exists in `sys.modules`. If not, it queries `sys.meta_path` finders to obtain a `ModuleSpec`, constructs an uninitialized module object and adds it to `sys.modules` (to handle circular imports), and finally calls `loader.exec_module()` to execute module code.
- Ref: [modules/07-imports-modules-and-packaging.md](../modules/07-imports-modules-and-packaging.md#1-the-cpython-import-system-architecture), https://docs.python.org/3/reference/import.html
</details>

---

### Q-PYTHON-006 · Names, Scopes & Objects · difficulty 1 · single
What is the structural composition of a standard `PyObject` header in 64-bit CPython?
- A) A 64-bit reference count (`ob_refcnt`) and a 64-bit type pointer (`ob_type`).
- B) A 32-bit hash code and a 32-bit memory address.
- C) An object name string and an attribute dictionary pointer.
- D) A garbage collector generation tag and a thread ID.
<details><summary>Answer</summary>

**A.** In CPython, `_PyObject_HEAD_EXTRA` / `PyObject` defines two primary 64-bit fields: `ob_refcnt` (reference counter) and `ob_type` (pointer to the type descriptor `PyTypeObject`).
- Why not B: Hash values are computed lazily or stored in specific subtype structures, not the base `PyObject` header.
- Why not C: Object names and dictionaries are not part of raw `PyObject` headers.
- Why not D: GC tracking headers precede the `PyObject` head via `PyGC_Head`.
- Ref: [modules/02-names-scopes-and-objects.md](../modules/02-names-scopes-and-objects.md#1-everything-is-an-object-pyobject-anatomy), https://docs.python.org/3/c-api/structures.html
</details>

### Q-PYTHON-007 · Names, Scopes & Objects · difficulty 2 · single
What is the output of the following code snippet?
```python
a = 256
b = 256
c = 257
d = 257
print(a is b, c is d)  # Evaluated in an interactive REPL
```
- A) `True True`
- B) `True False`
- C) `False False`
- D) `False True`
<details><summary>Answer</summary>

**B.** In standard interactive CPython, small integers in the range $[-5, 256]$ are pre-allocated and interned in a static array. Therefore, all references to 256 share the exact same object identity (`a is b` is `True`). Integers $\ge 257$ allocate distinct heap objects in separate REPL lines (`c is d` is `False`).
- Why not A: In the REPL, integers $\ge 257$ on separate prompt lines do not share identity.
- Why not C: 256 is within the small integer cache.
- Why not D: 256 is cached; 257 is not.
- Ref: [modules/02-names-scopes-and-objects.md](../modules/02-names-scopes-and-objects.md#2-identity-vs-equality--cpython-interning), https://docs.python.org/3/c-api/long.html
</details>

### Q-PYTHON-008 · Names, Scopes & Objects · difficulty 2 · scenario
Consider the function below:
```python
def append_item(val: int, target: list[int] = []) -> list[int]:
    target.append(val)
    return target

print(append_item(1))
print(append_item(2))
```
What is printed, and why?
- A) `[1]` followed by `[2]`, because default arguments are re-evaluated on each function call.
- B) `[1]` followed by `[1, 2]`, because default arguments are evaluated once at function definition time and bound to the function's `__defaults__` tuple.
- C) `[1]` followed by `[2]`, because lists passed as default arguments are deep-copied.
- D) `TypeError`, because mutable objects are illegal as default arguments in Python.
<details><summary>Answer</summary>

**B.** In Python, default parameter expressions are evaluated once when the `def` statement executes. The resulting list is stored in the function object's `__defaults__` attribute. Subsequent calls without the argument mutate that shared list.
- Why not A: Default arguments are not re-evaluated per call.
- Why not C: Python never copies default arguments automatically.
- Why not D: Mutable defaults are valid syntax, though an established anti-pattern.
- Ref: [modules/02-names-scopes-and-objects.md](../modules/02-names-scopes-and-objects.md#5-the-mutable-default-argument-trap), https://docs.python.org/3/tutorial/controlflow.html#default-argument-values
</details>

### Q-PYTHON-009 · Names, Scopes & Objects · difficulty 2 · single
What causes the "late-binding closure trap" when generating functions in a loop, e.g., `funcs = [lambda: i for i in range(3)]`?
- A) Python closures bind variable values eagerly by creating new scopes per loop step.
- B) Python closures bind variable names, looking up `i` in the enclosing scope when the function is called, at which point the loop has finished and `i == 2`.
- C) Lambdas in list comprehensions are executed immediately during list construction.
- D) The bytecode optimizer replaces all loop references with static constants.
<details><summary>Answer</summary>

**B.** In Python, closures capture variable names, not values at definition time. When the lambdas are later called, they resolve `i` from the enclosing lexical environment, where `i` retains its terminal loop value (`2`).
- Why not A: Python does not create a new scope per loop iteration.
- Why not C: Lambdas are created but not executed during list construction.
- Why not D: CPython does not constant-fold dynamic loop variables in closures.
- Ref: [modules/02-names-scopes-and-objects.md](../modules/02-names-scopes-and-objects.md#6-late-binding-closures-in-loops), https://docs.python.org/3/faq/programming.html#why-do-lambdas-defined-in-a-loop-with-different-values-all-return-the-same-result
</details>

### Q-PYTHON-010 · Names, Scopes & Objects · difficulty 3 · scenario
How does PEP 649 / PEP 749 deferred annotation evaluation in Python 3.14+ resolve the circular import and performance problems of type annotations?
- A) It removes all annotations from the runtime memory footprint completely.
- B) It compiles annotations into an executable code object (`__annotate__` function) that is evaluated only when `annotationlib.get_annotations()` or `cls.__annotations__` is explicitly called.
- C) It converts all annotations into static comments ignored by the parser.
- D) It enforces runtime type checking on every function call.
<details><summary>Answer</summary>

**B.** PEP 649 replaces eager module-load annotation evaluation with a deferred `__annotate__` function. The type expressions inside annotations are not evaluated when the module or class is loaded, eliminating circular import errors and startup overhead.
- Why not A: Annotations are preserved and retrievable via `annotationlib`.
- Why not C: Annotations remain part of the AST and runtime metadata.
- Why not D: CPython does not enforce runtime type checks.
- Ref: [modules/02-names-scopes-and-objects.md](../modules/02-names-scopes-and-objects.md#8-pep-649--749-deferred-evaluation-of-annotations), https://peps.python.org/pep-0649/
</details>

---

### Q-PYTHON-011 · Data Model & Dunder Protocols · difficulty 1 · single
What fundamental invariant must hold between `__eq__` and `__hash__` in Python?
- A) If `a == b`, then `hash(a) == hash(b)`.
- B) If `hash(a) == hash(b)`, then `a == b`.
- C) If `a != b`, then `hash(a) != hash(b)`.
- D) `hash(a)` must equal `id(a)`.
<details><summary>Answer</summary>

**A.** The core hash invariant states that if two objects compare equal (`a == b`), they must produce identical hash values (`hash(a) == hash(b)`). The converse is not true due to hash collisions.
- Why not B: Hash collisions allow unequal objects to produce identical hashes.
- Why not C: Unequal objects can collide on the same hash value.
- Why not D: `id(a)` is a memory address and changes between runs; hash is based on value content.
- Ref: [modules/03-data-model-and-dunder-protocols.md](../modules/03-data-model-and-dunder-protocols.md#2-the-hash-invariant-and-dict-key-mechanics), https://docs.python.org/3/reference/datamodel.html#object.__hash__
</details>

### Q-PYTHON-012 · Data Model & Dunder Protocols · difficulty 2 · single
If a custom class defines `__eq__` but does NOT define `__hash__`, what does Python do?
- A) It falls back to `object.__hash__`, hashing the object's `id()`.
- B) It automatically sets `__hash__ = None`, making instances unhashable and raising a `TypeError` if used in sets or dict keys.
- C) It hashes the dictionary of attributes `__dict__`.
- D) It raises a `SyntaxError` at class definition time.
<details><summary>Answer</summary>

**B.** Python enforces the hash invariant: when a class overrides `__eq__`, Python automatically sets `__hash__ = None`. Attempting to hash an instance raises `TypeError: unhashable type`.
- Why not A: Inheriting `object.__hash__` while defining value equality would violate the hash invariant.
- Why not C: Dictionaries are mutable and unhashable.
- Why not D: Overriding `__eq__` without `__hash__` is valid syntax; error occurs only when hashed.
- Ref: [modules/03-data-model-and-dunder-protocols.md](../modules/03-data-model-and-dunder-protocols.md#2-the-hash-invariant-and-dict-key-mechanics), https://docs.python.org/3/reference/datamodel.html#object.__hash__
</details>

### Q-PYTHON-013 · Data Model & Dunder Protocols · difficulty 2 · single
What should a custom numeric class return from arithmetic dunders (`__add__`, `__sub__`) when encountering an unsupported operand type?
- A) Raise `TypeError` immediately.
- B) Return `None`.
- C) Return `NotImplemented`.
- D) Return `False`.
<details><summary>Answer</summary>

**C.** When an operator dunder cannot handle the operand type, it must return the singleton `NotImplemented`. This signals to CPython to attempt the reflected operator on the right-hand operand (`__radd__`), or fall back to raising `TypeError` if both fail.
- Why not A: Raising `TypeError` immediately preempts the right-hand operand's chance to handle the operation.
- Why not B: Returning `None` treats `None` as a valid numeric result.
- Why not D: Returning `False` treats boolean `False` as the arithmetic result.
- Ref: [modules/03-data-model-and-dunder-protocols.md](../modules/03-data-model-and-dunder-protocols.md#4-arithmetic-emulation--reflected-operations), https://docs.python.org/3/reference/datamodel.html#emulating-numeric-types
</details>

### Q-PYTHON-014 · Data Model & Dunder Protocols · difficulty 2 · scenario
How does specifying `__slots__` on a class optimize memory footprint and attribute access?
- A) It converts all instance attributes to 64-bit C integers.
- B) It prevents the creation of a dynamic per-instance `__dict__`, storing attributes at fixed C-level descriptor offsets.
- C) It compresses object memory using zlib in RAM.
- D) It forces all instances to share a single global state.
<details><summary>Answer</summary>

**B.** By default, every Python instance allocates an internal dictionary (`__dict__`) to store attributes. `__slots__` eliminates `__dict__`, replacing dynamic hash lookups with fixed descriptor array offsets.
- Why not A: Attributes remain standard Python object pointers (`PyObject*`).
- Why not C: CPython does not compress instance memory with zlib.
- Why not D: Instances retain separate values; only attribute names and offsets are fixed.
- Ref: [modules/03-data-model-and-dunder-protocols.md](../modules/03-data-model-and-dunder-protocols.md#5-memory-optimization-with-__slots__), https://docs.python.org/3/reference/datamodel.html#slots
</details>

### Q-PYTHON-015 · Data Model & Dunder Protocols · difficulty 3 · single
What does PEP 487 `__init_subclass__` provide over traditional metaclass customization?
- A) It allows sub-classing final classes.
- B) It enables a base class to customize and validate subclass creation without requiring the complexity of a custom metaclass.
- C) It executes after instances are created to validate fields.
- D) It compiles Python subclasses to native C structs.
<details><summary>Answer</summary>

**B.** PEP 487 introduced `__init_subclass__(cls, **kwargs)`. When a class is subclassed, the parent's `__init_subclass__` is called, enabling clean subclass registration, validation, and keyword argument handling without metaclass conflicts.
- Why not A: Python has no native final class concept at the C level that `__init_subclass__` circumvents.
- Why not C: `__init_subclass__` runs at class creation time, not instance initialization.
- Why not D: It operates purely within CPython's standard class construction.
- Ref: [modules/03-data-model-and-dunder-protocols.md](../modules/03-data-model-and-dunder-protocols.md#6-subclass-customization-via-__init_subclass__-pep-487), https://peps.python.org/pep-0487/
</details>

---

### Q-PYTHON-016 · Descriptors, Metaclasses & Attributes · difficulty 1 · single
What is the difference between a **data descriptor** and a **non-data descriptor**?
- A) A data descriptor defines `__get__` and either `__set__` or `__delete__`; a non-data descriptor defines only `__get__`.
- B) Data descriptors store data in files; non-data descriptors store data in memory.
- C) Data descriptors can only be attached to dataclasses.
- D) Non-data descriptors are executed before `__init__`.
<details><summary>Answer</summary>

**A.** A descriptor that defines both `__get__` and `__set__` (or `__delete__`) is a data descriptor. A descriptor that defines only `__get__` (such as normal methods) is a non-data descriptor.
- Why not B: Descriptors are in-memory protocol objects.
- Why not C: Descriptors can be attached to any Python class.
- Why not D: Descriptor lookup order is governed by attribute access rules, not `__init__`.
- Ref: [modules/04-descriptors-metaclasses-and-attributes.md](../modules/04-descriptors-metaclasses-and-attributes.md#1-the-descriptor-protocol-data-vs-non-data), https://docs.python.org/3/howto/descriptor.html
</details>

### Q-PYTHON-017 · Descriptors, Metaclasses & Attributes · difficulty 2 · scenario
An instance `obj` has an attribute `'x'` in its `obj.__dict__`. Its class has a descriptor `'x'` with both `__get__` and `__set__`. When reading `obj.x`, which has precedence?
- A) `obj.__dict__['x']`
- B) The class-level data descriptor's `__get__` method
- C) `obj.__getattr__('x')`
- D) The small int cache
<details><summary>Answer</summary>

**B.** In Python's attribute lookup order, a **data descriptor** takes precedence over the instance's `__dict__`. If `'x'` is a data descriptor on the class, `Class.__dict__['x'].__get__(obj, Class)` is called regardless of whether `'x'` exists in `obj.__dict__`.
- Why not A: Instance `__dict__` only overrides non-data descriptors, not data descriptors.
- Why not C: `__getattr__` is called only if attribute lookup fails everywhere else.
- Why not D: The small int cache has no relation to descriptor precedence.
- Ref: [modules/04-descriptors-metaclasses-and-attributes.md](../modules/04-descriptors-metaclasses-and-attributes.md#2-attribute-lookup-precedence-order), https://docs.python.org/3/reference/datamodel.html#invoking-descriptors
</details>

### Q-PYTHON-018 · Descriptors, Metaclasses & Attributes · difficulty 3 · single
What algorithm does Python use to determine the Method Resolution Order (MRO) for multiple inheritance?
- A) Depth-First Search with post-order traversal.
- B) Breadth-First Search with duplicate elimination.
- C) C3 Linearization.
- D) Tarjan's Strongly Connected Components algorithm.
<details><summary>Answer</summary>

**C.** Python uses the C3 Linearization algorithm. C3 guarantees monotonicity (subclasses never reorder inherited ancestor precedence) and preserves the local precedence order of base classes declared in class definition headers.
- Why not A: DFS was used in Python 2.2 and earlier ("old-style classes") and suffered from serious diamond inheritance anomalies.
- Why not B: Simple BFS violates inheritance hierarchy monotonicity.
- Why not D: Tarjan's algorithm finds SCCs in directed graphs, not class linearization orders.
- Ref: [modules/04-descriptors-metaclasses-and-attributes.md](../modules/04-descriptors-metaclasses-and-attributes.md#4-multiple-inheritance-and-c3-linearization-mro), https://docs.python.org/3/howto/mro.html
</details>

### Q-PYTHON-019 · Descriptors, Metaclasses & Attributes · difficulty 2 · scenario
How does cooperative multiple inheritance with `super()` work in Python?
- A) `super()` calls the immediate parent declared in the class header.
- B) `super()` queries the calling instance's dynamic MRO to find the *next* class in line, passing control cooperatively down the chain.
- C) `super()` restarts method lookup from the root `object` class.
- D) `super()` executes all ancestor methods in parallel.
<details><summary>Answer</summary>

**B.** `super()` does not call the syntactic parent of the class where it is written; it inspects the MRO of the instance (`self`) passed into the call and invokes the method on the class immediately following the current class in that MRO.
- Why not A: Hardcoding the syntactic parent breaks cooperative diamond hierarchies.
- Why not C: `super()` advances along the MRO, not from `object`.
- Why not D: Execution is strictly serial and synchronous.
- Ref: [modules/04-descriptors-metaclasses-and-attributes.md](../modules/04-descriptors-metaclasses-and-attributes.md#5-cooperative-super-and-diamond-hierarchies), https://docs.python.org/3/library/functions.html#super
</details>

### Q-PYTHON-020 · Descriptors, Metaclasses & Attributes · difficulty 3 · single
How can a class satisfy `isinstance(obj, MyABC)` without explicitly inheriting from `MyABC`?
- A) By implementing `__subclasshook__(cls, subclass)` on `MyABC` and having `subclass` implement the required methods.
- B) By decorating `MyABC` with `@dataclass`.
- C) By setting `obj.__class__ = MyABC` dynamically.
- D) By compiling `obj` with Cython.
<details><summary>Answer</summary>

**A.** Abstract Base Classes (ABCs) support structural virtual subclassing via `__subclasshook__(cls, subclass)`. If the hook returns `True` (e.g. verifying that `subclass` implements `__len__`), `issubclass(subclass, MyABC)` and `isinstance(obj, MyABC)` evaluate to `True`.
- Why not B: `@dataclass` generates dunders for fields; it does not implement structural ABC hooks.
- Why not C: Mutating `__class__` changes nominal type, not virtual ABC compliance.
- Why not D: Cython does not alter ABC subtyping mechanics.
- Ref: [modules/04-descriptors-metaclasses-and-attributes.md](../modules/04-descriptors-metaclasses-and-attributes.md#7-abstract-base-classes-abcs--virtual-subclasses), https://docs.python.org/3/library/abc.html
</details>

---

### Q-PYTHON-021 · Iteration, Generators & Context Managers · difficulty 1 · single
What exception must an iterator's `__next__()` method raise to terminate iteration cleanly?
- A) `GeneratorExit`
- B) `IndexError`
- C) `StopIteration`
- D) `KeyError`
<details><summary>Answer</summary>

**C.** According to the Python Iteration Protocol (PEP 234), `__next__()` must raise `StopIteration` when there are no further items to yield. `for` loops and comprehensions catch this exception automatically to conclude the loop.
- Why not A: `GeneratorExit` is raised inside a generator when `.close()` is called.
- Why not B: `IndexError` signals sequence bounds exceedance in old-style indexing protocols, not standard iterators.
- Why not D: `KeyError` is raised on missing dictionary keys.
- Ref: [modules/05-iteration-generators-and-context-managers.md](../modules/05-iteration-generators-and-context-managers.md#1-the-iteration-protocol-mechanics), https://docs.python.org/3/reference/datamodel.html#iterator-types
</details>

### Q-PYTHON-022 · Iteration, Generators & Context Managers · difficulty 2 · single
What is the return value of `generator.send(val)` on a freshly instantiated generator that has not yet been yielded from?
- A) It returns `None`.
- B) It yields the first value.
- C) It raises `TypeError: can't send non-None value to a just-started generator`.
- D) It restarts the generator.
<details><summary>Answer</summary>

**C.** A newly created generator is in the `GEN_CREATED` state and has not paused at any `yield` expression. Sending any value other than `None` before priming raises `TypeError`.
- Why not A: It does not return `None`; it throws an exception.
- Why not B: It cannot consume a non-None value before reaching a yield point.
- Why not D: Generators cannot be restarted.
- Ref: [modules/05-iteration-generators-and-context-managers.md](../modules/05-iteration-generators-and-context-managers.md#2-generator-mechanics--frame-suspension), https://docs.python.org/3/reference/expressions.html#generator.send
</details>

### Q-PYTHON-023 · Iteration, Generators & Context Managers · difficulty 2 · scenario
How does `yield from subgen()` communicate with the caller of the delegating generator?
- A) It copies all yielded items into an in-memory list before returning them.
- B) It establishes a direct transparent bi-directional channel between caller and subgenerator: values yielded by `subgen` go directly to caller, and `.send()`, `.throw()`, and `.close()` calls bypass the delegating generator.
- C) It runs `subgen` in a background OS thread.
- D) It compiles `subgen` to a C loop.
<details><summary>Answer</summary>

**B.** PEP 380 defines `yield from`. It acts as a transparent two-way pipe between caller and subgenerator: yields flow directly out, values passed to `.send()` flow directly into the subgenerator, exceptions raised via `.throw()` propagate inside, and the subgenerator's return value becomes the value of the `yield from` expression.
- Why not A: `yield from` streams items lazily with $O(1)$ memory.
- Why not C: `yield from` is entirely synchronous and runs on the current thread.
- Why not D: It is executed by standard CPython evaluation bytecode.
- Ref: [modules/05-iteration-generators-and-context-managers.md](../modules/05-iteration-generators-and-context-managers.md#3-bidirectional-communication-and-yield-from), https://peps.python.org/pep-0380/
</details>

### Q-PYTHON-024 · Iteration, Generators & Context Managers · difficulty 2 · single
In a context manager's `__exit__(self, exc_type, exc_val, exc_tb)`, how do you suppress an exception so it does not propagate outside the `with` block?
- A) Return `True` (or a truthy value) from `__exit__`.
- B) Return `False`.
- C) Call `sys.exc_clear()`.
- D) Re-raise `None`.
<details><summary>Answer</summary>

**A.** If an exception occurs inside a `with` block, Python passes its details to `__exit__`. If `__exit__` returns `True`, Python suppresses the exception and continues normal execution after the `with` block. If it returns `False` or `None`, the exception is re-raised.
- Why not B: Returning `False` allows the exception to propagate.
- Why not C: `sys.exc_clear()` was removed in Python 3.
- Why not D: `raise None` is invalid syntax.
- Ref: [modules/05-iteration-generators-and-context-managers.md](../modules/05-iteration-generators-and-context-managers.md#4-the-context-manager-protocol), https://docs.python.org/3/reference/datamodel.html#object.__exit__
</details>

### Q-PYTHON-025 · Iteration, Generators & Context Managers · difficulty 3 · scenario
How does PEP 654 `except*` syntax handle an `ExceptionGroup` containing both `ValueError` and `KeyError`?
- A) It catches only the first exception in the group and ignores the rest.
- B) It can split the `ExceptionGroup`, matching the `ValueError` branch with the `ValueError` sub-group, and matching the `KeyError` branch with the `KeyError` sub-group, executing both handler blocks if present.
- C) It converts the `ExceptionGroup` into a dictionary of tracebacks.
- D) It aborts execution immediately.
<details><summary>Answer</summary>

**B.** `except*` enables handling concurrent exceptions. The runtime partitions the `ExceptionGroup`: the portion matching the pattern is bound to the `except*` clause, while unhandled exceptions remain in the group and propagate up the stack.
- Why not A: Traditional `except Exception:` matches the whole group monolithically; `except*` selectively splits and matches.
- Why not C: Tracebacks remain attached to individual exception objects.
- Why not D: Handled portions do not abort execution.
- Ref: [modules/05-iteration-generators-and-context-managers.md](../modules/05-iteration-generators-and-context-managers.md#6-pep-654-exceptiongroup--except), https://peps.python.org/pep-0654/
</details>

---

### Q-PYTHON-026 · Type System & Annotations · difficulty 1 · single
How are generic classes defined using modern PEP 695 syntax in Python 3.12+?
- A) `class Box(Generic[T]):`
- B) `class Box[T]:`
- C) `template <typename T> class Box:`
- D) `@generic("T") class Box:`
<details><summary>Answer</summary>

**B.** PEP 695 introduced native syntax for generics: `class Box[T]:`. It eliminates the need to manually declare `T = TypeVar("T")` and inherit from `typing.Generic[T]`.
- Why not A: Legacy syntax required importing `TypeVar` and `Generic`.
- Why not C: C++ template syntax is invalid Python.
- Why not D: Decorator-based generics are not part of Python.
- Ref: [modules/06-type-system-and-annotations.md](../modules/06-type-system-and-annotations.md#1-pep-695-type-parameter-syntax), https://peps.python.org/pep-0695/
</details>

### Q-PYTHON-027 · Type System & Annotations · difficulty 2 · single
Why must mutable collections like `list[T]` be **invariant** rather than covariant?
- A) Because CPython lists are linked lists, not arrays.
- B) Because if `list[Dog]` were a subtype of `list[Animal]`, code expecting `list[Animal]` could append a `Cat` into what is actually a list of dogs, violating type safety at runtime.
- C) Because the GIL prohibits covariance.
- D) Because Python strings are immutable.
<details><summary>Answer</summary>

**B.** Mutable collections must be invariant. If `list[Dog] <: list[Animal]`, then an alias `animals: list[Animal] = dogs` would allow `animals.append(Cat())`, corrupting the `dogs` list with an object that cannot bark.
- Why not A: CPython lists are dynamic arrays (`PyObject**`), not linked lists.
- Why not C: The GIL has no relation to type-system variance.
- Why not D: List mutability is independent of string immutability.
- Ref: [modules/06-type-system-and-annotations.md](../modules/06-type-system-and-annotations.md#2-subtyping-variance-invariance-covariance--contravariance), https://docs.python.org/3/library/typing.html#variance
</details>

### Q-PYTHON-028 · Type System & Annotations · difficulty 2 · single
What is the crucial advantage of PEP 742 `TypeIs[T]` over `TypeGuard[T]`?
- A) `TypeIs` works at runtime without type checkers.
- B) `TypeIs[T]` provides bidirectional narrowing: if it returns `True`, the variable is narrowed to `T`; if it returns `False`, `T` is safely removed from the type union in the `else` branch.
- C) `TypeIs` speeds up Python bytecode execution.
- D) `TypeIs` replaces `isinstance()`.
<details><summary>Answer</summary>

**B.** `TypeGuard[T]` only narrows in the `True` branch; it does not narrow in the `False` branch because the guard could be partial. PEP 742 `TypeIs[T]` guarantees full equivalence: in the `True` branch the type is narrowed to $U \cap T$, and in the `False` branch the type is narrowed to $U \setminus T$.
- Why not A: Both are static typing constructs interpreted by type checkers.
- Why not C: Static type annotations have zero effect on bytecode speed.
- Why not D: It types custom functions that call `isinstance()`.
- Ref: [modules/06-type-system-and-annotations.md](../modules/06-type-system-and-annotations.md#6-pep-742-typeis-vs-typeguard), https://peps.python.org/pep-0742/
</details>

### Q-PYTHON-029 · Type System & Annotations · difficulty 3 · scenario
How do you type a decorator that adds an argument to a function signature while preserving the original parameter types and return type?
- A) Use `typing.Any` for all parameters.
- B) Use `ParamSpec` combined with `Concatenate[FirstArgType, P]`.
- C) Use `TypeVarTuple`.
- D) Decorators cannot be statically typed with variable arguments.
<details><summary>Answer</summary>

**B.** `ParamSpec` captures the exact signature of a callable. PEP 612 introduced `typing.Concatenate`: `Callable[Concatenate[Request, P], R]` allows prefixing or prepending new parameter types while forwarding the remaining parameter pack `P` and return type `R`.
- Why not A: `Any` loses all static type safety and autocompletion.
- Why not C: `TypeVarTuple` is designed for variadic type generics (e.g. multi-dimensional tensor shapes), not callable parameter insertion.
- Why not D: Modern Python static typing cleanly types signature transformations.
- Ref: [modules/06-type-system-and-annotations.md](../modules/06-type-system-and-annotations.md#5-paramspec-and-concatenate-for-higher-order-callables), https://peps.python.org/pep-0612/
</details>

### Q-PYTHON-030 · Type System & Annotations · difficulty 2 · single
What does decorating a `typing.Protocol` with `@runtime_checkable` allow?
- A) It compiles the protocol to a C header file.
- B) It allows `isinstance(obj, Proto)` and `issubclass(cls, Proto)` to structurally verify that attributes and methods are present at runtime.
- C) It type-checks arguments on every function invocation.
- D) It forbids dynamic attribute creation on instances.
<details><summary>Answer</summary>

**B.** By default, `Protocol` is a static-only typing construct. Decorating it with `@runtime_checkable` enables `isinstance()` checks to inspect whether the target object has the attributes and callables specified in the protocol.
- Why not A: Protocols are pure Python.
- Why not C: Python does not perform runtime argument type checks automatically.
- Why not D: Dynamic attribute assignment is governed by `__setattr__` or `__slots__`.
- Ref: [modules/06-type-system-and-annotations.md](../modules/06-type-system-and-annotations.md#4-structural-typing-with-typingprotocol), https://docs.python.org/3/library/typing.html#typing.runtime_checkable
</details>

---

### Q-PYTHON-031 · Imports, Modules & Packaging · difficulty 1 · single
What is the purpose of `sys.modules`?
- A) It holds the list of directory paths searched during imports.
- B) It is a dictionary mapping fully qualified module names to their loaded module objects, serving as CPython's import cache.
- C) It contains the AST of all compiled functions.
- D) It lists the C extensions built into the interpreter.
<details><summary>Answer</summary>

**B.** `sys.modules` is CPython's module cache. Whenever an `import foo` statement executes, Python checks `sys.modules` first. If present, it returns the cached module immediately, preventing redundant file reads and re-execution.
- Why not A: Search paths are stored in `sys.path`.
- Why not C: `sys.modules` stores module objects, not AST nodes.
- Why not D: Built-in C modules are listed in `sys.builtin_module_names`.
- Ref: [modules/07-imports-modules-and-packaging.md](../modules/07-imports-modules-and-packaging.md#1-the-cpython-import-system-architecture), https://docs.python.org/3/library/sys.html#sys.modules
</details>

### Q-PYTHON-032 · Imports, Modules & Packaging · difficulty 2 · scenario
Two modules, `a.py` and `b.py`, import each other at top-level:
- `a.py`: `from b import func_b; def func_a(): return func_b()`
- `b.py`: `from a import func_a; def func_b(): return func_a()`
Running `python a.py` raises `ImportError: cannot import name 'func_b' from partially initialized module 'b'`. Why?
- A) Python prohibits any circular references in code.
- B) When `a.py` starts, it creates an empty module `a` in `sys.modules` and imports `b`. When `b.py` runs, it executes `from a import func_a`, but `func_a` has not yet been defined in `a`'s namespace because `a.py` is suspended at line 1!
- C) `b.py` cannot find `a.py` on `sys.path`.
- D) Python modules cannot share function names.
<details><summary>Answer</summary>

**B.** Top-level `from a import func_a` accesses attribute `func_a` immediately. Because `a.py` is suspended at `from b import func_b`, `func_a` has not yet executed. The attribute lookup on the partially initialized module `a` fails with `ImportError`.
- Why not A: Circular imports are supported if resolved via module-level imports (`import a; a.func_a()`) or inside function bodies.
- Why not C: Both modules are in the same directory.
- Why not D: Namespaces are isolated per module.
- Ref: [modules/07-imports-modules-and-packaging.md](../modules/07-imports-modules-and-packaging.md#3-circular-imports-mechanics-and-remediation), https://docs.python.org/3/reference/import.html
</details>

### Q-PYTHON-033 · Imports, Modules & Packaging · difficulty 2 · single
What defines a **PEP 420 Implicit Namespace Package** in Python 3.3+?
- A) A directory with an empty `__init__.py` file.
- B) A directory containing Python files that does NOT have an `__init__.py` file.
- C) A `.zip` file containing Python bytecode.
- D) A module installed via `pip install --user`.
<details><summary>Answer</summary>

**B.** PEP 420 introduced implicit namespace packages: directories without an `__init__.py` file. They allow multiple independent distributions to contribute packages and modules to a shared top-level namespace across different directories on `sys.path`.
- Why not A: Directories with `__init__.py` are regular packages.
- Why not C: Zip imports are governed by `zipimport`, not PEP 420.
- Why not D: Installation target directory does not determine namespace package semantics.
- Ref: [modules/07-imports-modules-and-packaging.md](../modules/07-imports-modules-and-packaging.md#4-pep-420-namespace-packages), https://peps.python.org/pep-0420/
</details>

### Q-PYTHON-034 · Imports, Modules & Packaging · difficulty 3 · single
How does PEP 810 explicit lazy imports optimize application startup latency?
- A) It compiles modules to WebAssembly ahead of time.
- B) Using `lazy import foo` defers the execution of `foo`'s top-level bytecode until an attribute on `foo` is accessed for the first time.
- C) It skips module syntax validation during import.
- D) It imports packages into a separate OS subprocess.
<details><summary>Answer</summary>

**B.** `lazy import` creates a proxy module object without executing the target module's file immediately. Top-level evaluation occurs only when the program actually accesses an attribute on the imported module, cutting CLI cold-start times dramatically.
- Why not A: Python bytecode is not WebAssembly.
- Why not C: Module syntax is validated when compiled.
- Why not D: It executes in the same process on demand.
- Ref: [modules/07-imports-modules-and-packaging.md](../modules/07-imports-modules-and-packaging.md#2-pep-810-explicit-lazy-imports), https://peps.python.org/pep-0810/
</details>

### Q-PYTHON-035 · Imports, Modules & Packaging · difficulty 2 · single
What is the structural format of a standard Python Wheel (`.whl`) file?
- A) A gzipped tarball containing C source files.
- B) A standard ZIP archive containing pure Python files or compiled binaries alongside a `.dist-info` directory with package metadata.
- C) A native ELF binary.
- D) An encrypted SQLite database.
<details><summary>Answer</summary>

**B.** A Wheel (PEP 427) is a ZIP-format archive with a specific file layout: the installable package files plus `<distribution>-<version>.dist-info/` containing metadata, entry points, and cryptographic record hashes (`RECORD`).
- Why not A: Source archives (`.tar.gz`) are sdists, not wheels.
- Why not C: Wheels are ZIP archives containing files, not standalone ELF executables.
- Why not D: Wheels do not use SQLite format.
- Ref: [modules/07-imports-modules-and-packaging.md](../modules/07-imports-modules-and-packaging.md#5-wheels-pyprojecttoml-and-modern-packaging), https://peps.python.org/pep-0427/
</details>

---

### Q-PYTHON-036 · CPython Internals & Bytecode · difficulty 1 · single
What tool in the Python standard library allows disassembling Python functions and code objects into readable bytecode instructions?
- A) `ast`
- B) `dis`
- C) `inspect`
- D) `tokenize`
<details><summary>Answer</summary>

**B.** The `dis` module is the standard library disassembler for CPython bytecode. Calling `dis.dis(func)` or `dis.get_instructions(func)` displays opcodes, arguments, and jump offsets.
- Why not A: `ast` inspects abstract syntax tree nodes, not compiled bytecode.
- Why not C: `inspect` inspects live objects, call frames, and signatures.
- Why not D: `tokenize` parses source text into lexical tokens.
- Ref: [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#1-the-cpython-bytecode-virtual-machine), https://docs.python.org/3/library/dis.html
</details>

### Q-PYTHON-037 · CPython Internals & Bytecode · difficulty 2 · scenario
How does PEP 659 Specialized Adaptive Interpreter achieve 10–60% execution speedups in Python 3.11+?
- A) By compiling Python to native x86 machine instructions via an LLVM backend.
- B) By identifying stable runtime types at bytecode call sites and inline-rewriting generic opcodes into monomorphic specialized instructions (e.g. `LOAD_ATTR_INSTANCE_VALUE`).
- C) By disabling reference counting in loops.
- D) By running multiple GIL threads simultaneously.
<details><summary>Answer</summary>

**B.** PEP 659 replaces hot generic instructions with specialized ones. If a `LOAD_ATTR` instruction consistently accesses an attribute at slot 0 of a specific class instance, it is rewritten to `LOAD_ATTR_INSTANCE_VALUE`, bypassing dictionary hashing and looking up the value directly at that offset.
- Why not A: PEP 659 operates entirely within CPython bytecode, not native assembly.
- Why not C: Reference counting remains active.
- Why not D: Free-threading is PEP 703, not PEP 659.
- Ref: [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#2-pep-659-specializing-adaptive-interpreter), https://peps.python.org/pep-0659/
</details>

### Q-PYTHON-038 · CPython Internals & Bytecode · difficulty 2 · single
What problem do PEP 683 **Immortal Objects** solve in CPython?
- A) They prevent memory fragmentation in the OS kernel.
- B) They give fundamental runtime singletons (`None`, `True`, `False`, small ints) a permanent reference count that is never incremented or decremented, avoiding cache-line dirtying in Copy-on-Write multi-process forks.
- C) They allow Python programs to run forever without restarting.
- D) They make objects immutable.
<details><summary>Answer</summary>

**B.** Before PEP 683, sharing objects between forked worker processes dirtied OS memory pages because even read operations (`x is None`) modified reference counts (`ob_refcnt++` / `ob_refcnt--`), breaking Linux Copy-on-Write sharing. Immortal objects set `ob_refcnt` to a fixed high-bit value so mutations are bypassed.
- Why not A: They do not change kernel heap fragmentation.
- Why not C: Object longevity does not prevent system restarts.
- Why not D: Immutability is governed by object type methods, not immortality.
- Ref: [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#3-memory-management-reference-counting--pep-683-immortal-objects), https://peps.python.org/pep-0683/
</details>

### Q-PYTHON-039 · CPython Internals & Bytecode · difficulty 3 · single
How does CPython's cyclic garbage collector detect unreferenced isolated cycles of container objects?
- A) By checking if memory addresses point to deleted pages.
- B) By copying `ob_refcnt` to `gc_refs`, subtracting 1 for every reference between tracked containers in that generation, and verifying if any external root reference remains (`gc_refs > 0`).
- C) By running Dijkstra's shortest path algorithm on the heap.
- D) By halting all threads and asking the operating system kernel for live handles.
<details><summary>Answer</summary>

**B.** The cyclic GC uses the trial deletion algorithm: it traverses the generation's container objects, decrementing temporary `gc_refs` for internal references. If all references to a cluster of objects originate from within the cluster itself, their `gc_refs` reach zero, identifying them as garbage.
- Why not A: Deallocated pages cause segfaults, not cyclic GC reclamation.
- Why not C: Dijkstra's algorithm computes shortest paths, not unreferenced clusters.
- Why not D: The OS kernel has no awareness of Python object references.
- Ref: [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#4-the-cyclic-garbage-collector), https://docs.python.org/3/library/gc.html
</details>

### Q-PYTHON-040 · CPython Internals & Bytecode · difficulty 2 · single
What is `pymalloc` in CPython?
- A) A Python wrapper around the `malloc()` C library.
- B) A specialized small-object memory allocator that manages allocations $\le 512$ bytes using 256KB arenas and 4KB pools to minimize system malloc overhead and fragmentation.
- C) A tool that profiles memory leaks in Python code.
- D) A garbage collection algorithm for circular references.
<details><summary>Answer</summary>

**B.** `pymalloc` is CPython's specialized memory allocator. Allocations $\le 512$ bytes are handled in pre-allocated pools of fixed size classes, avoiding expensive OS `malloc`/`free` calls.
- Why not A: Python's raw memory interface is `PyMem_RawMalloc`.
- Why not C: Memory profiling is provided by `tracemalloc`.
- Why not D: Cyclic GC is handled by the `gc` module, not `pymalloc`.
- Ref: [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#5-memory-allocator-hierarchy-pymalloc--mimalloc), https://docs.python.org/3/c-api/memory.html
</details>

---

### Q-PYTHON-041 · Concurrency: GIL, Threads & Subinterpreters · difficulty 1 · single
What is the primary role of the Global Interpreter Lock (GIL) in standard CPython?
- A) It prevents two Python processes from running at the same time.
- B) It is a mutual-exclusion lock that protects CPython's internal memory management and reference counting from concurrent access by multiple threads.
- C) It coordinates database transaction commits.
- D) It enforces type checking across thread boundaries.
<details><summary>Answer</summary>

**B.** The GIL ensures that only one native OS thread executes CPython bytecode at any given moment, preventing race conditions on object reference counts and internal CPython runtime structures.
- Why not A: Processes have separate address spaces and separate GILs.
- Why not C: Database locks are managed by DBMS engines.
- Why not D: Python does not perform static type checks at runtime.
- Ref: [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#1-the-global-interpreter-lock-gil-mechanics), https://wiki.python.org/moin/GlobalInterpreterLock
</details>

### Q-PYTHON-042 · Concurrency: GIL, Threads & Subinterpreters · difficulty 2 · scenario
Two threads in standard CPython increment a shared variable `counter += 1` inside a loop without a `threading.Lock`. Does the GIL prevent race conditions on `counter`?
- A) Yes, because the GIL makes all Python code completely thread-safe.
- B) No, because `counter += 1` compiles to multiple bytecode instructions (`LOAD_FAST`, `BINARY_OP`, `STORE_FAST`); thread preemption can occur between any instruction, causing lost updates.
- C) Yes, because integers are immutable.
- D) No, but only if running on Windows.
<details><summary>Answer</summary>

**B.** The GIL protects CPython's internal C structures, NOT application-level logic. Because `counter += 1` compiles to distinct bytecode operations, a thread switch can interrupt the read-modify-write cycle, resulting in data races.
- Why not A: The GIL does not guarantee application-level atomicity.
- Why not C: Integer immutability does not prevent name rebinding races.
- Why not D: Thread preemption happens on all platforms.
- Ref: [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#3-thread-safety-in-pure-python-data-races-under-the-gil), https://docs.python.org/3/library/threading.html
</details>

### Q-PYTHON-043 · Concurrency: GIL, Threads & Subinterpreters · difficulty 3 · single
How does PEP 703 Free-Threaded CPython (`python3.15t`) safely operate without a Global Interpreter Lock?
- A) By running every thread in a separate Docker container.
- B) By using mimalloc thread-local heaps, biased reference counting, and fine-grained mutexes on shared internal collections.
- C) By executing bytecodes in a single serial queue.
- D) By disabling garbage collection completely.
<details><summary>Answer</summary>

**B.** PEP 703 removes the GIL by using biased reference counting (local thread updates use non-atomic ops; foreign threads use atomic ops), immortal objects, thread-safe memory allocations via mimalloc, and internal container locks.
- Why not A: Threads share process memory.
- Why not C: Threads run truly in parallel across CPU cores.
- Why not D: Cyclic GC is updated to operate concurrently.
- Ref: [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#2-pep-703--pep-779-free-threaded-python), https://peps.python.org/pep-0703/
</details>

### Q-PYTHON-044 · Concurrency: GIL, Threads & Subinterpreters · difficulty 2 · single
What is the safest `multiprocessing` start method across all platforms for multi-threaded applications?
- A) `fork`
- B) `spawn`
- C) `exec`
- D) `forkserver`
<details><summary>Answer</summary>

**B.** `spawn` starts a fresh Python interpreter process from scratch, inheriting only necessary file descriptors. It avoids the deadlocks and state corruption that occur when `fork` duplicates processes that already contain active background threads.
- Why not A: `fork` in multi-threaded programs duplicates locks held by other threads, causing deadlocks in the child.
- Why not C: `exec` replaces the current process rather than spawning a worker pool.
- Why not D: `forkserver` is safer than `fork`, but not universally supported across all platforms (e.g. Windows).
- Ref: [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#4-multiprocessing-start-methods-fork-vs-spawn-vs-forkserver), https://docs.python.org/3/library/multiprocessing.html#contexts-and-start-methods
</details>

### Q-PYTHON-045 · Concurrency: GIL, Threads & Subinterpreters · difficulty 3 · single
What capability do subinterpreters with per-interpreter GILs (PEP 684 / PEP 734) provide?
- A) Running Python 2 and Python 3 inside the same binary.
- B) Running multiple independent Python execution states inside a single OS process, each with its own GIL, enabling true parallel execution across CPU cores.
- C) Replacing the Linux kernel task scheduler.
- D) Sharing all global variables across threads without synchronization.
<details><summary>Answer</summary>

**B.** PEP 684 and PEP 734 allow multiple isolated Python interpreters to exist in one process. Because each subinterpreter has its own GIL, threads belonging to different subinterpreters can execute CPU-bound bytecodes simultaneously on multiple cores.
- Why not A: Both run the same Python 3.15 runtime.
- Why not C: OS threads schedule the subinterpreters.
- Why not D: Subinterpreters have isolated namespaces and do not share global variables.
- Ref: [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#5-subinterpreters-and-per-interpreter-gil-pep-684--pep-734), https://peps.python.org/pep-0684/
</details>

---

### Q-PYTHON-046 · Asyncio & Structured Concurrency · difficulty 1 · single
What architectural pattern forms the foundation of Python's `asyncio` event loop?
- A) Model-View-Controller
- B) Reactor Pattern
- C) Blackboard Pattern
- D) Active Record Pattern
<details><summary>Answer</summary>

**B.** `asyncio` implements the Reactor design pattern. An event demultiplexer (such as `epoll` or `kqueue` via `selectors`) monitors I/O file descriptors, and the event loop dispatches events to registered coroutine tasks and callbacks.
- Why not A: MVC is an application UI pattern.
- Why not C: Blackboard is an AI / blackboard collaboration architecture.
- Why not D: Active Record is a database ORM pattern.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#1-the-reactor-pattern--the-asyncio-event-loop), https://docs.python.org/3/library/asyncio.html
</details>

### Q-PYTHON-047 · Asyncio & Structured Concurrency · difficulty 2 · scenario
Why does `asyncio.CancelledError` inherit from `BaseException` rather than `Exception` in modern Python?
- A) To prevent general `except Exception:` blocks from inadvertently swallowing task cancellation requests and keeping cancelled tasks alive.
- B) To force the operating system to terminate the process immediately.
- C) Because it is generated by native C code.
- D) To allow `asyncio` tasks to run without an event loop.
<details><summary>Answer</summary>

**A.** In earlier Python versions, `CancelledError` inherited from `Exception`. Naive code with `try: ... except Exception: pass` would catch and silence cancellation signals. In Python 3.8+, `CancelledError` inherits from `BaseException` (like `KeyboardInterrupt`), bypassing standard `except Exception:` handlers.
- Why not B: Cancellation cancels the task, not the whole OS process.
- Why not C: Exception hierarchy placement is a design choice in Python's standard library.
- Why not D: Coroutines still require an active event loop.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#3-cancellation-mechanics--cancellederror-lifecycle), https://docs.python.org/3/library/asyncio-exceptions.html#asyncio.CancelledError
</details>

### Q-PYTHON-048 · Asyncio & Structured Concurrency · difficulty 2 · single
What is the primary benefit of `asyncio.TaskGroup` over `asyncio.gather()`?
- A) It runs tasks in separate OS threads.
- B) It enforces structured concurrency: if any child task raises an exception, all other active tasks in the group are immediately cancelled and awaited before exiting the context manager.
- C) It guarantees that tasks execute in strict serial order.
- D) It eliminates the need for `await`.
<details><summary>Answer</summary>

**B.** `asyncio.TaskGroup` implements structured concurrency. Unlike `gather()`, which leaves sibling tasks running as orphans if one fails, `TaskGroup` guarantees that all child tasks are either completed or cancelled and cleaned up before exiting the `async with` block.
- Why not A: `TaskGroup` runs coroutines on the single event loop thread.
- Why not C: Tasks run concurrently, not serially.
- Why not D: Coroutines still require `await`.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#4-structured-concurrency-with-asynciotaskgroup), https://docs.python.org/3/library/asyncio-task.html#asyncio.TaskGroup
</details>

### Q-PYTHON-049 · Asyncio & Structured Concurrency · difficulty 2 · scenario
How should a synchronous, CPU-bound or blocking I/O function be invoked from within an async coroutine without freezing the event loop?
- A) `await func()`
- B) `await asyncio.to_thread(func, *args)`
- C) `asyncio.create_task(func())`
- D) `threading.Thread(target=func).start()`
<details><summary>Answer</summary>

**B.** `asyncio.to_thread()` offloads the synchronous blocking call to a worker thread from the default thread pool (`ThreadPoolExecutor`) and returns a coroutine that can be awaited, keeping the main event loop thread free to process other events.
- Why not A: Direct invocation blocks the event loop thread for the duration of the call.
- Why not C: `create_task()` expects a coroutine, not a regular blocking function.
- Why not D: Raw threads are not awaited by the event loop and do not integrate results into the async workflow.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#6-bridging-sync-and-async-asyncio-to_thread), https://docs.python.org/3/library/asyncio-task.html#asyncio.to_thread
</details>

### Q-PYTHON-050 · Asyncio & Structured Concurrency · difficulty 3 · single
What does Python 3.13+ `asyncio.Queue.shutdown()` do when called with `immediate=False`?
- A) It cancels all pending consumers and empties the queue instantly.
- B) It closes the queue to new additions (subsequent `put()` raises `QueueShutDown`), while allowing existing queued items to be consumed; once empty, subsequent `get()` raises `QueueShutDown`.
- C) It stops the event loop immediately.
- D) It converts the queue to a LIFO stack.
<details><summary>Answer</summary>

**B.** In Python 3.13+, `Queue.shutdown()` was introduced to solve graceful draining. With `immediate=False`, it prevents further submissions while allowing consumers to process remaining in-flight items cleanly, raising `QueueShutDown` once drained.
- Why not A: Immediate discarding occurs when `immediate=True`.
- Why not C: It shuts down the queue instance, not the entire event loop.
- Why not D: Queue ordering is not changed.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#7-streaming-backpressure-asyncioqueue--queueshutdown), https://docs.python.org/3/library/asyncio-queue.html#asyncio.Queue.shutdown
</details>

---

### Q-PYTHON-051 · Testing Practice: Pytest & Hypothesis · difficulty 1 · single
What is the default scope of a Pytest fixture if not explicitly specified?
- A) `module`
- B) `session`
- C) `function`
- D) `class`
<details><summary>Answer</summary>

**C.** If the `scope` argument is omitted from `@pytest.fixture`, it defaults to `"function"`. The fixture is created and destroyed fresh for each individual test function.
- Why not A: Module scope runs once per test file.
- Why not B: Session scope runs once per entire pytest invocation.
- Why not D: Class scope runs once per test class.
- Ref: [modules/11-testing-pytest-and-hypothesis.md](../modules/11-testing-pytest-and-hypothesis.md#1-pytest-architecture-and-dependency-injection), https://docs.pytest.org/en/stable/how-to/fixtures.html#fixture-scopes
</details>

### Q-PYTHON-052 · Testing Practice: Pytest & Hypothesis · difficulty 2 · single
What core testing capability does **Hypothesis** provide over traditional unit testing?
- A) It compiles tests to C++ for faster execution.
- B) It generates hundreds of randomized test inputs based on strategies, automatically shrinking any failing input to the minimal counterexample that breaks the assertion.
- C) It runs tests in Docker containers automatically.
- D) It replaces Pytest completely.
<details><summary>Answer</summary>

**B.** Hypothesis is a property-based testing framework. Given formal input strategies (`st.integers()`, `st.text()`), it generates diverse inputs, tests invariants, and when a failure occurs, systematically shrinks the data to find the smallest reproducible bug.
- Why not A: Hypothesis is pure Python.
- Why not C: It generates data in-process without containers.
- Why not D: Hypothesis integrates cleanly with Pytest as test functions.
- Ref: [modules/11-testing-pytest-and-hypothesis.md](../modules/11-testing-pytest-and-hypothesis.md#3-property-based-testing-with-hypothesis), https://hypothesis.readthedocs.io/
</details>

### Q-PYTHON-053 · Testing Practice: Pytest & Hypothesis · difficulty 2 · scenario
Why is `unittest.mock.create_autospec` preferred over standard `Mock()` or `MagicMock()` in large Python codebases?
- A) It runs mocks in parallel threads.
- B) It introspects the real specification object, raising `AttributeError` if test code attempts to access methods or pass arguments that do not exist on the real class, preventing "mock drift".
- C) It stores mock calls in an external database.
- D) It eliminates the need for dependency injection.
<details><summary>Answer</summary>

**B.** Standard `Mock()` dynamically creates attributes on the fly, meaning if a method on the real class is renamed or deleted, tests using naive mocks still pass. `create_autospec` matches the signature and attributes of the real target, failing tests immediately if mock drift occurs.
- Why not A: Mocks run in the test thread.
- Why not C: Mock histories are kept in memory.
- Why not D: Mocks are used alongside dependency injection.
- Ref: [modules/11-testing-pytest-and-hypothesis.md](../modules/11-testing-pytest-and-hypothesis.md#4-mocking-discipline--preventing-mock-drift), https://docs.python.org/3/library/unittest.mock.html#auto-speccing
</details>

### Q-PYTHON-054 · Testing Practice: Pytest & Hypothesis · difficulty 2 · single
How do you verify in Pytest that a specific block of code raises a `ValueError` with a message matching `"Invalid ID"`?
- A) `pytest.assert_raises(ValueError, "Invalid ID")`
- B) `with pytest.raises(ValueError, match="Invalid ID"):`
- C) `try...except ValueError: pass`
- D) `@pytest.mark.raises(ValueError)`
<details><summary>Answer</summary>

**B.** Pytest provides the `pytest.raises()` context manager. Passing `match="regex"` asserts that an exception of the specified type was raised and that its string representation matches the regex pattern.
- Why not A: `assert_raises` is an old unittest-style API.
- Why not C: Manual try-except does not fail if no exception is raised unless extra assertions are written.
- Why not D: Pytest has no `@pytest.mark.raises` decorator for this purpose.
- Ref: [modules/11-testing-pytest-and-hypothesis.md](../modules/11-testing-pytest-and-hypothesis.md#5-negative-testing-and-exception-verification), https://docs.pytest.org/en/stable/reference/reference.html#pytest-raises
</details>

### Q-PYTHON-055 · Testing Practice: Pytest & Hypothesis · difficulty 3 · single
In Pytest, how does fixture yield teardown behave when an exception occurs inside the test body?
- A) Teardown code after the `yield` statement is skipped completely.
- B) Teardown code after the `yield` statement is guaranteed to execute, exactly like the `finally` block of a `try...finally` statement.
- C) Pytest aborts the test suite immediately.
- D) The fixture is re-executed.
<details><summary>Answer</summary>

**B.** Pytest fixtures that use `yield` guarantee that code following the `yield` executes after the test concludes, even if the test raised an unhandled exception or failed an assertion.
- Why not A: Pytest ensures teardown execution.
- Why not C: Other tests continue running.
- Why not D: Fixtures are torn down, not re-run on failure.
- Ref: [modules/11-testing-pytest-and-hypothesis.md](../modules/11-testing-pytest-and-hypothesis.md#1-pytest-architecture-and-dependency-injection), https://docs.pytest.org/en/stable/how-to/fixtures.html#teardown-cleanup-yielding-fixture
</details>

---

### Q-PYTHON-056 · Performance Profiling & Optimization · difficulty 1 · single
What is the difference between `tottime` and `cumtime` in `cProfile` and `pstats` reports?
- A) `tottime` includes sub-function calls; `cumtime` excludes them.
- B) `tottime` is time spent exclusively inside that function body; `cumtime` is total time spent in that function plus all sub-functions it called.
- C) `tottime` is CPU time; `cumtime` is network latency.
- D) `tottime` is measured in seconds; `cumtime` is measured in clock ticks.
<details><summary>Answer</summary>

**B.** In `pstats`, `tottime` measures time spent strictly within the function itself (indicating pure CPU bottlenecks like tight loops), while `cumtime` measures cumulative time including all downstream functions called from it.
- Why not A: This inverts the definitions.
- Why not C: Both measure execution time within the profile.
- Why not D: Both are reported in seconds.
- Ref: [modules/12-performance-profiling-and-optimization.md](../modules/12-performance-profiling-and-optimization.md#2-profiling-cpu-time-with-cprofile--pstats), https://docs.python.org/3/library/profile.html
</details>

### Q-PYTHON-057 · Performance Profiling & Optimization · difficulty 2 · scenario
Why do sampling profilers (such as `py-spy`) introduce less runtime distortion than deterministic tracing profilers (`cProfile`)?
- A) Sampling profilers do not instrument or hook function entry/exit points; they inspect the process stack externally at fixed intervals, keeping overhead $<1\text{--}3\%$.
- B) Sampling profilers disable the GIL during profiling.
- C) Sampling profilers only profile the main function.
- D) Sampling profilers run inside the CPU L1 cache.
<details><summary>Answer</summary>

**A.** `cProfile` hooks every single function call and return via CPython's profiling hook, adding significant fixed per-call overhead that heavily distorts the execution time of small, frequently-called utility functions (the Observer Effect). Sampling profilers inspect memory externally, avoiding hook overhead.
- Why not B: Profilers do not disable the GIL.
- Why not C: Sampling profilers capture the full call stack.
- Why not D: Profilers are software programs, not hardware cache structures.
- Ref: [modules/12-performance-profiling-and-optimization.md](../modules/12-performance-profiling-and-optimization.md#1-profiling-taxonomy-tracing-vs-sampling), https://github.com/benfred/py-spy
</details>

### Q-PYTHON-058 · Performance Profiling & Optimization · difficulty 2 · single
Why is local variable caching (e.g. `local_sqrt = math.sqrt`) faster inside tight loops in CPython?
- A) It forces the C compiler to inline the function.
- B) It replaces `LOAD_GLOBAL` (hash table lookup in global and builtin dictionaries) with `LOAD_FAST` (direct array indexing in the call frame).
- C) It compiles the loop to SIMD instructions.
- D) It releases the GIL for the loop.
<details><summary>Answer</summary>

**B.** Global and module-level lookups emit `LOAD_GLOBAL` and `LOAD_ATTR`, requiring hash lookups. Local variables are pre-allocated slots in the frame's `f_localsplus` array, accessed in $O(1)$ time via single-cycle `LOAD_FAST` operations.
- Why not A: CPython does not perform JIT inlining of Python callables in standard builds.
- Why not C: Bytecode loops do not automatically vectorize to SIMD without libraries like NumPy.
- Why not D: The GIL remains active.
- Ref: [modules/12-performance-profiling-and-optimization.md](../modules/12-performance-profiling-and-optimization.md#3-high-impact-cpython-micro-optimizations), https://docs.python.org/3/glossary.html#term-bytecode
</details>

### Q-PYTHON-059 · Performance Profiling & Optimization · difficulty 2 · single
Why does concatenating $N$ strings using `+=` inside a loop result in $O(N^2)$ complexity, and how does `''.join()` fix this?
- A) `+=` performs a network call; `join()` keeps strings local.
- B) Strings are immutable; each `+=` allocates a new buffer and copies all previous bytes ($O(N^2)$ aggregate copies). `join()` calculates total length first, allocates once, and copies chunks in a single $O(N)$ pass.
- C) `+=` converts strings to floats.
- D) `join()` compresses strings using gzip.
<details><summary>Answer</summary>

**B.** Python strings are immutable. Repeatedly appending copies accumulating data: $1 + 2 + \dots + N = O(N^2)$ operations. `"".join(seq)` measures total length across elements, allocates a single heap buffer, and performs a single linear-time memory copy.
- Why not A: Strings are in-memory objects.
- Why not C: String types are not converted to floats.
- Why not D: `join()` does not compress strings.
- Ref: [modules/12-performance-profiling-and-optimization.md](../modules/12-performance-profiling-and-optimization.md#3-high-impact-cpython-micro-optimizations), https://docs.python.org/3/library/stdtypes.html#str.join
</details>

### Q-PYTHON-060 · Performance Profiling & Optimization · difficulty 3 · single
When using PyO3 to write high-performance native extensions in Rust, what mechanism allows Rust code to execute across multiple CPU cores simultaneously?
- A) Rust automatically disables Python's garbage collector.
- B) Calling `py.allow_threads(...)` releases the GIL during the Rust computation, allowing other Python threads to execute while Rust threads run across all cores.
- C) PyO3 rewrites Python bytecode into Rust macros.
- D) Rust threads bypass the operating system kernel.
<details><summary>Answer</summary>

**B.** In PyO3, wrapping a long-running native computation in `Python::allow_threads(py, || { ... })` releases CPython's Global Interpreter Lock for that duration. The native Rust worker can utilize Rayon or OS threads across all CPU cores without blocking Python threads.
- Why not A: The GC is not disabled.
- Why not C: PyO3 is a C-API binding generator, not a bytecode compiler.
- Why not D: Rust threads are standard OS threads.
- Ref: [modules/12-performance-profiling-and-optimization.md](../modules/12-performance-profiling-and-optimization.md#4-vectorization--native-extensions-simd--pyo3), https://pyo3.rs/
</details>

---

### Q-PYTHON-061 · Production Python & Security · difficulty 1 · single
Why is `pickle.loads()` considered unsafe when processing input from untrusted clients?
- A) It uses weak DES encryption.
- B) The pickle protocol allows serialized classes to define `__reduce__()`, which instructs the unpickler to invoke arbitrary system callables (like `os.system`) during deserialization, causing Remote Code Execution (RCE).
- C) It causes memory leaks in the operating system.
- D) It only works with ASCII text.
<details><summary>Answer</summary>

**B.** `pickle` is an interpreted virtual machine stream, not a passive data format. An attacker can construct a payload whose `__reduce__` method specifies an arbitrary function (e.g. `os.system("rm -rf /")`) and arguments; upon unpickling, Python executes the callable.
- Why not A: `pickle` is not an encryption protocol.
- Why not C: Memory is reclaimed; the vulnerability is code execution.
- Why not D: `pickle` is a binary format.
- Ref: [modules/13-production-python-and-security.md](../modules/13-production-python-and-security.md#5-security-vulnerability-classes--hardened-defenses), https://docs.python.org/3/library/pickle.html
</details>

### Q-PYTHON-062 · Production Python & Security · difficulty 2 · scenario
How does using `shell=False` in `subprocess.run(["cmd", user_arg])` defend against shell injection attacks?
- A) It parses and strips dangerous characters like `;` and `&` from `user_arg`.
- B) It bypasses the system shell (`/bin/sh` or `cmd.exe`) entirely and passes the argument list directly to the OS kernel `execve` syscall, ensuring metacharacters are treated as literal text data.
- C) It runs the command inside a seccomp container.
- D) It encrypts the command line.
<details><summary>Answer</summary>

**B.** When `shell=False`, Python does not invoke a shell command interpreter. The executable is invoked directly, and arguments are passed as discrete elements in the `argv` array. Shell metacharacters (`;`, `|`, `&&`) have no syntax meaning to `execve` and cannot trigger secondary commands.
- Why not A: Python does not sanitize or strip characters automatically.
- Why not C: `subprocess` does not create seccomp filters automatically.
- Why not D: Arguments are not encrypted.
- Ref: [modules/13-production-python-and-security.md](../modules/13-production-python-and-security.md#5-security-vulnerability-classes--hardened-defenses), https://docs.python.org/3/library/subprocess.html#security-considerations
</details>

### Q-PYTHON-063 · Production Python & Security · difficulty 2 · single
What default behavior change was introduced in Python 3.15 under PEP 686?
- A) Python defaults to 32-bit integers.
- B) Python enables UTF-8 mode by default across all operating systems, making `open()` and standard I/O default to UTF-8 regardless of OS locale.
- C) Python disables all logging by default.
- D) Python enables free-threading on all systems.
<details><summary>Answer</summary>

**B.** PEP 686 mandates UTF-8 mode as the default for Python 3.15+, eliminating legacy platform encoding quirks (like `cp1252` on Windows) and ensuring standard file and stream operations use UTF-8.
- Why not A: Python integers have arbitrary precision.
- Why not C: Logging is opt-in via the `logging` module.
- Why not D: Free-threading requires the `python3.15t` binary.
- Ref: [modules/13-production-python-and-security.md](../modules/13-production-python-and-security.md#3-pep-686-python-utf-8-default-mode), https://peps.python.org/pep-0686/
</details>

### Q-PYTHON-064 · Production Python & Security · difficulty 2 · single
Why should signal handlers in `asyncio` applications be registered with `loop.add_signal_handler()` instead of `signal.signal()`?
- A) `signal.signal()` does not work on Linux.
- B) `signal.signal()` runs asynchronously on the main thread between arbitrary bytecodes, making it unsafe to manipulate coroutine state; `loop.add_signal_handler()` schedules the callback cleanly within the event loop's turn.
- C) `signal.signal()` only works with SIGKILL.
- D) `loop.add_signal_handler()` compiles the handler to C.
<details><summary>Answer</summary>

**B.** `signal.signal()` can interrupt bytecode execution at arbitrary moments, creating re-entrancy bugs and race conditions if interacting with asyncio tasks. `loop.add_signal_handler()` integrates the signal into the loop's reactor mechanism via self-pipe or socketpair, ensuring safe execution.
- Why not A: `signal.signal()` is the POSIX standard API.
- Why not C: SIGKILL cannot be caught by any handler.
- Why not D: It executes Python callbacks.
- Ref: [modules/13-production-python-and-security.md](../modules/13-production-python-and-security.md#1-system-signals--graceful-lifecycle-shutdown), https://docs.python.org/3/library/asyncio-eventloop.html#asyncio.loop.add_signal_handler
</details>

### Q-PYTHON-065 · Production Python & Security · difficulty 3 · scenario
How do you reliably prevent path traversal attacks when resolving user-supplied relative file paths?
- A) Check that the path string does not contain `..`.
- B) Resolve the absolute canonical path using `path.resolve()` and verify that it starts with the canonical base directory using `resolved.is_relative_to(base.resolve())`.
- C) Remove all forward slashes from the input.
- D) Prepend `/tmp/` to the filename.
<details><summary>Answer</summary>

**B.** Simply checking for `..` can be bypassed by URL-encoding, symlinks, or unicode tricks. The secure defense resolves both the user target and the base directory to their canonical paths and asserts `target.is_relative_to(base)`.
- Why not A: String filtering is fragile and vulnerable to symlink and encoding bypasses.
- Why not C: Stripping slashes corrupts valid subdirectory names.
- Why not D: Prepending `/tmp/` does not prevent escaping via `../../`.
- Ref: [modules/13-production-python-and-security.md](../modules/13-production-python-and-security.md#5-security-vulnerability-classes--hardened-defenses), https://docs.python.org/3/library/pathlib.html#pathlib.Path.is_relative_to
</details>

---

### Q-PYTHON-066 · Then vs Now & Evolution · difficulty 1 · single
Which version of Python introduced structural pattern matching (`match / case`)?
- A) Python 3.8
- B) Python 3.9
- C) Python 3.10
- D) Python 3.12
<details><summary>Answer</summary>

**C.** Python 3.10 (PEP 634, 635, 636) introduced Structural Pattern Matching via `match / case` statements.
- Why not A: 3.8 introduced the walrus operator (`:=`).
- Why not B: 3.9 introduced dictionary merge (`|`) and builtin generics.
- Why not D: 3.12 introduced PEP 695 type parameter syntax.
- Ref: [modules/14-then-vs-now-version-history-and-capstone.md](../modules/14-then-vs-now-version-history-and-capstone.md#2-practitioners-cpython-version-history-38--315), https://docs.python.org/3/whatsnew/3.10.html
</details>

### Q-PYTHON-067 · Then vs Now & Evolution · difficulty 2 · single
What operator was introduced in Python 3.9 for dictionary union?
- A) `+`
- B) `|`
- C) `&`
- D) `^`
<details><summary>Answer</summary>

**B.** PEP 584 introduced the `|` and `|=` operators for merging dictionaries in Python 3.9 (`merged = dict_a | dict_b`).
- Why not A: `+` is not implemented on dicts.
- Why not C: `&` is used for set intersection.
- Why not D: `^` is used for symmetric difference.
- Ref: [modules/14-then-vs-now-version-history-and-capstone.md](../modules/14-then-vs-now-version-history-and-capstone.md#2-practitioners-cpython-version-history-38--315), https://peps.python.org/pep-0584/
</details>

### Q-PYTHON-068 · Then vs Now & Evolution · difficulty 2 · scenario
In Python 3.15, what deprecation warning occurs when using `asyncio.iscoroutinefunction()`?
- A) It is deprecated; callers must use `inspect.iscoroutinefunction()` instead.
- B) It is replaced by `types.iscoroutine()`.
- C) Coroutines can no longer be checked at runtime.
- D) It was removed without deprecation.
<details><summary>Answer</summary>

**A.** In Python 3.15, `asyncio.iscoroutinefunction()` is deprecated and slated for removal in Python 3.16. Code must use the canonical standard library `inspect.iscoroutinefunction()` instead.
- Why not B: `types.iscoroutine` checks coroutine instances, not functions.
- Why not C: `inspect.iscoroutinefunction` provides runtime checks.
- Why not D: CPython follows a multi-version deprecation schedule.
- Ref: [modules/14-then-vs-now-version-history-and-capstone.md](../modules/14-then-vs-now-version-history-and-capstone.md#3-capstone-project-high-performance-asynchronous-task-orchestrator), https://docs.python.org/3/library/asyncio-task.html
</details>

### Q-PYTHON-069 · Then vs Now & Evolution · difficulty 3 · single
Why is `contextvars.ContextVar` superior to `threading.local` for tracking request contexts in modern Python services?
- A) `ContextVar` stores data in redis.
- B) `threading.local` shares state across all coroutines executing on the same thread, causing data leaks between concurrent async requests; `ContextVar` isolates state per async task.
- C) `threading.local` was deprecated in Python 3.10.
- D) `ContextVar` can only store strings.
<details><summary>Answer</summary>

**B.** An event loop interleaves multiple coroutines on a single OS thread. `threading.local` is bound to the thread, so coroutines context-switching on that thread corrupt each other's state. `contextvars.ContextVar` creates isolated, copy-on-write contexts per task branch.
- Why not A: `ContextVar` is in-memory.
- Why not C: `threading.local` is still active for purely multi-threaded code.
- Why not D: `ContextVar` stores any Python object.
- Ref: [modules/14-then-vs-now-version-history-and-capstone.md](../modules/14-then-vs-now-version-history-and-capstone.md#4-interview-drill-questions--model-answers), https://docs.python.org/3/library/contextvars.html
</details>

### Q-PYTHON-070 · Then vs Now & Evolution · difficulty 2 · single
What did PEP 572 introduce in Python 3.8?
- A) Assignment expressions using the walrus operator (`:=`).
- B) Pattern matching.
- C) Type hints.
- D) Free-threading.
<details><summary>Answer</summary>

**A.** PEP 572 introduced the walrus operator (`:=`), allowing expression-level variable assignment (e.g. `if (match := pattern.search(text)): ...`).
- Why not B: Pattern matching was introduced in 3.10.
- Why not C: Type hints were introduced in 3.5.
- Why not D: Free-threading was introduced in 3.13.
- Ref: [modules/14-then-vs-now-version-history-and-capstone.md](../modules/14-then-vs-now-version-history-and-capstone.md#2-practitioners-cpython-version-history-38--315), https://peps.python.org/pep-0572/
</details>

---

### Q-PYTHON-071 · Cross-Cutting Architecture · difficulty 3 · single
In a high-throughput streaming service, why is using `asyncio.Queue(maxsize=1000)` crucial compared to an unbounded queue?
- A) Unbounded queues are slower on CPU.
- B) An unbounded queue cannot apply backpressure; if producers outpace consumers, the queue consumes unbounded RAM until the OS kernel invokes the OOM killer.
- C) Bounded queues run on the GPU.
- D) Unbounded queues do not support `queue.get()`.
<details><summary>Answer</summary>

**B.** Bounded queues enforce backpressure. When `maxsize` is reached, `queue.put()` suspends the producer coroutine until consumers drain items with `queue.get()`, bounding memory consumption and protecting system stability.
- Why not A: Memory exhaustion is the fatal issue, not queue CPU speed.
- Why not C: Async queues operate in standard memory on the CPU.
- Why not D: Both queue variants implement `get()`.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#7-backpressure-and-queue-shutdown-pep-713), https://docs.python.org/3/library/asyncio-queue.html
</details>

### Q-PYTHON-072 · Cross-Cutting Architecture · difficulty 3 · single
What guarantees that an `async with asyncio.timeout(5.0):` block properly handles cancellation?
- A) It kills the Python process after 5 seconds.
- B) If the inner coroutine does not finish within 5 seconds, the context manager cancels the running task, raising `TimeoutError` (which subclasses `TimeoutError` and catches cleanly).
- C) It converts the coroutine into a background thread.
- D) It rewrites the coroutine bytecode with NOPs.
<details><summary>Answer</summary>

**B.** Python 3.11 introduced `asyncio.timeout()`. It uses the loop's timer wheel to schedule a cancellation on the active task if the deadline is exceeded, converting the resulting cancellation into a clean `TimeoutError`.
- Why not A: It bounds task execution, not process life.
- Why not C: It runs on the event loop.
- Why not D: Bytecode is not altered.
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#5-timeouts-and-deadlines-with-asynciotimeout), https://docs.python.org/3/library/asyncio-task.html#asyncio.timeout
</details>

### Q-PYTHON-073 · Cross-Cutting Architecture · difficulty 3 · single
What is the effect of setting `sys.set_int_max_str_digits(4300)` in Python 3.11+?
- A) It limits integer values to 4300.
- B) It limits the maximum number of digits allowed when converting integers to or from strings, mitigating algorithmic quadratic DoS attacks from parsing huge integer literals.
- C) It rounds all float calculations to 4300 digits.
- D) It configures database column widths.
<details><summary>Answer</summary>

**B.** Converting large integer strings to binary integers has $O(N^2)$ algorithmic complexity. Python 3.11 introduced this limit to prevent remote attackers from sending multi-megabyte integer strings that peg CPU cores.
- Why not A: Pure integer arithmetic in memory remains arbitrarily large.
- Why not C: Floats follow IEEE 754 64-bit precision.
- Why not D: It is an interpreter-level DoS protection setting.
- Ref: [modules/01-execution-model-and-tooling.md](../modules/01-execution-model-and-tooling.md#4-runtime-execution-cli-flags--configuration), https://docs.python.org/3/library/sys.html#sys.set_int_max_str_digits
</details>

### Q-PYTHON-074 · Cross-Cutting Architecture · difficulty 3 · scenario
How does Python's `weakref` module prevent memory leaks in cache implementations?
- A) It deletes cached values after 60 seconds.
- B) It creates references to objects without incrementing their reference count (`ob_refcnt`), allowing the garbage collector to deallocate the target when no strong references remain.
- C) It stores objects on disk.
- D) It compresses objects in RAM.
<details><summary>Answer</summary>

**B.** A `weakref` reference does not increase an object's `ob_refcnt`. When all regular (strong) references to the object are dropped, CPython reclaims its memory immediately, notifying registered weakref callbacks or clearing `WeakValueDictionary` entries.
- Why not A: Weak references are governed by object lifetime, not TTL timers.
- Why not C: Weak references exist in process memory.
- Why not D: Memory compression is not performed by `weakref`.
- Ref: [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#3-memory-management-reference-counting--pep-683-immortal-objects), https://docs.python.org/3/library/weakref.html
</details>

### Q-PYTHON-075 · Cross-Cutting Architecture · difficulty 3 · single
What is the primary operational advantage of pre-compiling bytecode via `UV_COMPILE_BYTECODE=1` in production container images?
- A) It protects source code against reverse engineering.
- B) It compiles `.pyc` files during the container build stage, eliminating cold-start JIT compilation latency and preventing permission errors when containers run with read-only root filesystems.
- C) It eliminates the need for a Python interpreter.
- D) It converts Python into native Go binaries.
<details><summary>Answer</summary>

**B.** Pre-compiling bytecode ensures all `.py` files have corresponding `.pyc` files generated at build time. When the container starts in production, Python loads the `.pyc` files immediately without compiling ASTs or writing to disk, which is essential for read-only container filesystems.
- Why not A: Python bytecode is easily decompiled with tools like `uncompyle6`.
- Why not C: The Python VM is still required to execute bytecode.
- Why not D: Python code is not translated to Go.
- Ref: [modules/13-production-python-and-security.md](../modules/13-production-python-and-security.md#4-modern-production-packaging-with-uv--docker), https://docs.astral.sh/uv/
</details>

---

## Timed Mock Examination: Senior / Staff Python Engineer Loop

**Duration:** 90 Minutes  
**Passing Threshold:** 80% (32 / 40 Points)  
**Format:** 4 Progressive Architectural & Systems Scenarios

---

### Scenario 1: Debugging Memory Leaks & The CPython Object Model (10 Points)

#### Problem Statement:
A production streaming microservice processes 50,000 JSON events per second. Over 6 hours, memory consumption grows monotonically from 200MB to 16GB until the Kubernetes OOM-killer terminates the pod. An engineer captured the following class definitions from the core pipeline:

```python
class EventNode:
    def __init__(self, event_id: str, payload: dict):
        self.event_id = event_id
        self.payload = payload
        self.parent = None
        self.children = []

    def add_child(self, child):
        self.children.append(child)
        child.parent = self

    def __del__(self):
        # Legacy audit logging
        print(f"Cleaning up event {self.event_id}")
```

#### Questions:
1. Explain why this design leads to unbounded memory growth in Python, identifying the exact interaction between reference counting, reference cycles, and the `__del__` method. (4 Points)
2. In Python 3.4+ (PEP 442), how did cyclic GC handling of `__del__` change, and why did this service still experience memory bloat? (3 Points)
3. Provide the refactored, production-ready `EventNode` class demonstrating:
   - Elimination of strong circular references via `weakref`.
   - 60% memory footprint reduction via `__slots__`.
   - Removal of `__del__` anti-pattern in favor of explicit context management. (3 Points)

<details><summary>Scoring Key & Solution</summary>

1. **Cycle Mechanics (4 Points):**
   `EventNode` instances create bi-directional references: `parent.children` holds strong references to child nodes, and each child's `self.parent` holds a strong reference back to the parent. Because reference counts never drop to zero (`ob_refcnt >= 1`), standard reference counting cannot deallocate them when the event batch finishes.
2. **PEP 442 & Generation Bloat (3 Points):**
   Prior to PEP 442, reference cycles containing objects with `__del__` were uncollectible because Python could not determine safe destruction ordering; they accumulated in `gc.garbage`. PEP 442 allowed cyclic GC to break cycles with `__del__`. However, in high-throughput services (50,000 events/sec), cyclic garbage accumulates much faster than the generational GC runs (Gen 2 collection triggers infrequently). The lag between allocation and cycle collection creates massive memory bloat under load.
3. **Refactored Implementation (3 Points):**
```python
import weakref

class EventNode:
    __slots__ = ("event_id", "payload", "_parent_ref", "children", "__weakref__")

    def __init__(self, event_id: str, payload: dict) -> None:
        self.event_id = event_id
        self.payload = payload
        self._parent_ref: weakref.ReferenceType[EventNode] | None = None
        self.children: list[EventNode] = []

    @property
    def parent(self) -> EventNode | None:
        return self._parent_ref() if self._parent_ref is not None else None

    def add_child(self, child: EventNode) -> None:
        self.children.append(child)
        child._parent_ref = weakref.ref(self)
```
- Ref: [modules/03-data-model-and-dunder-protocols.md](../modules/03-data-model-and-dunder-protocols.md#5-memory-optimization-with-__slots__), [modules/08-cpython-internals-and-bytecode.md](../modules/08-cpython-internals-and-bytecode.md#4-the-cyclic-garbage-collector)
</details>

---

### Scenario 2: High-Throughput Async Pipeline with Backpressure (10 Points)

#### Problem Statement:
An asynchronous ingest service receives events via a WebSocket connection and persists them to PostgreSQL. Under traffic spikes, the following implementation crashes with `OutOfMemoryError`:

```python
async def on_message(ws, db_pool):
    async for raw_msg in ws:
        # Launching unmanaged tasks concurrently
        asyncio.create_task(process_and_save(raw_msg, db_pool))
```

#### Questions:
1. Identify the fundamental architectural defect and explain how unbounded task creation bypasses database connection pool limits. (3 Points)
2. Explain the difference in failure handling between `asyncio.gather()` and `asyncio.TaskGroup()`. (3 Points)
3. Architect and write a complete, backpressured consumer pipeline using `asyncio.Queue` (with Python 3.13+ `.shutdown()`) and `asyncio.TaskGroup` that caps concurrent database writes at 20 while applying upstream backpressure to the WebSocket stream. (4 Points)

<details><summary>Scoring Key & Solution</summary>

1. **Defect Analysis (3 Points):**
   Spawning unmanaged tasks via `asyncio.create_task()` creates an unbounded queue in the event loop's internal task set. If network ingest rate ($R_{in} = 10,000/\text{sec}$) exceeds database write throughput ($R_{db} = 1,000/\text{sec}$), millions of pending coroutines accumulate in memory, exhausting RAM and triggering connection pool starvation.
2. **TaskGroup vs Gather (3 Points):**
   If a task fails under `asyncio.gather()`, the exception is raised, but the remaining spawned tasks continue executing as unmonitored orphans. `asyncio.TaskGroup` implements structured concurrency: an unhandled exception in any worker triggers immediate cancellation of all sibling tasks in the group, ensuring clean teardown before exiting the context manager.
3. **Hardened Architecture (4 Points):**
```python
import asyncio

async def ingest_pipeline(ws, db_pool, max_concurrency: int = 20, max_queue: int = 100) -> None:
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=max_queue)

    async def worker() -> None:
        while True:
            try:
                msg = await queue.get()
            except (asyncio.CancelledError, asyncio.QueueShutDown):
                break
            try:
                await process_and_save(msg, db_pool)
            finally:
                queue.task_done()

    async with asyncio.TaskGroup() as tg:
        workers = [tg.create_task(worker()) for _ in range(max_concurrency)]

        # Producer pushes to bounded queue (blocks when full, applying backpressure)
        async for raw_msg in ws:
            await queue.put(raw_msg)

        await queue.join()
        queue.shutdown()
        for w in workers:
            w.cancel()
```
- Ref: [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#4-structured-concurrency-with-asynciotaskgroup), [modules/10-asyncio-internals-and-structured-concurrency.md](../modules/10-asyncio-internals-and-structured-concurrency.md#7-backpressure-and-queue-shutdown-pep-713)
</details>

---

### Scenario 3: Metaprogramming & Type Safety with PEP 695 & Descriptors (10 Points)

#### Problem Statement:
An enterprise framework requires a validation library where data classes validate field types and bounds at runtime while remaining completely transparent to static type checkers like `mypy` and `pyright`.

#### Questions:
1. Explain why descriptors must define `__set_name__` (PEP 487) when managing instance attributes, and what bug occurs if attribute names are hardcoded. (3 Points)
2. Explain the difference between `TypeGuard` and PEP 742 `TypeIs` when designing type validators. (3 Points)
3. Implement a generic `ValidatedField[T]` descriptor that:
   - Uses PEP 695 generic syntax.
   - Enforces runtime type validation on `__set__`.
   - Stores validated data in the instance's private attribute dictionary without name collision. (4 Points)

<details><summary>Scoring Key & Solution</summary>

1. **`__set_name__` Mechanics (3 Points):**
   Descriptors are instantiated at class definition time before the attribute name on the class is known. `__set_name__(self, owner, name)` is called automatically by CPython during class creation, informing the descriptor of its target attribute name. Without `__set_name__`, descriptor authors had to redundantly pass variable names as string literals, leading to copy-paste bugs and attribute collisions.
2. **TypeIs vs TypeGuard (3 Points):**
   `TypeGuard[T]` narrows the type in the positive `if` branch, but leaves the negative `else` branch unchanged. PEP 742 `TypeIs[T]` establishes bidirectional narrowing: if `is_str(val)` returns `False`, `mypy` removes `str` from the union type in the `else` block, ensuring total type safety.
3. **Generic Descriptor Implementation (4 Points):**
```python
from typing import Any, get_args

class ValidatedField[T]:
    def __init__(self, expected_type: type[T]) -> None:
        self.expected_type = expected_type
        self.private_name: str = ""

    def __set_name__(self, owner: type[Any], name: str) -> None:
        self.private_name = f"_validated_{name}"

    def __get__(self, instance: Any, owner: type[Any]) -> T:
        if instance is None:
            return self  # type: ignore[return-value]
        return getattr(instance, self.private_name)

    def __set__(self, instance: Any, value: T) -> None:
        if not isinstance(value, self.expected_type):
            raise TypeError(f"Expected {self.expected_type.__name__}, got {type(value).__name__}")
        setattr(instance, self.private_name, value)
```
- Ref: [modules/04-descriptors-metaclasses-and-attributes.md](../modules/04-descriptors-metaclasses-and-attributes.md#3-the-__set_name__-protocol-pep-487), [modules/06-type-system-and-annotations.md](../modules/06-type-system-and-annotations.md#1-pep-695-type-parameter-syntax)
</details>

---

### Scenario 4: Concurrency Architecture: Free-Threading vs Subinterpreters vs Multiprocessing (10 Points)

#### Problem Statement:
You are designing a high-compute fraud detection engine that evaluates complex machine learning feature pipelines over incoming banking transactions. The system runs on a 64-core Linux server and requires sub-10ms response times.

#### Questions:
1. Analyze the performance, IPC latency, and memory isolation trade-offs of the three primary Python concurrency models:
   - Traditional `multiprocessing` (with `spawn`).
   - PEP 734 Subinterpreters (with per-interpreter GILs).
   - PEP 703 Free-Threaded Python (`python3.15t`). (4 Points)
2. In Free-Threaded Python, what happens to thread safety in pure Python code? Give an example of code that was safe under the GIL that becomes a data race in free-threaded mode. (3 Points)
3. Write a production evaluation and recommendation stating which model you choose for the fraud engine and detailing your migration and deployment strategy. (3 Points)

<details><summary>Scoring Key & Solution</summary>

1. **Trade-Off Matrix (4 Points):**
   - **`multiprocessing`**: Perfect process isolation and crash resilience; zero GIL contention. Downside: heavy memory footprint (64 separate copies of runtime/models) and high IPC latency (serializing large numpy arrays/feature dicts through pipes/shared memory).
   - **Subinterpreters (PEP 734)**: Single process address space with independent GILs. Eliminates cross-interpreter GIL contention. Shared state must be passed through channels or memory buffers.
   - **Free-Threading (`python3.15t`)**: Single process, shared memory, zero IPC serialization latency. True multi-core thread execution on shared data structures. Downside: requires pure thread synchronization (`threading.Lock`), C extension compatibility verification.
2. **Data Races in Free-Threading (3 Points):**
   Under the GIL, internal CPython operations on built-in collections (e.g. `dict.setdefault()`, list appends) were effectively atomic with respect to bytecode execution. In free-threaded Python, concurrent unsynchronized reads and writes on shared pure-Python dictionaries or classes can experience race conditions:
   ```python
   # UNSAFE in Free-Threading without a Lock:
   if transaction_id not in processed_cache:
       processed_cache[transaction_id] = True  # Race condition!
   ```
3. **Recommendation (3 Points):**
   - **Recommendation**: Deploy **Free-Threaded Python (`python3.15t`)** with `InterpreterPoolExecutor` fallback.
   - **Rationale**: For sub-10ms latency, the serialization overhead of `multiprocessing` IPC exceeds the budget. Shared memory access to fraud feature graphs in `python3.15t` allows 64 cores to process feature calculations with sub-millisecond thread handoffs.
   - **Migration**: Guard shared cache writes with reader-writer locks (`threading.Lock`), run test suites under ThreadSanitizer (`-X dev`), and ensure all native C/Rust dependencies publish free-threaded wheels.
- Ref: [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#2-pep-703--pep-779-free-threaded-python), [modules/09-concurrency-gil-threads-and-subinterpreters.md](../modules/09-concurrency-gil-threads-and-subinterpreters.md#5-subinterpreters-and-per-interpreter-gil-pep-684--pep-734)
</details>
