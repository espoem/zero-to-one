globalThis.log = [];
import defer * as heavy from './heavy.js';
globalThis.log.push('main body');
globalThis.log.push(`value ${heavy.value}`);   // first property access triggers evaluation
console.log(JSON.stringify(globalThis.log));
