globalThis.order = [];
await import('./entry.js');
console.log(JSON.stringify(globalThis.order));
