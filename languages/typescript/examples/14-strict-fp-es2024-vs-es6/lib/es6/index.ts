export * from './core.ts';
export * from './array.ts';
export * from './collection.ts';
export * from './function.ts';
export * from './object.ts';
export * from './string.ts';
export * from './math-lang.ts';

import * as Core from './core.ts';
import * as Arr from './array.ts';
import * as Coll from './collection.ts';
import * as Fn from './function.ts';
import * as Obj from './object.ts';
import * as Str from './string.ts';
import * as MathLang from './math-lang.ts';

export const EDITION = 'es6' as const;

export const strata: Readonly<
  typeof Core & typeof Arr & typeof Coll & typeof Fn & typeof Obj & typeof Str & typeof MathLang
> = Object.freeze(Object.assign({}, Core, Arr, Coll, Fn, Obj, Str, MathLang));

export interface UnderscoreFacade {
  readonly each: typeof Coll.map;
  readonly map: typeof Coll.map;
  readonly reduce: typeof Coll.reduce;
  readonly reduceRight: typeof Coll.reduceRight;
  readonly find: typeof Coll.find;
  readonly filter: typeof Coll.filter;
  readonly reject: typeof Coll.reject;
  readonly every: typeof Coll.every;
  readonly all: typeof Coll.all;
  readonly some: typeof Coll.someMatch;
  readonly any: typeof Coll.any;
  readonly contains: typeof Coll.contains;
  readonly pluck: typeof Arr.pluck;
  readonly max: typeof Coll.max;
  readonly min: typeof Coll.min;
  readonly sortBy: typeof Arr.sortBy;
  readonly groupBy: typeof Arr.groupBy;
  readonly indexBy: typeof Arr.indexBy;
  readonly countBy: typeof Arr.countBy;
  readonly shuffle: typeof Arr.shuffle;
  readonly sample: typeof Arr.sample;
  readonly size: typeof Coll.size;
  readonly partition: typeof Arr.partition;
  readonly first: typeof Arr.first;
  readonly initial: typeof Arr.initial;
  readonly last: typeof Arr.last;
  readonly rest: typeof Arr.rest;
  readonly compact: typeof Arr.compact;
  readonly flatten: typeof Arr.flattenDeep;
  readonly without: typeof Arr.without;
  readonly union: typeof Arr.union;
  readonly intersection: typeof Arr.intersection;
  readonly difference: typeof Arr.difference;
  readonly uniq: typeof Arr.uniq;
  readonly zip: typeof Arr.zip;
  readonly unzip: typeof Arr.unzip;
  readonly object: typeof Arr.fromPairs;
  readonly range: typeof Arr.range;
  readonly partial: typeof Fn.partial;
  readonly memoize: typeof Fn.memoize;
  readonly debounce: typeof Fn.debounce;
  readonly throttle: typeof Fn.throttle;
  readonly once: typeof Fn.once;
  readonly after: typeof Fn.after;
  readonly before: typeof Fn.before;
  readonly negate: typeof Fn.negate;
  readonly compose: typeof Fn.compose;
  readonly keys: typeof Obj.keys;
  readonly values: typeof Obj.values;
  readonly pairs: typeof Arr.toPairs;
  readonly invert: typeof Obj.invert;
  readonly extend: typeof Obj.extend;
  readonly pick: typeof Obj.pick;
  readonly omit: typeof Obj.omit;
  readonly defaults: typeof Obj.defaults;
  readonly clone: typeof Core.clone;
  readonly tap: typeof Fn.tap;
  readonly has: typeof Obj.has;
  readonly isEqual: typeof Core.isEqual;
  readonly isEmpty: typeof Coll.isEmpty;
  readonly isArray: typeof MathLang.isArray;
  readonly isFunction: typeof MathLang.isFunction;
  readonly isString: typeof MathLang.isString;
  readonly isNumber: typeof MathLang.isNumber;
  readonly isFinite: typeof MathLang.isFiniteNum;
  readonly isBoolean: typeof MathLang.isBoolean;
  readonly isDate: typeof MathLang.isDate;
  readonly isRegExp: typeof MathLang.isRegExp;
  readonly isNull: typeof MathLang.isNull;
  readonly isUndefined: typeof MathLang.isUndefined;
  readonly identity: typeof Fn.identity;
  readonly constant: typeof Fn.constant;
  readonly noop: typeof Fn.noop;
  readonly times: typeof Arr.times;
  readonly escape: typeof Str.escapeHtml;
  readonly unescape: typeof Str.unescapeHtml;
  readonly template: typeof Str.template;
}

export interface LodashFacade extends Omit<UnderscoreFacade, 'flatten'> {
  readonly chunk: typeof Arr.chunk;
  readonly concat: typeof Arr.concat;
  readonly differenceBy: typeof Arr.differenceBy;
  readonly differenceWith: typeof Arr.differenceWith;
  readonly drop: typeof Arr.drop;
  readonly dropRight: typeof Arr.dropRight;
  readonly dropWhile: typeof Arr.dropWhile;
  readonly dropRightWhile: typeof Arr.dropRightWhile;
  readonly take: typeof Arr.take;
  readonly takeRight: typeof Arr.takeRight;
  readonly takeWhile: typeof Arr.takeWhile;
  readonly takeRightWhile: typeof Arr.takeRightWhile;
  readonly head: typeof Arr.head;
  readonly tail: typeof Arr.tail;
  readonly nth: typeof Arr.nth;
  readonly flatten: typeof Arr.flatten;
  readonly flattenDeep: typeof Arr.flattenDeep;
  readonly flattenDepth: typeof Arr.flattenDepth;
  readonly fromPairs: typeof Arr.fromPairs;
  readonly toPairs: typeof Arr.toPairs;
  readonly intersectionBy: typeof Arr.intersectionBy;
  readonly unionBy: typeof Arr.unionBy;
  readonly uniqBy: typeof Arr.uniqBy;
  readonly uniqWith: typeof Arr.uniqWith;
  readonly xor: typeof Arr.xor;
  readonly zipObject: typeof Arr.zipObject;
  readonly zipWith: typeof Arr.zipWith;
  readonly keyBy: typeof Arr.keyBy;
  readonly orderBy: typeof Arr.orderBy;
  readonly sampleSize: typeof Arr.sampleSize;
  readonly flatMap: typeof Coll.flatMap;
  readonly findLast: typeof Coll.findLast;
  readonly includes: typeof Coll.includes;
  readonly sum: typeof Coll.sum;
  readonly sumBy: typeof Coll.sumBy;
  readonly mean: typeof Coll.mean;
  readonly meanBy: typeof Coll.meanBy;
  readonly minBy: typeof Coll.minBy;
  readonly maxBy: typeof Coll.maxBy;
  readonly flow: typeof Fn.flow;
  readonly flowRight: typeof Fn.flowRight;
  readonly curry: typeof Fn.curry;
  readonly curry2: typeof Fn.curry2;
  readonly partialRight: typeof Fn.partialRight;
  readonly flip: typeof Fn.flip;
  readonly unary: typeof Fn.unary;
  readonly overArgs: typeof Fn.overArgs;
  readonly assign: typeof Obj.assign;
  readonly defaultsDeep: typeof Obj.defaultsDeep;
  readonly merge: typeof Obj.merge;
  readonly mergeWith: typeof Obj.mergeWith;
  readonly pickBy: typeof Obj.pickBy;
  readonly omitBy: typeof Obj.omitBy;
  readonly get: typeof Obj.get;
  readonly getPath: typeof Obj.getPath;
  readonly set: typeof Obj.set;
  readonly unset: typeof Obj.unset;
  readonly update: typeof Obj.updatePath;
  readonly mapValues: typeof Obj.mapValues;
  readonly mapKeys: typeof Obj.mapKeys;
  readonly invertBy: typeof Obj.invertBy;
  readonly cloneDeep: typeof Core.cloneDeep;
  readonly isPlainObject: typeof MathLang.isPlainObject;
  readonly isNil: typeof MathLang.isNil;
  readonly isMap: typeof MathLang.isMap;
  readonly isSet: typeof MathLang.isSet;
  readonly isTypedArray: typeof MathLang.isTypedArray;
  readonly isSafeInteger: typeof MathLang.isSafeInteger;
  readonly isError: typeof MathLang.isError;
  readonly castArray: typeof MathLang.castArray;
  readonly clamp: typeof MathLang.clamp;
  readonly inRange: typeof MathLang.inRange;
  readonly round: typeof MathLang.round;
  readonly ceil: typeof MathLang.ceil;
  readonly floor: typeof MathLang.floor;
  readonly camelCase: typeof Str.camelCase;
  readonly pascalCase: typeof Str.pascalCase;
  readonly kebabCase: typeof Str.kebabCase;
  readonly snakeCase: typeof Str.snakeCase;
  readonly startCase: typeof Str.startCase;
  readonly capitalize: typeof Str.capitalize;
  readonly upperFirst: typeof Str.upperFirst;
  readonly lowerFirst: typeof Str.lowerFirst;
  readonly deburr: typeof Str.deburr;
  readonly words: typeof Str.words;
  readonly truncate: typeof Str.truncate;
  readonly pad: typeof Str.pad;
  readonly padStart: typeof Str.padStart;
  readonly padEnd: typeof Str.padEnd;
  readonly trim: typeof Str.trim;
  readonly trimStart: typeof Str.trimStart;
  readonly trimEnd: typeof Str.trimEnd;
  readonly repeat: typeof Str.repeat;
  readonly escapeRegExp: typeof Str.escapeRegExp;
  readonly chain: typeof Coll.lazy;
}

export interface RamdaFacade {
  readonly __: typeof Core.__;
  readonly equals: typeof Core.equals;
  readonly clone: typeof Core.cloneDeep;
  readonly reduced: typeof Core.reduced;
  readonly identity: typeof Fn.identity;
  readonly always: typeof Fn.always;
  readonly T: typeof Fn.T;
  readonly F: typeof Fn.F;
  readonly pipe: typeof Fn.pipe;
  readonly compose: typeof Fn.compose;
  readonly curry: typeof Fn.curry;
  readonly curry2: typeof Fn.curry2;
  readonly curryN: typeof Fn.curryN;
  readonly partial: typeof Fn.partial;
  readonly partialRight: typeof Fn.partialRight;
  readonly flip: typeof Fn.flip;
  readonly unary: typeof Fn.unary;
  readonly binary: typeof Fn.binary;
  readonly nAry: typeof Fn.nAry;
  readonly complement: typeof Fn.complement;
  readonly both: typeof Fn.both;
  readonly either: typeof Fn.either;
  readonly allPass: typeof Fn.allPass;
  readonly anyPass: typeof Fn.anyPass;
  readonly cond: typeof Fn.cond;
  readonly condOption: typeof Fn.condOption;
  readonly ifElse: typeof Fn.ifElse;
  readonly when: typeof Fn.when;
  readonly unless: typeof Fn.unless;
  readonly converge: typeof Fn.converge;
  readonly useWith: typeof Fn.useWith;
  readonly juxt: typeof Fn.juxt;
  readonly ap: typeof Fn.ap;
  readonly tap: typeof Fn.tap;
  readonly once: typeof Fn.once;
  readonly memoizeWith: typeof Fn.memoize;
  readonly head: typeof Arr.head;
  readonly last: typeof Arr.last;
  readonly tail: typeof Arr.tail;
  readonly init: typeof Arr.init;
  readonly nth: typeof Arr.nth;
  readonly reverse: typeof Arr.reverse;
  readonly take: typeof Arr.take;
  readonly takeLast: typeof Arr.takeRight;
  readonly takeWhile: typeof Arr.takeWhile;
  readonly drop: typeof Arr.drop;
  readonly dropLast: typeof Arr.dropRight;
  readonly dropWhile: typeof Arr.dropWhile;
  readonly unnest: typeof Arr.unnest;
  readonly flatten: typeof Arr.flattenDeep;
  readonly aperture: typeof Arr.aperture;
  readonly splitAt: typeof Arr.splitAt;
  readonly splitEvery: typeof Arr.splitEvery;
  readonly splitWhen: typeof Arr.splitWhen;
  readonly intersperse: typeof Arr.intersperse;
  readonly insert: typeof Arr.insert;
  readonly remove: typeof Arr.remove;
  readonly update: typeof Arr.update;
  readonly adjust: typeof Arr.adjust;
  readonly move: typeof Arr.move;
  readonly append: typeof Arr.append;
  readonly prepend: typeof Arr.prepend;
  readonly xprod: typeof Arr.xprod;
  readonly transpose: typeof Arr.transpose;
  readonly scan: typeof Arr.scan;
  readonly mapAccum: typeof Arr.mapAccum;
  readonly pluck: typeof Arr.pluck;
  readonly partition: typeof Arr.partition;
  readonly groupBy: typeof Arr.groupBy;
  readonly indexBy: typeof Arr.indexBy;
  readonly countBy: typeof Arr.countBy;
  readonly sortBy: typeof Arr.sortBy;
  readonly symmetricDifference: typeof Arr.xor;
  readonly difference: typeof Arr.difference;
  readonly intersection: typeof Arr.intersection;
  readonly union: typeof Arr.union;
  readonly uniq: typeof Arr.uniq;
  readonly uniqBy: typeof Arr.uniqBy;
  readonly uniqWith: typeof Arr.uniqWith;
  readonly zip: typeof Arr.zip;
  readonly zipObj: typeof Arr.zipObject;
  readonly zipWith: typeof Arr.zipWith;
  readonly fromPairs: typeof Arr.fromPairs;
  readonly toPairs: typeof Arr.toPairs;
  readonly range: typeof Arr.range;
  readonly times: typeof Arr.times;
  readonly map: typeof Coll.map;
  readonly filter: typeof Coll.filter;
  readonly reject: typeof Coll.reject;
  readonly reduce: typeof Coll.reduce;
  readonly reduceRight: typeof Coll.reduceRight;
  readonly chain: typeof Coll.chain;
  readonly find: typeof Coll.find;
  readonly findLast: typeof Coll.findLast;
  readonly all: typeof Coll.all;
  readonly any: typeof Coll.any;
  readonly none: typeof Coll.noneMatch;
  readonly includes: typeof Coll.includes;
  readonly isEmpty: typeof Coll.isEmpty;
  readonly sum: typeof Coll.sum;
  readonly product: typeof Coll.product;
  readonly mean: typeof Coll.mean;
  readonly median: typeof Coll.median;
  readonly transduce: typeof Coll.transduce;
  readonly intoArray: typeof Coll.intoArray;
  readonly keys: typeof Obj.keys;
  readonly values: typeof Obj.values;
  readonly pick: typeof Obj.pick;
  readonly pickBy: typeof Obj.pickBy;
  readonly omit: typeof Obj.omit;
  readonly path: typeof Obj.path;
  readonly pathOr: typeof Obj.pathOr;
  readonly hasPath: typeof Obj.hasPath;
  readonly assoc: typeof Obj.assoc;
  readonly assocPath: typeof Obj.assocPath;
  readonly dissoc: typeof Obj.dissoc;
  readonly dissocPath: typeof Obj.dissocPath;
  readonly modifyPath: typeof Obj.modifyPath;
  readonly mapObjIndexed: typeof Obj.mapObjIndexed;
  readonly mergeDeepRight: typeof Obj.mergeDeepRight;
  readonly mergeDeepLeft: typeof Obj.mergeDeepLeft;
  readonly mergeWith: typeof Obj.mergeWith;
  readonly prop: typeof Obj.prop;
  readonly propOr: typeof Obj.propOr;
  readonly props: typeof Obj.props;
  readonly propEq: typeof Obj.propEq;
  readonly pathEq: typeof Obj.pathEq;
  readonly where: typeof Obj.where;
  readonly whereEq: typeof Obj.whereEq;
  readonly project: typeof Obj.project;
  readonly evolve: typeof Obj.evolve;
  readonly lens: typeof Obj.lens;
  readonly lensProp: typeof Obj.lensProp;
  readonly lensPath: typeof Obj.lensPath;
  readonly lensIndex: typeof Obj.lensIndex;
  readonly composeLens: typeof Obj.composeLens;
  readonly view: typeof Obj.view;
  readonly set: typeof Obj.setLens;
  readonly over: typeof Obj.over;
  readonly add: typeof MathLang.add;
  readonly subtract: typeof MathLang.subtract;
  readonly multiply: typeof MathLang.multiply;
  readonly divide: typeof MathLang.divide;
  readonly modulo: typeof MathLang.modulo;
  readonly mathMod: typeof MathLang.mathMod;
  readonly negate: typeof MathLang.negateNum;
  readonly inc: typeof MathLang.inc;
  readonly dec: typeof MathLang.dec;
  readonly clamp: typeof MathLang.clamp;
  readonly gt: typeof MathLang.gt;
  readonly gte: typeof MathLang.gte;
  readonly lt: typeof MathLang.lt;
  readonly lte: typeof MathLang.lte;
  readonly ascend: typeof MathLang.ascend;
  readonly descend: typeof MathLang.descend;
  readonly not: typeof MathLang.not;
  readonly and: typeof MathLang.and;
  readonly or: typeof MathLang.or;
  readonly defaultTo: typeof MathLang.defaultTo;
  readonly isNil: typeof MathLang.isNil;
  readonly type: typeof MathLang.typeOf;
  readonly split: typeof Str.split;
  readonly join: typeof Str.join;
  readonly replace: typeof Str.replace;
  readonly trim: typeof Str.trim;
  readonly startsWith: typeof Str.startsWith;
  readonly endsWith: typeof Str.endsWith;
}

export const underscore: UnderscoreFacade = Object.freeze({
  each: Coll.map,
  map: Coll.map,
  reduce: Coll.reduce,
  reduceRight: Coll.reduceRight,
  find: Coll.find,
  filter: Coll.filter,
  reject: Coll.reject,
  every: Coll.every,
  all: Coll.all,
  some: Coll.someMatch,
  any: Coll.any,
  contains: Coll.contains,
  pluck: Arr.pluck,
  max: Coll.max,
  min: Coll.min,
  sortBy: Arr.sortBy,
  groupBy: Arr.groupBy,
  indexBy: Arr.indexBy,
  countBy: Arr.countBy,
  shuffle: Arr.shuffle,
  sample: Arr.sample,
  size: Coll.size,
  partition: Arr.partition,
  first: Arr.first,
  initial: Arr.initial,
  last: Arr.last,
  rest: Arr.rest,
  compact: Arr.compact,
  flatten: Arr.flattenDeep,
  without: Arr.without,
  union: Arr.union,
  intersection: Arr.intersection,
  difference: Arr.difference,
  uniq: Arr.uniq,
  zip: Arr.zip,
  unzip: Arr.unzip,
  object: Arr.fromPairs,
  range: Arr.range,
  partial: Fn.partial,
  memoize: Fn.memoize,
  debounce: Fn.debounce,
  throttle: Fn.throttle,
  once: Fn.once,
  after: Fn.after,
  before: Fn.before,
  negate: Fn.negate,
  compose: Fn.compose,
  keys: Obj.keys,
  values: Obj.values,
  pairs: Arr.toPairs,
  invert: Obj.invert,
  extend: Obj.extend,
  pick: Obj.pick,
  omit: Obj.omit,
  defaults: Obj.defaults,
  clone: Core.clone,
  tap: Fn.tap,
  has: Obj.has,
  isEqual: Core.isEqual,
  isEmpty: Coll.isEmpty,
  isArray: MathLang.isArray,
  isFunction: MathLang.isFunction,
  isString: MathLang.isString,
  isNumber: MathLang.isNumber,
  isFinite: MathLang.isFiniteNum,
  isBoolean: MathLang.isBoolean,
  isDate: MathLang.isDate,
  isRegExp: MathLang.isRegExp,
  isNull: MathLang.isNull,
  isUndefined: MathLang.isUndefined,
  identity: Fn.identity,
  constant: Fn.constant,
  noop: Fn.noop,
  times: Arr.times,
  escape: Str.escapeHtml,
  unescape: Str.unescapeHtml,
  template: Str.template,
});

export const lodash: LodashFacade = Object.freeze(
  Object.assign({}, underscore, {
    chunk: Arr.chunk,
    concat: Arr.concat,
    differenceBy: Arr.differenceBy,
    differenceWith: Arr.differenceWith,
    drop: Arr.drop,
    dropRight: Arr.dropRight,
    dropWhile: Arr.dropWhile,
    dropRightWhile: Arr.dropRightWhile,
    take: Arr.take,
    takeRight: Arr.takeRight,
    takeWhile: Arr.takeWhile,
    takeRightWhile: Arr.takeRightWhile,
    head: Arr.head,
    tail: Arr.tail,
    nth: Arr.nth,
    flatten: Arr.flatten,
    flattenDeep: Arr.flattenDeep,
    flattenDepth: Arr.flattenDepth,
    fromPairs: Arr.fromPairs,
    toPairs: Arr.toPairs,
    intersectionBy: Arr.intersectionBy,
    unionBy: Arr.unionBy,
    uniqBy: Arr.uniqBy,
    uniqWith: Arr.uniqWith,
    xor: Arr.xor,
    zipObject: Arr.zipObject,
    zipWith: Arr.zipWith,
    keyBy: Arr.keyBy,
    orderBy: Arr.orderBy,
    sampleSize: Arr.sampleSize,
    flatMap: Coll.flatMap,
    findLast: Coll.findLast,
    includes: Coll.includes,
    sum: Coll.sum,
    sumBy: Coll.sumBy,
    mean: Coll.mean,
    meanBy: Coll.meanBy,
    minBy: Coll.minBy,
    maxBy: Coll.maxBy,
    flow: Fn.flow,
    flowRight: Fn.flowRight,
    curry: Fn.curry,
    curry2: Fn.curry2,
    partialRight: Fn.partialRight,
    flip: Fn.flip,
    unary: Fn.unary,
    overArgs: Fn.overArgs,
    assign: Obj.assign,
    defaultsDeep: Obj.defaultsDeep,
    merge: Obj.merge,
    mergeWith: Obj.mergeWith,
    pickBy: Obj.pickBy,
    omitBy: Obj.omitBy,
    get: Obj.get,
    getPath: Obj.getPath,
    set: Obj.set,
    unset: Obj.unset,
    update: Obj.updatePath,
    mapValues: Obj.mapValues,
    mapKeys: Obj.mapKeys,
    invertBy: Obj.invertBy,
    cloneDeep: Core.cloneDeep,
    isPlainObject: MathLang.isPlainObject,
    isNil: MathLang.isNil,
    isMap: MathLang.isMap,
    isSet: MathLang.isSet,
    isTypedArray: MathLang.isTypedArray,
    isSafeInteger: MathLang.isSafeInteger,
    isError: MathLang.isError,
    castArray: MathLang.castArray,
    clamp: MathLang.clamp,
    inRange: MathLang.inRange,
    round: MathLang.round,
    ceil: MathLang.ceil,
    floor: MathLang.floor,
    camelCase: Str.camelCase,
    pascalCase: Str.pascalCase,
    kebabCase: Str.kebabCase,
    snakeCase: Str.snakeCase,
    startCase: Str.startCase,
    capitalize: Str.capitalize,
    upperFirst: Str.upperFirst,
    lowerFirst: Str.lowerFirst,
    deburr: Str.deburr,
    words: Str.words,
    truncate: Str.truncate,
    pad: Str.pad,
    padStart: Str.padStart,
    padEnd: Str.padEnd,
    trim: Str.trim,
    trimStart: Str.trimStart,
    trimEnd: Str.trimEnd,
    repeat: Str.repeat,
    escapeRegExp: Str.escapeRegExp,
    chain: Coll.lazy,
  }),
);

export const R: RamdaFacade = Object.freeze({
  __: Core.__,
  equals: Core.equals,
  clone: Core.cloneDeep,
  reduced: Core.reduced,
  identity: Fn.identity,
  always: Fn.always,
  T: Fn.T,
  F: Fn.F,
  pipe: Fn.pipe,
  compose: Fn.compose,
  curry: Fn.curry,
  curry2: Fn.curry2,
  curryN: Fn.curryN,
  partial: Fn.partial,
  partialRight: Fn.partialRight,
  flip: Fn.flip,
  unary: Fn.unary,
  binary: Fn.binary,
  nAry: Fn.nAry,
  complement: Fn.complement,
  both: Fn.both,
  either: Fn.either,
  allPass: Fn.allPass,
  anyPass: Fn.anyPass,
  cond: Fn.cond,
  condOption: Fn.condOption,
  ifElse: Fn.ifElse,
  when: Fn.when,
  unless: Fn.unless,
  converge: Fn.converge,
  useWith: Fn.useWith,
  juxt: Fn.juxt,
  ap: Fn.ap,
  tap: Fn.tap,
  once: Fn.once,
  memoizeWith: Fn.memoize,
  head: Arr.head,
  last: Arr.last,
  tail: Arr.tail,
  init: Arr.init,
  nth: Arr.nth,
  reverse: Arr.reverse,
  take: Arr.take,
  takeLast: Arr.takeRight,
  takeWhile: Arr.takeWhile,
  drop: Arr.drop,
  dropLast: Arr.dropRight,
  dropWhile: Arr.dropWhile,
  unnest: Arr.unnest,
  flatten: Arr.flattenDeep,
  aperture: Arr.aperture,
  splitAt: Arr.splitAt,
  splitEvery: Arr.splitEvery,
  splitWhen: Arr.splitWhen,
  intersperse: Arr.intersperse,
  insert: Arr.insert,
  remove: Arr.remove,
  update: Arr.update,
  adjust: Arr.adjust,
  move: Arr.move,
  append: Arr.append,
  prepend: Arr.prepend,
  xprod: Arr.xprod,
  transpose: Arr.transpose,
  scan: Arr.scan,
  mapAccum: Arr.mapAccum,
  pluck: Arr.pluck,
  partition: Arr.partition,
  groupBy: Arr.groupBy,
  indexBy: Arr.indexBy,
  countBy: Arr.countBy,
  sortBy: Arr.sortBy,
  symmetricDifference: Arr.xor,
  difference: Arr.difference,
  intersection: Arr.intersection,
  union: Arr.union,
  uniq: Arr.uniq,
  uniqBy: Arr.uniqBy,
  uniqWith: Arr.uniqWith,
  zip: Arr.zip,
  zipObj: Arr.zipObject,
  zipWith: Arr.zipWith,
  fromPairs: Arr.fromPairs,
  toPairs: Arr.toPairs,
  range: Arr.range,
  times: Arr.times,
  map: Coll.map,
  filter: Coll.filter,
  reject: Coll.reject,
  reduce: Coll.reduce,
  reduceRight: Coll.reduceRight,
  chain: Coll.chain,
  find: Coll.find,
  findLast: Coll.findLast,
  all: Coll.all,
  any: Coll.any,
  none: Coll.noneMatch,
  includes: Coll.includes,
  isEmpty: Coll.isEmpty,
  sum: Coll.sum,
  product: Coll.product,
  mean: Coll.mean,
  median: Coll.median,
  transduce: Coll.transduce,
  intoArray: Coll.intoArray,
  keys: Obj.keys,
  values: Obj.values,
  pick: Obj.pick,
  pickBy: Obj.pickBy,
  omit: Obj.omit,
  path: Obj.path,
  pathOr: Obj.pathOr,
  hasPath: Obj.hasPath,
  assoc: Obj.assoc,
  assocPath: Obj.assocPath,
  dissoc: Obj.dissoc,
  dissocPath: Obj.dissocPath,
  modifyPath: Obj.modifyPath,
  mapObjIndexed: Obj.mapObjIndexed,
  mergeDeepRight: Obj.mergeDeepRight,
  mergeDeepLeft: Obj.mergeDeepLeft,
  mergeWith: Obj.mergeWith,
  prop: Obj.prop,
  propOr: Obj.propOr,
  props: Obj.props,
  propEq: Obj.propEq,
  pathEq: Obj.pathEq,
  where: Obj.where,
  whereEq: Obj.whereEq,
  project: Obj.project,
  evolve: Obj.evolve,
  lens: Obj.lens,
  lensProp: Obj.lensProp,
  lensPath: Obj.lensPath,
  lensIndex: Obj.lensIndex,
  composeLens: Obj.composeLens,
  view: Obj.view,
  set: Obj.setLens,
  over: Obj.over,
  add: MathLang.add,
  subtract: MathLang.subtract,
  multiply: MathLang.multiply,
  divide: MathLang.divide,
  modulo: MathLang.modulo,
  mathMod: MathLang.mathMod,
  negate: MathLang.negateNum,
  inc: MathLang.inc,
  dec: MathLang.dec,
  clamp: MathLang.clamp,
  gt: MathLang.gt,
  gte: MathLang.gte,
  lt: MathLang.lt,
  lte: MathLang.lte,
  ascend: MathLang.ascend,
  descend: MathLang.descend,
  not: MathLang.not,
  and: MathLang.and,
  or: MathLang.or,
  defaultTo: MathLang.defaultTo,
  isNil: MathLang.isNil,
  type: MathLang.typeOf,
  split: Str.split,
  join: Str.join,
  replace: Str.replace,
  trim: Str.trim,
  startsWith: Str.startsWith,
  endsWith: Str.endsWith,
});
