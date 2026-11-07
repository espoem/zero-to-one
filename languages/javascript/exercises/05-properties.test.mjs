import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: properties are wires starting at objects. Reading a
// missing one answers undefined; only null/undefined on the left throws.

describe('reading properties', () => {
  // Spec: §10.1.8 [[Get]] (missing property answers undefined, adds nothing)
  it('predict: sherlock.boat is undefined and adds no boat property', () => {
    const sherlock = { surname: 'Holmes', age: 64 };
    assert.equal(sherlock.boat, undefined);
    assert.equal('boat' in sherlock, false); // present-but-undefined model answer
  });

  // Spec: §10.1.8 [[Get]] (null/undefined base throws before any lookup)
  it('predict: sherlock.boat.name throws TypeError after boat was undefined', () => {
    const sherlock = { surname: 'Holmes', age: 64 };
    assert.equal(sherlock.boat, undefined);
    assert.throws(() => sherlock.boat.name, TypeError);
  });

  // Spec: §10.1.8 [[Get]] (?. short-circuits the null/undefined step to undefined)
  it('predict: sherlock.boat?.name is undefined instead of throwing', () => {
    const sherlock = { surname: 'Holmes', age: 64 };
    assert.equal(sherlock.boat?.name, undefined);
  });

  // Spec: §10.1.7 [[HasProperty]] / §7.3.11 HasProperty (in checks the prototype chain; hasOwn checks own only)
  it('predict: "surname" is in sherlock but "Boat" is not (case-sensitive)', () => {
    const sherlock = { surname: 'Holmes', age: 64 };
    sherlock.empty = undefined;
    assert.equal('surname' in sherlock, true);
    assert.equal('Boat' in sherlock, false);
    assert.equal('empty' in sherlock, true); // undefined-value model trap
    assert.equal(sherlock.empty, undefined);
    // 'in' walks the prototype chain; Object.hasOwn does not:
    assert.equal('toString' in sherlock, true);
    assert.equal(Object.hasOwn(sherlock, 'toString'), false);
  });
});

describe('naming and assigning properties', () => {
  // Spec: §13.3.2 Property Accessors / §13.3.3 (brackets evaluate the name; dots do not)
  it('predict: sherlock[propertyName] follows the string value "age" to 64', () => {
    const sherlock = { surname: 'Holmes', age: 64 };
    const propertyName = 'age';
    assert.equal(sherlock[propertyName], 64);
    assert.equal(sherlock['sur' + 'name'], 'Holmes');
  });

  // Spec: §10.1.9 [[Set]] (left side finds the wire; right side finds the value)
  it('predict: sherlock.age = 65 re-points the age wire to 65', () => {
    const sherlock = { surname: 'Holmes', age: 64 };
    sherlock.age = 65;
    assert.equal(sherlock.age, 65);
    assert.notStrictEqual(sherlock.age, 64);
  });

  // Spec: §7.1.19 ToPropertyKey (obj[1] and obj["1"] name the same string key)
  it('predict: numeric-like keys collapse: obj[1] reads obj["1"]', () => {
    const obj = {};
    obj[1] = 'one';
    assert.equal(obj['1'], 'one');
    assert.equal('1' in obj, true);
  });

  // Spec: §13.2.5.1 Early Errors / §13.2.5.6 PropertyDefinitionEvaluation (one object cannot hold two properties with one name)
  it('predict: a repeated literal key keeps only the last value', () => {
    const obj = { age: 64, age: 65 }; // eslint-disable-line no-dupe-keys
    assert.equal(obj.age, 65);
    assert.equal(Object.keys(obj).filter((k) => k === 'age').length, 1);
  });
});
