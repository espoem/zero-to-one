// Produces 1..count into the shared ring, spinning politely when it is full.
import { workerData, parentPort } from 'node:worker_threads';
const { Ring } = await import(workerData.ringModule);
const ring = new Ring(workerData.sab);
const pause = new Int32Array(new SharedArrayBuffer(4));
for (let i = 1; i <= workerData.count; i++) {
  while (!ring.push(i)) Atomics.wait(pause, 0, 0, 1); // full: back off 1 ms (allowed in a worker)
}
parentPort.postMessage('produced');
