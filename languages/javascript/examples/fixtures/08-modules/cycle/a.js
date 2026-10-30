// a.js imports b.js, and b.js imports a.js back: a cycle.
import { b } from './b.js';
export const a = 'A';
export function useB() { return b; }
