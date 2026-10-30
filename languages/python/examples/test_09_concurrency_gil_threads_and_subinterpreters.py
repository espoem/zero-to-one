"""
Module 09: Concurrency: GIL, Threads, Processes & Subinterpreters
Executable proofs of the GIL switch interval, thread data races without locks,
synchronization with threading.Lock, and concurrent.futures executors.
"""

import sys
import threading
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor


def test_gil_switch_interval_inspection() -> None:
    """Proves inspection and configuration of the CPython GIL switch interval."""
    interval = sys.getswitchinterval()
    # Default is 0.005 seconds (5 milliseconds)
    assert isinstance(interval, float)
    assert interval > 0.0

    # Temporarily modify and restore
    sys.setswitchinterval(0.010)
    assert sys.getswitchinterval() == 0.010
    sys.setswitchinterval(interval)


def test_thread_data_race_without_lock_vs_with_lock() -> None:
    """Proves that multi-step operations (like counter += 1) suffer race conditions

    under multi-threading without locks, and that threading.Lock restores correctness.
    """
    class UnsafeCounter:
        def __init__(self) -> None:
            self.value = 0

        def increment(self) -> None:
            # Multi-step read-modify-write susceptible to thread preemption
            current = self.value
            time.sleep(0.0001)  # Force thread context switch
            self.value = current + 1

    class SafeCounter:
        def __init__(self) -> None:
            self.value = 0
            self.lock = threading.Lock()

        def increment(self) -> None:
            with self.lock:
                current = self.value
                time.sleep(0.0001)
                self.value = current + 1

    # Execute unsafe counter across 5 threads
    unsafe = UnsafeCounter()
    threads = [threading.Thread(target=unsafe.increment) for _ in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    # Without locks, threads overwrote each other's increments
    assert unsafe.value < 5

    # Execute safe counter across 5 threads
    safe = SafeCounter()
    safe_threads = [threading.Thread(target=safe.increment) for _ in range(5)]
    for t in safe_threads:
        t.start()
    for t in safe_threads:
        t.join()
    # With locks, all 5 increments are strictly preserved
    assert safe.value == 5


def test_thread_pool_executor_io_concurrency() -> None:
    """Proves ThreadPoolExecutor executes concurrent tasks with future results."""
    def simulate_io_fetch(item_id: int) -> dict[str, int]:
        time.sleep(0.01)  # Releases GIL during sleep
        return {"id": item_id, "status": 200}

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = [executor.submit(simulate_io_fetch, i) for i in range(4)]
        results = [f.result() for f in futures]

    assert len(results) == 4
    assert [r["id"] for r in results] == [0, 1, 2, 3]


def helper_process_worker(x: int) -> int:
    """Top-level helper function picklable by ProcessPoolExecutor."""
    return x * x


def test_process_pool_executor_parallel_computation() -> None:
    """Proves ProcessPoolExecutor executes computations across independent OS processes."""
    with ProcessPoolExecutor(max_workers=2) as executor:
        futures = [executor.submit(helper_process_worker, i) for i in range(4)]
        results = [f.result() for f in futures]

    assert results == [0, 1, 4, 9]


def test_free_threaded_detection_api() -> None:
    """Verifies presence and behavior of Python 3.13+ free-threading detection API."""
    if hasattr(sys, "_is_gil_enabled"):
        gil_enabled = sys._is_gil_enabled()
        assert isinstance(gil_enabled, bool)
    else:
        # Standard legacy build without free-threading flags
        assert True
