"""Module 14 Test Suite: Then vs Now & Capstone Async Task Orchestrator.

Verifies PEP 695 generic typing, PEP 742 TypeIs narrowing, and a production-grade
asynchronous, backpressured, structured-concurrency task orchestrator.
"""

from __future__ import annotations

import asyncio
import contextvars
import inspect
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeIs

import pytest

# ContextVar for distributed trace ID propagation
trace_context: contextvars.ContextVar[str] = contextvars.ContextVar("trace_context", default="untracked")


# 1. Capstone Data Classes and Orchestrator
@dataclass(frozen=True, slots=True)
class Task[T, R]:
    task_id: str
    payload: T
    handler: Callable[[T], R]
    timeout_seconds: float = 2.0


@dataclass(frozen=True, slots=True)
class TaskResult[R]:
    task_id: str
    result: R | None
    error: str | None
    trace_id: str


class AsyncOrchestrator:
    def __init__(self, concurrency: int = 3, max_queue_size: int = 10) -> None:
        self.concurrency = concurrency
        self.queue: asyncio.Queue[Task[Any, Any]] = asyncio.Queue(maxsize=max_queue_size)
        self.results: list[TaskResult[Any]] = []

    async def submit(self, task: Task[Any, Any]) -> None:
        """Submit a task to the queue. Blocks if full (Backpressure)."""
        await self.queue.put(task)

    async def _worker(self) -> None:
        while True:
            try:
                task = await self.queue.get()
            except (asyncio.CancelledError, asyncio.QueueShutDown):
                break

            current_trace = trace_context.get()
            try:
                async with asyncio.timeout(task.timeout_seconds):
                    if inspect.iscoroutinefunction(task.handler):
                        res = await task.handler(task.payload)
                    else:
                        res = task.handler(task.payload)
                    self.results.append(TaskResult(task.task_id, res, None, current_trace))
            except TimeoutError:
                self.results.append(TaskResult(task.task_id, None, "TimeoutError", current_trace))
            except Exception as exc:
                self.results.append(TaskResult(task.task_id, None, str(exc), current_trace))
            finally:
                self.queue.task_done()

    async def run(self) -> list[TaskResult[Any]]:
        async with asyncio.TaskGroup() as tg:
            workers = [tg.create_task(self._worker()) for _ in range(self.concurrency)]

            # Wait until all submitted tasks have called task_done()
            await self.queue.join()

            # Trigger queue shutdown protocol (Python 3.13+)
            self.queue.shutdown()

            # Cancel remaining idle workers awaiting get()
            for w in workers:
                w.cancel()

        return self.results


# 2. Tests
@pytest.mark.asyncio
async def test_capstone_orchestrator_execution() -> None:
    """Verify task orchestrator handles success, async handlers, timeouts, and failures."""
    trace_context.set("trace-xyz-987")
    orchestrator = AsyncOrchestrator(concurrency=2, max_queue_size=5)

    # 1. Normal sync task
    def sync_square(x: int) -> int:
        return x * x

    # 2. Normal async task
    async def async_greet(name: str) -> str:
        await asyncio.sleep(0.01)
        return f"Hello, {name}!"

    # 3. Failing task
    def failing_task(msg: str) -> None:
        raise ValueError(f"Fatal error: {msg}")

    # 4. Slow task exceeding timeout
    async def slow_task(duration: float) -> str:
        await asyncio.sleep(duration)
        return "completed"

    await orchestrator.submit(Task("t1", 5, sync_square))
    await orchestrator.submit(Task("t2", "Python 3.15", async_greet))
    await orchestrator.submit(Task("t3", "corrupt_data", failing_task))
    await orchestrator.submit(Task("t4", 0.5, slow_task, timeout_seconds=0.05))

    results = await orchestrator.run()

    result_map = {r.task_id: r for r in results}

    # Verify task 1 (sync)
    assert result_map["t1"].result == 25
    assert result_map["t1"].error is None
    assert result_map["t1"].trace_id == "trace-xyz-987"

    # Verify task 2 (async)
    assert result_map["t2"].result == "Hello, Python 3.15!"
    assert result_map["t2"].error is None

    # Verify task 3 (failure isolation)
    assert result_map["t3"].result is None
    assert "Fatal error: corrupt_data" in str(result_map["t3"].error)

    # Verify task 4 (timeout)
    assert result_map["t4"].result is None
    assert result_map["t4"].error == "TimeoutError"


def test_pep695_generics_and_typeis_narrowing() -> None:
    """Verify PEP 695 generic class and PEP 742 TypeIs narrowing function."""
    class Container[T]:
        def __init__(self, value: T) -> None:
            self.value: T = value

    c = Container(42)
    assert c.value == 42

    def is_int(val: object) -> TypeIs[int]:
        return isinstance(val, int)

    val: object = 100
    if is_int(val):
        # TypeIs narrows val to int in positive branch
        doubled = val * 2
        assert doubled == 200
    else:
        pytest.fail("is_int returned False unexpectedly")
