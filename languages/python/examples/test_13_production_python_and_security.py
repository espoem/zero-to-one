"""Module 13 Test Suite: Production Python & Security.

Verifies signal handling, structured JSON logging, command injection mitigations,
path traversal defenses, and pickle exploit mechanics with HMAC verification.
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import pickle
import signal
import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest


# 1. Structured JSON Logger Formatter Implementation
class StructuredJSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "custom_field"):
            payload["custom_field"] = getattr(record, "custom_field")
        return json.dumps(payload, ensure_ascii=False)


def test_structured_json_logging() -> None:
    """Verify JSON log formatting produces valid, parsable single-line JSON."""
    formatter = StructuredJSONFormatter()
    logger = logging.getLogger("test_prod_logger")
    record = logger.makeRecord(
        name="test_prod_logger",
        level=logging.INFO,
        fn="test_13_production.py",
        lno=42,
        msg="Service started successfully on port %d",
        args=(8080,),
        exc_info=None,
    )
    setattr(record, "custom_field", "prod-cluster-us-east")

    formatted = formatter.format(record)
    parsed = json.loads(formatted)

    assert parsed["level"] == "INFO"
    assert parsed["logger"] == "test_prod_logger"
    assert parsed["message"] == "Service started successfully on port 8080"
    assert parsed["custom_field"] == "prod-cluster-us-east"
    assert parsed["line"] == 42


def test_subprocess_command_injection_mitigation() -> None:
    """Verify that shell=False treats shell metacharacters strictly as literal data."""
    # When shell=False, passing a semicolon or pipeline in argv must not invoke shell commands
    test_arg = "test_arg; echo INJECTED"
    result = subprocess.run(
        [sys.executable, "-c", "import sys; print(sys.argv[1])", test_arg],
        capture_output=True,
        text=True,
        check=True,
        shell=False,
    )
    # The output should literally be the entire string, not executed
    assert result.stdout.strip() == test_arg
    assert "INJECTED" in result.stdout
    # But crucially, it was printed as an argument by Python, never executed as a second shell command


def test_path_traversal_defense(tmp_path: Path) -> None:
    """Verify that path resolution blocks attempts to escape the root directory."""
    sandbox_dir = tmp_path / "sandbox"
    sandbox_dir.mkdir()
    secret_dir = tmp_path / "secrets"
    secret_dir.mkdir()
    secret_file = secret_dir / "secret.env"
    secret_file.write_text("DB_PASSWORD=supersecret", encoding="utf-8")

    allowed_file = sandbox_dir / "report.txt"
    allowed_file.write_text("Report Data", encoding="utf-8")

    def safe_read(base: Path, user_rel_path: str) -> str:
        resolved = (base / user_rel_path).resolve()
        if not resolved.is_relative_to(base.resolve()):
            raise PermissionError(f"Directory traversal detected: {user_rel_path}")
        if not resolved.is_file():
            raise FileNotFoundError(f"File not found: {user_rel_path}")
        return resolved.read_text(encoding="utf-8")

    # Allowed path access
    assert safe_read(sandbox_dir, "report.txt") == "Report Data"

    # Malicious traversal attempt escaping sandbox
    with pytest.raises(PermissionError, match="Directory traversal detected"):
        safe_read(sandbox_dir, "../secrets/secret.env")


class _MockExploitTrigger:
    executed: bool = False

    @classmethod
    def trigger(cls) -> None:
        cls.executed = True


class _VulnerableExploitPayload:
    def __reduce__(self) -> tuple[Any, tuple[Any, ...]]:
        return (_MockExploitTrigger.trigger, ())


def test_pickle_reduce_execution_and_hmac_tamper_proofing() -> None:
    """Demonstrate pickle __reduce__ arbitrary execution and HMAC tamper protection."""
    # 1. Exploit verification
    _MockExploitTrigger.executed = False
    payload = pickle.dumps(_VulnerableExploitPayload())

    # When unpickled, __reduce__ is executed automatically
    pickle.loads(payload)
    assert _MockExploitTrigger.executed is True

    # 2. Defense: HMAC signing for trusted payload integrity
    secret_key = b"enterprise-hmac-signing-key-42"

    def sign_payload(data: bytes, key: bytes) -> bytes:
        signature = hmac.new(key, data, hashlib.sha256).digest()
        return signature + data

    def verify_and_load(signed_data: bytes, key: bytes) -> Any:
        sig_len = hashlib.sha256().digest_size
        if len(signed_data) < sig_len:
            raise ValueError("Payload too short")
        sig, data = signed_data[:sig_len], signed_data[sig_len:]
        expected_sig = hmac.new(key, data, hashlib.sha256).digest()
        if not hmac.compare_digest(sig, expected_sig):
            raise SecurityError("HMAC verification failed: payload tampered or unauthorized")
        return pickle.loads(data)

    class SecurityError(Exception):
        pass

    legit_obj = {"user_id": 101, "role": "admin"}
    signed_legit = sign_payload(pickle.dumps(legit_obj), secret_key)

    # Valid payload loads cleanly
    loaded = verify_and_load(signed_legit, secret_key)
    assert loaded == legit_obj

    # Tampered or malicious unsigned payload is rejected before pickle.loads is ever called!
    malicious_unsigned = payload  # Untrusted attacker payload
    with pytest.raises((SecurityError, ValueError)):
        verify_and_load(malicious_unsigned, secret_key)


@pytest.mark.asyncio
async def test_asyncio_signal_handling_lifecycle() -> None:
    """Verify asyncio signal handling integration via loop.add_signal_handler on Unix."""
    if sys.platform == "win32":
        pytest.skip("loop.add_signal_handler is only supported on Unix")

    loop = asyncio.get_running_loop()
    signal_received = asyncio.Event()

    def handle_sigusr1() -> None:
        signal_received.set()

    # Register custom signal handler for SIGUSR1
    loop.add_signal_handler(signal.SIGUSR1, handle_sigusr1)

    try:
        # Trigger signal locally to this process
        import os
        os.kill(os.getpid(), signal.SIGUSR1)

        # Await the event loop processing the signal
        await asyncio.wait_for(signal_received.wait(), timeout=1.0)
        assert signal_received.is_set()
    finally:
        loop.remove_signal_handler(signal.SIGUSR1)
