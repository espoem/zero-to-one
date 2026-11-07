import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: write the value you expect before running node --test.
// Primitives are immutable stars: one value per distinct primitive, minus symbols.

describe('undefined and null', () => {
  // Spec: §6.1 language types (Undefined and Null each have a single value)
  it('predict: an unassigned let wire points at undefined', () => {
    // oxlint-disable-next-line no-unassigned-vars -- deliberate test of unassigned let binding
    let bandersnatch;
    assert.equal(bandersnatch, undefined);
    assert.equal(typeof bandersnatch, 'undefined');
  });

  // Spec: §6.1 language types
  it('predict: reading a property of undefined throws TypeError', () => {
    let person = undefined;
    assert.throws(() => person.mood, TypeError);
  });

  // Spec: §6.1 language types (typeof null is "object": a historic bug, not a type)
  it('predict: typeof null is "object" even though null is a primitive', () => {
    assert.equal(typeof null, 'object');
    assert.notStrictEqual(typeof null, 'null'); // honest-typeof model answer
    assert.throws(() => {
      const m = null;
      return m.mood;
    }, TypeError);
  });

  // Spec: §6.2.5 Reference Records (undeclared variable is not the value undefined)
  it('predict: reading a never-declared variable throws ReferenceError', () => {
    assert.throws(() => jabberwocky, ReferenceError); // eslint-disable-line no-undef
  });
});

describe('booleans, numbers, bigints, strings, symbols', () => {
  // Spec: §6.1 language types (exactly two boolean values exist)
  it('predict: isHappy is false, isFeeling is true, isConfusing is false', () => {
    const isSad = true;
    const isHappy = !isSad;
    const isFeeling = isSad || isHappy;
    const isConfusing = isSad && isHappy;
    assert.equal(isHappy, false);
    assert.equal(isFeeling, true);
    assert.equal(isConfusing, false);
  });

  // Spec: §6.1 language types (Number is binary64; 0.1 is the nearest double)
  it('predict: 0.1 + 0.2 is 0.30000000000000004, not 0.3', () => {
    assert.equal(0.1 + 0.2 === 0.3, false);
    assert.equal(0.1 + 0.2, 0.30000000000000004);
  });

  // Spec: §6.1 language types (single NaN value; signed zeros; infinities)
  it('predict: typeof NaN is "number" and 1/0, -1/0, 0/0 give Infinity/-Infinity/NaN', () => {
    assert.equal(typeof NaN, 'number');
    assert.equal(1 / 0, Infinity);
    assert.equal(-1 / 0, -Infinity);
    assert.ok(Number.isNaN(0 / 0));
    assert.equal(1 / -Infinity, -0);
  });

  // Spec: §6.1 language types (BigInt has arbitrary precision; n-suffix literal)
  it('predict: 9007199254740991n + 2n is exact 9007199254740993n', () => {
    const alot = 9007199254740991n;
    assert.equal(alot + 2n, 9007199254740993n);
    assert.throws(() => 1n + 1, TypeError); // mixing model answer would be 2n
  });

  // Spec: §6.1 language types (strings are primitives, not objects)
  it('predict: cat.length is 8 but cat[0] = "J" never sticks', () => {
    const cat = 'Cheshire';
    assert.equal(cat.length, 8);
    assert.equal(cat[0], 'C');
    assert.throws(() => {
      cat[0] = 'J';
    }, TypeError);
    assert.equal(cat, 'Cheshire');
  });

  // Spec: §6.1 language types (every Symbol() call is a fresh unique value)
  it('predict: Symbol("x") is never equal to another Symbol("x")', () => {
    assert.notStrictEqual(Symbol('x'), Symbol('x'));
    assert.equal(typeof Symbol(), 'symbol');
    assert.equal(Symbol.for('x') === Symbol.for('x'), true);
  });
});
