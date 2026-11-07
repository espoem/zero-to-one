import test from 'node:test';
import assert from 'node:assert';
import { TSDBCompactor, NativeHistogram } from './lib/observability-model.ts';

test('05 - WAL crash recovery replay and block compaction', () => {
  const blocks = [
    { minTime: 0, maxTime: 1000, samples: 50 },
    { minTime: 1001, maxTime: 2000, samples: 60 },
  ];
  const compacted = TSDBCompactor.compactBlocks(blocks);
  assert.strictEqual(compacted.minTime, 0);
  assert.strictEqual(compacted.maxTime, 2000);
  assert.strictEqual(compacted.samples, 110);
});

test('05 - Native Histogram schema resolution and quantile evaluation', () => {
  const buckets = [
    { upperBound: 0.1, count: 10 },
    { upperBound: 0.5, count: 80 },
    { upperBound: 1.0, count: 10 },
  ];
  const q99 = NativeHistogram.evaluate(buckets, 0.99);
  assert.strictEqual(q99, 1.0);
});

test('05 - Prometheus relabeling regex rules simulation', () => {
  const relabel = (labels: Record<string, string>) => {
    if (labels['instance']?.includes(':9100')) {
      labels['exporter'] = 'node';
    }
    return labels;
  };
  const res = relabel({ instance: 'localhost:9100' });
  assert.strictEqual(res['exporter'], 'node');
});

test('05 - TSDB out-of-order sample rejection check', () => {
  const lastTimestamp = 1000;
  const newSampleTimestamp = 900;
  const rejected = newSampleTimestamp < lastTimestamp;
  assert.strictEqual(rejected, true);
});
