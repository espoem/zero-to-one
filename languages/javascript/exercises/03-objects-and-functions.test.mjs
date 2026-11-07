import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: objects and functions are values too, but each literal
// creates a brand-new one instead of summoning a shared star.

describe('objects are fresh values', () => {
  // Spec: §6.1 language types ({} creates a new ordinary object each evaluation)
  it('predict: two {} literals are different values, so Object.is is false', () => {
    assert.equal(Object.is({}, {}), false);
    assert.notStrictEqual({}, {}); // reusable-literal model answer would be equal
  });

  // Spec: §6.1 language types
  it('predict: a loop logging {} seven times passes seven distinct values', () => {
    const seen = [];
    for (let i = 0; i < 7; i++) seen.push({});
    assert.equal(new Set(seen).size, 7);
  });

  // Spec: §6.1 language types (arrays, dates, regexps report typeof "object")
  it('predict: typeof [] and typeof new Date() are both "object"', () => {
    assert.equal(typeof [], 'object');
    assert.equal(typeof new Date(), 'object');
    assert.equal(typeof /x/, 'object');
  });

  // Spec: §6.1 language types (wires copy the pointer, not the object)
  it('predict: rapper ends at "No Malice" via dot and bracket writes', () => {
    const rapper = { name: 'Malicious' };
    rapper.name = 'Malice';
    rapper['name'] = 'No Malice';
    assert.equal(rapper.name, 'No Malice');
  });
});

describe('functions are callable objects', () => {
  // Spec: §6.1 language types (function expressions create a new value each time)
  it('predict: seven function(){} evaluations create seven distinct values', () => {
    const fns = [];
    for (let i = 0; i < 7; i++) fns.push(function () {});
    assert.equal(new Set(fns).size, 7);
  });

  // Spec: §6.1 language types (logging dwarves without () shows the function)
  it('predict: dwarves without () is the function itself, not 7', () => {
    const countDwarves = function () {
      return 7;
    };
    const dwarves = countDwarves;
    assert.equal(typeof dwarves, 'function');
    assert.equal(dwarves(), 7);
    assert.notStrictEqual(dwarves, 7); // call-by-naming model answer
  });

  // Spec: §6.1 language types (typeof a callable object is "function")
  it('predict: typeof (x => x * 2) is "function" and it doubles 21 to 42', () => {
    const doubler = (x) => x * 2;
    assert.equal(typeof doubler, 'function');
    assert.equal(doubler(21), 42);
  });

  // Spec: §6.1 language types (functions accept properties like objects do)
  it('predict: a function keeps a custom property alongside its code', () => {
    function donut() {
      return { shape: 'round' };
    }
    donut.eaten = 0;
    assert.equal(donut.eaten, 0);
    assert.equal(donut().shape, 'round');
  });
});
