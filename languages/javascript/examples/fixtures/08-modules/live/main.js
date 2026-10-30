import snapshot, { count, increment } from './counter.js';
import * as ns from './counter.js';
const before = count;
increment();
let assignError = null;
try { ns.count = 99; } catch (e) { assignError = e.name; }
console.log(JSON.stringify({ before, after: count, viaNs: ns.count, snapshot, assignError,
  keys: Object.keys(ns), proto: Object.getPrototypeOf(ns), tag: ns[Symbol.toStringTag],
  extensible: Object.isExtensible(ns), frozen: Object.isFrozen(ns) }));
