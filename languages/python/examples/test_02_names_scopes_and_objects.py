"""
Module 02: Names, Scopes & Object Model
Executable proofs of PyObject identity, caching, mutability anomalies,
LEGB resolution, closures, and modern annotationlib mechanics.
"""

import annotationlib
import sys

import pytest


def test_small_integer_caching_and_identity() -> None:
    """Proves small integer singleton caching [-5, 256] vs larger distinct heap instances."""
    # Small integers within [-5, 256] share a single pre-allocated singleton
    a = 256
    b = 256
    assert a is b
    assert id(a) == id(b)

    # Large integers created via dynamic operations are distinct heap objects
    large_1 = int("1000500")
    large_2 = int("1000500")
    assert large_1 == large_2  # Equal value
    assert large_1 is not large_2  # Distinct memory allocations


def test_string_interning() -> None:
    """Proves sys.intern() enforces pointer identity for identical string payloads."""
    # Construct strings dynamically to avoid compile-time literal deduplication
    s1 = sys.intern("".join(["alpha", "_", "beta"]))
    s2 = sys.intern("alpha_beta")

    assert s1 is s2
    assert id(s1) == id(s2)


def test_tuple_augmented_assignment_anomaly() -> None:
    """Proves that augmented assignment on a mutable item inside an immutable tuple

    mutates the list in-place before raising a TypeError on the tuple assignment step.
    """
    tup: tuple[list[int], int] = ([1, 2], 3)

    # Attempting in-place augmented addition on tup[0]
    with pytest.raises(TypeError, match="'tuple' object does not support item assignment"):
        tup[0] += [4]

    # Critical invariant: the list WAS mutated in-place before the TypeError was raised!
    assert tup[0] == [1, 2, 4]


def test_mutable_default_argument_trap_and_idiomatic_fix() -> None:
    """Demonstrates the mutable default argument trap and its idiomatic None-sentinel fix."""
    # Anti-pattern: default list evaluated once at function definition time
    def broken_append(val: int, acc: list[int] = []) -> list[int]:  # noqa: B006
        acc.append(val)
        return acc

    res1 = broken_append(1)
    res2 = broken_append(2)
    # The default list was shared between calls!
    assert res1 is res2
    assert res2 == [1, 2]

    # Idiomatic Senior Pattern: default is None, allocate fresh list per invocation
    def safe_append(val: int, acc: list[int] | None = None) -> list[int]:
        if acc is None:
            acc = []
        acc.append(val)
        return acc

    safe1 = safe_append(10)
    safe2 = safe_append(20)
    assert safe1 is not safe2
    assert safe1 == [10]
    assert safe2 == [20]


def test_late_binding_closure_trap_and_fixes() -> None:
    """Demonstrates late-binding closures in loops and both idiomatic resolution strategies."""
    from collections.abc import Callable

    # Anti-pattern: inner functions bind variable by reference, observing final loop value
    late_funcs: list[Callable[[], int]] = []
    for idx in range(4):
        late_funcs.append(lambda: idx)
    assert [cb() for cb in late_funcs] == [3, 3, 3, 3]

    # Fix 1: Default argument captures current loop value at definition time
    fixed_callbacks_1: list[Callable[[], int]] = []
    for idx in range(4):
        def default_arg_fn(captured: int = idx) -> int:
            return captured
        fixed_callbacks_1.append(default_arg_fn)
    assert [cb() for cb in fixed_callbacks_1] == [0, 1, 2, 3]

    # Fix 2: Factory function creates an explicit enclosing closure scope per iteration
    def make_handler(captured_val: int) -> Callable[[], int]:
        return lambda: captured_val

    fixed_callbacks_2 = [make_handler(i) for i in range(4)]
    assert [cb() for cb in fixed_callbacks_2] == [0, 1, 2, 3]


def test_nonlocal_state_mutation() -> None:
    """Proves nonlocal modifies the enclosing lexical scope cell variable."""
    from collections.abc import Callable

    def create_accumulator(initial: int) -> tuple[Callable[[], int], Callable[[int], int]]:
        state = initial

        def get_value() -> int:
            return state

        def add(amount: int) -> int:
            nonlocal state
            state += amount
            return state

        return get_value, add

    getter, adder = create_accumulator(100)
    assert getter() == 100
    assert adder(25) == 125
    assert getter() == 125


def test_comprehension_scope_isolation() -> None:
    """Proves Python 3 comprehensions execute in isolated scopes without leaking loop variables."""
    target_var = "outer_scope_value"

    # Comprehension uses target_var as its internal loop identifier
    _ = [target_var for target_var in range(5)]

    # In Python 3, the outer variable is strictly preserved without leakage
    assert target_var == "outer_scope_value"


def test_annotationlib_deferred_annotations() -> None:
    """Proves PEP 649 / PEP 749 deferred annotation inspection using standard library annotationlib."""
    class Person:
        name: str
        age: int
        friend: "Person"  # Forward reference string

    # Format.VALUE resolves types where possible
    val_annos = annotationlib.get_annotations(Person, format=annotationlib.Format.VALUE)
    assert val_annos["name"] is str
    assert val_annos["age"] is int

    # Format.STRING inspects string representation of annotations
    src_annos = annotationlib.get_annotations(Person, format=annotationlib.Format.STRING)
    assert src_annos["name"] == "str"
    assert src_annos["friend"] == "Person"

    # Format.FORWARDREF provides safe forward reference inspection
    fwd_annos = annotationlib.get_annotations(Person, format=annotationlib.Format.FORWARDREF)
    assert fwd_annos["name"] is str
    assert fwd_annos["friend"] is not None
