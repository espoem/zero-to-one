# Python 3.15 Fast Reference Cheatsheet

High-density fast reference for modern Python 3.15: CLI flags, dunder protocols, descriptors, MRO, PEP 695 generics, structured concurrency, and defensive security.

---

## 1. CLI Flags & Tooling (`uv`)

```bash
# Production and Debug CLI Flags
python -X dev app.py                 # CPython dev mode (allocator hooks, asyncio debug)
python -X faulthandler app.py        # Dump C traceback on SIGSEGV / bus error
python -X utf8=1 app.py              # Enforce universal UTF-8 mode (PEP 686 default)
python3.15t app.py                   # Run free-threaded binary (PEP 703, no GIL)

# High-Speed Tooling with uv
uv init --app myproject              # Initialize modern pyproject.toml
uv add "pytest>=9.0" "hypothesis"    # Add pinned dependencies and update uv.lock
uv run pytest                        # Execute test runner in hermetic virtualenv
uv run ruff check --fix .            # High-speed linting and import formatting
uv sync --frozen --no-dev            # Production container deterministic sync
```

---

## 2. Core Dunder Protocols Reference

### Representation & Hashing
```python
class Model:
    def __repr__(self) -> str:
        # Developer debug representation: unambiguous, matches constructor if possible
        return f"Model(id={self.id!r})"

    def __str__(self) -> str:
        # User-facing readable representation
        return f"Model #{self.id}"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Model):
            return NotImplemented
        return self.id == other.id

    def __hash__(self) -> int:
        # Invariant: a == b => hash(a) == hash(b). If __eq__ is defined without __hash__, __hash__ = None!
        return hash((self.__class__, self.id))
```

### Sequence & Arithmetic Emulation
```python
class Vector:
    __slots__ = ("x", "y")  # Eliminates __dict__, saves >60% RAM

    def __init__(self, x: float, y: float) -> None:
        self.x = x; self.y = y

    def __add__(self, other: object) -> Vector:
        if not isinstance(other, Vector):
            return NotImplemented  # Signals Python to call other.__radd__(self)
        return Vector(self.x + other.x, self.y + other.y)

    def __getitem__(self, index: int | slice) -> float | list[float]:
        if isinstance(index, slice):
            start, stop, step = index.indices(2)  # Canonical slice bounds clamp
            return [getattr(self, ("x", "y")[i]) for i in range(start, stop, step)]
        return (self.x, self.y)[index]
```

---

## 3. Descriptors, MRO & Cooperative `super()`

### Data Descriptor (PEP 487)
```python
class PositiveNumber:
    def __set_name__(self, owner: type, name: str) -> None:
        self.storage_name = f"_{name}"

    def __get__(self, instance: object, owner: type) -> float:
        if instance is None:
            return self  # Access via class returns descriptor itself
        return getattr(instance, self.storage_name, 0.0)

    def __set__(self, instance: object, value: float) -> None:
        if value < 0:
            raise ValueError(f"{self.storage_name} must be >= 0")
        setattr(instance, self.storage_name, value)
```

### Cooperative Diamond Inheritance
```python
class Base:
    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)

class MixinA(Base):
    def __init__(self, **kwargs: object) -> None:
        super().__init__(**kwargs)  # Calls next in MRO, NOT necessarily Base!

class Diamond(MixinA, Base):
    pass
# Inspect MRO: Diamond.mro() or Diamond.__mro__
```

---

## 4. PEP 695 Generics & Type Narrowing

```python
# Modern Generic Class and Type Alias
class Repository[T, ID]:
    def __init__(self) -> None:
        self._data: dict[ID, T] = {}

    def get(self, item_id: ID) -> T | None:
        return self._data.get(item_id)

type JSONValue = str | int | float | bool | None | list[JSONValue] | dict[str, JSONValue]

# Bidirectional Type Narrowing (PEP 742)
from typing import TypeIs

def is_str(val: object) -> TypeIs[str]:
    return isinstance(val, str)

def process(val: str | int) -> None:
    if is_str(val):
        val.upper()   # Narrowed to str
    else:
        val + 10      # Narrowed to int (removed str from union)
```

---

## 5. Iterators, Generators & Context Managers

```python
# Bidirectional Subgenerator Delegation
def subgen():
    val = yield "ready"
    return f"processed: {val}"

def delegator():
    result = yield from subgen()  # Two-way pipe: .send() goes to subgen; return value bound to result
    yield result

# Modern ExceptionGroup Handling (PEP 654)
try:
    raise ExceptionGroup("Batch errors", [ValueError("Bad arg"), KeyError("Missing key")])
except* ValueError as eg:
    for err in eg.exceptions:
        print(f"Handled ValueError: {err}")
except* KeyError as eg:
    print(f"Handled KeyError group: {eg}")
```

---

## 6. Asyncio & Structured Concurrency

```python
import asyncio

async def pipeline():
    # Bounded queue with backpressure and shutdown protocol (Python 3.13+)
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=100)

    async def worker():
        while True:
            try:
                item = await queue.get()
            except (asyncio.CancelledError, asyncio.QueueShutDown):
                break
            try:
                # Deadline enforcement (PEP 654 / Python 3.11+)
                async with asyncio.timeout(2.0):
                    await asyncio.sleep(0.01)
            finally:
                queue.task_done()

    # Structured concurrency: no leaked tasks
    async with asyncio.TaskGroup() as tg:
        workers = [tg.create_task(worker()) for _ in range(4)]
        await queue.put("job-1")
        await queue.join()
        queue.shutdown()  # Prevents new puts, drains existing items
        for w in workers:
            w.cancel()
```

---

## 7. Testing with Pytest & Hypothesis

```python
import pytest
from hypothesis import given, strategies as st

# Parametrized Unit Test with Exception Match
@pytest.mark.parametrize("input_val, expected", [(2, 4), (3, 9)])
def test_squares(input_val: int, expected: int) -> None:
    assert input_val ** 2 == expected

def test_exception_verification() -> None:
    with pytest.raises(ValueError, match=r"^Invalid ID: \d+$"):
        raise ValueError("Invalid ID: 999")

# Property-Based Testing with Shrinking
@given(st.lists(st.integers()))
def test_list_reversal_involution(xs: list[int]) -> None:
    assert list(reversed(list(reversed(xs)))) == xs
```

---

## 8. Performance & Defensive Security Guardrails

| Requirement | Anti-Pattern | Senior Production Idiom |
|---|---|---|
| **Subprocess Execution** | `subprocess.run(f"cat {arg}", shell=True)` | `subprocess.run(["cat", arg], shell=False, check=True)` |
| **Path Traversal Defense** | `if ".." not in user_path:` | `if not (base / user_path).resolve().is_relative_to(base.resolve()): raise PermissionError` |
| **Object Deserialization** | `pickle.loads(untrusted_bytes)` | Use `json.loads()` or HMAC-signed envelopes |
| **String Building in Loops**| `s = ""; for x in items: s += x` | `s = "".join(items)` ($O(N)$ single-pass allocation) |
| **Attribute Lookup in Loops**| `for x in data: math.sqrt(x)` | `sqrt = math.sqrt; for x in data: sqrt(x)` (`LOAD_FAST`) |
| **Instance Memory Footprint**| Standard class with dynamic `__dict__` | `__slots__ = ("a", "b")` (eliminates `__dict__`, $>60\%$ memory cut) |
