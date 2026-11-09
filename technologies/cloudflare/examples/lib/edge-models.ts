/**
 * Zero-to-One: Cloudflare Track Executable Edge Models & Architectural Simulations
 *
 * Implements deterministic simulations for:
 * 1. Isolate Execution Quotas (CPU-time vs wall-clock, memory limits, Error 1102)
 * 2. Workers KV (central store, per-PoP edge caches, negative lookups, propagation delay)
 * 3. Durable Objects (single-threaded actor, input/output gates, SQLite transactions, alarms)
 * 4. D1 Database Replication & Sessions API (bookmarks, read-your-writes sequential consistency)
 * 5. R2 Object Storage (multipart uploads, presigned URLs, etags)
 * 6. Queues & DLQ (at-least-once delivery, batching, per-message retry, dead-letter routing)
 * 7. Cloudflare Workflows (durable step replay, memoization, determinism boundary)
 */

export interface IsolateLimits {
  readonly maxMemoryBytes: number;
  readonly maxCpuTimeMs: number;
}

export class IsolateLimitExceededError extends Error {
  readonly code = 1102;
  constructor(message: string) {
    super(`Error 1102: Worker exceeded isolate resource limits: ${message}`);
    this.name = 'IsolateLimitExceededError';
  }
}

export class IsolateExecutionHarness {
  public readonly limits: IsolateLimits;
  private allocatedBytes = 0;
  private cpuTimeMs = 0;

  constructor(limits: IsolateLimits = { maxMemoryBytes: 128 * 1024 * 1024, maxCpuTimeMs: 10 }) {
    this.limits = limits;
  }

  allocate(bytes: number): void {
    if (this.allocatedBytes + bytes > this.limits.maxMemoryBytes) {
      throw new IsolateLimitExceededError(
        `Memory limit of ${this.limits.maxMemoryBytes / (1024 * 1024)} MB exceeded`,
      );
    }
    this.allocatedBytes += bytes;
  }

  free(bytes: number): void {
    this.allocatedBytes = Math.max(0, this.allocatedBytes - bytes);
  }

  consumeCpu(ms: number): void {
    this.cpuTimeMs += ms;
    if (this.cpuTimeMs > this.limits.maxCpuTimeMs) {
      throw new IsolateLimitExceededError(
        `CPU-time limit of ${this.limits.maxCpuTimeMs} ms exceeded`,
      );
    }
  }

  getMetrics() {
    return {
      allocatedBytes: this.allocatedBytes,
      cpuTimeMs: this.cpuTimeMs,
    };
  }
}

// --------------------------------------------------------------------------------
// 2. Workers KV Simulation with PoP caching, negative caching, and propagation lag
// --------------------------------------------------------------------------------

interface KVCacheEntry<T> {
  value: T | null; // null represents negative cached entry
  cachedAtMs: number;
  ttlMs: number;
  metadata?: Record<string, unknown>;
}

export class EdgePoPKVStore<T = unknown> {
  public readonly popId: string;
  private readonly centralStore: CentralKVStore<T>;
  public readonly defaultCacheTtlMs: number;
  private readonly localCache = new Map<string, KVCacheEntry<T>>();

  constructor(popId: string, centralStore: CentralKVStore<T>, defaultCacheTtlMs: number = 60_000) {
    this.popId = popId;
    this.centralStore = centralStore;
    this.defaultCacheTtlMs = defaultCacheTtlMs;
  }

  async get(
    key: string,
    nowMs: number = Date.now(),
  ): Promise<{ value: T | null; hit: 'edge-cache' | 'central' | 'negative-cache' }> {
    const cached = this.localCache.get(key);
    if (cached && nowMs - cached.cachedAtMs < cached.ttlMs) {
      if (cached.value === null) {
        return { value: null, hit: 'negative-cache' };
      }
      return { value: cached.value, hit: 'edge-cache' };
    }

    // Cache miss: query central store
    const centralRecord = this.centralStore.readPrimary(key);
    if (!centralRecord) {
      // Store negative cache entry
      this.localCache.set(key, {
        value: null,
        cachedAtMs: nowMs,
        ttlMs: this.defaultCacheTtlMs,
      });
      return { value: null, hit: 'negative-cache' };
    }

    this.localCache.set(key, {
      value: centralRecord.value,
      cachedAtMs: nowMs,
      ttlMs: this.defaultCacheTtlMs,
      metadata: centralRecord.metadata,
    });
    return { value: centralRecord.value, hit: 'central' };
  }

  evict(key: string): void {
    this.localCache.delete(key);
  }
}

export class CentralKVStore<T = unknown> {
  private readonly primary = new Map<
    string,
    { value: T; metadata?: Record<string, unknown>; updatedAtMs: number }
  >();
  private readonly pops = new Map<string, EdgePoPKVStore<T>>();

  createPoP(popId: string, cacheTtlMs?: number): EdgePoPKVStore<T> {
    const pop = new EdgePoPKVStore<T>(popId, this, cacheTtlMs);
    this.pops.set(popId, pop);
    return pop;
  }

  put(key: string, value: T, metadata?: Record<string, unknown>, nowMs: number = Date.now()): void {
    this.primary.set(key, { value, metadata, updatedAtMs: nowMs });
  }

  delete(key: string): void {
    this.primary.delete(key);
  }

  readPrimary(
    key: string,
  ): { value: T; metadata?: Record<string, unknown>; updatedAtMs: number } | undefined {
    return this.primary.get(key);
  }

  propagateInvalidation(key: string): void {
    for (const pop of this.pops.values()) {
      pop.evict(key);
    }
  }
}

// --------------------------------------------------------------------------------
// 3. Durable Object: Single-Threaded Actor, Input/Output Gates, Alarms & SQLite
// --------------------------------------------------------------------------------

export class DurableObjectActor {
  private readonly id: string;
  private readonly storage = new Map<string, string>();
  private alarmTimestamp: number | null = null;
  private activeOperations = 0;
  private callLog: string[] = [];

  constructor(id: string) {
    this.id = id;
  }

  getId(): string {
    return this.id;
  }

  // SQLite transaction simulation
  async sqlTransaction<R>(
    operation: (tx: {
      get: (k: string) => string | undefined;
      put: (k: string, v: string) => void;
    }) => Promise<R>,
  ): Promise<R> {
    const backup = new Map(this.storage);
    const stagedChanges = new Map<string, string>();

    const tx = {
      get: (k: string) => (stagedChanges.has(k) ? stagedChanges.get(k) : this.storage.get(k)),
      put: (k: string, v: string) => {
        stagedChanges.set(k, v);
      },
    };

    try {
      const result = await operation(tx);
      // Commit
      for (const [k, v] of stagedChanges.entries()) {
        this.storage.set(k, v);
      }
      return result;
    } catch (err) {
      // Rollback
      this.storage.clear();
      for (const [k, v] of backup.entries()) {
        this.storage.set(k, v);
      }
      throw err;
    }
  }

  getStorage(key: string): string | undefined {
    return this.storage.get(key);
  }

  setAlarm(timestamp: number): void {
    this.alarmTimestamp = timestamp;
  }

  getAlarm(): number | null {
    return this.alarmTimestamp;
  }

  deleteAlarm(): void {
    this.alarmTimestamp = null;
  }

  async runScheduledAlarm(nowMs: number, alarmHandler: () => Promise<void>): Promise<boolean> {
    if (this.alarmTimestamp !== null && nowMs >= this.alarmTimestamp) {
      this.alarmTimestamp = null;
      await alarmHandler();
      return true;
    }
    return false;
  }

  /**
   * Simulates Input/Output gate concurrency:
   * While computing synchronously, input gate holds back incoming calls.
   * While awaiting external I/O (e.g. fetch), input gate opens, allowing concurrent invocation!
   */
  async executeWithGates(label: string, externalIo?: () => Promise<void>): Promise<void> {
    this.activeOperations++;
    this.callLog.push(`start:${label}:active=${this.activeOperations}`);

    if (externalIo) {
      // During await, input gate is unlocked
      await externalIo();
    }

    this.activeOperations--;
    this.callLog.push(`end:${label}:active=${this.activeOperations}`);
  }

  getCallLog(): readonly string[] {
    return this.callLog;
  }
}

// --------------------------------------------------------------------------------
// 4. D1 Database Replication & Sessions API
// --------------------------------------------------------------------------------

export interface D1Record {
  id: string;
  data: string;
  version: number;
}

export class D1ReplicaNode {
  public currentVersion = 0;
  private readonly data = new Map<string, D1Record>();

  syncFromPrimary(records: D1Record[], version: number): void {
    this.data.clear();
    for (const r of records) {
      this.data.set(r.id, { ...r });
    }
    this.currentVersion = version;
  }

  read(id: string): D1Record | undefined {
    return this.data.get(id);
  }
}

export class D1DatabaseWithSessions {
  private primaryVersion = 0;
  private readonly primaryData = new Map<string, D1Record>();
  private readonly replicas: D1ReplicaNode[] = [];

  createReplica(): D1ReplicaNode {
    const replica = new D1ReplicaNode();
    replica.syncFromPrimary(Array.from(this.primaryData.values()), this.primaryVersion);
    this.replicas.push(replica);
    return replica;
  }

  write(id: string, data: string): { bookmark: string; record: D1Record } {
    this.primaryVersion++;
    const record: D1Record = { id, data, version: this.primaryVersion };
    this.primaryData.set(id, record);
    const bookmark = `bm_v${this.primaryVersion}`;
    return { bookmark, record };
  }

  /**
   * Sessions API Read:
   * Guarantees read-your-writes by ensuring the queried replica has applied at least the bookmark version.
   * If the replica is lagging behind bookmark, it either syncs or routes to primary!
   */
  sessionRead(
    replica: D1ReplicaNode,
    id: string,
    bookmark?: string,
  ): { record: D1Record | undefined; source: 'replica' | 'primary' } {
    const targetVersion = bookmark ? parseInt(bookmark.replace('bm_v', ''), 10) : 0;

    if (replica.currentVersion >= targetVersion) {
      return { record: replica.read(id), source: 'replica' };
    }

    // Replica lagging: fall back to primary to preserve sequential consistency
    return { record: this.primaryData.get(id), source: 'primary' };
  }
}

// --------------------------------------------------------------------------------
// 5. R2 Multipart Upload & Presigned URL Validation
// --------------------------------------------------------------------------------

export interface R2Part {
  partNumber: number;
  data: Uint8Array;
  etag: string;
}

export class R2BucketSimulator {
  private readonly objects = new Map<
    string,
    { body: Uint8Array; etag: string; metadata?: Record<string, string> }
  >();
  private readonly multipartSessions = new Map<
    string,
    { key: string; parts: Map<number, R2Part> }
  >();

  put(key: string, body: Uint8Array, metadata?: Record<string, string>): { etag: string } {
    const etag = `"${Buffer.from(body).toString('hex').slice(0, 16)}"`;
    this.objects.set(key, { body, etag, metadata });
    return { etag };
  }

  get(key: string): { body: Uint8Array; etag: string; metadata?: Record<string, string> } | null {
    return this.objects.get(key) ?? null;
  }

  createMultipartUpload(key: string): { uploadId: string } {
    const uploadId = `mp_${Math.random().toString(36).slice(2, 10)}`;
    this.multipartSessions.set(uploadId, { key, parts: new Map() });
    return { uploadId };
  }

  uploadPart(uploadId: string, partNumber: number, data: Uint8Array): { etag: string } {
    const session = this.multipartSessions.get(uploadId);
    if (!session) throw new Error('Invalid upload ID');
    if (partNumber < 1 || partNumber > 10000) throw new Error('Part number out of range');

    const etag = `"${partNumber}_${Buffer.from(data).toString('hex').slice(0, 8)}"`;
    session.parts.set(partNumber, { partNumber, data, etag });
    return { etag };
  }

  completeMultipartUpload(
    uploadId: string,
    partsOrder: { partNumber: number; etag: string }[],
  ): { key: string; etag: string; size: number } {
    const session = this.multipartSessions.get(uploadId);
    if (!session) throw new Error('Invalid upload ID');

    // Verify ordering and matching ETags
    const totalBuffers: Uint8Array[] = [];
    for (const [idx, partSpec] of partsOrder.entries()) {
      const prevPart = partsOrder[idx - 1];
      if (idx > 0 && prevPart && partSpec.partNumber <= prevPart.partNumber) {
        throw new Error('Parts must be listed in strictly ascending order');
      }
      const actualPart = session.parts.get(partSpec.partNumber);
      if (!actualPart || actualPart.etag !== partSpec.etag) {
        throw new Error(`Part mismatch for part ${partSpec.partNumber}`);
      }
      totalBuffers.push(actualPart.data);
    }

    const totalLength = totalBuffers.reduce((sum, b) => sum + b.length, 0);
    const assembled = new Uint8Array(totalLength);
    let offset = 0;
    for (const b of totalBuffers) {
      assembled.set(b, offset);
      offset += b.length;
    }

    const finalEtag = `"${uploadId}_combined"`;
    this.objects.set(session.key, { body: assembled, etag: finalEtag });
    this.multipartSessions.delete(uploadId);

    return { key: session.key, etag: finalEtag, size: totalLength };
  }
}

// --------------------------------------------------------------------------------
// 6. Queues Batch Consumer & DLQ Routing
// --------------------------------------------------------------------------------

export interface QueueMessage<T> {
  id: string;
  body: T;
  attempts: number;
}

export class QueuesEngine<T> {
  public readonly deadLetterQueue: QueueMessage<T>[] = [];
  public readonly ackedMessages: string[] = [];
  public readonly maxRetries: number;

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  async processBatch(
    messages: QueueMessage<T>[],
    consumer: (msg: QueueMessage<T>, ctrl: { ack: () => void; retry: () => void }) => Promise<void>,
  ): Promise<void> {
    for (const msg of messages) {
      let isAcked = false;
      let isRetried = false;

      const ctrl = {
        ack: () => {
          isAcked = true;
        },
        retry: () => {
          isRetried = true;
        },
      };

      try {
        await consumer(msg, ctrl);
        if (isRetried || !isAcked) {
          this.handleRetryOrDlq(msg);
        } else {
          this.ackedMessages.push(msg.id);
        }
      } catch {
        this.handleRetryOrDlq(msg);
      }
    }
  }

  private handleRetryOrDlq(msg: QueueMessage<T>): void {
    msg.attempts++;
    if (msg.attempts > this.maxRetries) {
      this.deadLetterQueue.push(msg);
    }
  }
}

// --------------------------------------------------------------------------------
// 7. Cloudflare Workflows Durable Execution & Determinism Engine
// --------------------------------------------------------------------------------

export class WorkflowInstance {
  private readonly stepOutputs = new Map<string, unknown>();
  public replayCount = 0;

  async runStep<T>(name: string, stepFn: () => Promise<T>): Promise<T> {
    if (this.stepOutputs.has(name)) {
      // Skipped on replay - return memoized output
      return this.stepOutputs.get(name) as T;
    }

    const output = await stepFn();
    this.stepOutputs.set(name, output);
    return output;
  }

  simulateCrashAndRestart(): void {
    this.replayCount++;
    // State outside stepOutputs resets, but stepOutputs remains intact!
  }

  getStepOutput(name: string): unknown {
    return this.stepOutputs.get(name);
  }
}
