const { isSea } = require('node:sea');
console.log(`hello from a single executable: isSea=${isSea()} args=${process.argv.slice(2).join(',')}`);
