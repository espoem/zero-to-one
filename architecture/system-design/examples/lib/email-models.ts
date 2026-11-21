/**
 * Executable models for Module 20: Distributed Email Service (ByteByteGo Ch. 23).
 * Covers:
 *  1. Planetary capacity estimation (1B users, 730 PB/yr metadata, 1,460 PB/yr attachments,
 *     RFC 2045 Base64 4/3 wire overhead, and SHA-256 deduplication savings)
 *  2. Email authentication & deliverability evaluator: SPF (RFC 7208), DKIM (RFC 6376),
 *     DMARC (RFC 7489) strict/relaxed identifier alignment (with eTLD+1 public-suffix awareness),
 *     and ARC (RFC 8617) forwarding chain
 *  3. RFC 5322 / JWZ conversation thread tree reconstruction (`Message-Id`, `In-Reply-To`,
 *     `References[]`) handling out-of-order arrivals, missing intermediate parents, and cycle defense
 *  4. Content-Addressed Attachment Store (`SHA-256` deduplication + reference-counted GC + overwrite safety)
 *  5. Deliverability IP pool isolation (`transactional` vs `marketing`), exponential IP warm-up caps,
 *     and rolling 0.3% (0.003) spam-complaint circuit breaker (Gmail/Yahoo bulk-sender mandate)
 */

import { createHash } from 'node:crypto';

export interface EmailStorageEstimate {
  readonly outboundEmailsPerSec: number;
  readonly inboundEmailsPerSec: number;
  readonly dailyMetadataPb: number;
  readonly annualMetadataPb: number;
  readonly dailyRawAttachmentPb: number;
  readonly annualRawAttachmentPb: number;
  readonly annualDeduplicatedAttachmentPb: number;
  readonly maxRawBinaryBytesForMimeCap: number;
}

/**
 * Computes RFC 2045 Base64 encoded payload byte size (`ceil(rawBytes / 3) * 4`,
 * plus optional 2-byte `\r\n` line breaks every 76 encoded characters).
 */
export function computeBase64WireBytes(rawBytes: number, includeMimeLineBreaks = false): number {
  if (rawBytes < 0 || !Number.isInteger(rawBytes)) {
    throw new RangeError('rawBytes must be a non-negative integer');
  }
  if (rawBytes === 0) return 0;
  const base64Chars = Math.ceil(rawBytes / 3) * 4;
  if (!includeMimeLineBreaks) return base64Chars;
  const lines = Math.ceil(base64Chars / 76);
  return base64Chars + Math.max(0, lines - 1) * 2;
}

/**
 * Planetary-scale capacity model for ByteByteGo Ch. 23 (default: 1B users, 10 sent/day,
 * 40 received/day, 50 KB metadata+body, 20% attachments at 500 KB average).
 */
export function estimateEmailStorage(options: {
  totalUsers: number;
  emailsSentPerUserDay: number;
  emailsReceivedPerUserDay: number;
  avgMetadataBytes: number;
  attachmentFraction: number;
  avgAttachmentBytes: number;
  attachmentDedupeRatio: number; // e.g. 2.5 means 2.5 logical refs per unique physical blob
  smtpMimeLimitBytes: number;
}): EmailStorageEstimate {
  const dailySent = options.totalUsers * options.emailsSentPerUserDay;
  const dailyReceived = options.totalUsers * options.emailsReceivedPerUserDay;
  const outboundEmailsPerSec = dailySent / 86_400;
  const inboundEmailsPerSec = dailyReceived / 86_400;

  const dailyMetadataBytes = dailyReceived * options.avgMetadataBytes;
  const dailyMetadataPb = dailyMetadataBytes / 1e15;
  const annualMetadataPb = dailyMetadataPb * 365;

  const dailyRawAttachmentBytes =
    dailyReceived * options.attachmentFraction * options.avgAttachmentBytes;
  const dailyRawAttachmentPb = dailyRawAttachmentBytes / 1e15;
  const annualRawAttachmentPb = dailyRawAttachmentPb * 365;
  const annualDeduplicatedAttachmentPb = annualRawAttachmentPb / options.attachmentDedupeRatio;

  // Base64 expands 3 binary bytes into 4 ASCII characters -> max raw binary is ~3/4 of MIME limit
  const maxRawBinaryBytesForMimeCap = Math.floor((options.smtpMimeLimitBytes * 3) / 4);

  return {
    outboundEmailsPerSec,
    inboundEmailsPerSec,
    dailyMetadataPb,
    annualMetadataPb,
    dailyRawAttachmentPb,
    annualRawAttachmentPb,
    annualDeduplicatedAttachmentPb,
    maxRawBinaryBytesForMimeCap,
  };
}

type AlignmentMode = 'strict' | 'relaxed';
type DmarcPolicy = 'none' | 'quarantine' | 'reject';

export interface EmailAuthInput {
  readonly headerFromDomain: string; // RFC 5322 visible `From:` domain
  readonly envelopeMailFromDomain: string; // RFC 5321 `MAIL FROM` (Return-Path)
  readonly spfPass: boolean;
  readonly dkimPass: boolean;
  readonly dkimSigningDomain: string | null; // DKIM `d=` tag
  readonly alignmentMode: AlignmentMode;
  readonly dmarcPolicy: DmarcPolicy;
  readonly trustedArcChainPass?: boolean; // RFC 8617 Authenticated Received Chain from known forwarder
}

export interface EmailAuthVerdict {
  readonly spfAlignedPass: boolean;
  readonly dkimAlignedPass: boolean;
  readonly dmarcPass: boolean;
  readonly disposition: 'accept' | 'quarantine' | 'reject';
  readonly reason: string;
}

const MULTI_LABEL_PUBLIC_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'gov.uk',
  'ac.uk',
  'com.au',
  'co.jp',
  'com.br',
  'co.nz',
  'co.in',
]);

/**
 * Extracts the organizational domain (`eTLD+1`, RFC 7489 §3.2) respecting common two-label
 * country-code public suffixes (such as `.co.uk` and `.com.au`) so unrelated registrants
 * like `bank.co.uk` and `evil.co.uk` never align to `co.uk`.
 */
function normalizeOrgDomain(domain: string): string {
  const parts = domain.toLowerCase().trim().split('.').filter(Boolean);
  if (parts.length <= 2) return parts.join('.');
  const lastTwo = parts.slice(-2).join('.');
  const labelCount = MULTI_LABEL_PUBLIC_SUFFIXES.has(lastTwo) ? 3 : 2;
  return parts.slice(-labelCount).join('.');
}

function domainsAlign(headerFrom: string, candidate: string, mode: AlignmentMode): boolean {
  const h = headerFrom.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();
  if (mode === 'strict') {
    return h === c;
  }
  return h === c || normalizeOrgDomain(h) === normalizeOrgDomain(c);
}

/**
 * Evaluates SPF (RFC 7208), DKIM (RFC 6376), DMARC identifier alignment (RFC 7489),
 * and ARC forwarding recovery (RFC 8617) for an inbound SMTP message.
 */
export function evaluateEmailAuth(input: EmailAuthInput): EmailAuthVerdict {
  const spfAlignedPass =
    input.spfPass &&
    domainsAlign(input.headerFromDomain, input.envelopeMailFromDomain, input.alignmentMode);

  const dkimAlignedPass =
    input.dkimPass &&
    input.dkimSigningDomain !== null &&
    domainsAlign(input.headerFromDomain, input.dkimSigningDomain, input.alignmentMode);

  const dmarcPass = spfAlignedPass || dkimAlignedPass;

  if (dmarcPass) {
    return {
      spfAlignedPass,
      dkimAlignedPass,
      dmarcPass: true,
      disposition: 'accept',
      reason: dkimAlignedPass ? 'DMARC pass via aligned DKIM' : 'DMARC pass via aligned SPF',
    };
  }

  // RFC 8617 ARC override for legitimate indirect mail flows (mailing lists / forwarding)
  if (input.trustedArcChainPass) {
    return {
      spfAlignedPass,
      dkimAlignedPass,
      dmarcPass: false,
      disposition: 'accept',
      reason: 'DMARC override via validated RFC 8617 ARC forwarding seal',
    };
  }

  const disposition =
    input.dmarcPolicy === 'reject'
      ? 'reject'
      : input.dmarcPolicy === 'quarantine'
        ? 'quarantine'
        : 'accept';

  return {
    spfAlignedPass,
    dkimAlignedPass,
    dmarcPass: false,
    disposition,
    reason: `DMARC fail (spfAligned=${spfAlignedPass}, dkimAligned=${dkimAlignedPass}) -> policy ${input.dmarcPolicy}`,
  };
}

export interface ThreadMessageHeader {
  readonly messageId: string;
  readonly inReplyTo: string | null;
  readonly references: readonly string[];
  readonly timestampMs: number;
  readonly subject: string;
}

export interface ThreadNode {
  readonly messageId: string;
  readonly parentId: string | null;
  readonly isPlaceholder: boolean;
  readonly children: string[];
}

/**
 * Reconstructs a deterministic conversation thread hierarchy from RFC 5322 headers
 * (`Message-Id`, `In-Reply-To`, `References[]`) inspired by the JWZ threading algorithm:
 *  - Sorts messages chronologically by `(timestampMs ASC, messageId ASC)` so parent linking
 *    and cycle breaking are strictly independent of network arrival order
 *  - Creates placeholder nodes for missing intermediate ancestors referenced in `References`
 *  - Prevents cycle creation if malformed headers contain circular `In-Reply-To` references
 */
export function reconstructThreadTree(
  messages: readonly ThreadMessageHeader[],
): ReadonlyMap<string, ThreadNode> {
  const sorted = [...messages].sort(
    (a, b) => a.timestampMs - b.timestampMs || a.messageId.localeCompare(b.messageId),
  );

  const nodes = new Map<
    string,
    { messageId: string; parentId: string | null; isPlaceholder: boolean; children: string[] }
  >();

  const ensureNode = (id: string, isPlaceholder: boolean) => {
    let existing = nodes.get(id);
    if (!existing) {
      existing = { messageId: id, parentId: null, isPlaceholder, children: [] };
      nodes.set(id, existing);
    } else if (!isPlaceholder) {
      existing.isPlaceholder = false;
    }
    return existing;
  };

  // Returns true if setting `child.parentId = candidateParentId` would create a cycle
  const createsCycle = (childId: string, candidateParentId: string): boolean => {
    let cur: string | null = candidateParentId;
    const visited = new Set<string>();
    while (cur !== null) {
      if (cur === childId) return true;
      if (visited.has(cur)) return true;
      visited.add(cur);
      cur = nodes.get(cur)?.parentId ?? null;
    }
    return false;
  };

  const linkParent = (childId: string, parentId: string) => {
    if (childId === parentId) return;
    const child = nodes.get(childId)!;
    const parent = nodes.get(parentId)!;
    if (child.parentId !== null || createsCycle(childId, parentId)) return;
    child.parentId = parentId;
    if (!parent.children.includes(childId)) {
      parent.children.push(childId);
    }
  };

  for (const msg of sorted) {
    ensureNode(msg.messageId, false);
    for (const refId of msg.references) {
      ensureNode(refId, true);
    }
    if (msg.inReplyTo) {
      ensureNode(msg.inReplyTo, true);
    }
  }

  for (const msg of sorted) {
    // Link adjacent chain in `References: [root, ..., parent]`
    for (let i = 0; i + 1 < msg.references.length; i++) {
      const ancestor = msg.references[i]!;
      const descendant = msg.references[i + 1]!;
      linkParent(descendant, ancestor);
    }

    const explicitParent = msg.inReplyTo ?? msg.references.at(-1) ?? null;
    if (explicitParent) {
      linkParent(msg.messageId, explicitParent);
    }
  }

  return nodes;
}

interface AttachmentBlob {
  readonly sha256: string;
  readonly byteSize: number;
  readonly mimeType: string;
  refCount: number;
}

/**
 * Content-Addressed Attachment Store (CAS) keying binary blobs by `SHA-256` digest
 * with reference-counted garbage collection across `(userId, emailId, filename)` links.
 */
export class ContentAddressedAttachmentStore {
  private readonly blobs = new Map<string, AttachmentBlob>();
  private readonly messageRefs = new Map<string, string>(); // `${userId}:${emailId}:${filename}` -> sha256

  putAttachment(params: {
    userId: string;
    emailId: string;
    filename: string;
    content: string | Uint8Array;
    mimeType: string;
  }): { sha256: string; deduplicated: boolean; refCount: number } {
    const refKey = `${params.userId}:${params.emailId}:${params.filename}`;
    const sha256 = createHash('sha256').update(params.content).digest('hex');

    // Idempotent retry if the exact same user message attachment link already points to this sha256
    const existingSha = this.messageRefs.get(refKey);
    if (existingSha === sha256) {
      const blob = this.blobs.get(sha256)!;
      return { sha256, deduplicated: true, refCount: blob.refCount };
    }

    // Overwrite safety: if `(userId, emailId, filename)` previously referenced a different blob
    // (e.g. user replaced an attachment on a draft), release the old blob reference first!
    if (existingSha !== undefined) {
      this.deleteAttachmentRef({
        userId: params.userId,
        emailId: params.emailId,
        filename: params.filename,
      });
    }

    const byteSize =
      typeof params.content === 'string'
        ? Buffer.byteLength(params.content, 'utf8')
        : params.content.byteLength;

    let blob = this.blobs.get(sha256);
    let deduplicated = false;
    if (blob) {
      blob.refCount += 1;
      deduplicated = true;
    } else {
      blob = { sha256, byteSize, mimeType: params.mimeType, refCount: 1 };
      this.blobs.set(sha256, blob);
    }

    this.messageRefs.set(refKey, sha256);
    return { sha256, deduplicated, refCount: blob.refCount };
  }

  deleteAttachmentRef(params: { userId: string; emailId: string; filename: string }): {
    reclaimedBlob: boolean;
    remainingRefs: number;
  } {
    const refKey = `${params.userId}:${params.emailId}:${params.filename}`;
    const sha256 = this.messageRefs.get(refKey);
    if (!sha256) {
      return { reclaimedBlob: false, remainingRefs: 0 };
    }

    this.messageRefs.delete(refKey);
    const blob = this.blobs.get(sha256);
    if (!blob) {
      return { reclaimedBlob: false, remainingRefs: 0 };
    }

    blob.refCount -= 1;
    if (blob.refCount <= 0) {
      this.blobs.delete(sha256);
      return { reclaimedBlob: true, remainingRefs: 0 };
    }
    return { reclaimedBlob: false, remainingRefs: blob.refCount };
  }

  get physicalBlobCount(): number {
    return this.blobs.size;
  }

  get totalPhysicalBytes(): number {
    let sum = 0;
    for (const blob of this.blobs.values()) {
      sum += blob.byteSize;
    }
    return sum;
  }
}

type IpPoolCategory = 'transactional' | 'marketing';

interface FblBatchSample {
  readonly delivered: number;
  readonly complaints: number;
}

interface IpPoolState {
  readonly category: IpPoolCategory;
  warmupDay: number;
  sentToday: number;
  readonly rollingBatches: FblBatchSample[];
  haltedByComplaintBreaker: boolean;
}

/**
 * Computes the maximum daily emails permitted for a dedicated IP on `warmupDay` (1..42)
 * using an exponential warm-up schedule (`baseDailyLimit * 2^(day - 1)` clamped to `steadyStateCap`).
 */
export function computeWarmupDailyCap(
  warmupDay: number,
  baseDailyLimit = 500,
  steadyStateCap = 1_000_000,
): number {
  if (!Number.isInteger(warmupDay) || warmupDay < 1) {
    throw new RangeError('warmupDay must be a positive integer');
  }
  const scaled = baseDailyLimit * Math.pow(2, warmupDay - 1);
  return Math.min(steadyStateCap, Math.floor(scaled));
}

/**
 * Outbound deliverability controller isolating `transactional` (2FA, password resets) and
 * `marketing` IP pools, enforcing IP warm-up daily caps and evaluating a rolling sliding
 * window of ISP Feedback Loop (FBL) batches against the 0.3% (0.003) bulk-sender threshold.
 */
export class DeliverabilityPoolGuard {
  readonly maxComplaintRate: number;
  readonly minSampleForBreaker: number;
  readonly maxRollingBatches: number;
  private readonly pools = new Map<IpPoolCategory, IpPoolState>();

  constructor(
    options: {
      maxComplaintRate?: number;
      minSampleForBreaker?: number;
      maxRollingBatches?: number;
    } = {},
  ) {
    this.maxComplaintRate = options.maxComplaintRate ?? 0.003; // 0.3% Gmail/Yahoo bulk ceiling
    this.minSampleForBreaker = options.minSampleForBreaker ?? 100;
    this.maxRollingBatches = options.maxRollingBatches ?? 5;
    for (const category of ['transactional', 'marketing'] as const) {
      this.pools.set(category, {
        category,
        warmupDay: 1,
        sentToday: 0,
        rollingBatches: [],
        haltedByComplaintBreaker: false,
      });
    }
  }

  setWarmupDay(category: IpPoolCategory, day: number): void {
    const pool = this.pools.get(category)!;
    pool.warmupDay = day;
    pool.sentToday = 0;
  }

  recordFblMetrics(category: IpPoolCategory, delivered: number, complaints: number): number {
    const pool = this.pools.get(category)!;
    pool.rollingBatches.push({ delivered, complaints });
    if (pool.rollingBatches.length > this.maxRollingBatches) {
      pool.rollingBatches.shift();
    }

    let windowDelivered = 0;
    let windowComplaints = 0;
    for (const b of pool.rollingBatches) {
      windowDelivered += b.delivered;
      windowComplaints += b.complaints;
    }

    const rate = windowDelivered > 0 ? windowComplaints / windowDelivered : 0;
    pool.haltedByComplaintBreaker =
      windowDelivered >= this.minSampleForBreaker && rate >= this.maxComplaintRate;
    return rate;
  }

  tryDispatchBatch(
    category: IpPoolCategory,
    count: number,
  ): { allowed: boolean; reason: 'OK' | 'COMPLAINT_BREAKER_OPEN' | 'WARMUP_CAP_EXCEEDED' } {
    const pool = this.pools.get(category)!;
    if (pool.haltedByComplaintBreaker) {
      return { allowed: false, reason: 'COMPLAINT_BREAKER_OPEN' };
    }
    const dailyCap = computeWarmupDailyCap(pool.warmupDay);
    if (pool.sentToday + count > dailyCap) {
      return { allowed: false, reason: 'WARMUP_CAP_EXCEEDED' };
    }
    pool.sentToday += count;
    return { allowed: true, reason: 'OK' };
  }
}
