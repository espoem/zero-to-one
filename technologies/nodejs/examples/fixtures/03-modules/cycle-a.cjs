exports.loaded = false;
const b = require('./cycle-b.cjs');
exports.loaded = true;
exports.bSawA = b.sawA;
