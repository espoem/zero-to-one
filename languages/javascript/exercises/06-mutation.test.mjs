import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: nothing nests; wires share values. Mutating a shared
// object is visible through every wire, re-pointing is visible through one.

describe('the shared-address bug', () => {
  // Spec: §13.2.5.6 / §7.3.5 CreateDataProperty (john.address copies the object value, not the wire)
  it('predict: both flats read Malibu; only john reads Lennon', () => {
    const sherlock = { surname: 'Holmes', address: { city: 'London' } };
    const john = { surname: 'Watson', address: sherlock.address };
    john.surname = 'Lennon';
    john.address.city = 'Malibu';
    assert.equal(sherlock.surname, 'Holmes');
    assert.equal(sherlock.address.city, 'Malibu'); // London-model answer fails
    assert.equal(john.surname, 'Lennon');
    assert.equal(john.address.city, 'Malibu');
  });

  // Spec: §10.1.9 [[Set]] (re-pointing john.address leaves sherlock in London)
  it('predict: assigning john.address = {...} keeps sherlock in London', () => {
    const sherlock = { surname: 'Holmes', address: { city: 'London' } };
    const john = { surname: 'Watson', address: sherlock.address };
    john.surname = 'Lennon';
    john.address = { city: 'Malibu' };
    assert.equal(sherlock.address.city, 'London');
    assert.equal(john.address.city, 'Malibu');
    assert.notStrictEqual(john.address, sherlock.address);
  });

  // Spec: §6.2.5.6 PutValue (reassigning the variable abandons the old object)
  it('predict: pointing john at a fresh object also keeps sherlock in London', () => {
    const sherlock = { surname: 'Holmes', address: { city: 'London' } };
    let john = { surname: 'Watson', address: sherlock.address };
    john = { surname: 'Lennon', address: { city: 'Malibu' } };
    assert.equal(sherlock.address.city, 'London');
    assert.equal(john.address.city, 'Malibu');
  });

  // Spec: §6.1 language types (two brace pairs always mean two objects)
  it('predict: mutating a fresh literal is safe; no other wire sees it', () => {
    const a = { city: 'London' };
    const b = { city: 'London' };
    b.city = 'Malibu';
    assert.equal(a.city, 'London');
    assert.equal(b.city, 'Malibu');
  });
});

describe('const wires vs mutable objects', () => {
  // Spec: §14.3.1 let/const (const locks the wire, not the object it reaches)
  it('predict: const shrek mutates species but cannot be re-pointed', () => {
    // oxlint-disable-next-line no-const-assign -- deliberate test proving const reassignment throws TypeError
    const shrek = { species: 'ogre' };
    shrek.species = 'human';
    assert.equal(shrek.species, 'human');
    assert.throws(() => {
      shrek = {};
    }, TypeError);
  });

  // Spec: §14.3.1 let/const
  it('predict: arr[0] = 420 sticks because arrays are mutable objects', () => {
    const arr = [212, 8, 506];
    arr[0] = 420;
    assert.deepEqual(arr, [420, 8, 506]);
    assert.notDeepEqual(arr, [212, 8, 506]);
  });

  // Spec: §10.1.9 [[Set]] (aliasing: two wires, one mutated object)
  it('predict: cherry and banana share one object, so cherry.count++ shows via banana', () => {
    const banana = { count: 1 };
    const cherry = banana;
    cherry.count++;
    assert.equal(banana.count, 2);
    assert.equal(cherry.count, 2);
  });

  // Spec: §10.1.9 [[Set]] (shape check: which object did we mean to mutate?)
  it('predict: city mutation reaches sherlock only through the shared address', () => {
    const sherlock = { surname: 'Holmes', address: { city: 'London' } };
    const watson = { surname: 'Watson', address: sherlock.address };
    assert.equal(sherlock.address === watson.address, true);
    watson.address.city = 'Bath';
    assert.equal(sherlock.address.city, 'Bath');
  });
});
