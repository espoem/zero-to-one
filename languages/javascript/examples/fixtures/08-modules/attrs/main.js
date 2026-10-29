import data from './data.json' with { type: 'json' };
let missing = null;
try { await import('./data.json'); } catch (e) { missing = e.code ?? e.name; }
console.log(JSON.stringify({ name: data.name, big: String(data.big), missing,
  dirname: import.meta.dirname.endsWith('attrs'), resolved: import.meta.resolve('./data.json').startsWith('file://') }));
