// Entry imports a.js first. a.js depends on b.js, which depends on a.js (cycle).
// Evaluation is depth-first post-order: b.js runs before a.js, so a's binding is still in TDZ.
import { useB } from './a.js';
import { sawA, readALater } from './b.js';
console.log(JSON.stringify({ sawA, later: readALater(), useB: useB() }));
