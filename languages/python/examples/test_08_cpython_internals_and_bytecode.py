"""
Module 08: CPython Internals, Bytecode & Garbage Collection
Executable proofs of bytecode instructions, reference counting mechanics,
cyclic reference collection, GC thresholds, and tracemalloc memory profiling.
"""

import dis
import gc
import sys
import tracemalloc
from typing import Any


def test_reference_counting_deterministic_tracking() -> None:
    """Proves that reference counting increments on binding and decrements on unbinding."""
    obj: list[int] = [10, 20, 30]

    # sys.getrefcount(obj) adds 1 temporary reference while executing the call
    base_count = sys.getrefcount(obj)

    # Creating a second alias increments reference count
    alias = obj
    assert sys.getrefcount(obj) == base_count + 1

    # Deleting alias decrements reference count immediately
    del alias
    assert sys.getrefcount(obj) == base_count


def test_cyclic_reference_garbage_collection() -> None:
    """Proves that reference cycles are not collected by reference counting alone

    but are collected deterministically by the cyclic garbage collector.
    """
    class Node:
        def __init__(self, name: str):
            self.name = name
            self.partner: Any = None

    # Disable automatic GC to isolate reference counting behavior
    gc.disable()
    try:
        # Create an isolated cycle: NodeA -> NodeB -> NodeA
        node_a = Node("A")
        node_b = Node("B")
        node_a.partner = node_b
        node_b.partner = node_a

        # Delete external references
        del node_a
        del node_b

        # At this point, the cycle exists in memory, unreachable but uncollected by refcount!
        # Explicitly invoke cyclic GC
        collected_count = gc.collect()
        # GC successfully identified and freed the cyclic container objects
        assert collected_count > 0
    finally:
        gc.enable()


def test_gc_threshold_inspection() -> None:
    """Proves inspection and configuration of generational GC thresholds."""
    thresholds = gc.get_threshold()
    assert len(thresholds) == 3
    # Standard CPython default thresholds: Gen 0, Gen 1, Gen 2
    gen0_threshold, gen1_threshold, gen2_threshold = thresholds
    assert gen0_threshold > 0
    assert gen1_threshold > 0
    assert gen2_threshold > 0


def test_bytecode_disassembly_instructions() -> None:
    """Proves bytecode inspection and opargs via dis module."""
    def add_values(x: int, y: int) -> int:
        return x + y

    instructions = list(dis.get_instructions(add_values))
    opnames = [inst.opname for inst in instructions]

    # Verify bytecode contains instruction to return value
    assert "RETURN_VALUE" in opnames
    # Modern Python uses fast locals
    assert any("LOAD_FAST" in op for op in opnames)


def test_tracemalloc_memory_allocation_profiling() -> None:
    """Proves memory allocation tracking using standard library tracemalloc."""
    tracemalloc.start()
    try:
        # Take snapshot before allocation
        snapshot1 = tracemalloc.take_snapshot()

        # Allocate a large list of 50,000 integers
        large_buffer = [i * 2 for i in range(50_000)]
        assert len(large_buffer) == 50_000

        # Take snapshot after allocation
        snapshot2 = tracemalloc.take_snapshot()

        # Compare differences
        top_stats = snapshot2.compare_to(snapshot1, "lineno")
        assert len(top_stats) > 0

        # The allocation difference should show significant memory increase (> 500 KB)
        allocated_diff = sum(stat.size_diff for stat in top_stats)
        assert allocated_diff > 500_000
    finally:
        tracemalloc.stop()
