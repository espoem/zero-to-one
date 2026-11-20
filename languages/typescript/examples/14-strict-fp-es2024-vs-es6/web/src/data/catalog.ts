import es2024CoreRaw from '../../../lib/es2024/core.ts?raw';
import es2024ArrayRaw from '../../../lib/es2024/array.ts?raw';
import es2024CollectionRaw from '../../../lib/es2024/collection.ts?raw';
import es2024FunctionRaw from '../../../lib/es2024/function.ts?raw';
import es2024ObjectRaw from '../../../lib/es2024/object.ts?raw';
import es2024StringRaw from '../../../lib/es2024/string.ts?raw';
import es2024MathLangRaw from '../../../lib/es2024/math-lang.ts?raw';

import es6CoreRaw from '../../../lib/es6/core.ts?raw';
import es6ArrayRaw from '../../../lib/es6/array.ts?raw';
import es6CollectionRaw from '../../../lib/es6/collection.ts?raw';
import es6FunctionRaw from '../../../lib/es6/function.ts?raw';
import es6ObjectRaw from '../../../lib/es6/object.ts?raw';
import es6StringRaw from '../../../lib/es6/string.ts?raw';
import es6MathLangRaw from '../../../lib/es6/math-lang.ts?raw';

export type ModuleKey =
  | 'core'
  | 'array'
  | 'collection'
  | 'function'
  | 'object'
  | 'string'
  | 'math-lang';

export type OriginKey = 'core' | 'underscore' | 'lodash' | 'ramda';

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly module: ModuleKey;
  readonly moduleLabel: string;
  readonly signature: string;
  readonly complexity: string;
  readonly origins: readonly OriginKey[];
  readonly aliases: {
    readonly underscore?: string;
    readonly lodash?: string;
    readonly ramda?: string;
  };
  readonly es2024Primitive: string;
  readonly es6Strategy: string;
  readonly safetyModel: string;
  readonly summary: string;
  readonly deltaNote: string;
  readonly symbols: readonly string[];
  readonly companionTypes?: Readonly<Record<string, readonly string[]>>;
  readonly example: string;
}

export interface ModuleSourcePair {
  readonly key: ModuleKey;
  readonly filename: string;
  readonly label: string;
  readonly es2024: string;
  readonly es6: string;
}

export const MODULE_META: readonly { readonly key: ModuleKey; readonly label: string }[] = [
  { key: 'core', label: 'Core ADTs & Equality' },
  { key: 'array', label: 'Array & List' },
  { key: 'collection', label: 'Collections & Transducers' },
  { key: 'function', label: 'Functions & FSMs' },
  { key: 'object', label: 'Objects, Paths & Lenses' },
  { key: 'string', label: 'Strings & Templates' },
  { key: 'math-lang', label: 'Math & Type Guards' },
];

export const MODULE_SOURCES: readonly ModuleSourcePair[] = [
  {
    key: 'core',
    filename: 'core.ts',
    label: 'Core ADTs & Equality',
    es2024: es2024CoreRaw,
    es6: es6CoreRaw,
  },
  {
    key: 'array',
    filename: 'array.ts',
    label: 'Array & List',
    es2024: es2024ArrayRaw,
    es6: es6ArrayRaw,
  },
  {
    key: 'collection',
    filename: 'collection.ts',
    label: 'Collections & Transducers',
    es2024: es2024CollectionRaw,
    es6: es6CollectionRaw,
  },
  {
    key: 'function',
    filename: 'function.ts',
    label: 'Functions & FSMs',
    es2024: es2024FunctionRaw,
    es6: es6FunctionRaw,
  },
  {
    key: 'object',
    filename: 'object.ts',
    label: 'Objects, Paths & Lenses',
    es2024: es2024ObjectRaw,
    es6: es6ObjectRaw,
  },
  {
    key: 'string',
    filename: 'string.ts',
    label: 'Strings & Templates',
    es2024: es2024StringRaw,
    es6: es6StringRaw,
  },
  {
    key: 'math-lang',
    filename: 'math-lang.ts',
    label: 'Math & Type Guards',
    es2024: es2024MathLangRaw,
    es6: es6MathLangRaw,
  },
];

export const API_CATALOG: readonly CatalogEntry[] = [
  {
    id: 'option-result',
    name: 'Option<T> / Result<T, E>',
    module: 'core',
    moduleLabel: 'Core ADTs & Equality',
    signature:
      'type Option<T> = { readonly tag: "some"; readonly value: T } | { readonly tag: "none" }',
    complexity: 'O(1)',
    origins: ['core'],
    aliases: {},
    es2024Primitive: 'Discriminated unions + assertNever + Object.freeze',
    es6Strategy: 'Identical ADT representation (compiles cleanly under ES2015)',
    safetyModel: 'Exhaustive ADT',
    summary:
      'Eliminates implicit null/undefined ambiguity and unchecked exceptions with frozen tagged unions.',
    deltaNote:
      'Algebraic data types are pure TypeScript design patterns: both ES2024 and ES6 share the same zero-overhead tagged-object layout, enforced statically by assertNever.',
    symbols: [
      'mapOption',
      'flatMapOption',
      'matchOption',
      'fromNullable',
      'tryResult',
      'matchResult',
      'assertNever',
    ],
    companionTypes: {
      mapOption: ['Option'],
      tryResult: ['Result'],
    },
    example: `matchOption(
  mapOption(fromNullable(21), (n) => n * 2),
  { some: (v) => ({ status: 'resolved', value: v }), none: () => ({ status: 'empty' }) }
)`,
  },
  {
    id: 'is-equal',
    name: 'isEqual / equals',
    module: 'core',
    moduleLabel: 'Core ADTs & Equality',
    signature: 'function isEqual(a: unknown, b: unknown): boolean',
    complexity: 'O(n)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: { underscore: '_.isEqual', lodash: '_.isEqual', ramda: 'R.equals' },
    es2024Primitive: 'Object.hasOwn + classifyValue + bijective Set/Map match',
    es6Strategy: 'Object.prototype.hasOwnProperty.call + WeakMap cycle guard',
    safetyModel: 'Cycle-safe & Bijective',
    summary:
      'Cycle-safe deep structural equality across NaN, Date, RegExp, TypedArray, DataView, Set, Map, and POJOs.',
    deltaNote:
      'ES2024 uses Object.hasOwn (ES2022) and includes BigInt64Array in TypedArray; ES6 uses Object.prototype.hasOwnProperty.call. Both fix the naive Set duplicate and Map object-key bugs.',
    symbols: ['isEqual', 'equals', 'classifyValue'],
    example: `({
  setDuplicateFixed: isEqual(new Set([{ x: 1 }, { x: 1 }]), new Set([{ x: 1 }, { x: 2 }])),
  mapObjectKeyFixed: isEqual(new Map([[{ id: 1 }, NaN]]), new Map([[{ id: 1 }, NaN]])),
})`,
  },
  {
    id: 'clone-deep',
    name: 'cloneDeep / clone',
    module: 'core',
    moduleLabel: 'Core ADTs & Equality',
    signature: 'function cloneDeep<T>(value: T): T',
    complexity: 'O(n)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: { underscore: '_.clone', lodash: '_.cloneDeep', ramda: 'R.clone' },
    es2024Primitive: 'TypedArray.prototype.slice() + descriptor preservation',
    es6Strategy: 'Explicit ArrayBuffer byte-copy loop + Object.assign descriptor copy',
    safetyModel: 'Cycle-safe Isolation',
    summary:
      'Deep structural clone preserving prototypes, property descriptors, symbols, RegExp.lastIndex, Maps, Sets, and circular references.',
    deltaNote:
      'ES2024 clones TypedArray/DataView slices succinctly with Uint8Array.slice() and object spread on descriptors; ES6 copies bytes explicitly into a fresh ArrayBuffer with Object.assign.',
    symbols: ['cloneDeep', 'clone'],
    example: `const re = /ab/g; re.lastIndex = 3;
const src = { nested: { n: 1 }, re, tags: new Set(['ts']) };
const copy = cloneDeep(src);
copy.nested.n = 99;
return { origN: src.nested.n, copyN: copy.nested.n, lastIndex: copy.re.lastIndex };`,
  },
  {
    id: 'group-by',
    name: 'groupBy / groupByMap',
    module: 'array',
    moduleLabel: 'Array & List',
    signature:
      'function groupBy<T, K extends PropertyKey>(array: readonly T[], keyFn: (item: T, i: number) => K): Partial<Record<K, T[]>>',
    complexity: 'O(n)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: { underscore: '_.groupBy', lodash: '_.groupBy', ramda: 'R.groupBy' },
    es2024Primitive: 'Object.groupBy / Map.groupBy (ES2024)',
    es6Strategy: 'Manual Map<K, T[]> bucket accumulator loop',
    safetyModel: 'Immutable Buckets',
    summary:
      'Partitions elements into keyed buckets using native ES2024 grouping or an ES6 Map loop.',
    deltaNote:
      'ES2024 introduced Object.groupBy (returning a null-prototype object) and Map.groupBy (allowing arbitrary object keys). In ES6 you write an explicit bucket-initialization loop.',
    symbols: ['groupBy', 'groupByMap', 'keyBy', 'countBy', 'partition'],
    companionTypes: {
      groupBy: ['groupByMap'],
    },
    example: `groupBy(
  [{ role: 'eng', name: 'Ada' }, { role: 'ops', name: 'Lin' }, { role: 'eng', name: 'Grace' }],
  (u) => u.role
)`,
  },
  {
    id: 'sort-by',
    name: 'sortBy / orderBy',
    module: 'array',
    moduleLabel: 'Array & List',
    signature:
      'function sortBy<T, K extends number | string>(array: readonly T[], keyFn: (item: T) => K): T[]',
    complexity: 'O(n log n)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: { underscore: '_.sortBy', lodash: '_.orderBy', ramda: 'R.sortBy' },
    es2024Primitive: 'Array.prototype.toSorted (ES2023) + Schwartzian transform',
    es6Strategy: 'Defensive slice()/map() copy + mutating Array.prototype.sort()',
    safetyModel: 'Pure & Stable',
    summary: 'Stable, non-mutating Schwartzian sort computing sort keys exactly once per element.',
    deltaNote:
      'ES2023 toSorted() guarantees non-mutation natively on readonly arrays. In ES6, Array.prototype.sort() mutates in place, so forgetting a defensive copy corrupts caller state.',
    symbols: ['sortBy', 'orderBy', 'shuffle', 'sample', 'sampleSize'],
    example: `orderBy(
  [{ name: 'b', prio: 2 }, { name: 'a', prio: 1 }, { name: 'c', prio: 1 }],
  [(x) => x.prio, (x) => x.name],
  ['asc', 'desc']
)`,
  },
  {
    id: 'immutable-array-edits',
    name: 'insert / remove / update / adjust / move / reverse',
    module: 'array',
    moduleLabel: 'Array & List',
    signature: 'function update<T>(index: number, value: T, array: readonly T[]): T[]',
    complexity: 'O(n)',
    origins: ['ramda'],
    aliases: { ramda: 'R.update / R.adjust / R.insert / R.remove / R.move' },
    es2024Primitive: 'toSpliced / .with() / toReversed (ES2023)',
    es6Strategy: 'slice() + spread / slice() + indexed write / slice().splice()',
    safetyModel: 'Pure Copy-on-Write',
    summary: 'Pure positional list edits that never mutate the source array.',
    deltaNote:
      'ES2023 change-array-by-copy methods (.with(), toSpliced(), toReversed()) replace the classic ES6 pattern of cloning with slice() before calling mutating splice()/reverse().',
    symbols: ['insert', 'remove', 'update', 'adjust', 'move', 'reverse'],
    example: `({
  inserted: insert(1, 99, [10, 20, 30]),
  updated: update(-1, 42, [10, 20, 30]),
  moved: move(0, 2, ['a', 'b', 'c']),
  reversed: reverse([1, 2, 3]),
})`,
  },
  {
    id: 'indexed-access-flatten',
    name: 'nth / head / last / flatten / toPairs / fromPairs',
    module: 'array',
    moduleLabel: 'Array & List',
    signature: 'function nthOption<T>(array: readonly T[], index: number): Option<T>',
    complexity: 'O(1) / O(n)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: {
      underscore: '_.first / _.pairs / _.object',
      lodash: '_.nth / _.flatten',
      ramda: 'R.nth / R.unnest / R.fromPairs',
    },
    es2024Primitive: '.at() (ES2022), .flat() (ES2019), Object.entries/fromEntries',
    es6Strategy: 'Manual negative index math, explicit loops, Object.keys iteration',
    safetyModel: 'Option<T> Variants',
    summary: 'Safe positional accessors and pair/nesting conversions with Option<T> variants.',
    deltaNote:
      'ES2022 .at(-1), ES2019 .flat() + Object.fromEntries(), and ES2017 Object.entries() eliminate boilerplate index arithmetic and Object.keys loops required under ES6.',
    symbols: [
      'nth',
      'last',
      'flatten',
      'flattenDeep',
      'flattenDepth',
      'fromPairs',
      'toPairs',
      'chunk',
      'compact',
    ],
    example: `({
  lastVal: lastOption([10, 20, 30]),
  emptyLast: lastOption([]),
  flat: flatten([[1, 2], [3], 4]),
  obj: fromPairs([['host', 'localhost'], ['port', 443]]),
})`,
  },
  {
    id: 'transducers-lazy',
    name: 'transduce / composeTransducers / lazy',
    module: 'collection',
    moduleLabel: 'Collections & Transducers',
    signature:
      'type Transducer<In, Out> = <Acc>(next: StepReducer<Acc, Out>) => StepReducer<Acc, In>',
    complexity: 'O(k) single-pass',
    origins: ['lodash', 'ramda'],
    aliases: { lodash: '_.chain', ramda: 'R.transduce / R.into' },
    es2024Primitive: 'Reduced<Acc> / StepResult<Acc> ADT + findLastIndex / includes',
    es6Strategy: 'Same transducer algebra + ES6 SameValueZero loop & reverse scan',
    safetyModel: 'Zero Intermediate Arrays',
    summary:
      'Single-pass fused pipelines with explicit short-circuiting and pull-based generator sequences.',
    deltaNote:
      'Transducer composition is runtime-agnostic across ES6 and ES2024; surrounding collection helpers differ (ES2023 findLastIndex & toSorted median vs ES6 reverse loop & slice().sort()).',
    symbols: [
      'transduce',
      'composeTransducers',
      'intoArray',
      'takeT',
      'findLast',
      'includes',
      'flatMap',
      'median',
      'LazySeq',
    ],
    example: `const xf = composeTransducers(
  filterT((n) => n % 2 === 0),
  mapT((n) => n * 10),
  takeT(4)
);
return {
  transduced: intoArray(xf, range(1, 50)),
  lazyFirst3: lazy(range(1, 50)).filter((n) => n % 3 === 0).take(3).toArray(),
  medianVal: median([10, 2, 8, 4]),
};`,
  },
  {
    id: 'debounce-throttle-fsm',
    name: 'debounce / throttle (FSM + Disposal)',
    module: 'function',
    moduleLabel: 'Functions & FSMs',
    signature:
      'function debounce<Args, R>(fn: (...args: Args) => R, waitMs: number, mode?: DebounceMode): DebouncedFunction<Args, R>',
    complexity: 'O(1)',
    origins: ['underscore', 'lodash'],
    aliases: { underscore: '_.debounce / _.throttle', lodash: '_.debounce / _.throttle' },
    es2024Primitive: '5-state Discriminated Union + DebounceMode + Symbol.dispose (`using`)',
    es6Strategy: 'Identical 5-state FSM + explicit dispose() & usingResource(res, fn)',
    safetyModel: 'Zero Leaked Timers',
    summary:
      'Explicit finite-state machines preventing impossible boolean flag combinations and leaked timers.',
    deltaNote:
      'ES2024 implements Disposable ([Symbol.dispose]) for automatic scope cleanup via `using d = debounce(...)`. ES6 models deterministic cleanup with `usingResource(res, fn)` over try/finally.',
    symbols: ['debounce', 'throttle', 'once', 'memoize', 'after', 'before'],
    companionTypes: {
      debounce: ['DebounceMode', 'DebounceState', 'usingResource'],
      throttle: ['ThrottleState', 'usingResource'],
      once: ['OnceState'],
    },
    example: `const seen = [];
const d = debounce((v) => { seen.push(v); return v.length; }, 500, { edge: 'both' });
const r1 = d('alpha');
const s1 = d.getState();
const r2 = d('beta');
const s2 = d.getState();
const flushed = d.flush();
d.dispose();
return { r1, s1, r2, s2, flushed, finalState: d.getState(), seen };`,
  },
  {
    id: 'pipe-curry-trampoline',
    name: 'pipe / compose / curry2 / trampoline',
    module: 'function',
    moduleLabel: 'Functions & FSMs',
    signature: 'function curry2<A, B, R>(fn: (a: A, b: B) => R): Curried2<A, B, R>',
    complexity: 'O(k) / O(1) stack',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: {
      underscore: '_.compose',
      lodash: '_.flow / _.curry',
      ramda: 'R.pipe / R.compose / R.curry / R.__',
    },
    es2024Primitive: 'fns.toReversed() in compose + Placeholder __ + Bounce ADT',
    es6Strategy: 'Manual reverse for-loop in compose + identical Placeholder & Bounce ADT',
    safetyModel: 'O(1) Call Stack',
    summary:
      'Type-preserving function pipelines, placeholder currying, and stack-safe tail-call trampolining.',
    deltaNote:
      'ES2024 compose delegates directly to pipe(...fns.toReversed()); ES6 iterates fns backward to avoid mutating the argument array.',
    symbols: ['compose', 'pipe', 'curry2', 'curryN', 'trampoline', 'condOption', 'allPass'],
    companionTypes: {
      curry2: ['Curried2'],
      trampoline: ['Bounce'],
    },
    example: `const div = curry2((a, b) => a / b);
const halve = div(__, 2);
const pipeline = pipe((n) => n + 6, halve, (n) => n * 10);
const sumDown = (n, acc) => (n <= 0 ? done(acc) : more(() => sumDown(n - 1, acc + n)));
return { piped: pipeline(14), trampolineSum10k: trampoline(sumDown(10000, 0)) };`,
  },
  {
    id: 'dot-path-lenses',
    name: 'DotPath<T> / getPath / Lens / assocPath',
    module: 'object',
    moduleLabel: 'Objects, Paths & Lenses',
    signature:
      'function getPath<T extends object, P extends DotPath<T>>(obj: T, path: P): Option<DotPathValue<T, P>>',
    complexity: 'O(depth)',
    origins: ['lodash', 'ramda'],
    aliases: { lodash: '_.get / _.set / _.unset', ramda: 'R.path / R.assocPath / R.lens / R.over' },
    es2024Primitive: 'Depth-bounded DotPath<T> + .with() in lensIndex + toSpliced + Object.hasOwn',
    es6Strategy: 'Identical DotPath<T> + slice() in lensIndex/dissocPath + hasOwn helper',
    safetyModel: 'Prototype-Pollution Guard',
    summary:
      'Statically checked dot paths, composable functional lenses, and structural-sharing immutable updates.',
    deltaNote:
      'Both editions constrain T extends object (fixing the Record<string, unknown> interface bug), cap DotPath recursion depth, and reject __proto__/constructor/prototype. ES2024 updates arrays via .with() and toSpliced().',
    symbols: [
      'lensIndex',
      'getPath',
      'assocPath',
      'dissocPath',
      'composeLens',
      'evolve',
      'mergeDeepRight',
      'pick',
      'values',
      'entries',
    ],
    companionTypes: {
      getPath: ['DotPath', 'DotPathValue'],
      lensIndex: ['Lens'],
      evolve: ['Evolver'],
    },
    example: `const profile = { user: { name: 'Ada' }, scores: [10, 20, 30] };
const score0 = composeLens(lensProp('scores'), lensIndex(0));
const updated = over(score0, (o) => mapOption(o, (n) => n + 5), profile);
return {
  readPath: getPath(profile, 'user.name'),
  originalScores: profile.scores,
  updatedScores: updated.scores,
};`,
  },
  {
    id: 'strings-templates',
    name: 'words / camelCase / padStart / trimStart / template',
    module: 'string',
    moduleLabel: 'Strings & Templates',
    signature:
      'function template(source: string, data: Readonly<Record<string, unknown>>, options?: { escape?: boolean }): string',
    complexity: 'O(n)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: {
      underscore: '_.escape / _.template',
      lodash: '_.camelCase / _.padStart / _.words',
      ramda: 'R.split / R.trim',
    },
    es2024Primitive:
      'Unicode \\p{Lu}/\\p{Ll}/\\p{Diacritic} + native padStart/trimStart + Object.hasOwn',
    es6Strategy: 'Latin regex + [\\u0300-\\u036f] + manual repeat/slice pad + ^\\s+ regex trim',
    safetyModel: 'Zero eval / Zero new Function',
    summary:
      'Unicode-aware word tokenization, case conversion, padding, trimming, and sandbox-safe template interpolation.',
    deltaNote:
      'ES2024 tokenizes non-Latin scripts (Greek/Cyrillic) via ES2018 Unicode property escapes and uses native padStart/trimStart. ES6 falls back to ASCII-after-NFD-deburr and manual repeat/regex helpers.',
    symbols: [
      'words',
      'deburr',
      'padStart',
      'padEnd',
      'pad',
      'trimStart',
      'trimEnd',
      'camelCase',
      'kebabCase',
      'template',
    ],
    example: `({
  kebab: kebabCase('XMLHttpRequest2'),
  czech: kebabCase('Příliš žluťoučký kůň'),
  unicodeWords: words('ΑλφαΒητα 42'),
  padded: padStart('7', 4, '0'),
  rendered: template('Hi {{user.name}} [{{toString}}]', { user: { name: '<b>Ada</b>' } }, { escape: true }),
})`,
  },
  {
    id: 'math-guards',
    name: 'round / clamp / mathMod / type guards',
    module: 'math-lang',
    moduleLabel: 'Math & Type Guards',
    signature: 'function round(n: number, precision?: number): number',
    complexity: 'O(1)',
    origins: ['underscore', 'lodash', 'ramda'],
    aliases: {
      underscore: '_.isFinite / _.isArray',
      lodash: '_.round / _.clamp / _.isPlainObject',
      ramda: 'R.mathMod / R.clamp / R.type',
    },
    es2024Primitive: '10 ** precision (ES2016) + BigInt guard + isSafeInteger/isError',
    es6Strategy: 'Math.pow(10, precision) (ES6) + number/string comparators',
    safetyModel: 'Narrowing Predicates (x is T)',
    summary:
      'Precision arithmetic, mathematical modulo, and strict TypeScript type-narrowing guards.',
    deltaNote:
      'Exponentiation (**) was standardized in ES2016 and bigint in ES2020. The ES6 profile uses Math.pow(10, precision) and omits bigint to stay strictly within lib: ["ES2015"].',
    symbols: [
      'round',
      'ceil',
      'floor',
      'mathMod',
      'clamp',
      'isPlainObject',
      'isTypedArray',
      'typeOf',
    ],
    example: `({
  rounded: round(1.005, 2),
  mathModNeg: mathMod(-1, 5),
  clamped: clamp(25, 0, 10),
  plainObj: isPlainObject({ a: 1 }),
  typeTag: typeOf(new Map()),
})`,
  },
];

export interface PlaygroundPreset {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly code: string;
}

export const PLAYGROUND_PRESETS: readonly PlaygroundPreset[] = [
  {
    id: 'adt-pipeline',
    label: 'Option & Result Pipeline',
    description: 'Parse JSON into Result<T, E>, guard invalid states, and fold exhaustively.',
    code: `const parsed = tryResult(() => JSON.parse('{"price": 120, "discount": 0.15}'));
const finalPrice = flatMapResult(parsed, (cfg) =>
  cfg.discount >= 0 && cfg.discount < 1
    ? ok(round(cfg.price * (1 - cfg.discount), 2))
    : err('Discount out of range')
);
return matchResult(finalPrice, {
  ok: (amount) => ({ status: 'quoted', amount }),
  err: (reason) => ({ status: 'rejected', reason }),
});`,
  },
  {
    id: 'fixed-equality',
    label: 'Fixed Set/Map & Cycle Equality',
    description:
      'Proves bijective Set matching, Map structural object-key lookup, and circular graphs.',
    code: `const cycA = { tag: 'node' }; cycA.self = cycA;
const cycB = { tag: 'node' }; cycB.self = cycB;
return {
  setBijectiveFix: isEqual(new Set([{ x: 1 }, { x: 1 }]), new Set([{ x: 1 }, { x: 2 }])),
  mapObjectKeysFix: isEqual(new Map([[{ id: 1 }, NaN]]), new Map([[{ id: 1 }, NaN]])),
  cyclicMatch: isEqual(cycA, cycB),
};`,
  },
  {
    id: 'transducer-fusion',
    label: 'Single-Pass Transducer Fusion',
    description: 'Composes filter + map + take over 1,000 items with zero intermediate arrays.',
    code: `let inspected = 0;
const xf = composeTransducers(
  filterT((n) => { inspected++; return n % 2 === 0; }),
  mapT((n) => n * n),
  takeT(5)
);
const result = intoArray(xf, range(1, 1000));
return { result, itemsInspected: inspected };`,
  },
  {
    id: 'lens-laws',
    label: 'Functional Lens Composition',
    description: 'Updates a nested array element immutably and verifies the GetPut / PutGet laws.',
    code: `const state = { team: 'Core', scores: [10, 20, 30] };
const secondScore = composeLens(lensProp('scores'), lensIndex(1));
const updated = over(secondScore, (opt) => mapOption(opt, (n) => n * 3), state);
return {
  original: state.scores,
  updated: updated.scores,
  getPutHolds: isEqual(setLens(secondScore, view(secondScore, state), state), state),
};`,
  },
  {
    id: 'unicode-delta',
    label: 'Intentional ES2024 vs ES6 Delta',
    description:
      'Highlights where ES2024 Unicode \\p{Lu}/\\p{Ll} differs from ES6 Latin-only regexes.',
    code: `return {
  latinDiacritics: kebabCase('Příliš žluťoučký kůň'),
  greekTokens: words('ΑλφαΒητα 42'),
  edition: EDITION,
};`,
  },
  {
    id: 'proto-guard',
    label: 'Prototype-Pollution Guard',
    description:
      'Verifies that unsafe keys (__proto__, constructor, prototype) are rejected safely.',
    code: `const attempt = tryResult(() => assocPath('__proto__.polluted', true, {}));
return matchResult(attempt, {
  ok: () => 'VULNERABLE',
  err: (e) => ({ blocked: true, message: e.message }),
});`,
  },
];
