import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Predict-then-run: same diagram shape means the same value. === is that
// intuition plus two irregular verbs: NaN and -0.

describe('same value vs strict', () => {
  // Spec: §7.2.9 SameValue (Object.is matches the one-shape-one-value diagram)
  it('predict: dwarves is 7 and wonders is 7, so Object.is(wonders, dwarves)', () => {
    const dwarves = 7;
    const continents = '7';
    const worldWonders = 3 + 4;
    assert.equal(Object.is(dwarves, continents), false);
    assert.equal(Object.is(continents, worldWonders), false);
    assert.equal(Object.is(worldWonders, dwarves), true);
  });

  // Spec: §7.2.9 SameValue
  it('predict: cherry ends alone; chocolate still matches banana', () => {
    const banana = {};
    let cherry = banana;
    const chocolate = cherry;
    cherry = {};
    assert.equal(Object.is(banana, cherry), false);
    assert.equal(Object.is(cherry, chocolate), false);
    assert.equal(Object.is(chocolate, banana), true);
  });

  // Spec: §7.2.9 SameValue (NaN is the same value as itself)
  it('predict: Object.is(NaN, NaN) is true although NaN === NaN is false', () => {
    const width = 0 / 0;
    const height = width * 2;
    assert.equal(Object.is(width, height), true);
    assert.equal(width === height, false);
    assert.notStrictEqual(width === height, true); // same-shape-means-=== model
  });

  // Spec: §7.2.14 IsStrictlyEqual (0 and -0 compare strictly equal)
  it('predict: 0 === -0 is true although Object.is(0, -0) is false', () => {
    const width = 0;
    const height = -width;
    assert.equal(width === height, true);
    assert.equal(Object.is(width, height), false);
  });
});

describe('strict vs loose vs SameValueZero', () => {
  // Spec: §7.2.10 SameValueZero (includes/Map/Set treat NaN as found, ±0 as same)
  it('predict: includes finds NaN but indexOf does not; Set merges +0 and -0', () => {
    assert.equal([NaN].includes(NaN), true);
    assert.equal([NaN].indexOf(NaN), -1);
    assert.equal(new Set([0, -0]).size, 1);
    assert.equal(new Map([[NaN, 1]]).get(NaN), 1);
  });

  // Spec: §7.2.13 IsLooselyEqual (== null covers null and undefined, nothing else)
  it('predict: x == null matches null/undefined but null == 0 is false', () => {
    const loose = (a, b) => a == b; // eslint-disable-line eqeqeq
    assert.equal(loose(null, undefined), true);
    assert.equal(loose(null, 0), false);
    assert.equal(loose(undefined, 0), false);
  });

  // Spec: §7.2.13 IsLooselyEqual (Boolean and Object operands convert before compare)
  it('predict: [[]] == "" and true == [1] are both true (coercion, not sameness)', () => {
    const loose = (a, b) => a == b; // eslint-disable-line eqeqeq
    assert.equal(loose([[]], ''), true);
    assert.equal(loose(true, [1]), true);
    assert.equal(loose(false, [0]), true);
    assert.equal(Object.is([[]], ''), false); // sameness-model answer
  });

  // Spec: §7.2.14 IsStrictlyEqual (Number.isNaN is the readable NaN check)
  it('predict: Number.isNaN spots NaN while x === NaN never fires', () => {
    const size = 0 / 0;
    assert.equal(size === NaN, false);
    assert.equal(Number.isNaN(size), true);
    assert.equal(size !== size, true); // the classic self-inequality detector
  });
});
