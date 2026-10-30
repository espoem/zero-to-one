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
    /** Document visibility: hidden documents are filtered out of rendering. */
    this.visible = true;
    /** When true, the rendering task logs every sub-step instead of only style+layout and paint. */
    this.verboseRendering = false;
    /** Active timer due times, for idle-deadline computation. */
    this.lastRenderOpportunity = 0;
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
      if (this.now >= this.nextFrame) {
        // in parallel: a rendering opportunity queues a task on the rendering task source
        this.lastRenderOpportunity = this.now;
        if (this.rafCallbacks.length > 0) {
          this.queueTask('rendering', 'update the rendering', () => this.updateTheRendering());
        }
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
    // Filter non-renderable documents: a hidden document is skipped entirely (no rAF).
    if (!this.visible) return;
    const steps = this.verboseRendering
      ? ['resize', 'scroll', 'media queries', 'animations', 'fullscreen', 'context lost']
      : [];
    this.log.push(...steps);
    const callbacks = this.rafCallbacks;
    this.rafCallbacks = [];
    const ts = this.lastRenderOpportunity;           // one shared timestamp for all callbacks
    for (const cb of callbacks) {
      cb(ts);
      this.performMicrotaskCheckpoint(10_000);       // clean up after running script
    }
    this.log.push('style+layout');
    if (this.verboseRendering) this.log.push('focus fix-up', 'view transitions', 'intersection observers');
    this.log.push('paint');
  }

  /**
   * Idle deadline per §8.1.7.3: min(idle start + 50 ms, earliest pending timer,
   * next render deadline if rAF callbacks are pending).
   */
  idleDeadline(refreshMs = this.frameMs) {
    let deadline = this.now + 50;
    for (const t of this.taskQueues.get('timer') ?? []) deadline = Math.min(deadline, t.at);
    if (this.rafCallbacks.length > 0) deadline = Math.min(deadline, this.lastRenderOpportunity + refreshMs);
    return deadline;
  }

  /**
   * Dispatch an event to several listeners.
   * fromUser = true: each listener is invoked from an empty stack, so a microtask checkpoint
   * runs after each one ("clean up after running script"). fromUser = false models el.click()
   * called from script: the stack is not empty, so microtasks wait until the caller finishes.
   */
  dispatch(listeners, { fromUser }) {
    for (const l of listeners) {
      l();
      if (fromUser) this.performMicrotaskCheckpoint(10_000);
    }
  }
}
