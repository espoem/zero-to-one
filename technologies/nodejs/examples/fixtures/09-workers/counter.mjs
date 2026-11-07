// Increments a shared Int32 counter `times` times with Atomics.add, then reports.
import { workerData, parentPort } from 'node:worker_threads';
const { shared, times } = workerData;
const counter = new Int32Array(shared);
for (let i = 0; i < times; i++) Atomics.add(counter, 0, 1);
parentPort.postMessage('done');
