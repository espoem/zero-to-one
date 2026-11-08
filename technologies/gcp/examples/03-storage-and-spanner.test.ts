import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CloudStorageBucketModel, SpannerTrueTimeSimulator } from './lib/gcp-models.ts';

describe('Cloud Storage Consistency & Cloud Spanner TrueTime Engine', () => {
  describe('Cloud Storage Global Strong Consistency & Bucket Lock Compliance', () => {
    it('Strong Read-After-Write Consistency: Object is immediately readable following PUT', () => {
      const bucket = new CloudStorageBucketModel('corp-telemetry-archive');
      const payloadMd5 = 'd41d8cd98f00b204e9800998ecf8427e';

      const writeResult = bucket.putObject('events/2026/11/batch-01.json', 1048576, payloadMd5);
      assert.ok(writeResult.generation > 1000);

      // Immediate strongly consistent read
      const readResult = bucket.getObject('events/2026/11/batch-01.json');
      assert.ok(readResult !== undefined);
      assert.equal(readResult.sizeBytes, 1048576);
      assert.equal(readResult.md5Hash, payloadMd5);
    });

    it('Strong Read-After-Delete Consistency: Deleted object is immediately invisible to subsequent reads', () => {
      const bucket = new CloudStorageBucketModel('temp-staging-bucket');
      bucket.putObject('temp/data.csv', 500, 'hash123');

      // Delete object
      const deleted = bucket.deleteObject('temp/data.csv');
      assert.equal(deleted, true);

      // Immediate strongly consistent read returns undefined
      const readResult = bucket.getObject('temp/data.csv');
      assert.equal(readResult, undefined);
    });

    it('Bucket Lock Compliance: Prevents reduction of retention period once locked', () => {
      const bucket = new CloudStorageBucketModel('sec-compliance-vault');
      // Set 30 days (2,592,000 seconds)
      bucket.setRetentionPolicy(2592000);
      bucket.lockBucket();
      assert.equal(bucket.isBucketLocked, true);

      // Attempting to increase retention is permitted
      bucket.setRetentionPolicy(5184000); // 60 days
      assert.equal(bucket.retentionPeriodSeconds, 5184000);

      // Attempting to reduce retention throws an immutable violation
      assert.throws(
        () => bucket.setRetentionPolicy(2592000), // Reduce back to 30 days
        /Bucket Lock Violation/,
      );
    });

    it('Object Retention Enforcement: Rejects premature deletion of objects under retention hold', () => {
      const bucket = new CloudStorageBucketModel('legal-archive');
      bucket.setRetentionPolicy(86400); // 1 day
      bucket.lockBucket();

      const now = 1700000000000;
      bucket.putObject('contracts/agreement-2026.pdf', 204800, 'pdfhash', now);

      // Attempt deletion while retention is active (now + 1 hour)
      assert.throws(
        () => bucket.deleteObject('contracts/agreement-2026.pdf', now + 3600000),
        /Object Retention Violation/,
      );

      // Deletion succeeds after retention expiration (now + 2 days)
      const deleted = bucket.deleteObject('contracts/agreement-2026.pdf', now + 172800000);
      assert.equal(deleted, true);
    });
  });

  describe('Cloud Spanner TrueTime & Key Hotspot Detection', () => {
    it('TrueTime Commit Wait: Derives 2*epsilon commit delay to guarantee external consistency', () => {
      const requestTimeMs = 1700000000000;
      const epsilonMs = 4; // 4ms clock uncertainty

      const { commitTimestampMs, commitWaitDurationMs } =
        SpannerTrueTimeSimulator.simulateCommitWait(requestTimeMs, epsilonMs);

      // Commit timestamp is picked >= t.latest (requestTimeMs + epsilon)
      assert.equal(commitTimestampMs, requestTimeMs + epsilonMs);

      // Commit wait duration is 2 * epsilon
      assert.equal(commitWaitDurationMs, 2 * epsilonMs);
      assert.equal(commitWaitDurationMs, 8);
    });

    it('Monotonic Sequence Hotspot: Identifies single split overload on sequential keys', () => {
      // 100 sequential timestamps/order numbers
      const sequentialKeys: string[] = [];
      for (let i = 1; i <= 100; i++) {
        sequentialKeys.push(`2026-11-08-ORD-${String(i).padStart(5, '0')}`);
      }

      // Existing historical tablet bounds separating previous days
      const bounds = ['2026-11-05', '2026-11-06', '2026-11-07'];
      const analysis = SpannerTrueTimeSimulator.analyzeKeyDistribution(sequentialKeys, 4, bounds);
      // Because sorted range boundaries partition chronological keys, a single tail split absorbs the writes
      assert.equal(analysis.isHotspotting, true);
      assert.ok(analysis.maxSplitFraction >= 0.8);
    });

    it('Hashed / Distributed Key Distribution: Eliminates write hotspotting across tablet splits', () => {
      // 100 UUIDv4-style distributed keys
      const distributedKeys: string[] = [];
      for (let i = 1; i <= 100; i++) {
        const hashPrefix = ((i * 2654435761) >>> 0).toString(16).padStart(8, '0');
        distributedKeys.push(`${hashPrefix}-2026-11-08-ORD-${i}`);
      }

      const analysis = SpannerTrueTimeSimulator.analyzeKeyDistribution(distributedKeys, 4);
      assert.equal(analysis.isHotspotting, false);
      assert.ok(analysis.maxSplitFraction < 0.6); // well distributed across all 4 splits
    });
  });
});
