"""
Module 03: Data Model & Dunder Protocols
Executable proofs of dunder protocols, equality & hashing invariants,
sequence slicing, reflected operators, __slots__, and __init_subclass__.
"""

import sys

import pytest


def test_repr_and_str_fallback_contract() -> None:
    """Proves that __repr__ acts as a fallback for __str__, while __str__ does not fallback to __repr__."""
    class OnlyRepr:
        def __init__(self, val: int):
            self.val = val

        def __repr__(self) -> str:
            return f"OnlyRepr({self.val})"

    obj = OnlyRepr(42)
    assert repr(obj) == "OnlyRepr(42)"
    assert str(obj) == "OnlyRepr(42)"  # str falls back to __repr__

    class OnlyStr:
        def __init__(self, val: int):
            self.val = val

        def __str__(self) -> str:
            return f"StrVal: {self.val}"

    obj2 = OnlyStr(99)
    assert str(obj2) == "StrVal: 99"
    # repr does NOT fallback to __str__; it uses object.__repr__
    assert repr(obj2).startswith("<")
    assert "OnlyStr object at" in repr(obj2)


def test_equality_and_hashing_invariants() -> None:
    """Proves the hashing invariant and the automatic __hash__ = None rule."""
    class PersonWithoutHash:
        def __init__(self, person_id: int):
            self.person_id = person_id

        def __eq__(self, other: object) -> bool:
            if not isinstance(other, PersonWithoutHash):
                return NotImplemented
            return self.person_id == other.person_id

    p1 = PersonWithoutHash(101)
    p2 = PersonWithoutHash(101)
    assert p1 == p2

    # Because __eq__ was defined without __hash__, CPython sets __hash__ = None
    assert PersonWithoutHash.__hash__ is None
    with pytest.raises(TypeError, match="unhashable type: 'PersonWithoutHash'"):
        hash(p1)

    # Immutable class with explicit __hash__ preserving mathematical invariant
    class ImmutablePerson:
        def __init__(self, person_id: int):
            self._person_id = person_id

        @property
        def person_id(self) -> int:
            return self._person_id

        def __eq__(self, other: object) -> bool:
            if not isinstance(other, ImmutablePerson):
                return NotImplemented
            return self._person_id == other._person_id

        def __hash__(self) -> int:
            return hash((self.__class__, self._person_id))

    ip1 = ImmutablePerson(202)
    ip2 = ImmutablePerson(202)
    assert ip1 == ip2
    # Invariant: ip1 == ip2 implies hash(ip1) == hash(ip2)
    assert hash(ip1) == hash(ip2)

    # Valid key in dict and set
    lookup = {ip1: "active"}
    assert lookup[ip2] == "active"


def test_sequence_protocol_with_slice_handling() -> None:
    """Proves custom sequence implementation with len, negative index, and slice handling."""
    class CustomSequence:
        def __init__(self, items: list[int]):
            self._items = list(items)

        def __len__(self) -> int:
            return len(self._items)

        def __getitem__(self, index: int | slice) -> int | list[int]:
            if isinstance(index, slice):
                return [self._items[i] for i in range(*index.indices(len(self._items)))]
            if not isinstance(index, int):
                raise TypeError(f"Index must be integer or slice, not {type(index).__name__}")
            if index < 0:
                index += len(self._items)
            if index < 0 or index >= len(self._items):
                raise IndexError("Index out of bounds")
            return self._items[index]

    seq = CustomSequence([10, 20, 30, 40, 50])
    assert len(seq) == 5
    assert seq[0] == 10
    assert seq[-1] == 50
    # Slicing
    assert seq[1:4] == [20, 30, 40]
    assert seq[::2] == [10, 30, 50]

    with pytest.raises(IndexError):
        _ = seq[10]


def test_reflected_arithmetic_operators() -> None:
    """Proves cooperative inter-type arithmetic via __mul__ and __rmul__ using NotImplemented."""
    class Currency:
        def __init__(self, amount: float, currency: str = "USD"):
            self.amount = amount
            self.currency = currency

        def __eq__(self, other: object) -> bool:
            if not isinstance(other, Currency):
                return NotImplemented
            return self.amount == other.amount and self.currency == other.currency

        def __mul__(self, factor: object) -> "Currency":
            if isinstance(factor, (int, float)):
                return Currency(self.amount * factor, self.currency)
            return NotImplemented

        def __rmul__(self, factor: object) -> "Currency":
            return self.__mul__(factor)

    c = Currency(100.0, "EUR")

    # __mul__ invoked: Currency * int
    res1 = c * 3
    assert res1 == Currency(300.0, "EUR")

    # __rmul__ invoked: int * Currency (int.__mul__ returns NotImplemented, falling back to c.__rmul__)
    res2 = 2.5 * c
    assert res2 == Currency(250.0, "EUR")


def test_slots_memory_and_attribute_restriction() -> None:
    """Proves that __slots__ prevents dynamic attributes, eliminates __dict__, and reduces memory."""
    class StandardClass:
        def __init__(self, x: int, y: int):
            self.x = x
            self.y = y

    class SlottedClass:
        __slots__ = ("x", "y")

        def __init__(self, x: int, y: int):
            self.x = x
            self.y = y

    std = StandardClass(1, 2)
    slotted = SlottedClass(1, 2)

    # Standard class has __dict__; slotted class does not
    assert hasattr(std, "__dict__")
    assert not hasattr(slotted, "__dict__")

    # Slotted class forbids arbitrary attribute assignment
    with pytest.raises(AttributeError, match="'SlottedClass' object has no attribute 'z'"):
        slotted.z = 10  # type: ignore[attr-defined]

    # Memory footprint: slotted instance is significantly smaller than standard instance
    size_std = sys.getsizeof(std) + sys.getsizeof(std.__dict__)
    size_slotted = sys.getsizeof(slotted)
    assert size_slotted < size_std


def test_init_subclass_plugin_registration() -> None:
    """Proves PEP 487 __init_subclass__ auto-registration mechanism with kwargs."""
    class PluginBase:
        registry: dict[str, type["PluginBase"]] = {}

        def __init_subclass__(cls, plugin_name: str | None = None, **kwargs: object) -> None:
            super().__init_subclass__(**kwargs)
            name = plugin_name or cls.__name__.lower()
            if name in cls.registry:
                raise ValueError(f"Duplicate plugin: {name}")
            cls.registry[name] = cls

    class S3Storage(PluginBase, plugin_name="s3"):
        pass

    class GCSStorage(PluginBase, plugin_name="gcs"):
        pass

    assert "s3" in PluginBase.registry
    assert "gcs" in PluginBase.registry
    assert PluginBase.registry["s3"] is S3Storage
    assert PluginBase.registry["gcs"] is GCSStorage

    # Verify duplicate name rejection
    with pytest.raises(ValueError, match="Duplicate plugin: s3"):
        class DuplicateS3(PluginBase, plugin_name="s3"):
            pass
