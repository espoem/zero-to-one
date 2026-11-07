exports.a = 1;
module.exports.b = 2;
Object.defineProperty(exports, 'c', { enumerable: true, get() { return 3; } });
if (Math.random() > 2) exports.d = 4;
