// Package self-reference: a package can import itself by name, which applies its "exports" map.
import { build } from 'cond-demo';
import { feature } from 'cond-demo/feature';
let blocked = null;
try { await import('cond-demo/src/secret.js'); } catch (e) { blocked = e.code; }
console.log(JSON.stringify({ build, feature, blocked }));
