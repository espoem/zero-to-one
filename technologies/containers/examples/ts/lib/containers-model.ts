import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// 1. Linux Namespaces & Clone Bitmask & User-NS UID/GID Range Mapping
// ---------------------------------------------------------------------------

export const CLONE_FLAGS = {
  CLONE_NEWTIME: 0x00000080,
  CLONE_NEWNS: 0x00020000,
  CLONE_NEWCGROUP: 0x02000000,
  CLONE_NEWUTS: 0x04000000,
  CLONE_NEWIPC: 0x08000000,
  CLONE_NEWUSER: 0x10000000,
  CLONE_NEWPID: 0x20000000,
  CLONE_NEWNET: 0x40000000,
} as const;

export type CloneFlagName = keyof typeof CLONE_FLAGS;

export function parseCloneFlags(flags: number): CloneFlagName[] {
  const result: CloneFlagName[] = [];
  for (const [name, bit] of Object.entries(CLONE_FLAGS) as [CloneFlagName, number][]) {
    if ((flags & bit) === bit) {
      result.push(name);
    }
  }
  return result;
}

export function formatCloneFlags(names: CloneFlagName[]): number {
  let mask = 0;
  for (const name of names) {
    mask |= CLONE_FLAGS[name];
  }
  return mask;
}

export interface UidGidMapping {
  containerId: number;
  hostId: number;
  length: number;
}

export function parseUidMap(content: string): UidGidMapping[] {
  const lines = content.trim().split('\n');
  const mappings: UidGidMapping[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 3) {
      const containerId = parseInt(parts[0]!, 10);
      const hostId = parseInt(parts[1]!, 10);
      const length = parseInt(parts[2]!, 10);
      if (!Number.isNaN(containerId) && !Number.isNaN(hostId) && !Number.isNaN(length)) {
        mappings.push({ containerId, hostId, length });
      }
    }
  }

  return mappings;
}

export function mapToHost(
  containerId: number,
  mappings: UidGidMapping[],
  overflowId = 65534,
): number {
  for (const m of mappings) {
    if (containerId >= m.containerId && containerId < m.containerId + m.length) {
      const offset = containerId - m.containerId;
      return m.hostId + offset;
    }
  }
  return overflowId;
}

export function mapToContainer(
  hostId: number,
  mappings: UidGidMapping[],
  overflowId = 65534,
): number {
  for (const m of mappings) {
    if (hostId >= m.hostId && hostId < m.hostId + m.length) {
      const offset = hostId - m.hostId;
      return m.containerId + offset;
    }
  }
  return overflowId;
}

export interface RootlessUserNsConfig {
  hostUid: number;
  subuidStart: number;
  subuidCount: number;
  mode: 'default' | 'keep-id';
}

export function generateRootlessUidMap(config: RootlessUserNsConfig): UidGidMapping[] {
  if (config.mode === 'keep-id') {
    // With --userns=keep-id, container UID matching hostUid maps directly to hostUid!
    return [
      { containerId: 0, hostId: config.subuidStart, length: config.hostUid },
      { containerId: config.hostUid, hostId: config.hostUid, length: 1 },
      {
        containerId: config.hostUid + 1,
        hostId: config.subuidStart + config.hostUid,
        length: config.subuidCount - config.hostUid,
      },
    ];
  }

  // Default rootless: container UID 0 maps to host UID, container UID 1..N map to subuids
  return [
    { containerId: 0, hostId: config.hostUid, length: 1 },
    { containerId: 1, hostId: config.subuidStart, length: config.subuidCount },
  ];
}

// ---------------------------------------------------------------------------
// 2. PID 1 Signal Forwarding & Zombie Reaping State Machine
// ---------------------------------------------------------------------------

export type InitType = 'exec-form' | 'shell-form' | 'tini-init';

export interface ProcessNode {
  pid: number;
  ppid: number;
  name: string;
  isZombie: boolean;
  exitCode?: number;
}

export class ContainerProcessTree {
  public readonly initType: InitType;
  private nextPid = 1;
  public processes: Map<number, ProcessNode> = new Map();
  public signalsReceived: { targetPid: number; signal: string }[] = [];
  public gracePeriodExpired = false;

  constructor(initType: InitType) {
    this.initType = initType;
    if (initType === 'shell-form') {
      // PID 1 is /bin/sh -c "app"
      this.processes.set(1, { pid: 1, ppid: 0, name: '/bin/sh', isZombie: false });
      // Child process is the actual app (PID 2)
      this.processes.set(2, { pid: 2, ppid: 1, name: 'node-app', isZombie: false });
      this.nextPid = 3;
    } else if (initType === 'tini-init') {
      // PID 1 is tini
      this.processes.set(1, { pid: 1, ppid: 0, name: 'tini', isZombie: false });
      // Child process is the app
      this.processes.set(2, { pid: 2, ppid: 1, name: 'node-app', isZombie: false });
      this.nextPid = 3;
    } else {
      // Exec form: PID 1 is directly the app
      this.processes.set(1, { pid: 1, ppid: 0, name: 'node-app', isZombie: false });
      this.nextPid = 2;
    }
  }

  public spawn(ppid: number, name: string): number {
    const parent = this.processes.get(ppid);
    if (!parent || parent.isZombie) {
      throw new Error(`Cannot spawn from non-existent or zombie parent PID ${ppid}`);
    }
    const pid = this.nextPid++;
    this.processes.set(pid, { pid, ppid, name, isZombie: false });
    return pid;
  }

  public exit(pid: number, exitCode: number): void {
    const proc = this.processes.get(pid);
    if (!proc) {
      return;
    }
    proc.isZombie = true;
    proc.exitCode = exitCode;

    // Reparent orphaned children to PID 1
    for (const child of this.processes.values()) {
      if (child.ppid === pid && child.pid !== 1) {
        child.ppid = 1;
      }
    }
  }

  public sendSignal(signal: 'SIGTERM' | 'SIGKILL' | 'SIGINT'): {
    forwardedTo: number[];
    killedImmediately: boolean;
  } {
    this.signalsReceived.push({ targetPid: 1, signal });
    const forwardedTo: number[] = [];

    if (signal === 'SIGKILL') {
      // SIGKILL unconditionally destroys all processes in PID namespace
      for (const p of this.processes.values()) {
        p.isZombie = true;
        p.exitCode = 137; // 128 + 9
      }
      return { forwardedTo: [1], killedImmediately: true };
    }

    // Graceful signals (SIGTERM/SIGINT)
    if (this.initType === 'shell-form') {
      // Gotcha: /bin/sh DOES NOT forward SIGTERM to child processes!
      // Shell ignores SIGTERM unless trap is registered.
      return { forwardedTo: [], killedImmediately: false };
    }

    if (this.initType === 'tini-init') {
      // Tini forwards to its direct children
      for (const p of this.processes.values()) {
        if (p.ppid === 1 && !p.isZombie) {
          forwardedTo.push(p.pid);
          this.signalsReceived.push({ targetPid: p.pid, signal });
        }
      }
      return { forwardedTo, killedImmediately: false };
    }

    // Exec form: PID 1 received signal directly
    forwardedTo.push(1);
    return { forwardedTo, killedImmediately: false };
  }

  public reapZombies(): number[] {
    const reaped: number[] = [];

    if (this.initType === 'shell-form') {
      // Gotcha: Shell does not reap orphaned grandchildren!
      // Only reaps direct child if waited.
      return reaped;
    }

    if (this.initType === 'tini-init') {
      // Tini acts as subreaper and reaps all orphaned zombies reparented to PID 1
      for (const [pid, p] of this.processes.entries()) {
        if (p.ppid === 1 && p.isZombie && pid !== 1) {
          reaped.push(pid);
          this.processes.delete(pid);
        }
      }
    }

    return reaped;
  }

  public simulateStopTimeout(gracePeriodSec = 10): { exitCode: number; reason: string } {
    const { forwardedTo } = this.sendSignal('SIGTERM');

    if (forwardedTo.length === 0) {
      // Signal was ignored (e.g. shell-form entrypoint)
      // Daemon waits 10s grace period and then issues SIGKILL
      this.gracePeriodExpired = true;
      this.sendSignal('SIGKILL');
      return {
        exitCode: 137,
        reason: `SIGTERM ignored by PID 1; killed with SIGKILL after ${gracePeriodSec}s grace period`,
      };
    }

    // App received SIGTERM and shut down cleanly
    const appPid = forwardedTo[0] ?? 1;
    this.exit(appPid, 0);
    return {
      exitCode: 0,
      reason: 'Graceful shutdown on SIGTERM completed within grace period',
    };
  }
}

// ---------------------------------------------------------------------------
// 3. cgroups v2 Unified Hierarchy, Controllers & Throttling / OOM Mechanics
// ---------------------------------------------------------------------------

export interface CgroupV2Node {
  path: string;
  controllers: Set<string>;
  subtreeControl: Set<string>;
  procs: Set<number>;
  children: Map<string, CgroupV2Node>;
}

export function createCgroupV2Tree(): CgroupV2Node {
  return {
    path: '/',
    controllers: new Set(['cpu', 'memory', 'io', 'pids', 'cpuset']),
    subtreeControl: new Set(),
    procs: new Set(),
    children: new Map(),
  };
}

export function enableSubtreeController(
  parent: CgroupV2Node,
  controller: string,
): { success: boolean; error?: string } {
  if (!parent.controllers.has(controller)) {
    return {
      success: false,
      error: `Controller '${controller}' is not available in parent controllers`,
    };
  }

  // cgroups v2 "no internal processes" constraint:
  // Non-root parent cannot have processes in cgroup.procs if enabling subtree_control!
  if (parent.path !== '/' && parent.procs.size > 0) {
    return {
      success: false,
      error: `EBUSY: cgroup v2 internal process constraint violated; parent '${parent.path}' contains active processes`,
    };
  }

  parent.subtreeControl.add(controller);
  return { success: true };
}

export interface CpuMaxConfig {
  quota: number | 'max';
  period: number; // microseconds (typically 100,000)
}

export function parseCpuMax(content: string): CpuMaxConfig {
  const parts = content.trim().split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Invalid cpu.max format: '${content}'`);
  }
  const quota = parts[0] === 'max' ? 'max' : parseInt(parts[0]!, 10);
  const period = parseInt(parts[1]!, 10);
  return { quota, period };
}

export function calculateEffectiveCores(config: CpuMaxConfig): number {
  if (config.quota === 'max') {
    return Number.POSITIVE_INFINITY;
  }
  return config.quota / config.period;
}

export interface CpuThrottleResult {
  periods: number;
  throttledPeriods: number;
  throttledTimeUs: number;
  throttled: boolean;
}

export function evaluateCpuThrottling(
  config: CpuMaxConfig,
  requestedComputeUs: number,
): CpuThrottleResult {
  if (config.quota === 'max') {
    return { periods: 1, throttledPeriods: 0, throttledTimeUs: 0, throttled: false };
  }

  const periodsNeeded = Math.ceil(requestedComputeUs / config.quota);
  const throttledPeriods = Math.max(0, periodsNeeded - 1);
  const throttledTimeUs = throttledPeriods * config.period;

  return {
    periods: periodsNeeded,
    throttledPeriods,
    throttledTimeUs,
    throttled: throttledPeriods > 0,
  };
}

export interface MemoryAccounting {
  limitBytes: number;
  currentBytes: number;
  oomKills: number;
  oomKilled: boolean;
  exitCode: number;
}

export class MemoryCgroupController {
  public limitBytes: number;
  public currentBytes = 0;
  public oomKills = 0;

  constructor(limitBytes: number) {
    this.limitBytes = limitBytes;
  }

  public allocate(bytes: number): { success: boolean; oomKilled: boolean; exitCode: number } {
    if (this.currentBytes + bytes > this.limitBytes) {
      this.oomKills++;
      return { success: false, oomKilled: true, exitCode: 137 };
    }
    this.currentBytes += bytes;
    return { success: true, oomKilled: false, exitCode: 0 };
  }

  public free(bytes: number): void {
    this.currentBytes = Math.max(0, this.currentBytes - bytes);
  }
}

// ---------------------------------------------------------------------------
// 4. OverlayFS Lowerdir / Upperdir / Workdir & Whiteouts & Copy-Up
// ---------------------------------------------------------------------------

export interface OverlayFileEntry {
  path: string;
  content: string;
  sizeBytes: number;
  isWhiteout?: boolean;
}

export class OverlayFsResolver {
  public readonly lowerdirs: Map<string, OverlayFileEntry>[];
  public readonly upperdir: Map<string, OverlayFileEntry>;
  public readonly workdir: Map<string, OverlayFileEntry>;

  constructor(
    lowerdirs: Map<string, OverlayFileEntry>[],
    upperdir: Map<string, OverlayFileEntry>,
    workdir: Map<string, OverlayFileEntry> = new Map(),
  ) {
    this.lowerdirs = lowerdirs;
    this.upperdir = upperdir;
    this.workdir = workdir;
  }

  public getMergedFile(path: string): OverlayFileEntry | null {
    // Upperdir takes precedence
    const upper = this.upperdir.get(path);
    if (upper) {
      if (upper.isWhiteout) {
        return null; // Deleted in upperdir via whiteout
      }
      return upper;
    }

    // Fall through lowers in order
    for (const lower of this.lowerdirs) {
      const entry = lower.get(path);
      if (entry) {
        if (entry.isWhiteout) {
          return null;
        }
        return entry;
      }
    }

    return null;
  }

  public modifyFile(
    path: string,
    newContent: string,
  ): { copyUpTriggered: boolean; copiedBytes: number } {
    const existingInUpper = this.upperdir.get(path);
    if (existingInUpper) {
      existingInUpper.content = newContent;
      existingInUpper.sizeBytes = Buffer.byteLength(newContent);
      return { copyUpTriggered: false, copiedBytes: 0 };
    }

    // File only in lower? Triggers full copy-up!
    for (const lower of this.lowerdirs) {
      const lowerFile = lower.get(path);
      if (lowerFile && !lowerFile.isWhiteout) {
        // Copy-up amplification: the entire lower file must be copied to upper before modification!
        const copiedBytes = lowerFile.sizeBytes;
        this.upperdir.set(path, {
          path,
          content: newContent,
          sizeBytes: Buffer.byteLength(newContent),
        });
        return { copyUpTriggered: true, copiedBytes };
      }
    }

    // Creating new file in upper
    this.upperdir.set(path, {
      path,
      content: newContent,
      sizeBytes: Buffer.byteLength(newContent),
    });
    return { copyUpTriggered: false, copiedBytes: 0 };
  }

  public deleteFile(path: string): { whiteoutCreated: boolean; lowerShrunk: boolean } {
    let existsInLower = false;
    for (const lower of this.lowerdirs) {
      if (lower.has(path) && !lower.get(path)?.isWhiteout) {
        existsInLower = true;
        break;
      }
    }

    if (this.upperdir.has(path)) {
      this.upperdir.delete(path);
    }

    if (existsInLower) {
      // Create whiteout device (character device 0:0) in upperdir
      this.upperdir.set(path, {
        path,
        content: '',
        sizeBytes: 0,
        isWhiteout: true,
      });
      // Deleting does NOT shrink lower layer storage!
      return { whiteoutCreated: true, lowerShrunk: false };
    }

    return { whiteoutCreated: false, lowerShrunk: false };
  }
}

// ---------------------------------------------------------------------------
// 5. OCI Image Spec v1.1: Content-Addressable SHA-256, Manifests & Referrers
// ---------------------------------------------------------------------------

export interface OciDescriptor {
  mediaType: string;
  digest: string;
  size: number;
  annotations?: Record<string, string>;
  platform?: {
    architecture: string;
    os: string;
    variant?: string;
  };
}

export interface OciManifest {
  schemaVersion: 2;
  mediaType: string;
  artifactType?: string;
  config: OciDescriptor;
  layers: OciDescriptor[];
  subject?: OciDescriptor; // OCI 1.1 referrers support
  annotations?: Record<string, string>;
}

export interface OciImageIndex {
  schemaVersion: 2;
  mediaType: string;
  manifests: OciDescriptor[];
  annotations?: Record<string, string>;
}

export function computeSha256Digest(content: string | Buffer): string {
  const hash = createHash('sha256');
  hash.update(content);
  return `sha256:${hash.digest('hex')}`;
}

export function createDescriptor(
  mediaType: string,
  content: string | Buffer,
  platform?: OciDescriptor['platform'],
): OciDescriptor {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  return {
    mediaType,
    digest: computeSha256Digest(buf),
    size: buf.byteLength,
    platform,
  };
}

export function resolvePlatformManifest(
  index: OciImageIndex,
  targetPlatform: { os: string; architecture: string },
): { descriptor?: OciDescriptor; error?: string } {
  const match = index.manifests.find(
    (m) =>
      m.platform?.os === targetPlatform.os &&
      m.platform?.architecture === targetPlatform.architecture,
  );

  if (!match) {
    return {
      error: `exec format error: no matching manifest for platform ${targetPlatform.os}/${targetPlatform.architecture} found in image index`,
    };
  }

  return { descriptor: match };
}

export class OciReferrersGraph {
  private referrersBySubject: Map<string, OciDescriptor[]> = new Map();

  public registerManifest(manifest: OciManifest, descriptor: OciDescriptor): void {
    if (manifest.subject) {
      const subjectDigest = manifest.subject.digest;
      const list = this.referrersBySubject.get(subjectDigest) ?? [];
      list.push(descriptor);
      this.referrersBySubject.set(subjectDigest, list);
    }
  }

  public getReferrers(subjectDigest: string, artifactTypeFilter?: string): OciDescriptor[] {
    const list = this.referrersBySubject.get(subjectDigest) ?? [];
    if (!artifactTypeFilter) {
      return list;
    }
    return list.filter(
      (d) => d.annotations?.['org.opencontainers.image.artifactType'] === artifactTypeFilter,
    );
  }
}

// ---------------------------------------------------------------------------
// 6. OCI Runtime Spec v1.3 & Bundle Lifecycle State Machine
// ---------------------------------------------------------------------------

export type RuntimeLifecycleState = 'creating' | 'created' | 'running' | 'stopped';

export class OciRuntimeContainer {
  public readonly id: string;
  public readonly bundlePath: string;
  public state: RuntimeLifecycleState = 'creating';
  public hooksRun: string[] = [];

  constructor(id: string, bundlePath: string) {
    this.id = id;
    this.bundlePath = bundlePath;
  }

  public create(): void {
    if (this.state !== 'creating') {
      throw new Error(`Cannot transition to created from state ${this.state}`);
    }
    this.hooksRun.push('prestart');
    this.hooksRun.push('createRuntime');
    this.hooksRun.push('createContainer');
    this.state = 'created';
  }

  public start(): void {
    if (this.state !== 'created') {
      throw new Error(`Cannot start container in state ${this.state}; must be in created state`);
    }
    this.hooksRun.push('startContainer');
    this.state = 'running';
  }

  public kill(signal: string): void {
    if (this.state !== 'running' && this.state !== 'created') {
      throw new Error(`Cannot kill container in state ${this.state}`);
    }
    this.hooksRun.push(`kill:${signal}`);
    this.state = 'stopped';
  }

  public delete(force = false): void {
    if (this.state === 'running' && !force) {
      throw new Error(`Cannot delete running container '${this.id}' without force=true`);
    }
    this.hooksRun.push('poststop');
    this.state = 'stopped';
  }
}

// ---------------------------------------------------------------------------
// 7. OCI Distribution Spec v1.1 & Token Auth / Chunked Upload State Machine
// ---------------------------------------------------------------------------

export interface DistributionSession {
  repository: string;
  token?: string;
  rateLimitRemaining: number;
}

export class OciDistributionClient {
  public sessions: Map<string, DistributionSession> = new Map();
  public uploadedBlobs: Map<string, Buffer> = new Map(); // digest -> content
  public uploadsInProgress: Map<string, { chunks: Buffer[]; totalBytes: number }> = new Map();

  public authenticate(repo: string, token: string, rateLimitRemaining = 100): DistributionSession {
    const session = { repository: repo, token, rateLimitRemaining };
    this.sessions.set(repo, session);
    return session;
  }

  public startUpload(repo: string, uploadId: string): { status: number; uploadUrl: string } {
    const session = this.sessions.get(repo);
    if (!session || !session.token) {
      return { status: 401, uploadUrl: '' };
    }
    if (session.rateLimitRemaining <= 0) {
      return { status: 429, uploadUrl: '' };
    }
    session.rateLimitRemaining--;
    this.uploadsInProgress.set(uploadId, { chunks: [], totalBytes: 0 });
    return { status: 202, uploadUrl: `/v2/${repo}/blobs/uploads/${uploadId}` };
  }

  public uploadChunk(
    uploadId: string,
    chunk: Buffer,
    rangeStart: number,
  ): { status: number; error?: string } {
    const upload = this.uploadsInProgress.get(uploadId);
    if (!upload) {
      return { status: 404, error: 'Upload UUID not found' };
    }
    if (rangeStart !== upload.totalBytes) {
      return {
        status: 416,
        error: `Range start ${rangeStart} does not match current offset ${upload.totalBytes}`,
      };
    }
    upload.chunks.push(chunk);
    upload.totalBytes += chunk.byteLength;
    return { status: 202 };
  }

  public finalizeUpload(
    uploadId: string,
    expectedDigest: string,
  ): { status: number; digest?: string; error?: string } {
    const upload = this.uploadsInProgress.get(uploadId);
    if (!upload) {
      return { status: 404, error: 'Upload not found' };
    }
    const fullBuffer = Buffer.concat(upload.chunks);
    const actualDigest = computeSha256Digest(fullBuffer);
    if (actualDigest !== expectedDigest) {
      return {
        status: 400,
        error: `Digest mismatch: expected ${expectedDigest}, calculated ${actualDigest}`,
      };
    }
    this.uploadedBlobs.set(actualDigest, fullBuffer);
    this.uploadsInProgress.delete(uploadId);
    return { status: 201, digest: actualDigest };
  }

  public mountBlob(
    targetRepo: string,
    sourceRepo: string,
    digest: string,
  ): { status: number; mounted: boolean } {
    if (this.uploadedBlobs.has(digest)) {
      return { status: 201, mounted: true };
    }
    return { status: 202, mounted: false };
  }
}

// ---------------------------------------------------------------------------
// 8. Dockerfile & BuildKit LLB Cache Invalidation Analyzer
// ---------------------------------------------------------------------------

export interface BuildInstruction {
  type: 'FROM' | 'COPY' | 'RUN' | 'ENV' | 'ARG';
  args: string[];
  filesSnapshot?: Record<string, string>; // path -> fileHash
  isSecretMount?: boolean;
}

export interface BuildStepResult {
  stepIndex: number;
  cacheKey: string;
  cacheHit: boolean;
}

export class BuildKitCacheAnalyzer {
  private previousCacheKeys: Map<number, string> = new Map();

  public setPreviousBuildCache(cacheKeys: Map<number, string>): void {
    this.previousCacheKeys = new Map(cacheKeys);
  }

  public evaluateBuild(instructions: BuildInstruction[]): {
    results: BuildStepResult[];
    firstCacheBustIndex: number;
    secretLeakedInConfig: boolean;
  } {
    const results: BuildStepResult[] = [];
    let cacheBusted = false;
    let firstCacheBustIndex = -1;
    let secretLeakedInConfig = false;

    let rollingHash = 'initial';

    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i]!;
      const hash = createHash('sha256');
      hash.update(rollingHash);
      hash.update(inst.type);
      hash.update(inst.args.join(' '));

      if (inst.filesSnapshot) {
        for (const [p, h] of Object.entries(inst.filesSnapshot).sort()) {
          hash.update(`${p}:${h}`);
        }
      }

      if (inst.type === 'ARG' || inst.type === 'ENV') {
        const text = inst.args.join(' ');
        if (
          text.toLowerCase().includes('secret') ||
          text.toLowerCase().includes('token') ||
          text.toLowerCase().includes('key=')
        ) {
          secretLeakedInConfig = true;
        }
      }

      const currentKey = hash.digest('hex');
      rollingHash = currentKey;

      const previousKey = this.previousCacheKeys.get(i);
      const isHit = !cacheBusted && previousKey === currentKey;

      if (!isHit && !cacheBusted) {
        cacheBusted = true;
        firstCacheBustIndex = i;
      }

      results.push({
        stepIndex: i,
        cacheKey: currentKey,
        cacheHit: isHit,
      });
    }

    return { results, firstCacheBustIndex, secretLeakedInConfig };
  }
}

// ---------------------------------------------------------------------------
// 9. Container Networking: veth, Bridges, nftables DOCKER-USER & Pasta
// ---------------------------------------------------------------------------

export interface FirewallPacket {
  srcIp: string;
  dstIp: string;
  dstPort: number;
  inInterface: string;
}

export type FirewallDecision = 'ACCEPT' | 'DROP';

export class DockerFirewallEvaluator {
  public dockerUserRules: ((packet: FirewallPacket) => FirewallDecision | null)[] = [];
  public ufwDefaultPolicy: FirewallDecision = 'DROP';

  public addDockerUserRule(rule: (packet: FirewallPacket) => FirewallDecision | null): void {
    this.dockerUserRules.push(rule);
  }

  public evaluateInboundPacket(
    packet: FirewallPacket,
    publishedPort: number,
  ): {
    decision: FirewallDecision;
    bypassedUfw: boolean;
    handledByDockerUser: boolean;
  } {
    // 1. DOCKER-USER chain is evaluated FIRST
    for (const rule of this.dockerUserRules) {
      const res = rule(packet);
      if (res !== null) {
        return { decision: res, bypassedUfw: false, handledByDockerUser: true };
      }
    }

    // 2. If DOCKER-USER does not drop, Docker's default DNAT forwards directly to container!
    // Gotcha: Docker injects rules BEFORE UFW/firewalld input rules!
    if (packet.dstPort === publishedPort) {
      return {
        decision: 'ACCEPT',
        bypassedUfw: this.ufwDefaultPolicy === 'DROP',
        handledByDockerUser: false,
      };
    }

    // Normal host packet subject to UFW
    return { decision: this.ufwDefaultPolicy, bypassedUfw: false, handledByDockerUser: false };
  }
}

export interface RootlessNetworkDriver {
  name: 'pasta' | 'slirp4netns';
  supportsIpv6: boolean;
  preservesSourceIp: boolean;
  isRemovedInPodman6: boolean;
}

export function getRootlessNetworkDriver(name: 'pasta' | 'slirp4netns'): RootlessNetworkDriver {
  if (name === 'slirp4netns') {
    return {
      name: 'slirp4netns',
      supportsIpv6: true,
      preservesSourceIp: false, // slirp4netns uses NAT, obliterating source IP!
      isRemovedInPodman6: true, // Gotcha: slirp4netns was removed in Podman 6.0
    };
  }
  return {
    name: 'pasta',
    supportsIpv6: true,
    preservesSourceIp: true, // pasta preserves original source IP!
    isRemovedInPodman6: false,
  };
}

// ---------------------------------------------------------------------------
// 10. Docker vs Podman Engine Evolution & Compatibility Evaluators
// ---------------------------------------------------------------------------

export function validateDockerApiVersion(requestedVersion: string): {
  supported: boolean;
  minApi: string;
  error?: string;
} {
  const minApi = '1.44'; // Baseline in Docker Engine 29.x
  const req = parseFloat(requestedVersion);
  const min = parseFloat(minApi);

  if (req < min) {
    return {
      supported: false,
      minApi,
      error: `client version ${requestedVersion} is too old. Minimum supported API version is ${minApi}, please upgrade your client to a newer version`,
    };
  }

  return { supported: true, minApi };
}

export function validatePodmanDatabase(
  databaseBackend: 'boltdb' | 'sqlite',
  podmanMajorVersion: number,
): {
  valid: boolean;
  error?: string;
} {
  if (podmanMajorVersion >= 6 && databaseBackend === 'boltdb') {
    return {
      valid: false,
      error:
        'Podman 6.0 completely removed BoltDB database backend support; migrate state to SQLite via Podman 5.8 before upgrading',
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// 11. Compose v5 Dependency DAG & Variable Interpolation Precedence
// ---------------------------------------------------------------------------

export interface ComposeServiceDef {
  name: string;
  profiles?: string[];
  dependsOn?: Record<string, { condition?: 'service_started' | 'service_healthy' }>;
  environment?: Record<string, string>;
}

export class ComposeDagResolver {
  public resolveStartupOrder(services: ComposeServiceDef[]): {
    order: string[];
    hasCycle: boolean;
  } {
    const graph: Map<string, string[]> = new Map();
    const inDegree: Map<string, number> = new Map();

    for (const s of services) {
      graph.set(s.name, []);
      inDegree.set(s.name, 0);
    }

    for (const s of services) {
      if (s.dependsOn) {
        for (const dep of Object.keys(s.dependsOn)) {
          if (!graph.has(dep)) {
            throw new Error(`Service '${s.name}' depends on undefined service '${dep}'`);
          }
          graph.get(dep)!.push(s.name);
          inDegree.set(s.name, (inDegree.get(s.name) ?? 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [name, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(name);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      order.push(curr);

      for (const neighbor of graph.get(curr) ?? []) {
        const nextDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, nextDeg);
        if (nextDeg === 0) {
          queue.push(neighbor);
        }
      }
    }

    const hasCycle = order.length !== services.length;
    return { order, hasCycle };
  }

  public filterByProfiles(
    services: ComposeServiceDef[],
    activeProfiles: string[],
  ): ComposeServiceDef[] {
    const activeSet = new Set(activeProfiles);
    return services.filter((s) => {
      if (!s.profiles || s.profiles.length === 0) {
        return true; // No profiles specified -> active in default profile
      }
      return s.profiles.some((p) => activeSet.has(p));
    });
  }

  public resolveInterpolation(
    template: string,
    sources: {
      inlineEnv?: Record<string, string>;
      processEnv?: Record<string, string>;
      dotenv?: Record<string, string>;
    },
  ): string {
    // Priority order: inlineEnv > processEnv > dotenv > default fallback syntax ${VAR:-default}
    return template.replace(
      /\$\{([a-zA-Z0-9_]+)(?::-([^}]*))?\}/g,
      (_match, varName, defaultValue) => {
        if (sources.inlineEnv && varName in sources.inlineEnv) {
          return sources.inlineEnv[varName]!;
        }
        if (sources.processEnv && varName in sources.processEnv) {
          return sources.processEnv[varName]!;
        }
        if (sources.dotenv && varName in sources.dotenv) {
          return sources.dotenv[varName]!;
        }
        return defaultValue !== undefined ? defaultValue : '';
      },
    );
  }
}

// ---------------------------------------------------------------------------
// 12. Security Capability, Seccomp & Socket Mount Risk Evaluator
// ---------------------------------------------------------------------------

export interface ContainerSecurityProfile {
  capDrop: string[];
  capAdd: string[];
  noNewPrivileges: boolean;
  readOnlyRootfs: boolean;
  mountedVolumes: { hostPath: string; containerPath: string; readOnly: boolean }[];
  seccompProfile: 'default' | 'unconfined' | 'custom-strict';
}

export interface SecurityAuditFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
}

export function auditContainerSecurity(profile: ContainerSecurityProfile): SecurityAuditFinding[] {
  const findings: SecurityAuditFinding[] = [];

  // Gotcha: Docker socket mount is root on the host!
  const socketMount = profile.mountedVolumes.find(
    (v) => v.hostPath === '/var/run/docker.sock' || v.containerPath === '/var/run/docker.sock',
  );
  if (socketMount) {
    findings.push({
      severity: 'CRITICAL',
      title: 'Docker Socket Mount Escalation',
      description:
        'Mounting /var/run/docker.sock gives the container root-equivalent control over the host Docker daemon.',
    });
  }

  if (profile.seccompProfile === 'unconfined') {
    findings.push({
      severity: 'HIGH',
      title: 'Seccomp Unconfined',
      description:
        'Disabling seccomp exposes dangerous host system calls (e.g. bpf, unshare, reboot).',
    });
  }

  if (!profile.noNewPrivileges) {
    findings.push({
      severity: 'MEDIUM',
      title: 'No-New-Privileges Disabled',
      description:
        'Without no-new-privileges, setuid binaries within the image can elevate process privileges.',
    });
  }

  const hasCapSysAdmin = profile.capAdd.includes('CAP_SYS_ADMIN') || profile.capAdd.includes('ALL');
  if (hasCapSysAdmin) {
    findings.push({
      severity: 'CRITICAL',
      title: 'CAP_SYS_ADMIN Granted',
      description:
        'CAP_SYS_ADMIN breaks container isolation boundaries and enables host device manipulation.',
    });
  }

  if (!profile.readOnlyRootfs) {
    findings.push({
      severity: 'LOW',
      title: 'Writable Root Filesystem',
      description:
        'Writable rootfs allows runtime malware persistence and unexpected layer modifications.',
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// 13. Container vs VM Isolation, OCI Execution Chains & Daemonless Topologies
// ---------------------------------------------------------------------------

export interface IsolationBoundaryProfile {
  kind: 'container' | 'virtual-machine';
  kernelBoundary: 'shared-host-kernel' | 'isolated-guest-kernel-via-hypervisor';
  executionModel: 'direct-cgroup-constrained-processes' | 'hardware-assisted-virtualization';
  startupLatencyMs: number;
  memoryOverheadBytes: number;
  hardwareVirtualizationRequired: boolean;
  syscallIsolationMechanism: 'namespaces-cgroups-seccomp' | 'hypervisor-vm-exit-trap';
}

export function evaluateIsolationBoundary(
  kind: 'container' | 'virtual-machine',
): IsolationBoundaryProfile {
  if (kind === 'container') {
    return {
      kind: 'container',
      kernelBoundary: 'shared-host-kernel',
      executionModel: 'direct-cgroup-constrained-processes',
      startupLatencyMs: 50,
      memoryOverheadBytes: 4 * 1024 * 1024,
      hardwareVirtualizationRequired: false,
      syscallIsolationMechanism: 'namespaces-cgroups-seccomp',
    };
  }

  return {
    kind: 'virtual-machine',
    kernelBoundary: 'isolated-guest-kernel-via-hypervisor',
    executionModel: 'hardware-assisted-virtualization',
    startupLatencyMs: 15000,
    memoryOverheadBytes: 512 * 1024 * 1024,
    hardwareVirtualizationRequired: true,
    syscallIsolationMechanism: 'hypervisor-vm-exit-trap',
  };
}

export interface OciExecutionLayer {
  layer:
    | 'CLI'
    | 'Engine Daemon'
    | 'Container Supervisor'
    | 'Shim Process'
    | 'Process Monitor'
    | 'OCI Runtime';
  component: string;
  isDaemon: boolean;
  managesLifecycle: boolean;
}

export interface OciExecutionChain {
  engine: 'docker' | 'podman';
  architecture: 'daemon-centric' | 'daemonless';
  layers: OciExecutionLayer[];
  leafRuntime: string;
  hasSinglePointOfFailure: boolean;
}

export function resolveOciExecutionChain(engine: 'docker' | 'podman'): OciExecutionChain {
  if (engine === 'docker') {
    const layers: OciExecutionLayer[] = [
      { layer: 'CLI', component: 'docker', isDaemon: false, managesLifecycle: false },
      { layer: 'Engine Daemon', component: 'dockerd', isDaemon: true, managesLifecycle: true },
      {
        layer: 'Container Supervisor',
        component: 'containerd',
        isDaemon: true,
        managesLifecycle: true,
      },
      {
        layer: 'Shim Process',
        component: 'containerd-shim-v2',
        isDaemon: false,
        managesLifecycle: true,
      },
      { layer: 'OCI Runtime', component: 'runc', isDaemon: false, managesLifecycle: false },
    ];
    return {
      engine: 'docker',
      architecture: 'daemon-centric',
      layers,
      leafRuntime: 'runc',
      hasSinglePointOfFailure: true,
    };
  }

  const layers: OciExecutionLayer[] = [
    { layer: 'CLI', component: 'podman', isDaemon: false, managesLifecycle: false },
    { layer: 'Process Monitor', component: 'conmon', isDaemon: false, managesLifecycle: true },
    { layer: 'OCI Runtime', component: 'crun', isDaemon: false, managesLifecycle: false },
  ];
  return {
    engine: 'podman',
    architecture: 'daemonless',
    layers,
    leafRuntime: 'crun',
    hasSinglePointOfFailure: false,
  };
}

export interface OciRuntimeBenchmarkProfile {
  runtime: 'runc' | 'crun' | 'youki';
  binaryLanguage: 'Go' | 'C' | 'Rust';
  executableSizeBytes: number;
  forkExecMemoryOverheadBytes: number;
  cgroupsV2Support: string;
}

export interface OciRuntimeComparisonResult {
  runc: OciRuntimeBenchmarkProfile;
  crun: OciRuntimeBenchmarkProfile;
  memorySavingsRatio: number;
  executableSizeRatio: number;
  crunIsLowerFootprint: boolean;
}

export function compareOciRuntimeMemoryFootprint(): OciRuntimeComparisonResult {
  const runc: OciRuntimeBenchmarkProfile = {
    runtime: 'runc',
    binaryLanguage: 'Go',
    executableSizeBytes: 14 * 1024 * 1024,
    forkExecMemoryOverheadBytes: 15 * 1024 * 1024,
    cgroupsV2Support: 'Supported via libcontainer',
  };

  const crun: OciRuntimeBenchmarkProfile = {
    runtime: 'crun',
    binaryLanguage: 'C',
    executableSizeBytes: 2 * 1024 * 1024,
    forkExecMemoryOverheadBytes: 1.5 * 1024 * 1024,
    cgroupsV2Support: 'Native zero-allocation cgroups v2 tree traversal',
  };

  const memorySavingsRatio = runc.forkExecMemoryOverheadBytes / crun.forkExecMemoryOverheadBytes;
  const executableSizeRatio = runc.executableSizeBytes / crun.executableSizeBytes;

  return {
    runc,
    crun,
    memorySavingsRatio,
    executableSizeRatio,
    crunIsLowerFootprint:
      crun.executableSizeBytes < runc.executableSizeBytes &&
      crun.forkExecMemoryOverheadBytes < runc.forkExecMemoryOverheadBytes,
  };
}

export interface EngineCrashSimulationResult {
  engine: string;
  daemonDied: boolean;
  containersSurvive: boolean;
  reason: string;
  hasSinglePointOfFailure: boolean;
  processMonitor?: string;
}

export function simulateEngineCrashImpact(
  engine: 'docker-without-live-restore' | 'docker-with-live-restore' | 'podman',
): EngineCrashSimulationResult {
  switch (engine) {
    case 'docker-without-live-restore':
      return {
        engine,
        daemonDied: true,
        containersSurvive: false,
        reason:
          'Without live-restore enabled, dockerd termination tears down child containerd sessions and container process pipes.',
        hasSinglePointOfFailure: true,
      };
    case 'docker-with-live-restore':
      return {
        engine,
        daemonDied: true,
        containersSurvive: true,
        reason:
          'Live-restore keeps containerd and shims running independently during dockerd daemon restarts.',
        hasSinglePointOfFailure: false,
      };
    case 'podman':
      return {
        engine,
        daemonDied: false,
        containersSurvive: true,
        reason:
          'Podman is daemonless; CLI process exists only during invocation. conmon independently monitors the container.',
        hasSinglePointOfFailure: false,
        processMonitor: 'conmon',
      };
  }
}

export interface PodContainerMember {
  name: string;
  port?: number;
}

export interface PodTopologyContainer {
  name: string;
  port?: number;
  sharesLocalhost: boolean;
  canLoopbackReach: (targetPort: number) => string;
}

export interface PodNamespaceTopology {
  podName: string;
  sharedNamespaces: ('net' | 'ipc' | 'uts')[];
  isolatedNamespaces: ('pid' | 'mnt')[];
  infraContainer: {
    name: string;
    holdsNamespaces: boolean;
  };
  containers: PodTopologyContainer[];
}

export function createPodNamespaceTopology(
  podName: string,
  containers: PodContainerMember[],
): PodNamespaceTopology {
  return {
    podName,
    sharedNamespaces: ['net', 'ipc', 'uts'],
    isolatedNamespaces: ['pid', 'mnt'],
    infraContainer: {
      name: `${podName}-infra`,
      holdsNamespaces: true,
    },
    containers: containers.map((c) => ({
      name: c.name,
      port: c.port,
      sharesLocalhost: true,
      canLoopbackReach: (targetPort: number) => `127.0.0.1:${targetPort}`,
    })),
  };
}
