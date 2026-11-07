const a = require('./cycle-a.cjs');
exports.sawA = { ...a };
