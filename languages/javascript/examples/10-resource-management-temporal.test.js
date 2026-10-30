// Module 10 · Explicit resource management and Temporal (ES2027, shipped in Node 26)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import vm from 'node:vm';
import { runNode } from './helpers/run-node.js';

const resource = (name, log, { failDispose = false } = {}) => ({
  name,
  [Symbol.dispose]() {
    log.push(`dispose ${name}`);
    if (failDispose) throw new Error(`dispose ${name} failed`);
  },
});

describe('using (explicit resource management)', () => {
  test('disposes in reverse declaration order on normal exit', () => {
    const log = [];
    {
      using a = resource('a', log), b = resource('b', log);
      using c = resource('c', log);
      log.push('body');
    }
    assert.deepEqual(log, ['body', 'dispose c', 'dispose b', 'dispose a']);
  });

  test('disposes on return, break and throw', () => {
    const log = [];
    const f = () => { using r = resource('ret', log); return 'value'; };
    assert.equal(f(), 'value');
    for (const i of [1, 2]) { using r = resource(`loop${i}`, log); if (i === 1) break; }
    assert.throws(() => { using r = resource('thr', log); throw new Error('x'); }, /x/);
    assert.deepEqual(log, ['dispose ret', 'dispose loop1', 'dispose thr']);
  });

  test('NEGATIVE: a disposal error does not hide the body error (SuppressedError)', () => {
    const log = [];
    try {
      using bad = resource('bad', log, { failDispose: true });
      throw new Error('body failed');
    } catch (e) {
      assert.ok(e instanceof SuppressedError);
      assert.equal(e.error.message, 'dispose bad failed');
      assert.equal(e.suppressed.message, 'body failed');
      return;
    }
    assert.fail('expected SuppressedError');
  });

  test('NEGATIVE: every resource is still disposed when one disposal throws', () => {
    const log = [];
    assert.throws(() => {
      using a = resource('a', log);
      using b = resource('b', log, { failDispose: true });
      using c = resource('c', log);
    }, /dispose b failed/);
    assert.deepEqual(log, ['dispose c', 'dispose b', 'dispose a']);
  });

  test('two failing disposals nest SuppressedErrors (newest error outermost)', () => {
    const log = [];
    try {
      using a = resource('a', log, { failDispose: true });
      using b = resource('b', log, { failDispose: true });
      throw new Error('E0');
    } catch (e) {
      assert.equal(e.error.message, 'dispose a failed');
      assert.equal(e.suppressed.error.message, 'dispose b failed');
      assert.equal(e.suppressed.suppressed.message, 'E0');
    }
  });

  test('NEGATIVE: a non-disposable value throws TypeError at the declaration; null/undefined are allowed', () => {
    assert.throws(() => { using x = /** @type {any} */ ({}); }, TypeError);
    assert.doesNotThrow(() => { using n = null; using u = undefined; });
  });

  test('NEGATIVE: the dispose method is captured at declaration time', () => {
    const log = [];
    {
      using r = resource('orig', log);
      /** @type {any} */ (r)[Symbol.dispose] = () => log.push('replaced');
    }
    assert.deepEqual(log, ['dispose orig']);
  });

  test('NEGATIVE: using is a SyntaxError at the top level of a classic script and with destructuring', () => {
    assert.throws(() => new vm.Script('using x = null;'), SyntaxError);              // script top level
    assert.throws(() => new vm.Script('{ using { a } = { a: 1 }; }'), SyntaxError);  // destructuring
    assert.doesNotThrow(() => new vm.Script('{ using x = null; }'));                 // a block is fine
    assert.doesNotThrow(() => new Function('using x = null;'));                      // a function body too
  });

  test('using in for-of disposes each value at the end of its iteration', () => {
    const log = [];
    for (using it of [resource('i1', log), resource('i2', log)]) log.push(`use ${it.name}`);
    assert.deepEqual(log, ['use i1', 'dispose i1', 'use i2', 'dispose i2']);
  });

  test('await using awaits async disposal', async () => {
    const log = [];
    await (async () => {
      await using conn = {
        async [Symbol.asyncDispose]() { await new Promise((r) => setTimeout(r, 5)); log.push('closed'); },
      };
      log.push('query');
    })();
    assert.deepEqual(log, ['query', 'closed']);
  });

  test('NEGATIVE: plain using does not await an async-only resource', () => {
    assert.throws(() => { using x = /** @type {any} */ ({ async [Symbol.asyncDispose]() {} }); }, TypeError);
  });
});

describe('DisposableStack', () => {
  test('use, adopt, defer, reverse order', () => {
    const log = [];
    const stack = new DisposableStack();
    stack.use(resource('used', log));
    stack.adopt('handle', (h) => log.push(`adopted ${h}`));
    stack.defer(() => log.push('deferred'));
    stack.dispose();
    assert.deepEqual(log, ['deferred', 'adopted handle', 'dispose used']);
    assert.equal(stack.disposed, true);
    stack.dispose(); // idempotent
    assert.equal(log.length, 3);
  });

  test('move() transfers ownership: the constructor pattern', () => {
    const log = [];
    class Session {
      #resources;
      constructor(failAfterFirst) {
        using stack = new DisposableStack();
        this.socket = stack.use(resource('socket', log));
        if (failAfterFirst) throw new Error('second acquisition failed');
        this.log = stack.adopt('logfile', () => log.push('dispose logfile'));
        this.#resources = stack.move();
      }
      [Symbol.dispose]() { this.#resources.dispose(); }
    }
    assert.throws(() => new Session(true), /second acquisition failed/);
    assert.deepEqual(log, ['dispose socket']);           // partial acquisition cleaned up
    log.length = 0;
    {
      using s = new Session(false);
      assert.deepEqual(log, []);                         // nothing disposed while the object lives
    }
    assert.deepEqual(log, ['dispose logfile', 'dispose socket']);
  });

  test('NEGATIVE: using a disposed stack throws ReferenceError', () => {
    const stack = new DisposableStack();
    stack.dispose();
    assert.throws(() => stack.defer(() => {}), ReferenceError);
  });
});

describe('Date pitfalls that motivated Temporal', () => {
  test('NEGATIVE: date-only strings are UTC, date-time strings are local', () => {
    // run in Prague time so the difference is visible regardless of the machine's zone
    const prague = runNode(['-e', `process.env.TZ='Europe/Prague'; console.log(JSON.stringify([
      new Date('2026-03-29').toISOString(), new Date('2026-03-29T00:00').toISOString()]))`]);
    assert.deepEqual(JSON.parse(prague.stdout), ['2026-03-29T00:00:00.000Z', '2026-03-28T23:00:00.000Z']);
  });

  test('NEGATIVE: Date months are 0-based and overflow rolls over silently', () => {
    assert.equal(new Date(2026, 0, 31).getMonth(), 0);
    const rolled = new Date(2026, 1, 30);
    assert.equal(rolled.getMonth(), 2);
    assert.equal(rolled.getDate(), 2);
  });

  test('NEGATIVE: Date is mutable', () => {
    const shared = new Date(0);
    const alias = shared;
    alias.setUTCFullYear(2000);
    assert.equal(shared.getUTCFullYear(), 2000);
  });
});

describe('Temporal (ES2027, shipped in Node 26)', () => {
  const zoned = (s) => Temporal.ZonedDateTime.from(s);

  test('calendar-day vs exact-hour arithmetic across the spring-forward gap', () => {
    const z = zoned('2026-03-28T12:00[Europe/Prague]');
    assert.equal(z.add({ days: 1 }).toString(), '2026-03-29T12:00:00+02:00[Europe/Prague]');
    assert.equal(z.add({ hours: 24 }).toString(), '2026-03-29T13:00:00+02:00[Europe/Prague]');
    assert.equal(zoned('2026-03-29T00:00[Europe/Prague]').hoursInDay, 23);
    assert.equal(zoned('2026-10-25T00:00[Europe/Prague]').hoursInDay, 25);
  });

  test('disambiguation for gaps and folds', () => {
    const at = (s, disambiguation) => Temporal.ZonedDateTime.from(s, { disambiguation }).toString();
    assert.equal(at('2026-03-29T02:30[Europe/Prague]', 'compatible'), '2026-03-29T03:30:00+02:00[Europe/Prague]');
    assert.equal(at('2026-03-29T02:30[Europe/Prague]', 'earlier'), '2026-03-29T01:30:00+01:00[Europe/Prague]');
    assert.equal(at('2026-10-25T02:30[Europe/Prague]', 'earlier'), '2026-10-25T02:30:00+02:00[Europe/Prague]');
    assert.equal(at('2026-10-25T02:30[Europe/Prague]', 'later'), '2026-10-25T02:30:00+01:00[Europe/Prague]');
    assert.throws(() => at('2026-03-29T02:30[Europe/Prague]', 'reject'), RangeError);
  });

  test('overflow: constrain by default, reject on request', () => {
    assert.equal(Temporal.PlainDate.from('2026-01-31').add({ months: 1 }).toString(), '2026-02-28');
    assert.throws(() => Temporal.PlainDate.from('2026-01-31').add({ months: 1 }, { overflow: 'reject' }), RangeError);
    assert.equal(Temporal.PlainDate.from({ year: 2026, month: 2, day: 30 }).toString(), '2026-02-28');
  });

  test('durations: relative rounding across a 23-hour day, totals, until/since defaults', () => {
    const z = zoned('2026-03-28T12:00[Europe/Prague]');
    const d = Temporal.Duration.from({ hours: 25 });
    assert.equal(d.round({ largestUnit: 'day', relativeTo: z }).toString(), 'P1DT2H');
    assert.equal(d.total({ unit: 'minute' }), 1500);
    const s = zoned('2026-03-01T00:00[Europe/Prague]');
    const e = zoned('2026-04-01T00:00[Europe/Prague]');
    assert.equal(s.until(e).toString(), 'PT743H');
    assert.equal(s.until(e, { largestUnit: 'day' }).toString(), 'P31D');
  });

  test('NEGATIVE: relational operators throw; use compare', () => {
    const a = Temporal.PlainDate.from('2026-01-01');
    const b = Temporal.PlainDate.from('2026-02-01');
    assert.throws(() => /** @type {any} */ (a) < /** @type {any} */ (b), TypeError);
    assert.equal(Temporal.PlainDate.compare(a, b), -1);
  });

  test('immutability: with/add return new objects', () => {
    const d = Temporal.PlainDate.from('2026-05-01');
    const e = d.with({ day: 15 });
    assert.equal(d.toString(), '2026-05-01');
    assert.equal(e.toString(), '2026-05-15');
  });

  test('Instant ↔ ZonedDateTime ↔ Date interop', () => {
    const instant = Temporal.Instant.from('2026-03-29T00:00Z');
    assert.equal(instant.toZonedDateTimeISO('America/New_York').toString(), '2026-03-28T20:00:00-04:00[America/New_York]');
    const date = new Date(instant.epochMilliseconds);
    assert.equal(date.toTemporalInstant().equals(instant), true);
  });

  test('calendars other than ISO', () => {
    const hebrew = Temporal.PlainDate.from('2026-03-01').withCalendar('hebrew');
    assert.equal(hebrew.calendarId, 'hebrew');
    assert.equal(hebrew.toString(), '2026-03-01[u-ca=hebrew]');
  });

  test('property: add then subtract the same calendar duration from a ZonedDateTime round-trips at non-ambiguous times', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 364 }), fc.integer({ min: 0, max: 400 }), (offsetDays, days) => {
      const start = zoned('2026-01-01T12:00[Europe/Prague]').add({ days: offsetDays }); // noon: never in a gap or fold
      return start.add({ days }).subtract({ days }).equals(start);
    }));
  });

  test('property: hours-based addition always changes epochNanoseconds by exactly that amount', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 365 * 24 }), fc.integer({ min: -1000, max: 1000 }), (h0, h) => {
      const start = zoned('2026-01-01T00:00[Europe/Prague]').add({ hours: h0 });
      return start.add({ hours: h }).epochNanoseconds - start.epochNanoseconds === BigInt(h) * 3_600_000_000_000n;
    }));
  });
});
