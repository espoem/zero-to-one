import answer from 'virtual:answer';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
console.log(answer, require('virtual:answer').default);
