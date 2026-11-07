import test from 'node:test';
import assert from 'node:assert';
import fc from 'fast-check';
import {
  CardinalityEngine,
  W3CTraceContextParser,
  CardinalityGovernanceEngine,
} from './lib/observability-model.ts';

test('01 - Cardinality calculation and label explosion', () => {
  const sets = { method: ['GET', 'POST'], status: ['200', '500'] };
  assert.strictEqual(CardinalityEngine.calculateCardinality(sets), 4);
});

test('01 - High cardinality label explosion detection (Gotcha #1)', () => {
  assert.throws(() => {
    CardinalityGovernanceEngine.checkSeriesLimit(150000, 100000);
  });
});

test('01 - W3CTraceContext parsing and validation', () => {
  const tp = W3CTraceContextParser.parseTraceParent(
    '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  );
  assert.strictEqual(tp.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
});

test('01 - Fast-check cardinality property', () => {
  fc.assert(
    fc.property(
      fc.dictionary(
        fc.string({ minLength: 1, maxLength: 3 }),
        fc.array(fc.string(), { minLength: 1, maxLength: 5 }),
      ),
      (dict) => {
        const card = CardinalityEngine.calculateCardinality(dict);
        return card >= 1;
      },
    ),
  );
});
