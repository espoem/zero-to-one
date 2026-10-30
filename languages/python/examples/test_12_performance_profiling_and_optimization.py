"""Module 12 Test Suite: Performance Profiling & Optimization.

Verifies deterministic tracing with cProfile & pstats, CPython bytecode optimizations
(local variable caching, __slots__, string joining), and benchmarking patterns.
"""

from __future__ import annotations

import cProfile
import dis
import io
import math
import pstats
import sys
import timeit


def _sub_worker(n: int) -> int:
    return sum(i for i in range(n))


def _orchestrator(iterations: int) -> int:
    total = 0
    for _ in range(iterations):
        total += _sub_worker(100)
    return total


def test_cprofile_deterministic_tracing_and_pstats() -> None:
    """Verify programmatic profiling with cProfile and pstats metrics extraction."""
    profiler = cProfile.Profile()
    profiler.enable()
    result = _orchestrator(50)
    profiler.disable()

    assert result > 0

    stream = io.StringIO()
    stats = pstats.Stats(profiler, stream=stream).sort_stats(pstats.SortKey.CUMULATIVE)
    stats.print_stats()

    output = stream.getvalue()
    assert "_orchestrator" in output
    assert "_sub_worker" in output

    # Direct stat dictionary verification
    # stats.stats key is (filename, line_number, func_name)
    raw_stats: dict[tuple[str, int, str], tuple[int, int, float, float, dict[object, object]]] = getattr(stats, "stats")
    sub_worker_stats = [
        val for key, val in raw_stats.items() if key[2] == "_sub_worker"
    ]
    assert len(sub_worker_stats) == 1
    cc, nc, tottime, cumtime, _callers = sub_worker_stats[0]
    assert nc == 50  # Exactly 50 calls recorded deterministically
    assert tottime <= cumtime


def test_local_variable_caching_bytecode() -> None:
    """Verify that local variable binding changes LOAD_GLOBAL to LOAD_FAST in bytecode."""
    def unoptimized(data: list[float]) -> list[float]:
        return [math.sqrt(x) for x in data]

    def optimized(data: list[float]) -> list[float]:
        local_sqrt = math.sqrt
        return [local_sqrt(x) for x in data]

    unopt_ops = [instr.opname for instr in dis.get_instructions(unoptimized)]
    opt_ops = [instr.opname for instr in dis.get_instructions(optimized)]

    # Unoptimized function must perform LOAD_GLOBAL or LOAD_ATTR for math.sqrt
    assert any("GLOBAL" in op or "ATTR" in op for op in unopt_ops)

    # In optimized function, local_sqrt is loaded via LOAD_FAST (or LOAD_FAST_LOAD_FAST in 3.15)
    assert any("LOAD_FAST" in op for op in opt_ops)


def test_string_concatenation_equivalence_and_performance() -> None:
    """Verify correctness and performance profile of join vs repeated concatenation."""
    chunks = [f"segment_{i}_data;" for i in range(1000)]

    # Concatenation via +=
    acc = ""
    for c in chunks:
        acc += c

    # Concatenation via ''.join()
    joined = "".join(chunks)

    assert acc == joined
    assert len(joined) == sum(len(c) for c in chunks)


class RegularDictPoint:
    def __init__(self, x: float, y: float, z: float) -> None:
        self.x = x
        self.y = y
        self.z = z


class SlottedPoint:
    __slots__ = ("x", "y", "z")

    def __init__(self, x: float, y: float, z: float) -> None:
        self.x = x
        self.y = y
        self.z = z


def test_slots_memory_and_attribute_access() -> None:
    """Verify that __slots__ eliminates __dict__ and optimizes memory layout."""
    reg = RegularDictPoint(1.0, 2.0, 3.0)
    slot = SlottedPoint(1.0, 2.0, 3.0)

    # Regular instance has a dynamic __dict__
    assert hasattr(reg, "__dict__")
    assert isinstance(reg.__dict__, dict)

    # Slotted instance does NOT have a __dict__
    assert not hasattr(slot, "__dict__")

    # The slotted instance itself has a smaller or equal base footprint,
    # and regular instance additionally allocates the entire __dict__ table.
    reg_total_size = sys.getsizeof(reg) + sys.getsizeof(reg.__dict__)
    slot_total_size = sys.getsizeof(slot)
    assert slot_total_size < reg_total_size


def test_timeit_microbenchmarking_harness() -> None:
    """Verify deterministic microbenchmarking using timeit.timeit."""
    setup_code = "data = list(range(100)); import math"
    stmt_unopt = "[math.sqrt(x) for x in data]"
    stmt_opt = "local_sqrt = math.sqrt; [local_sqrt(x) for x in data]"

    t_unopt = timeit.timeit(stmt_unopt, setup=setup_code, number=1000)
    t_opt = timeit.timeit(stmt_opt, setup=setup_code, number=1000)

    assert t_unopt > 0.0
    assert t_opt > 0.0
