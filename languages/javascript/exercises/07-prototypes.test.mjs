import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: a missing property asks the prototype next. Reads walk
// the chain; writes plant a fresh own wire if the property is writable and not
// an accessor (otherwise the §10.1.9.2 override mistake or setter applies).

describe('lookup, shadowing, assignment', () => {
  // Spec: §10.1.8 [[Get]] (miss on the object continues to __proto__)
  it('predict: gwen.teeth is 32 via human although gwen has no teeth wire', () => {
    const human = { teeth: 32 };
    const gwen = { __proto__: human, age: 19 };
    assert.equal(gwen.teeth, 32);
    assert.equal(gwen.hasOwnProperty('teeth'), false);
    assert.equal(gwen.age, 19);
    assert.equal(human.age, undefined);
  });

  // Spec: §10.1.8 [[Get]] (chain of two prototypes still resolves brainy)
  it('predict: gwen.brainy is true through human up to mammal', () => {
    const mammal = { brainy: true };
    const human = { __proto__: mammal, teeth: 32 };
    const gwen = { __proto__: human, age: 19 };
    assert.equal(gwen.brainy, true);
    assert.equal(gwen.tail ?? 'missing', 'missing');
  });

  // Spec: §10.1.8 [[Get]] (first own hit stops the search: shadowing)
  it('predict: own teeth 31 shadows the prototype teeth 32', () => {
    const human = { teeth: 32 };
    const gwen = { __proto__: human, teeth: 31 };
    assert.equal(gwen.teeth, 31);
    assert.equal(human.teeth, 32);
    assert.equal(gwen.hasOwnProperty('teeth'), true);
  });

  // Spec: §10.1.9 [[Set]] (write creates an own property; prototype untouched)
  it('predict: gwen.teeth = 31 leaves human.teeth at 32', () => {
    const human = { teeth: 32 };
    const gwen = { __proto__: human };
    gwen.teeth = 31;
    assert.equal(gwen.teeth, 31);
    assert.equal(human.teeth, 32);
    assert.equal(Object.hasOwn(gwen, 'teeth'), true);
  });

  // Spec: §10.1.9.2 OrdinarySetWithOwnDescriptor (override mistake: read-only proto blocks assignment)
  it('predict: non-writable prototype property throws TypeError on assignment in strict mode', () => {
    const proto = Object.freeze({ species: 'Homo sapiens' });
    const person = { __proto__: proto };
    assert.throws(() => {
      person.species = 'Neanderthal';
    }, TypeError);
    assert.equal(person.species, 'Homo sapiens');
    assert.equal(Object.hasOwn(person, 'species'), false);
  });
});

describe('the default prototype and its edges', () => {
  // Spec: §6.1 language types ({} defaults its __proto__ to Object.prototype)
  it('predict: a fresh {} already answers hasOwnProperty via Object.prototype', () => {
    const obj = {};
    assert.equal(typeof obj.hasOwnProperty, 'function');
    assert.equal(Object.hasOwn(obj, 'x'), false);
    assert.equal(Object.getPrototypeOf(obj) === Object.prototype, true);
  });

  // Spec: §20.1.2.2 Object.create / Annex B.3.1 (null-prototype object opts out of Object.prototype)
  it('predict: a null-prototype object has no toString and no hasOwnProperty', () => {
    const weirdo = { __proto__: null };
    assert.equal(weirdo.hasOwnProperty, undefined);
    assert.equal(weirdo.toString, undefined);
    assert.equal(Object.getPrototypeOf(weirdo), null);
    assert.equal('toString' in weirdo, false);
    // Object.hasOwn works safely because it is not an instance method:
    assert.equal(Object.hasOwn(weirdo, 'anything'), false);
    assert.throws(() => weirdo.hasOwnProperty('x'), TypeError);
  });

  // Spec: §10.1.8 [[Get]] (mutating a shared prototype shows up everywhere)
  it('predict: adding smell to the shared proto appears on both detectives', () => {
    const proto = {};
    const sherlock = { __proto__: proto };
    const watson = { __proto__: proto };
    proto.smell = 'banana';
    assert.equal(sherlock.smell, 'banana');
    assert.equal(watson.smell, 'banana');
    delete proto.smell; // restore the shared fixture for other tests
    assert.equal('smell' in sherlock, false);
  });

  // Spec: §20.1.3.8 Object.prototype.__proto__ (prototype property configures new, __proto__ reads it)
  it('predict: new Donut() eats via Donut.prototype, not an own property', () => {
    function Donut() {
      this.shape = 'round';
    }
    Donut.prototype.eat = function () {
      return 'Nom nom nom';
    };
    const donut1 = new Donut();
    assert.equal(donut1.eat(), 'Nom nom nom');
    assert.equal(donut1.hasOwnProperty('eat'), false);
    assert.equal(Object.getPrototypeOf(donut1) === Donut.prototype, true);
    delete Donut.prototype.eat;
  });
});
