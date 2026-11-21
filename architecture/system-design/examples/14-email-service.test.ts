import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  ContentAddressedAttachmentStore,
  DeliverabilityPoolGuard,
  computeBase64WireBytes,
  computeWarmupDailyCap,
  estimateEmailStorage,
  evaluateEmailAuth,
  reconstructThreadTree,
} from './lib/email-models.ts';

describe('Module 20: Distributed Email Service Executable Proofs', () => {
  it('Planetary capacity model verifies 1B-user throughput (~115.7k QPS), 730 PB/yr metadata, 1,460 PB/yr attachments, and Base64 4/3 wire overhead', () => {
    const est = estimateEmailStorage({
      totalUsers: 1_000_000_000,
      emailsSentPerUserDay: 10,
      emailsReceivedPerUserDay: 40,
      avgMetadataBytes: 50_000, // 50 KB decimal
      attachmentFraction: 0.2,
      avgAttachmentBytes: 500_000, // 500 KB decimal
      attachmentDedupeRatio: 2.5,
      smtpMimeLimitBytes: 25_000_000, // 25 MB MIME ceiling
    });

    // 10^10 / 86,400 = 115,740.74 emails/sec (~100k QPS mental-math anchor)
    assert.ok(est.outboundEmailsPerSec > 115_740 && est.outboundEmailsPerSec < 115_741);
    assert.ok(est.inboundEmailsPerSec > 462_962 && est.inboundEmailsPerSec < 462_963);

    // 4 * 10^10 * 50 KB = 2 PB/day -> 730 PB/year metadata + body
    assert.equal(est.dailyMetadataPb, 2);
    assert.equal(est.annualMetadataPb, 730);

    // 4 * 10^10 * 0.20 * 500 KB = 4 PB/day -> 1,460 PB/year raw attachments (584 PB/yr at 2.5x CAS dedupe)
    assert.equal(est.dailyRawAttachmentPb, 4);
    assert.equal(est.annualRawAttachmentPb, 1460);
    assert.equal(est.annualDeduplicatedAttachmentPb, 584);

    // RFC 2045 Base64 4/3 wire expansion: 18.75 MB raw binary expands to exactly 25.00 MB Base64 chars
    assert.equal(est.maxRawBinaryBytesForMimeCap, 18_750_000);
    assert.equal(computeBase64WireBytes(18_750_000, false), 25_000_000);
    assert.ok(computeBase64WireBytes(18_750_000, true) > 25_600_000); // CRLF line breaks add ~657 KB
  });

  it('evaluateEmailAuth enforces DMARC strict/relaxed alignment (including eTLD+1 public suffixes), blocks unaligned SPF spoofing, and recovers mailing-list forwards via ARC', () => {
    // 1. Relaxed alignment pass: subdomain `mailer.bank.com` aligns with organizational domain `bank.com`
    const relaxedPass = evaluateEmailAuth({
      headerFromDomain: 'bank.com',
      envelopeMailFromDomain: 'bounces.bank.com',
      spfPass: true,
      dkimPass: true,
      dkimSigningDomain: 'mailer.bank.com',
      alignmentMode: 'relaxed',
      dmarcPolicy: 'reject',
    });
    assert.equal(relaxedPass.dmarcPass, true);
    assert.equal(relaxedPass.disposition, 'accept');

    // 2. Negative test (Strict alignment): subdomain `mailer.bank.com` fails strict alignment against `bank.com`
    const strictFail = evaluateEmailAuth({
      headerFromDomain: 'bank.com',
      envelopeMailFromDomain: 'bounces.bank.com',
      spfPass: true,
      dkimPass: true,
      dkimSigningDomain: 'mailer.bank.com',
      alignmentMode: 'strict',
      dmarcPolicy: 'reject',
    });
    assert.equal(strictFail.dmarcPass, false);
    assert.equal(strictFail.disposition, 'reject');

    // 3. Negative test (Envelope Spoofing & multi-label eTLD+1 `.co.uk` isolation):
    //    attacker passes SPF for `evil.co.uk` and tries to spoof `From: security@bank.co.uk` under relaxed mode
    const ukSpoofAttack = evaluateEmailAuth({
      headerFromDomain: 'bank.co.uk',
      envelopeMailFromDomain: 'evil.co.uk',
      spfPass: true,
      dkimPass: false,
      dkimSigningDomain: null,
      alignmentMode: 'relaxed',
      dmarcPolicy: 'reject',
    });
    assert.equal(ukSpoofAttack.spfAlignedPass, false);
    assert.equal(ukSpoofAttack.dmarcPass, false);
    assert.equal(ukSpoofAttack.disposition, 'reject');

    // 4. Mailing-list forwarding: SPF fails (forwarder IP != sender SPF) and list footer breaks DKIM,
    //    but a cryptographically verified RFC 8617 ARC chain from a trusted forwarder preserves delivery
    const arcForward = evaluateEmailAuth({
      headerFromDomain: 'acm.org',
      envelopeMailFromDomain: 'lists.university.edu',
      spfPass: false,
      dkimPass: false,
      dkimSigningDomain: 'acm.org',
      alignmentMode: 'relaxed',
      dmarcPolicy: 'reject',
      trustedArcChainPass: true,
    });
    assert.equal(arcForward.dmarcPass, false);
    assert.equal(arcForward.disposition, 'accept');
  });

  it('reconstructThreadTree builds RFC 5322 / JWZ conversation DAGs deterministically across out-of-order arrivals, missing intermediate parents, and cyclic headers', () => {
    // Message 3 arrives BEFORE Message 1, and Message 2 (`<m2@ex.com>`) is missing from the mailbox!
    const tree = reconstructThreadTree([
      {
        messageId: '<m3@ex.com>',
        inReplyTo: '<m2@ex.com>',
        references: ['<m1@ex.com>', '<m2@ex.com>'],
        timestampMs: 3_000,
        subject: 'Re: Architecture review',
      },
      {
        messageId: '<m1@ex.com>',
        inReplyTo: null,
        references: [],
        timestampMs: 1_000,
        subject: 'Architecture review',
      },
    ]);

    const m1 = tree.get('<m1@ex.com>')!;
    const m2 = tree.get('<m2@ex.com>')!;
    const m3 = tree.get('<m3@ex.com>')!;

    assert.equal(m1.parentId, null);
    assert.equal(m1.isPlaceholder, false);
    assert.deepEqual(m1.children, ['<m2@ex.com>']);

    // Missing intermediate parent `<m2@ex.com>` was synthesized as a placeholder bridging m1 -> m2 -> m3
    assert.equal(m2.parentId, '<m1@ex.com>');
    assert.equal(m2.isPlaceholder, true);
    assert.deepEqual(m2.children, ['<m3@ex.com>']);
    assert.equal(m3.parentId, '<m2@ex.com>');

    // Negative test: malformed mutual cycle (`c1 -> c2 -> c1`) never creates a parent loop,
    // and timestamp sorting guarantees identical tree structure regardless of input array order
    const msgA = {
      messageId: '<c1@ex.com>',
      inReplyTo: '<c2@ex.com>',
      references: ['<c2@ex.com>'],
      timestampMs: 10,
      subject: 'Cycle A',
    };
    const msgB = {
      messageId: '<c2@ex.com>',
      inReplyTo: '<c1@ex.com>',
      references: ['<c1@ex.com>'],
      timestampMs: 20,
      subject: 'Cycle B',
    };
    const cyclicForward = reconstructThreadTree([msgA, msgB]);
    const cyclicReverse = reconstructThreadTree([msgB, msgA]);
    assert.equal(
      cyclicForward.get('<c1@ex.com>')?.parentId,
      cyclicReverse.get('<c1@ex.com>')?.parentId,
    );
    assert.equal(
      cyclicForward.get('<c2@ex.com>')?.parentId,
      cyclicReverse.get('<c2@ex.com>')?.parentId,
    );
  });

  it('ContentAddressedAttachmentStore deduplicates identical attachments via SHA-256, handles draft overwrites cleanly, and reclaims blobs only when refCount hits 0 (fast-check)', () => {
    const store = new ContentAddressedAttachmentStore();
    const pdfPayload = 'PDF-1.7-quarterly-all-hands-deck-binary-payload';

    const r1 = store.putAttachment({
      userId: 'u-alice',
      emailId: 'e-101',
      filename: 'deck.pdf',
      content: pdfPayload,
      mimeType: 'application/pdf',
    });
    const r2 = store.putAttachment({
      userId: 'u-bob',
      emailId: 'e-202',
      filename: 'forwarded-deck.pdf',
      content: pdfPayload,
      mimeType: 'application/pdf',
    });

    assert.equal(r1.sha256, r2.sha256);
    assert.equal(r1.deduplicated, false);
    assert.equal(r2.deduplicated, true);
    assert.equal(r2.refCount, 2);
    assert.equal(store.physicalBlobCount, 1);

    // Overwrite test: Alice replaces `deck.pdf` on draft `e-101` with new bytes -> old blob refCount drops to 1
    const r1Updated = store.putAttachment({
      userId: 'u-alice',
      emailId: 'e-101',
      filename: 'deck.pdf',
      content: 'PDF-1.7-revised-v2-deck-binary-payload',
      mimeType: 'application/pdf',
    });
    assert.notEqual(r1Updated.sha256, r1.sha256);
    assert.equal(store.physicalBlobCount, 2);

    // Alice deletes her revised draft -> v2 blob is reclaimed immediately
    const d1 = store.deleteAttachmentRef({
      userId: 'u-alice',
      emailId: 'e-101',
      filename: 'deck.pdf',
    });
    assert.deepEqual(d1, { reclaimedBlob: true, remainingRefs: 0 });
    assert.equal(store.physicalBlobCount, 1);

    // Bob deletes his email -> original v1 blob refCount reaches 0 and physical storage is reclaimed
    const d2 = store.deleteAttachmentRef({
      userId: 'u-bob',
      emailId: 'e-202',
      filename: 'forwarded-deck.pdf',
    });
    assert.deepEqual(d2, { reclaimedBlob: true, remainingRefs: 0 });
    assert.equal(store.physicalBlobCount, 0);
    assert.equal(store.totalPhysicalBytes, 0);

    // Property test: across arbitrary multi-user uploads, overwrites, and partial deletions,
    // physicalBlobCount always equals the exact number of distinct active payloads referenced
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            userIdx: fc.integer({ min: 1, max: 4 }),
            emailIdx: fc.integer({ min: 1, max: 4 }),
            payloadIdx: fc.integer({ min: 1, max: 4 }),
            deleteImmediately: fc.boolean(),
          }),
          { minLength: 1, maxLength: 35 },
        ),
        (ops) => {
          const cas = new ContentAddressedAttachmentStore();
          const activeRefToPayload = new Map<string, number>();

          for (const op of ops) {
            const userId = `u-${op.userIdx}`;
            const emailId = `e-${op.emailIdx}`;
            const filename = 'attachment.bin';
            const refKey = `${userId}:${emailId}:${filename}`;

            cas.putAttachment({
              userId,
              emailId,
              filename,
              content: `unique-binary-blob-content-${op.payloadIdx}`,
              mimeType: 'application/octet-stream',
            });
            activeRefToPayload.set(refKey, op.payloadIdx);

            if (op.deleteImmediately) {
              cas.deleteAttachmentRef({ userId, emailId, filename });
              activeRefToPayload.delete(refKey);
            }
          }

          const uniqueActivePayloads = new Set(activeRefToPayload.values());
          assert.equal(cas.physicalBlobCount, uniqueActivePayloads.size);
        },
      ),
      { seed: 20261121, numRuns: 100 },
    );
  });

  it('DeliverabilityPoolGuard enforces exponential IP warm-up caps and trips/recovers the rolling 0.3% spam-complaint circuit breaker on marketing while keeping transactional 2FA mail flowing', () => {
    // Day 1 cap = 500, Day 4 cap = 4,000, Day 20 cap clamped to 1,000,000
    assert.equal(computeWarmupDailyCap(1, 500, 1_000_000), 500);
    assert.equal(computeWarmupDailyCap(4, 500, 1_000_000), 4_000);
    assert.equal(computeWarmupDailyCap(20, 500, 1_000_000), 1_000_000);

    const guard = new DeliverabilityPoolGuard({
      maxComplaintRate: 0.003,
      minSampleForBreaker: 1000,
      maxRollingBatches: 2,
    });
    guard.setWarmupDay('transactional', 15);
    guard.setWarmupDay('marketing', 1); // Day 1 warm-up cap = 500

    // Negative test 1: Marketing campaign attempting to burst 600 emails on Warm-up Day 1 is throttled
    assert.deepEqual(guard.tryDispatchBatch('marketing', 400), { allowed: true, reason: 'OK' });
    assert.deepEqual(guard.tryDispatchBatch('marketing', 200), {
      allowed: false,
      reason: 'WARMUP_CAP_EXCEEDED',
    });

    // Advance marketing IP to Day 15 (steady state), then simulate ISP FBL reporting 40 complaints on 10,000 deliveries (0.4% >= 0.3% ceiling!)
    guard.setWarmupDay('marketing', 15);
    const complaintRate = guard.recordFblMetrics('marketing', 10_000, 40);
    assert.equal(complaintRate, 0.004);

    // Negative test 2: Marketing pool circuit breaker trips open to protect domain reputation
    assert.deepEqual(guard.tryDispatchBatch('marketing', 50), {
      allowed: false,
      reason: 'COMPLAINT_BREAKER_OPEN',
    });

    // Positive isolation proof: Transactional IP pool (password resets / 2FA OTPs) remains completely unaffected!
    guard.recordFblMetrics('transactional', 10_000, 1); // 0.01% complaint rate
    assert.deepEqual(guard.tryDispatchBatch('transactional', 500), {
      allowed: true,
      reason: 'OK',
    });

    // Rolling window recovery proof: after pausing the bad campaign, two clean 10,000-delivery batches evict the spike from the 2-batch window
    guard.recordFblMetrics('marketing', 10_000, 2);
    guard.recordFblMetrics('marketing', 10_000, 2); // rolling rate = 4 / 20,000 = 0.02% < 0.3%
    assert.deepEqual(guard.tryDispatchBatch('marketing', 50), {
      allowed: true,
      reason: 'OK',
    });
  });
});
