// A deterministic, simplified model of the HTML event loop processing model (§8.1.7.3).
// It is a teaching model: one window event loop, task sources with FIFO order per source,
// one microtask queue, a checkpoint after every task, and an "update the rendering" task
// queued at each frame boundary of a simulated clock.

/**
 * @typedef {{ source: string, at: number, run: () => void, label: string }} Task
 */

export class EventLoopModel {
  constructor({ frameMs = 16, sourcePriority = ['rendering', 'user-interaction', 'timer', 'message'] } = {}) {
    this.now = 0;
    this.frameMs = frameMs;
    this.nextFrame = frameMs;
    this.sourcePriority = sourcePriority;
    /** @type {Map<string, Task[]>} */
    this.taskQueues = new Map();
    /** @type {Array<() => void>} */
    this.microtasks = [];
    /** @type {Array<(t: number) => void>} */
    this.rafCallbacks = [];
    /** @type {string[]} */
    this.log = [];
    this.performingCheckpoint = false;
  }

  /** Queue a task on a task source, runnable from time `at`. */
  queueTask(source, label, run, at = this.now) {
    if (!this.taskQueues.has(source)) this.taskQueues.set(source, []);
    this.taskQueues.get(source)?.push({ source, at, run, label });
  }

  setTimeout(label, fn, ms = 0) { this.queueTask('timer', label, fn, this.now + ms); }
  queueMicrotask(fn) { this.microtasks.push(fn); }
  requestAnimationFrame(fn) { this.rafCallbacks.push(fn); }

  performMicrotaskCheckpoint(limit) {
    if (this.performingCheckpoint) return;
    this.performingCheckpoint = true;
    let n = 0;
    while (this.microtasks.length > 0) {
      if (++n > limit) { this.log.push('STARVED'); throw new Error('microtask starvation'); }
      const mt = /** @type {() => void} */ (this.microtasks.shift());
      mt();
    }
    this.performingCheckpoint = false;
  }

  /** Pick the first runnable task, honouring source priority; FIFO within a source. */
  pickTask() {
    const sources = [...new Set([...this.sourcePriority, ...this.taskQueues.keys()])];
    for (const s of sources) {
      const q = this.taskQueues.get(s);
      if (!q) continue;
      const i = q.findIndex((t) => t.at <= this.now);
      if (i !== -1) return q.splice(i, 1)[0];
    }
    return undefined;
  }

  hasPendingTasks() { return [...this.taskQueues.values()].some((q) => q.length > 0); }

  /** Run until no work remains or `maxSteps` iterations elapse. */
  run({ maxSteps = 1000, microtaskLimit = 10_000 } = {}) {
    for (let step = 0; step < maxSteps; step++) {
      if (this.now >= this.nextFrame && this.rafCallbacks.length > 0) {
        this.queueTask('rendering', 'update the rendering', () => this.updateTheRendering());
        this.nextFrame += this.frameMs;
      }
      const task = this.pickTask();
      if (task) {
        task.run();
        this.performMicrotaskCheckpoint(microtaskLimit);
        this.now += 1; // every task costs 1 ms of simulated time
        continue;
      }
      if (!this.hasPendingTasks() && this.rafCallbacks.length === 0) return;
      this.now += 1; // idle: advance the clock
    }
  }

  updateTheRendering() {
    const callbacks = this.rafCallbacks;
    this.rafCallbacks = [];
    const ts = this.now;
    for (const cb of callbacks) {
      cb(ts);
      this.performMicrotaskCheckpoint(10_000); // clean up after running script
    }
    this.log.push('style+layout');
    this.log.push('paint');
  }
}
