"""
Module 06: Type System, Generics & Modern Annotations
Executable proofs of PEP 695 generics, structural Protocols, ParamSpec decorators,
TypeIs bidirectional narrowing, and @overload dispatch.
"""

from collections.abc import Callable
from typing import Literal, ParamSpec, Protocol, TypeIs, TypeVar, overload, runtime_checkable

P = ParamSpec("P")
R = TypeVar("R")


# PEP 695 Generic Class
class Container[T]:
    def __init__(self, initial_value: T):
        self._value = initial_value

    def get(self) -> T:
        return self._value

    def set(self, new_value: T) -> None:
        self._value = new_value


# PEP 695 Generic Type Alias
type Point2D[T] = tuple[T, T]


def test_pep_695_generics_and_type_aliases() -> None:
    """Proves PEP 695 class and type alias syntax execution at runtime."""
    box_int: Container[int] = Container(42)
    assert box_int.get() == 42
    box_int.set(100)
    assert box_int.get() == 100

    box_str: Container[str] = Container("alpha")
    assert box_str.get() == "alpha"

    pt: Point2D[float] = (1.5, 3.5)
    assert pt == (1.5, 3.5)


@runtime_checkable
class Summarizable(Protocol):
    def summarize(self) -> str: ...


class Article:
    def __init__(self, title: str):
        self.title = title

    def summarize(self) -> str:
        return f"Article: {self.title}"


class MetricSnapshot:
    def __init__(self, count: int):
        self.count = count

    def summarize(self) -> str:
        return f"Count: {self.count}"


def test_structural_typing_protocols() -> None:
    """Proves structural subtyping via Protocol and runtime validation via @runtime_checkable."""
    article = Article("Distributed Systems Deep Dive")
    metric = MetricSnapshot(1000)

    # Both classes satisfy the protocol structurally without common inheritance
    def format_summary(item: Summarizable) -> str:
        return item.summarize()

    assert format_summary(article) == "Article: Distributed Systems Deep Dive"
    assert format_summary(metric) == "Count: 1000"

    # Runtime checkable verification
    assert isinstance(article, Summarizable)
    assert isinstance(metric, Summarizable)
    assert not isinstance([1, 2, 3], Summarizable)


def test_paramspec_decorator_signature_preservation() -> None:
    """Proves that ParamSpec preserves parameter signatures and return types."""
    call_log: list[str] = []

    def log_call(func: Callable[P, R]) -> Callable[P, R]:
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            call_log.append(f"invoking_{func.__name__}")
            result = func(*args, **kwargs)
            call_log.append(f"finished_{func.__name__}")
            return result
        return wrapper

    @log_call
    def calculate(a: int, b: int, multiplier: int = 1) -> int:
        return (a + b) * multiplier

    res = calculate(10, 20, multiplier=2)
    assert res == 60
    assert call_log == ["invoking_calculate", "finished_calculate"]


def test_type_is_bidirectional_narrowing() -> None:
    """Proves PEP 742 TypeIs narrows types in positive and negative execution branches."""
    def is_string(val: object) -> TypeIs[str]:
        return isinstance(val, str)

    def process_item(item: str | int) -> str:
        if is_string(item):
            # item is narrowed to str
            return f"str:{item.upper()}"
        else:
            # item is narrowed to int
            return f"int:{item * 10}"

    assert process_item("test") == "str:TEST"
    assert process_item(5) == "int:50"


@overload
def parse_payload(raw: bytes, binary: Literal[True]) -> bytes: ...


@overload
def parse_payload(raw: bytes, binary: Literal[False]) -> str: ...


@overload
def parse_payload(raw: bytes, binary: bool = False) -> str | bytes: ...


def parse_payload(raw: bytes, binary: bool = False) -> str | bytes:
    if binary:
        return raw
    return raw.decode("utf-8")


def test_overload_runtime_execution() -> None:
    """Proves @overload signatures match correct runtime branches."""
    raw_bytes = b"Hello Python 3.15"

    text_result: str = parse_payload(raw_bytes, binary=False)
    assert text_result == "Hello Python 3.15"

    binary_result: bytes = parse_payload(raw_bytes, binary=True)
    assert binary_result == b"Hello Python 3.15"
