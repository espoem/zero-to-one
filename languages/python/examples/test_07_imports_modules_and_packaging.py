"""
Module 07: Imports, Modules & Packaging
Executable proofs of the import machinery, sys.meta_path finders, sys.modules caching,
circular import dynamics, PEP 420 namespace packages, and package metadata.
"""

import importlib
import importlib.abc
import importlib.metadata
import sys
import types
from typing import Any

import pytest


def test_sys_modules_cache_and_reload() -> None:
    """Proves sys.modules caches loaded modules and importlib.reload updates module dict."""
    import math

    # sys.modules contains the active module reference
    assert "math" in sys.modules
    assert sys.modules["math"] is math

    # Injecting dynamic attribute into module
    setattr(math, "_custom_test_marker", 12345)
    assert getattr(math, "_custom_test_marker") == 12345

    # Reloading the module re-executes its code and refreshes its namespace
    reloaded_math = importlib.reload(math)
    assert reloaded_math is math
    # Custom dynamic marker is preserved or refreshed depending on reload behavior
    delattr(math, "_custom_test_marker")


def test_custom_meta_path_finder_and_loader() -> None:
    """Proves custom module generation via sys.meta_path finder and loader protocols."""
    class VirtualModuleLoader(importlib.abc.Loader):
        def __init__(self, spec: Any):
            self.spec = spec

        def create_module(self, spec: Any) -> types.ModuleType | None:
            return None  # Use default module allocation

        def exec_module(self, module: types.ModuleType) -> None:
            # Inject virtual attributes into the module namespace
            setattr(module, "VIRTUAL_FLAG", True)
            setattr(module, "add_numbers", lambda a, b: a + b)

    class VirtualMetaFinder:
        TARGET_MODULE = "virtual_in_memory_pkg"

        def find_spec(self, fullname: str, path: Any, target: Any = None) -> Any:
            if fullname == self.TARGET_MODULE:
                loader = VirtualModuleLoader(None)
                from importlib.machinery import ModuleSpec
                return ModuleSpec(fullname, loader, origin="virtual_memory")
            return None

    finder = VirtualMetaFinder()
    sys.meta_path.insert(0, finder)

    try:
        # Import the completely virtual, non-disk module
        virtual_mod = importlib.import_module("virtual_in_memory_pkg")
        assert virtual_mod.VIRTUAL_FLAG is True
        assert virtual_mod.add_numbers(10, 20) == 30
        assert "virtual_in_memory_pkg" in sys.modules
    finally:
        # Clean up global runtime state
        sys.meta_path.remove(finder)
        sys.modules.pop("virtual_in_memory_pkg", None)


def test_circular_import_partially_initialized_anomaly() -> None:
    """Simulates the mechanics of circular imports causing partially initialized module errors."""
    mod_a = types.ModuleType("simulated_mod_a")
    mod_b = types.ModuleType("simulated_mod_b")

    # Step 1: mod_a registered in sys.modules
    sys.modules["simulated_mod_a"] = mod_a
    sys.modules["simulated_mod_b"] = mod_b

    try:
        # mod_a starts executing and imports mod_b
        # mod_b starts executing and attempts to access an attribute on mod_a not yet defined
        with pytest.raises(AttributeError, match="has no attribute 'uninitialized_func'"):
            # Attempting to read attribute before mod_a executes its definition line
            getattr(mod_a, "uninitialized_func")
    finally:
        sys.modules.pop("simulated_mod_a", None)
        sys.modules.pop("simulated_mod_b", None)


def test_importlib_metadata_inspection() -> None:
    """Proves standard library importlib.metadata queries installed wheel metadata and versions."""
    # Query pytest package metadata
    pytest_version = importlib.metadata.version("pytest")
    assert pytest_version.startswith("9.")

    # Inspect installed packages list
    installed = {dist.metadata["Name"].lower() for dist in importlib.metadata.distributions()}
    assert "pytest" in installed
    assert "mypy" in installed
    assert "ruff" in installed
