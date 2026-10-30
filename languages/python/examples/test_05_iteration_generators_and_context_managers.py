"""
Module 05: Iteration, Generators & Context Managers
Executable proofs of the iteration protocol, generator frame suspension,
bidirectional coroutines, yield from delegation, context managers, and ExceptionGroups.
"""

import inspect
from collections.abc import Generator
from contextlib import ExitStack
from typing import Any

import pytest


def test_custom_iterator_protocol() -> None:
    """Proves iterable and iterator separation and StopIteration signaling."""
    class RangeCounter:
        def __init__(self, limit: int):
            self.limit = limit

        def __iter__(self) -> "RangeCounterIterator":
            return RangeCounterIterator(self.limit)

    class RangeCounterIterator:
        def __init__(self, limit: int):
            self.limit = limit
            self.current = 0

        def __iter__(self) -> "RangeCounterIterator":
            return self

        def __next__(self) -> int:
            if self.current >= self.limit:
                raise StopIteration
            val = self.current
            self.current += 1
            return val

    counter = RangeCounter(3)
    # Iterating over iterable produces all elements
    assert list(counter) == [0, 1, 2]
    # Iterable can be iterated again producing fresh iterator
    assert list(counter) == [0, 1, 2]

    # Manual iterator stepping
    it = iter(counter)
    assert next(it) == 0
    assert next(it) == 1
    assert next(it) == 2
    with pytest.raises(StopIteration):
        next(it)


def test_generator_lifecycle_and_suspension_states() -> None:
    """Proves generator states: GEN_CREATED, GEN_SUSPENDED, and GEN_CLOSED."""
    def simple_gen() -> Generator[int, None, str]:
        yield 100
        yield 200
        return "done"

    g = simple_gen()
    assert inspect.getgeneratorstate(g) == inspect.GEN_CREATED

    val1 = next(g)
    assert val1 == 100
    assert inspect.getgeneratorstate(g) == inspect.GEN_SUSPENDED

    val2 = next(g)
    assert val2 == 200
    assert inspect.getgeneratorstate(g) == inspect.GEN_SUSPENDED

    with pytest.raises(StopIteration) as exc_info:
        next(g)
    # Return value is stored in StopIteration.value
    assert exc_info.value.value == "done"
    assert inspect.getgeneratorstate(g) == inspect.GEN_CLOSED


def test_generator_bidirectional_send_and_throw() -> None:
    """Proves bidirectional communication using .send() and exception injection using .throw()."""
    def accumulator() -> Generator[float, float, None]:
        total = 0.0
        while True:
            val = yield total
            total += val

    acc = accumulator()
    # Generator must be primed with next() or send(None)
    initial = next(acc)
    assert initial == 0.0

    assert acc.send(10.0) == 10.0
    assert acc.send(25.5) == 35.5

    # Injecting exception via throw()
    def resilient_gen() -> Generator[str, None, None]:
        try:
            yield "running"
        except ValueError:
            yield "recovered_from_value_error"

    rg = resilient_gen()
    assert next(rg) == "running"
    recovered_msg = rg.throw(ValueError("Test error"))
    assert recovered_msg == "recovered_from_value_error"


def test_generator_close_and_ignored_exit_runtime_error() -> None:
    """Proves that ignoring GeneratorExit raises a RuntimeError."""
    def rule_violating_gen() -> Generator[int, None, None]:
        try:
            yield 1
        except GeneratorExit:
            # Illegal: attempting to yield a value during GeneratorExit handling
            yield 2

    bad_g = rule_violating_gen()
    assert next(bad_g) == 1
    with pytest.raises(RuntimeError, match="generator ignored GeneratorExit"):
        bad_g.close()


def test_subgenerator_delegation_via_yield_from() -> None:
    """Proves yield from transparently delegates yielded values and captures return value."""
    def worker_child() -> Generator[str, None, int]:
        yield "child_step_1"
        yield "child_step_2"
        return 42

    def parent_coordinator() -> Generator[str, None, str]:
        yield "parent_start"
        child_result = yield from worker_child()
        yield f"parent_received:{child_result}"
        return "all_complete"

    gen = parent_coordinator()
    stream = list(gen)
    assert stream == ["parent_start", "child_step_1", "child_step_2", "parent_received:42"]


def test_context_manager_protocol_and_exception_suppression() -> None:
    """Proves __enter__ and __exit__ protocol, including exception suppression by returning True."""
    class SuppressExceptions:
        def __init__(self, target_type: type[BaseException]):
            self.target_type = target_type
            self.entered = False
            self.exited = False

        def __enter__(self) -> "SuppressExceptions":
            self.entered = True
            return self

        def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
            self.exited = True
            if exc_type is not None and issubclass(exc_type, self.target_type):
                return True  # Suppress the exception!
            return False  # Propagate other exceptions

    # Handled exception is suppressed
    with SuppressExceptions(ValueError) as ctx:
        raise ValueError("This should be suppressed")
    assert ctx.entered is True
    assert ctx.exited is True

    # Unhandled exception propagates out
    with pytest.raises(KeyError):
        with SuppressExceptions(ValueError):
            raise KeyError("This should propagate")


def test_exit_stack_dynamic_unwinding() -> None:
    """Proves ExitStack unwinds multiple dynamically added context managers in LIFO order."""
    unwind_log: list[str] = []

    class TrackedResource:
        def __init__(self, name: str):
            self.name = name

        def __enter__(self) -> "TrackedResource":
            unwind_log.append(f"enter_{self.name}")
            return self

        def __exit__(self, *args: object) -> None:
            unwind_log.append(f"exit_{self.name}")

    with ExitStack() as stack:
        stack.enter_context(TrackedResource("res1"))
        stack.enter_context(TrackedResource("res2"))
        stack.enter_context(TrackedResource("res3"))
        unwind_log.append("body_work")

    # Invariant: ExitStack unwinds contexts in reverse (LIFO) order
    assert unwind_log == [
        "enter_res1",
        "enter_res2",
        "enter_res3",
        "body_work",
        "exit_res3",
        "exit_res2",
        "exit_res1",
    ]


def test_exception_groups_and_except_star() -> None:
    """Proves PEP 654 ExceptionGroup decomposition via except*."""
    def throw_multiple() -> None:
        raise ExceptionGroup(
            "Batch execution errors",
            [ValueError("err_val_1"), KeyError("err_key"), ValueError("err_val_2")],
        )

    caught_values: list[str] = []
    caught_keys: list[str] = []

    try:
        throw_multiple()
    except* ValueError as eg:
        caught_values.extend([e.args[0] for e in eg.exceptions])
    except* KeyError as eg:
        caught_keys.extend([e.args[0] for e in eg.exceptions])

    assert caught_values == ["err_val_1", "err_val_2"]
    assert caught_keys == ["err_key"]
