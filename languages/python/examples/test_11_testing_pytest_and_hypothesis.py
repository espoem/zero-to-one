"""
Module 11: Testing with Pytest & Hypothesis
Executable proofs of fixture lifecycles, parametrization, Hypothesis property tests,
autospec mock verification, and exception/warning contracts.
"""

import json
import warnings
from collections.abc import Generator
from unittest.mock import create_autospec

import pytest
from hypothesis import given
from hypothesis import strategies as st


@pytest.fixture
def managed_resource() -> Generator[dict[str, str], None, None]:
    """Demonstrates generator fixture with guaranteed setup and teardown."""
    resource: dict[str, str] = {"status": "active", "id": "RES-42"}
    yield resource
    # Teardown clears resource
    resource.clear()


def test_fixture_lifecycle(managed_resource: dict[str, str]) -> None:
    """Proves fixture is correctly injected and populated."""
    assert managed_resource["status"] == "active"
    assert managed_resource["id"] == "RES-42"


@pytest.mark.parametrize(
    ("input_val", "expected_squared"),
    [
        (0, 0),
        (2, 4),
        (-3, 9),
        (10, 100),
    ],
    ids=["zero", "positive", "negative", "two_digit"],
)
def test_parametric_squaring(input_val: int, expected_squared: int) -> None:
    """Proves @pytest.mark.parametrize generates independent test cases."""
    assert input_val * input_val == expected_squared


@given(st.dictionaries(keys=st.text(min_size=1, max_size=20), values=st.integers(min_value=-1000, max_value=1000)))
def test_hypothesis_json_roundtrip_property(data: dict[str, int]) -> None:
    """Hypothesis property test proving serialization roundtrip invertibility:

    forall d: deserialize(serialize(d)) == d
    """
    serialized = json.dumps(data)
    deserialized = json.loads(serialized)
    assert deserialized == data


@given(st.integers(), st.integers(), st.integers())
def test_hypothesis_associativity_property(a: int, b: int, c: int) -> None:
    """Hypothesis property test proving integer addition associativity:

    forall a, b, c: (a + b) + c == a + (b + c)
    """
    assert (a + b) + c == a + (b + c)


class RealService:
    def execute_transaction(self, account_id: str, amount: float, memo: str = "") -> str:
        return f"TX_{account_id}_{amount}"


def test_autospec_mock_prevents_mock_drift() -> None:
    """Proves create_autospec enforces method existence and parameter signatures."""
    mock_service = create_autospec(RealService, instance=True)

    # Valid call matching exact signature
    mock_service.execute_transaction("ACC-01", 100.5, memo="deposit")
    mock_service.execute_transaction.assert_called_once_with("ACC-01", 100.5, memo="deposit")

    # Calling with missing required arguments raises TypeError immediately!
    with pytest.raises(TypeError):
        mock_service.execute_transaction("ACC-01")  # Missing amount

    # Calling a non-existent method raises AttributeError
    with pytest.raises(AttributeError):
        mock_service.non_existent_method()


def test_strict_exception_matching() -> None:
    """Proves pytest.raises matches exception type and regex message pattern."""
    def parse_port(val: str) -> int:
        port = int(val)
        if not (1 <= port <= 65535):
            raise ValueError(f"Port must be between 1 and 65535, got {port}")
        return port

    with pytest.raises(ValueError, match=r"Port must be between 1 and 65535, got 99999"):
        parse_port("99999")


def test_warning_contract_verification() -> None:
    """Proves pytest.warns captures and asserts on deprecation warnings."""
    def legacy_api() -> str:
        warnings.warn("legacy_api() is deprecated; use modern_api() instead", DeprecationWarning, stacklevel=2)
        return "legacy"

    with pytest.warns(DeprecationWarning, match="legacy_api\\(\\) is deprecated"):
        result = legacy_api()
        assert result == "legacy"
