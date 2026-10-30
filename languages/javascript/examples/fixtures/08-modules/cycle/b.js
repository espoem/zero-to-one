import { a } from './a.js';
// b.js is evaluated first (depth-first post-order), while a.js's `a` is still in its TDZ.
let seen;
try { seen = a; } catch (e) { seen = `${e.name}: ${e.message}`; }
export const b = 'B';
export const sawA = seen;
export function readALater() { return a; }   // reading later works: live binding, initialized by then
