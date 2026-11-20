import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as ES2024 from '#strata/es2024';
import * as ES2024Core from '#strata/es2024/core';
import * as ES2024Obj from '#strata/es2024/object';
import * as ES6 from '#strata/es6';
import * as ES6Core from '#strata/es6/core';
import * as ES6Fn from '#strata/es6/function';
import * as ES6Obj from '#strata/es6/object';

function runEditionSuite(label: string, lib: typeof ES6): void {
  describe(`14 · ${label} Core ADTs, Equality & Deep Cloning`, () => {
    it('satisfies Option functor and monad laws', () => {
      const f = (n: number): number => n + 3;
      const g = (n: number): number => n * 2;
      const mf = (n: number): ES2024Core.Option<number> => (n > 0 ? lib.some(n + 5) : lib.none());
      const mg = (n: number): ES2024Core.Option<number> => lib.some(n * 10);

      for (const opt of [lib.some(7), lib.some(0), lib.none()]) {
        assert.equal(lib.isEqual(lib.mapOption(opt, lib.identity), opt), true);
        assert.equal(
          lib.isEqual(
            lib.mapOption(lib.mapOption(opt, f), g),
            lib.mapOption(opt, (x) => g(f(x))),
          ),
          true,
        );
        assert.equal(lib.isEqual(lib.flatMapOption(opt, lib.some), opt), true);
        assert.equal(
          lib.isEqual(
            lib.flatMapOption(lib.flatMapOption(opt, mf), mg),
            lib.flatMapOption(opt, (x) => lib.flatMapOption(mf(x), mg)),
          ),
          true,
        );
      }
      assert.equal(lib.isEqual(lib.flatMapOption(lib.some(4), mf), mf(4)), true);
      assert.equal(
        lib.getOrElse(lib.fromNullable<number>(null), () => 99),
        99,
      );
      assert.equal(
        lib.matchOption(lib.fromNullable('ok'), { some: (v) => v.toUpperCase(), none: () => '' }),
        'OK',
      );
    });

    it('turns thrown errors into Result ADTs via tryResult', () => {
      const good = lib.tryResult(() => JSON.parse('{"x":10}') as { x: number });
      const bad = lib.tryResult(() => JSON.parse('{bad') as unknown);
      assert.equal(lib.isOk(good), true);
      assert.equal(lib.isErr(bad), true);
      const doubled = lib.mapResult(good, (d) => d.x * 2);
      assert.equal(lib.matchResult(doubled, { ok: (v) => v, err: () => -1 }), 20);
      const remapped = lib.mapError(bad, (e) => `ERR:${e.name}`);
      assert.equal(lib.matchResult(remapped, { ok: () => '', err: (e) => e }), 'ERR:SyntaxError');
    });

    it('fixes Set bijective matching and Map structural object-key bugs in isEqual', () => {
      const dupSet = new Set([{ x: 1 }, { x: 1 }]);
      const diffSet = new Set([{ x: 1 }, { x: 2 }]);
      assert.equal(lib.isEqual(dupSet, diffSet), false);
      assert.equal(lib.isEqual(diffSet, dupSet), false);
      assert.equal(lib.isEqual(new Set([{ x: 1 }, { x: 2 }]), new Set([{ x: 2 }, { x: 1 }])), true);

      const mapA = new Map([[{ id: 1 }, { score: Number.NaN }]]);
      const mapB = new Map([[{ id: 1 }, { score: Number.NaN }]]);
      const mapC = new Map([[{ id: 1 }, { score: 42 }]]);
      assert.equal(lib.isEqual(mapA, mapB), true);
      assert.equal(lib.isEqual(mapA, mapC), false);

      const cycA: { name: string; self?: unknown } = { name: 'node' };
      cycA.self = cycA;
      const cycB: { name: string; self?: unknown } = { name: 'node' };
      cycB.self = cycB;
      const cycC: { name: string; self?: unknown } = { name: 'other' };
      cycC.self = cycC;
      assert.equal(lib.isEqual(cycA, cycB), true);
      assert.equal(lib.isEqual(cycB, cycA), true);
      assert.equal(lib.isEqual(cycA, cycC), false);

      assert.equal(lib.isEqual(new Uint16Array([1, 2, 3]), new Uint16Array([1, 2, 3])), true);
      assert.equal(lib.isEqual(new Uint16Array([1, 2, 3]), new Int16Array([1, 2, 3])), false);
      const dvA = new DataView(new Uint8Array([9, 8]).buffer);
      const dvB = new DataView(new Uint8Array([9, 8]).buffer);
      assert.equal(lib.isEqual(dvA, dvB), true);
      assert.equal(lib.isEqual(Number.NaN, Number.NaN), true);
      assert.equal(lib.isEqual(+0, -0), true);
      assert.equal(lib.isEqual(new Date(1000), new Date(1000)), true);
      assert.equal(lib.isEqual(/abc/gi, /abc/gi), true);
      assert.equal(lib.equals(5)(5), true);
    });

    it('preserves isolation, cycles, descriptors, and RegExp.lastIndex in cloneDeep', () => {
      const re = /ab/g;
      re.lastIndex = 4;
      const source: {
        nested: { list: number[] };
        regex: RegExp;
        bytes: Uint8Array;
        self?: unknown;
      } = {
        nested: { list: [1, 2, 3] },
        regex: re,
        bytes: new Uint8Array([10, 20]),
      };
      source.self = source;

      const copy = lib.cloneDeep(source);
      assert.notEqual(copy, source);
      assert.equal(copy.self, copy);
      assert.equal(copy.regex.lastIndex, 4);
      copy.nested.list.push(99);
      copy.bytes[0] = 255;
      assert.deepEqual(source.nested.list, [1, 2, 3]);
      assert.equal(source.bytes[0], 10);
    });
  });

  describe(`14 · ${label} Functions, Combinators, FSMs & Trampoline`, () => {
    it('supports typed pipe, compose, curry2/curry with __, and combinators', () => {
      const transform = lib.pipe(
        (x: number) => x + 1,
        (x: number) => x * 3,
        (x: number) => `v=${x}`,
      );
      assert.equal(transform(4), 'v=15');

      const composed = lib.compose(
        (x: number) => `v=${x}`,
        (x: number) => x * 3,
        (x: number) => x + 1,
      );
      assert.equal(composed(4), 'v=15');

      const div = lib.curry2((a: number, b: number) => a / b);
      const halve = div(lib.__, 2);
      assert.equal(halve(10), 5);
      assert.equal(div(10)(2), 5);
      assert.equal(div(10, 2), 5);

      const sub3 = lib.curry((a: number, b: number, c: number) => a - b - c);
      const step1 = sub3(lib.__, 2, lib.__) as (...args: number[]) => unknown;
      assert.equal(step1(10, 3), 5);

      const inBounds = lib.allPass([(n: number) => n > 0, (n: number) => n < 10]);
      assert.equal(inBounds(5), true);
      assert.equal(inBounds(12), false);
      assert.equal(lib.complement(inBounds)(12), true);

      const classifyNum = lib.condOption<number, string>([
        [(n) => n < 0, () => 'neg'],
        [(n) => n === 0, () => 'zero'],
        [(n) => n > 0, () => 'pos'],
      ]);
      assert.deepEqual(classifyNum(7), lib.some('pos'));
    });

    it('runs once, after, before, bounded LRU memoize, and stack-safe trampoline', () => {
      let calls = 0;
      const initOnce = lib.once((x: number) => {
        calls++;
        return x * 2;
      });
      assert.equal(initOnce.getState().tag, 'uncalled');
      assert.equal(initOnce(5), 10);
      assert.equal(initOnce(99), 10);
      assert.equal(calls, 1);
      assert.equal(initOnce.getState().tag, 'called');

      const after3 = lib.after(3, (s: string) => s.toUpperCase());
      assert.equal(lib.isNone(after3('a')), true);
      assert.equal(lib.isNone(after3('b')), true);
      assert.deepEqual(after3('c'), lib.some('C'));

      const before3 = lib.before(3, (x: number) => x + 1);
      assert.deepEqual(before3(1), lib.some(2));
      assert.deepEqual(before3(2), lib.some(3));
      assert.deepEqual(before3(99), lib.some(3));

      let fibCalls = 0;
      const memo = lib.memoize(
        (x: number) => {
          fibCalls++;
          return x * x;
        },
        { maxSize: 2 },
      );
      assert.equal(memo(2), 4);
      assert.equal(memo(3), 9);
      assert.equal(memo(2), 4); // Refreshes key 2 as most-recently used
      assert.equal(memo(4), 16); // Evicts key 3
      assert.equal(lib.isNone(memo.getCached(3)), true);
      assert.deepEqual(memo.getCached(2), lib.some(4));
      assert.equal(fibCalls, 3);

      const sumDown = (n: number, acc: number): ES2024.Bounce<number> =>
        n <= 0 ? lib.done(acc) : lib.more(() => sumDown(n - 1, acc + n));
      assert.equal(lib.trampoline(sumDown(50_000, 0)), 1_250_025_000);
    });

    it('enforces explicit debounce/throttle FSM states and deterministic disposal', () => {
      const seen: string[] = [];
      const d = lib.debounce(
        (v: string) => {
          seen.push(v);
          return v.length;
        },
        500,
        { edge: 'both' },
      );
      assert.equal(d.getState(), 'idle');
      assert.deepEqual(d('first'), lib.some(5));
      assert.equal(d.getState(), 'coolingLeading');
      assert.equal(lib.isNone(d('second')), true);
      assert.equal(d.getState(), 'coolingWithPending');
      assert.deepEqual(d.flush(), lib.some(6));
      assert.equal(d.getState(), 'idle');
      assert.deepEqual(seen, ['first', 'second']);

      d('third');
      d.dispose();
      assert.equal(d.getState(), 'disposed');
      assert.equal(lib.isNone(d('ignored')), true);

      const tSeen: number[] = [];
      const th = lib.throttle((n: number) => {
        tSeen.push(n);
        return n * 2;
      }, 500);
      assert.deepEqual(th(1), lib.some(2));
      assert.equal(th.getState(), 'cooling');
      assert.equal(lib.isNone(th(2)), true);
      assert.equal(th.getState(), 'coolingWithQueued');
      th.dispose();
      assert.equal(th.getState(), 'disposed');
      assert.deepEqual(tSeen, [1]);
    });
  });

  describe(`14 · ${label} Arrays, Collections, Transducers & LazySeq`, () => {
    it('maintains immutability and behavioral parity on array operations', () => {
      const src = [3, 1, 2, 1];
      assert.deepEqual(
        lib.sortBy(src, (n) => n),
        [1, 1, 2, 3],
      );
      assert.deepEqual(src, [3, 1, 2, 1]);
      assert.deepEqual(lib.reverse(src), [1, 2, 1, 3]);
      assert.deepEqual(lib.insert(1, 9, [10, 20]), [10, 9, 20]);
      assert.deepEqual(lib.remove(1, 2, [10, 20, 30, 40]), [10, 40]);
      assert.deepEqual(lib.update(1, 99, [10, 20, 30]), [10, 99, 30]);
      assert.deepEqual(
        lib.adjust(-1, (x) => x * 10, [1, 2, 3]),
        [1, 2, 30],
      );
      assert.deepEqual(lib.move(0, 2, ['a', 'b', 'c']), ['b', 'c', 'a']);
      assert.deepEqual(lib.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
      assert.deepEqual(lib.compact([0, 'a', false, '', null, 7, undefined]), ['a', 7]);
      assert.deepEqual(lib.flattenDeep([1, [2, [3, [4]]]]), [1, 2, 3, 4]);
      assert.deepEqual(
        lib.groupBy(['ant', 'ape', 'bear'], (w) => w[0]!),
        {
          a: ['ant', 'ape'],
          b: ['bear'],
        },
      );
      const groupedMap = lib.groupByMap([1, 2, 3, 4], (n) => (n % 2 === 0 ? 'even' : 'odd'));
      assert.deepEqual(groupedMap.get('even'), [2, 4]);
      assert.deepEqual(lib.toPairs({ a: 1, b: 2 }), [
        ['a', 1],
        ['b', 2],
      ]);
      assert.deepEqual(
        lib.fromPairs([
          ['a', 1],
          ['b', 2],
        ]),
        { a: 1, b: 2 },
      );
      assert.deepEqual(lib.aperture(2, [1, 2, 3, 4]), [
        [1, 2],
        [2, 3],
        [3, 4],
      ]);
      assert.deepEqual(
        lib.scan((a, b) => a + b, 0, [1, 2, 3]),
        [0, 1, 3, 6],
      );
    });

    it('proves transducer fusion matches eager pipelines and short-circuits lazily', () => {
      let visits = 0;
      const input = lib.range(1, 100);
      const xf = lib.composeTransducers(
        lib.filterT((n: number) => {
          visits++;
          return n % 2 === 0;
        }),
        lib.mapT((n: number) => n * n),
        lib.takeT<number>(4),
      );
      const fused = lib.intoArray(xf, input);
      const eager = input
        .filter((n) => n % 2 === 0)
        .map((n) => n * n)
        .slice(0, 4);
      assert.deepEqual(fused, eager);
      assert.equal(visits, 8);

      const adtRes = lib.transduceAdt<number, number, number[]>(
        (next) => (acc, n) => (n > 3 ? lib.doneStep(acc) : next(acc, n * 10)),
        (acc, v) => {
          acc.push(v);
          return lib.cont(acc);
        },
        [],
        [1, 2, 3, 4, 5],
      );
      assert.deepEqual(adtRes, [10, 20, 30]);

      let lazyVisits = 0;
      const lazyOut = lib
        .lazy(input)
        .filter((n) => {
          lazyVisits++;
          return n % 3 === 0;
        })
        .map((n) => n + 1)
        .take(3)
        .toArray();
      assert.deepEqual(lazyOut, [4, 7, 10]);
      assert.equal(lazyVisits, 9);

      assert.equal(lib.includes([1, Number.NaN, 3], Number.NaN), true);
      assert.deepEqual(
        lib.findLast([1, 2, 3, 4], (n) => n % 2 === 0),
        lib.some(4),
      );
      assert.equal(lib.isNone(lib.mean([])), true);
      assert.deepEqual(lib.median([10, 2, 8, 4]), lib.some(6));
    });
  });

  describe(`14 · ${label} Objects, Prototype-Pollution Guard, Lenses & Strings`, () => {
    it('enforces prototype pollution rejection and structural sharing', () => {
      const base = { user: { name: 'Ada', role: 'eng' }, meta: { active: true } };
      assert.deepEqual(lib.getPath(base, 'user.name'), lib.some('Ada'));
      const updated = lib.assocPath('user.role', 'staff', base);
      assert.equal(updated.user.role, 'staff');
      assert.equal(base.user.role, 'eng');
      assert.equal(updated.meta, base.meta); // Unmodified branch structurally shared

      assert.throws(() => lib.assocPath('__proto__.polluted', true, {}), /Unsafe property key/);
      assert.throws(
        () =>
          lib.mergeDeepRight({}, JSON.parse('{"__proto__":{"p":1}}') as Record<string, unknown>),
        /Unsafe property key/,
      );
      assert.throws(
        () => lib.assocPath(['constructor', 'prototype', 'x'], 1, {}),
        /Unsafe property key/,
      );

      const evolved = lib.evolve({ user: { name: (s: string) => s.toUpperCase() } }, base);
      assert.equal(evolved.user.name, 'ADA');
      assert.equal(base.user.name, 'Ada');
    });

    it('satisfies the three Lens laws (GetPut, PutGet, PutPut) on prop, index, and composed lenses', () => {
      interface Profile {
        readonly name: string;
        readonly scores: readonly number[];
      }
      const scoresLens = lib.lensProp<Profile, 'scores'>('scores');
      const firstScoreLens = lib.lensIndex<number>(0);
      const composed = lib.composeLens(scoresLens, firstScoreLens);

      const sample: Profile = { name: 'Grace', scores: [10, 20, 30] };

      assert.equal(
        lib.isEqual(lib.setLens(scoresLens, lib.view(scoresLens, sample), sample), sample),
        true,
      );
      assert.equal(
        lib.isEqual(lib.setLens(composed, lib.view(composed, sample), sample), sample),
        true,
      );

      const nextOpt = lib.some(99);
      assert.equal(
        lib.isEqual(lib.view(composed, lib.setLens(composed, nextOpt, sample)), nextOpt),
        true,
      );

      const optA = lib.some(42);
      const optB = lib.some(77);
      assert.equal(
        lib.isEqual(
          lib.setLens(composed, optB, lib.setLens(composed, optA, sample)),
          lib.setLens(composed, optB, sample),
        ),
        true,
      );

      const bumped = lib.over(composed, (o) => lib.mapOption(o, (n) => n + 5), sample);
      assert.deepEqual(bumped.scores, [15, 20, 30]);
      assert.deepEqual(sample.scores, [10, 20, 30]);
    });

    it('formats strings, pads/trims, and renders safe AST templates without prototype traversal', () => {
      assert.equal(lib.camelCase('Crème brûlée_API-v2'), 'cremeBruleeApiV2');
      assert.equal(lib.kebabCase('XMLHttpRequest2'), 'xml-http-request-2');
      assert.equal(lib.snakeCase('helloWorldTest'), 'hello_world_test');
      assert.equal(lib.pascalCase('strict_fp_lib'), 'StrictFpLib');
      assert.equal(lib.padStart('7', 4, '0'), '0007');
      assert.equal(lib.padEnd('hi', 5, '.'), 'hi...');
      assert.equal(lib.pad('ok', 6, '-'), '--ok--');
      assert.equal(lib.trimStart('   abc'), 'abc');
      assert.equal(lib.trimEnd('abc   '), 'abc');
      assert.equal(
        lib.escapeHtml('<script>"x"</script>'),
        '&lt;script&gt;&quot;x&quot;&lt;/script&gt;',
      );
      assert.equal(lib.unescapeHtml('&lt;a&gt;&amp;&#39;b&#39;'), "<a>&'b'");

      const rendered = lib.template(
        'Hello {{user.name}} (<%= role %>) [{{toString}}]',
        { user: { name: '<b>Ada</b>' }, role: 'admin' },
        { escape: true },
      );
      assert.equal(rendered, 'Hello &lt;b&gt;Ada&lt;/b&gt; (admin) []');

      assert.equal(lib.round(1.005, 2), 1.01);
      assert.equal(lib.mathMod(-1, 5), 4);
      assert.equal(lib.clamp(15, 0, 10), 10);
      assert.equal(lib.isSafeInteger(42), true);
      assert.equal(lib.isError(new TypeError('boom')), true);
    });
  });
}

describe('14 · Strict FP Internal Library — Subpath Imports & Facade Parity', () => {
  it('resolves internal #strata/es2024 and #strata/es6 subpath imports natively', () => {
    assert.equal(ES2024.EDITION, 'es2024');
    assert.equal(ES6.EDITION, 'es6');
    assert.equal(ES2024Core.some(42).value, 42);
    assert.equal(ES6Core.some(42).value, 42);
    assert.equal(typeof ES2024Obj.lensProp, 'function');
    assert.equal(typeof ES6Obj.lensProp, 'function');
  });

  it('exposes identical facade keys across Underscore, Lodash, and Ramda in both editions', () => {
    assert.deepEqual(Object.keys(ES2024.underscore).sort(), Object.keys(ES6.underscore).sort());
    assert.deepEqual(Object.keys(ES2024.lodash).sort(), Object.keys(ES6.lodash).sort());
    assert.deepEqual(Object.keys(ES2024.R).sort(), Object.keys(ES6.R).sort());
    assert.ok(Object.isFrozen(ES2024.strata));
    assert.ok(Object.isFrozen(ES6.strata));
    assert.ok(Object.isFrozen(ES2024.R));
    assert.ok(Object.isFrozen(ES6.R));
  });

  it('enforces pure ES2015 syntax/APIs inside lib/es6 source files', () => {
    const es6Dir = new URL('./lib/es6/', import.meta.url);
    const forbidden: readonly RegExp[] = [
      /\bObject\.hasOwn\b/,
      /\bObject\.groupBy\b/,
      /\bMap\.groupBy\b/,
      /\bObject\.entries\b/,
      /\bObject\.values\b/,
      /\bObject\.fromEntries\b/,
      /\.toSorted\(/,
      /\.toReversed\(/,
      /\.toSpliced\(/,
      /\.with\(/,
      /\.findLastIndex\(/,
      /\.padStart\(/,
      /\.padEnd\(/,
      /\.trimStart\(/,
      /\.trimEnd\(/,
      /Symbol\.dispose/,
      /\\p\{/,
      /\d+\s*\*\*\s*\w+/,
    ];
    for (const file of readdirSync(es6Dir)) {
      if (!file.endsWith('.ts')) continue;
      const content = readFileSync(new URL(file, es6Dir), 'utf8');
      const codeOnly = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      for (const pattern of forbidden) {
        assert.equal(
          pattern.test(codeOnly),
          false,
          `ES6 file ${file} must not use post-ES2015 construct matching ${pattern}`,
        );
      }
    }
  });
});

runEditionSuite('ES2024', ES2024 as unknown as typeof ES6);
runEditionSuite('ES6', ES6);

describe('14 · Intentional ES2024 vs ES6 Teaching Deltas', () => {
  it('demonstrates ES2024 `using` / Symbol.dispose vs ES6 `usingResource` try/finally cleanup', () => {
    let es2024Ref: ES2024.DebouncedFunction<[string], number> | undefined;
    {
      using d = ES2024.debounce((s: string) => s.length, 500);
      es2024Ref = d;
      d('pending');
      assert.equal(d.getState(), 'waitingTrailing');
    }
    assert.equal(es2024Ref.getState(), 'disposed');

    let es6Ref: ES6Fn.DebouncedFunction<[string], number> | undefined;
    ES6Fn.usingResource(
      ES6Fn.debounce((s: string) => s.length, 500),
      (d) => {
        es6Ref = d;
        d('pending');
        assert.equal(d.getState(), 'waitingTrailing');
      },
    );
    assert.equal(es6Ref?.getState(), 'disposed');
  });

  it('demonstrates ES2024 Unicode property escapes vs ES6 Latin-only regex tokenization', () => {
    // Non-Latin scripts (Greek/Cyrillic) are tokenized natively by ES2024 \p{Lu}/\p{Ll}
    // whereas ES6 ASCII-after-NFD-deburr cannot match non-Latin Unicode letters.
    assert.deepEqual(ES2024.words('ΑλφαΒητα 42'), ['Αλφα', 'Βητα', '42']);
    assert.deepEqual(ES6.words('ΑλφαΒητα 42'), ['42']);
    // Both editions agree identically on Latin scripts with diacritics after NFD deburr:
    assert.equal(ES2024.kebabCase('Příliš žluťoučký kůň'), ES6.kebabCase('Příliš žluťoučký kůň'));
  });
});
