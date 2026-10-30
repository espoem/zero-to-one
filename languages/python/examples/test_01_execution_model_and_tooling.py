"""
Module 01: Execution Model & Tooling Baseline
Executable proofs of the CPython compilation pipeline, bytecode instructions,
AST generation, symbol table scoping, and runtime evaluation.
"""

import ast
import dis
import symtable

import pytest


def test_ast_parsing_and_evaluation() -> None:
    """Proves AST parsing, node structure, and dynamic compilation into executable code."""
    source_code = "def add(a, b): return a + b"
    tree = ast.parse(source_code)

    assert isinstance(tree, ast.Module)
    assert len(tree.body) == 1
    func_def = tree.body[0]
    assert isinstance(func_def, ast.FunctionDef)
    assert func_def.name == "add"
    assert [arg.arg for arg in func_def.args.args] == ["a", "b"]

    # Compile AST to code object and execute in clean namespace
    compiled_code = compile(tree, filename="<test_ast>", mode="exec")
    namespace: dict[str, object] = {}
    exec(compiled_code, namespace)

    from collections.abc import Callable
    from typing import cast

    add_fn = cast(Callable[[int, int], int], namespace["add"])
    assert callable(add_fn)
    assert add_fn(10, 25) == 35


def test_symbol_table_lexical_scoping() -> None:
    """Proves CPython classifies variable scopes at compile time using symtable."""
    source_code = """
global_var = 100

def outer(param):
    free_var = 42
    local_var = 1
    def inner():
        return free_var + local_var + param + global_var
    return inner
"""
    table = symtable.symtable(source_code, filename="<test_sym>", compile_type="exec")
    assert table.is_optimized() is False  # Module scope is unoptimized (uses dict)

    # Inspect module-level symbols
    symbols = {s.get_name(): s for s in table.get_symbols()}
    assert symbols["global_var"].is_global()
    assert symbols["outer"].is_local()

    # Inspect outer function table (filtering out PEP 649/749 __annotate__ scopes)
    outer_table = next(c for c in table.get_children() if c.get_name() == "outer")
    assert outer_table.get_name() == "outer"
    assert outer_table.is_optimized() is True  # Function scopes use fast locals

    outer_symbols = {s.get_name(): s for s in outer_table.get_symbols()}
    assert outer_symbols["param"].is_parameter()
    assert outer_symbols["param"].is_local()
    assert outer_symbols["free_var"].is_cell()  # Captured by inner -> cell variable
    assert outer_symbols["local_var"].is_cell()

    # Inspect inner closure table
    inner_table = next(c for c in outer_table.get_children() if c.get_name() == "inner")
    assert inner_table.get_name() == "inner"
    inner_symbols = {s.get_name(): s for s in inner_table.get_symbols()}
    assert inner_symbols["free_var"].is_free()  # Referenced from enclosing -> free
    assert inner_symbols["global_var"].is_global()


GLOBAL_FACTOR: int = 2


def test_bytecode_fast_locals_vs_global_lookup() -> None:
    """Proves that local variables emit LOAD_FAST/STORE_FAST while globals emit LOAD_GLOBAL."""
    def compute(val: int) -> int:
        factor = 3
        return val * factor * GLOBAL_FACTOR

    instructions = list(dis.get_instructions(compute))
    opnames = [inst.opname for inst in instructions]

    # In modern CPython (3.13-3.15), superinstructions like LOAD_FAST_LOAD_FAST or
    # LOAD_FAST_BORROW_LOAD_FAST_BORROW fuse adjacent local variable loads.
    assert any("LOAD_FAST" in op for op in opnames)
    assert any("STORE_FAST" in op for op in opnames)
    assert any("LOAD_GLOBAL" in op for op in opnames)

    # Inspect instruction arguments to verify local and global identifiers
    loaded_args = [inst.argval for inst in instructions if "LOAD" in inst.opname]
    assert any("val" in str(arg) for arg in loaded_args)
    assert any("GLOBAL_FACTOR" in str(arg) for arg in loaded_args)


def test_unbound_local_error_compile_time_scope_trap() -> None:
    """Proves that assignment anywhere in a function body marks the variable local for the entire scope."""
    x = 100

    def faulty_scope() -> int:
        # Reading x before assignment raises UnboundLocalError because x is classified as local
        val = x  # type: ignore[used-before-def] # noqa: F823, F841
        x = 200  # Assignment forces 'x' to be local
        return x

    with pytest.raises(UnboundLocalError, match="cannot access local variable 'x'"):
        faulty_scope()


def test_code_object_immutability_and_attributes() -> None:
    """Proves the internal structure and immutability of PyCodeObject."""
    def sample_func(a: int, b: int = 10) -> int:
        """Sample docstring."""
        c = a + b
        return c

    code = sample_func.__code__

    assert code.co_argcount == 2
    assert code.co_varnames == ("a", "b", "c")
    assert "a" in code.co_varnames
    assert "Sample docstring." in code.co_consts
    assert code.co_name == "sample_func"

    # PyCodeObject is immutable: mutating attributes raises AttributeError
    with pytest.raises(AttributeError):
        code.co_name = "mutated_func"  # type: ignore[misc]


def test_peephole_constant_folding() -> None:
    """Proves that CPython's bytecode compiler folds constant expressions at compile time."""
    def calculate() -> int:
        return 60 * 60 * 24  # 86400 seconds in a day

    # The bytecode instructions load 86400 directly without binary multiplication operations
    instructions = list(dis.get_instructions(calculate))
    opnames = [inst.opname for inst in instructions]

    # No runtime binary operations are executed for the multiplication
    assert "BINARY_OP" not in opnames
    # 86400 is folded into constants
    assert 86400 in calculate.__code__.co_consts
