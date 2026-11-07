import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: cover the answer column, write your prediction, then run.
// Wires point at values; assignment re-points the left wire to the right value.

describe('wires, not boxes', () => {
  // Spec: §14.3.1 let/const (declaration creates a wire, assignment re-points it)
  it('predict: b is still 10 after a is reassigned to 0', () => {
    let a = 10;
    let b = a;
    a = 0;
    assert.equal(a, 0);
    assert.equal(b, 10);
    assert.notStrictEqual(b, 0); // wire-to-variable model answer: b would follow a to 0
  });

  // Spec: §14.3.1 let/const
  it('predict: pet is "The Kraken"; reassignment does not mutate the old string', () => {
    let pet = 'Narwhal';
    pet = 'The Kraken';
    assert.equal(pet, 'The Kraken');
    assert.notStrictEqual(pet, 'Narwhal');
  });

  // Spec: §6.1 language types (primitives are values wires point to)
  it('predict: reaction stays "yikes" (locked ESM strict mode throws on write)', () => {
    let reaction = 'yikes';
    assert.throws(() => {
      reaction[0] = 'l';
    }, TypeError);
    assert.equal(reaction, 'yikes');
    assert.notStrictEqual(reaction, 'likes'); // mutable-string model answer
  });

  // Spec: §6.2.5 Reference Records (a variable name evaluates to its current value)
  it('predict: money stays 10 after double(money); only the parameter wire moves', () => {
    function double(x) {
      x = x * 2;
      return x;
    }
    let money = 10;
    const returned = double(money);
    assert.equal(returned, 20);
    assert.equal(money, 10);
    assert.notStrictEqual(money, 20); // pass-by-variable model answer
  });

  // Spec: §9.1.1 Environment Records (each let declares a fresh wire)
  it('predict: y points to the value of x, so later x moves alone', () => {
    let x = 10;
    let y = x;
    x = 0;
    assert.equal(x, 0);
    assert.equal(y, 10);
    assert.notStrictEqual(y, x);
  });

  // Spec: §6.2.5 Reference Records
  it('predict: assigning a literal re-points the wire, never edits the old value', () => {
    let sisters = 3;
    let musketeers = 3;
    sisters = 4;
    assert.equal(musketeers, 3);
    assert.equal(sisters, 4);
  });

  // Spec: §6.1 language types
  it('predict: reading a wire twice with no reassignment gives the same value', () => {
    let count = 41 + 1;
    assert.equal(count, 42);
    assert.equal(count, 42);
  });
});
