import type { Shape } from './types.ts';
import { area } from './types.ts';
const s: Shape = { w: 2, h: 3 };
console.log(area(s) satisfies number);
