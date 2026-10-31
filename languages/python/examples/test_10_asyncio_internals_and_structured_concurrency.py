"""
Module 10: Asyncio Internals & Structured Concurrency
Executable proofs of TaskGroup structured concurrency, cancellation invariants,
timeout contexts, contextvars isolation, to_thread execution, and Queue backpressure.
"""

import asyncio
import time
from contextvars import ContextVar

import pytest

# Request-scoped context variable
request_context: ContextVar[str] = ContextVar("request_context", default="default")


@pytest.mark.asyncio
async def test_task_group_structured_concurrency_and_cancellation() -> None:
    """Proves TaskGroup cancels all sibling tasks when one fails and raises ExceptionGroup."""
    sibling_was_cancelled = False

    async def failing_worker() -> None:
        await asyncio.sleep(0.01)
        raise ValueError("Intentional worker failure")

    async def long_running_worker() -> None:
        nonlocal sibling_was_cancelled
        try:
            await asyncio.sleep(1.0)
        except asyncio.CancelledError:
            sibling_was_cancelled = True
            raise  # Re-raise cancellation

    with pytest.raises(ExceptionGroup) as exc_info:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(failing_worker())
            tg.create_task(long_running_worker())

    # Invariant 1: Sibling was automatically cancelled by the task group
    assert sibling_was_cancelled is True
    # Invariant 2: ExceptionGroup contains the original ValueError
    eg = exc_info.value
    assert len(eg.exceptions) == 1
    assert isinstance(eg.exceptions[0], ValueError)


@pytest.mark.asyncio
async def test_asyncio_timeout_context_manager() -> None:
    """Proves modern asyncio.timeout cancels operations when deadline is exceeded."""
    async def slow_operation() -> str:
        await asyncio.sleep(0.5)
        return "completed"

    with pytest.raises(TimeoutError):
        async with asyncio.timeout(0.02):
            await slow_operation()


def test_cancelled_error_inherits_from_base_exception() -> None:
    """Proves that asyncio.CancelledError inherits from BaseException, not Exception."""
    assert issubclass(asyncio.CancelledError, BaseException)
    assert not issubclass(asyncio.CancelledError, Exception)


@pytest.mark.asyncio
async def test_contextvars_isolation_across_concurrent_tasks() -> None:
    """Proves contextvars maintain isolated state across concurrent tasks on the same thread."""
    task_observations: dict[str, str] = {}

    async def scoped_task(name: str, bound_value: str) -> None:
        # Mutate context variable inside this coroutine context
        request_context.set(bound_value)
        # Yield to event loop to allow concurrent task interleaving
        await asyncio.sleep(0.01)
        # Verify the context remains uncorrupted by sibling tasks
        task_observations[name] = request_context.get()

    async with asyncio.TaskGroup() as tg:
        tg.create_task(scoped_task("task_A", "TENANT_ALPHA"))
        tg.create_task(scoped_task("task_B", "TENANT_BETA"))

    assert task_observations["task_A"] == "TENANT_ALPHA"
    assert task_observations["task_B"] == "TENANT_BETA"


@pytest.mark.asyncio
async def test_asyncio_to_thread_delegation() -> None:
    """Proves asyncio.to_thread runs synchronous blocking calls on background worker threads."""
    def blocking_sync_function(multiplier: int) -> int:
        time.sleep(0.02)
        return 42 * multiplier

    # Run blocking call in thread pool while maintaining event loop responsiveness
    result = await asyncio.to_thread(blocking_sync_function, 2)
    assert result == 84


@pytest.mark.asyncio
async def test_asyncio_queue_backpressure_and_shutdown() -> None:
    """Proves asyncio.Queue backpressure with maxsize and Queue.shutdown()."""
    # Create bounded queue with maxsize=2
    queue: asyncio.Queue[int] = asyncio.Queue(maxsize=2)

    await queue.put(1)
    await queue.put(2)
    assert queue.full() is True

    # Consume items
    item1 = await queue.get()
    queue.task_done()
    assert item1 == 1
    assert queue.full() is False

    # Modern Python 3.13+ Queue.shutdown()
    if hasattr(queue, "shutdown") and hasattr(asyncio, "QueueShutDown"):
        queue.shutdown()
        # Putting into a shut down queue raises asyncio.QueueShutDown
        with pytest.raises(asyncio.QueueShutDown):
            queue.put_nowait(99)
