"""
Module 04: Descriptors, Metaclasses & Attribute Machinery
Executable proofs of the descriptor protocol, data vs non-data descriptors,
C3 linearization MRO, cooperative super(), metaclasses, and ABC subclass hooks.
"""

import abc
import types
from typing import Any

import pytest


def test_data_vs_non_data_descriptor_precedence() -> None:
    """Proves that Data Descriptors shadow __dict__, while Non-Data Descriptors are shadowed by __dict__."""
    class DataDescriptor:
        def __init__(self, val: str):
            self.val = val

        def __get__(self, instance: object, owner: type | None = None) -> str:
            return f"data_desc:{self.val}"

        def __set__(self, instance: object, value: str) -> None:
            self.val = value

    class NonDataDescriptor:
        def __init__(self, val: str):
            self.val = val

        def __get__(self, instance: object, owner: type | None = None) -> str:
            return f"non_data_desc:{self.val}"

    class Host:
        data_attr = DataDescriptor("initial_data")
        non_data_attr = NonDataDescriptor("initial_non_data")

    h = Host()

    # Initial lookups
    assert h.data_attr == "data_desc:initial_data"
    assert h.non_data_attr == "non_data_desc:initial_non_data"

    # Inject matching keys directly into the instance dictionary __dict__
    h.__dict__["data_attr"] = "injected_in_dict"
    h.__dict__["non_data_attr"] = "injected_in_dict"

    # Data descriptor has higher priority than __dict__: __dict__ entry is ignored!
    assert h.data_attr == "data_desc:initial_data"

    # Non-data descriptor has lower priority than __dict__: __dict__ entry shadows the descriptor!
    assert h.non_data_attr == "injected_in_dict"


def test_set_name_automatic_binding() -> None:
    """Proves PEP 487 __set_name__ passes owner class and target attribute name during class creation."""
    class LoggedField:
        def __init__(self) -> None:
            self.field_name = ""
            self.owner_class_name = ""

        def __set_name__(self, owner: type, name: str) -> None:
            self.field_name = name
            self.owner_class_name = owner.__name__

        def __get__(self, instance: object, owner: type | None = None) -> Any:
            if instance is None:
                return self
            return getattr(instance, f"_{self.field_name}", None)

        def __set__(self, instance: object, value: Any) -> None:
            setattr(instance, f"_{self.field_name}", value)

    class Customer:
        first_name = LoggedField()
        email_address = LoggedField()

    assert Customer.first_name.field_name == "first_name"
    assert Customer.first_name.owner_class_name == "Customer"
    assert Customer.email_address.field_name == "email_address"

    c = Customer()
    c.first_name = "Alice"
    assert c.first_name == "Alice"
    assert getattr(c, "_first_name") == "Alice"


def test_methods_as_descriptors_and_binding() -> None:
    """Proves that Python functions are non-data descriptors that bind to instances via MethodType."""
    class Calculator:
        def multiply(self, x: int, y: int) -> int:
            return x * y

    calc = Calculator()

    # Access on class returns raw function
    raw_fn = Calculator.multiply
    assert isinstance(raw_fn, types.FunctionType)

    # Access on instance returns bound MethodType
    bound_method = calc.multiply
    assert isinstance(bound_method, types.MethodType)
    assert bound_method.__self__ is calc
    assert bound_method.__func__ is raw_fn

    # Emulating descriptor call manually
    manual_bound = Calculator.__dict__["multiply"].__get__(calc, Calculator)
    assert manual_bound(5, 6) == 30


def test_c3_linearization_and_cooperative_super() -> None:
    """Proves C3 linearization order and cooperative multiple inheritance with super()."""
    call_order: list[str] = []

    class Base:
        def action(self) -> None:
            call_order.append("Base")

    class Left(Base):
        def action(self) -> None:
            call_order.append("Left")
            super().action()

    class Right(Base):
        def action(self) -> None:
            call_order.append("Right")
            super().action()

    class Diamond(Left, Right):
        def action(self) -> None:
            call_order.append("Diamond")
            super().action()

    d = Diamond()
    d.action()

    # MRO order: Diamond -> Left -> Right -> Base -> object
    expected_mro = [Diamond, Left, Right, Base, object]
    assert Diamond.__mro__ == tuple(expected_mro)
    # Notice: inside Left, super().action() invoked Right (its sibling), NOT Base!
    assert call_order == ["Diamond", "Left", "Right", "Base"]


def test_c3_linearization_inconsistency_rejection() -> None:
    """Proves CPython rejects inconsistent inheritance hierarchies with TypeError at compile time."""
    class X:
        pass

    class Y:
        pass

    class A(X, Y):
        pass

    class B(Y, X):
        pass

    # A requires X < Y; B requires Y < X. Creating subclass C(A, B) causes irreconcilable contradiction
    with pytest.raises(TypeError, match="Cannot create a consistent method resolution"):
        class Contradiction(A, B):  # type: ignore[misc]
            pass


def test_metaclass_class_creation_interception() -> None:
    """Proves metaclass __new__ can inspect, validate, and inject attributes into classes."""
    class ValidatingMeta(type):
        def __new__(mcs, name: str, bases: tuple[type, ...], namespace: dict[str, Any]) -> type:
            # Enforce that all non-dunder method names must be lower_case
            for key in namespace:
                if not key.startswith("__") and callable(namespace[key]):
                    if not key.islower():
                        raise TypeError(f"Method '{key}' in class '{name}' must be lowercase")
            # Inject auto-generated class metadata
            namespace["__generated_by__"] = "ValidatingMeta"
            return super().__new__(mcs, name, bases, namespace)

    class ValidClass(metaclass=ValidatingMeta):
        def valid_method(self) -> str:
            return "ok"

    assert getattr(ValidClass, "__generated_by__") == "ValidatingMeta"

    with pytest.raises(TypeError, match="Method 'InvalidMethod' in class 'BrokenClass' must be lowercase"):
        class BrokenClass(metaclass=ValidatingMeta):
            def InvalidMethod(self) -> None:
                pass


def test_abc_enforcement_and_subclasshook() -> None:
    """Proves ABC prevents instantiation of incomplete classes and supports structural __subclasshook__."""
    class AbstractWorker(abc.ABC):
        @abc.abstractmethod
        def execute(self) -> str:
            pass

    # Incomplete subclass cannot be instantiated
    class IncompleteWorker(AbstractWorker):
        pass

    with pytest.raises(TypeError, match="Can't instantiate abstract class IncompleteWorker"):
        IncompleteWorker()  # type: ignore[abstract]

    # Structural virtual subclassing via __subclasshook__
    class Quackable(abc.ABC):
        @classmethod
        def __subclasshook__(cls, subclass: type) -> bool:
            if cls is Quackable:
                return bool(any("quack" in B.__dict__ for B in subclass.__mro__))
            return False

    class RealDuck:
        def quack(self) -> str:
            return "Quack!"

    # RealDuck did NOT inherit from Quackable, but satisfies structural hook
    assert issubclass(RealDuck, Quackable)
    assert isinstance(RealDuck(), Quackable)
