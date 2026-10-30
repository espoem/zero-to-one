// Same graph, other entry order: now a.js is evaluated first and b.js sees an initialized `a`.
import { sawA } from './b.js';
console.log(JSON.stringify({ sawA }));
