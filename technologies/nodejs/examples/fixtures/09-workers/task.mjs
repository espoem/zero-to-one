// Worker entry: CPU-bound tasks for the pool tests.
import { parentPort } from 'node:worker_threads';

function fib(n) { return n < 2 ? n : fib(n - 1) + fib(n - 2); }

parentPort.on('message', ({ id, kind, n }) => {
  if (kind === 'crash') throw new Error(`task ${id} crashed the worker`);
  if (kind === 'fib') return parentPort.postMessage({ id, result: fib(n) });
  if (kind === 'sum') {
    // n is a transferred ArrayBuffer of float64 values
    const view = new Float64Array(n);
    let s = 0;
    for (const v of view) s += v;
    return parentPort.postMessage({ id, result: s });
  }
});
