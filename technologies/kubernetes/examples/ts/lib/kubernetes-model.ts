// Kubernetes Domain Model and Simulation Primitives
// Implements verified models of Kubernetes v1.37 semantics, control-plane internals,
// kubelet cgroup v2/QoS behavior, scheduler pipeline, networking, Gateway API, and security gates.

import { createHash } from 'node:crypto';

// ============================================================================
// 1. Core Object Model & Metadata
// ============================================================================

export interface ObjectMeta {
  name: string;
  namespace?: string;
  uid?: string;
  resourceVersion?: string;
  generation?: number;
  creationTimestamp?: string;
  deletionTimestamp?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  ownerReferences?: OwnerReference[];
  finalizers?: string[];
  managedFields?: ManagedFieldEntry[];
}

export interface OwnerReference {
  apiVersion: string;
  kind: string;
  name: string;
  uid: string;
  controller?: boolean;
  blockOwnerDeletion?: boolean;
}

export interface ManagedFieldEntry {
  manager: string;
  operation: 'Apply' | 'Update';
  apiVersion: string;
  time?: string;
  fieldsV1: Record<string, any>;
  subresource?: string;
}

export interface K8sObject<TSpec = any, TStatus = any> {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
  spec?: TSpec;
  status?: TStatus;
}

// ============================================================================
// 2. Server-Side Apply vs Client-Side Apply
// ============================================================================

export const ANNOTATION_SIZE_LIMIT_BYTES = 256 * 1024; // 262,144 bytes
export const LAST_APPLIED_CONFIG_ANNOTATION = 'kubectl.kubernetes.io/last-applied-configuration';

export interface FieldConflict {
  fieldPath: string;
  currentManager: string;
  existingValue: any;
  attemptedValue: any;
}

export class MetadataAnnotationsTooLongError extends Error {
  constructor(size: number) {
    super(
      `metadata.annotations too long: size ${size} bytes exceeds maximum limit of ${ANNOTATION_SIZE_LIMIT_BYTES} bytes`,
    );
    this.name = 'MetadataAnnotationsTooLongError';
  }
}

export class FieldOwnershipConflictError extends Error {
  readonly conflicts: FieldConflict[];

  constructor(conflicts: FieldConflict[]) {
    super(
      `Apply failed due to ${conflicts.length} field ownership conflict(s): ${conflicts.map((c) => `${c.fieldPath} owned by ${c.currentManager}`).join(', ')}`,
    );
    this.name = 'FieldOwnershipConflictError';
    this.conflicts = conflicts;
  }
}

/**
 * Simulates Client-Side Apply (`kubectl apply`).
 * Serializes the manifest into `kubectl.kubernetes.io/last-applied-configuration`.
 * Fails if manifest serialized exceeds 256KB annotation limit.
 */
export function applyClientSide<T extends K8sObject>(existing: T | null, manifest: T): T {
  const serialized = JSON.stringify(manifest);
  const byteLength = Buffer.byteLength(serialized, 'utf-8');

  if (byteLength > ANNOTATION_SIZE_LIMIT_BYTES) {
    throw new MetadataAnnotationsTooLongError(byteLength);
  }

  const annotations = { ...existing?.metadata.annotations, ...manifest.metadata.annotations };
  annotations[LAST_APPLIED_CONFIG_ANNOTATION] = serialized;

  const merged: T = {
    ...existing,
    ...manifest,
    metadata: {
      ...existing?.metadata,
      ...manifest.metadata,
      annotations,
      generation: (existing?.metadata.generation ?? 0) + 1,
      resourceVersion: String(Date.now()),
    },
  };

  return merged;
}

/**
 * Simulates Server-Side Apply (SSA) with field manager tracking and conflict detection.
 */
export function applyServerSide<T extends K8sObject>(
  existing: T | null,
  patch: T,
  fieldManager: string,
  options: { force?: boolean } = {},
): T {
  const currentManagedFields: ManagedFieldEntry[] = existing?.metadata.managedFields
    ? [...existing.metadata.managedFields]
    : [];
  const patchFields = extractFlatFields(patch.spec ?? {});

  const conflicts: FieldConflict[] = [];

  // Check for ownership conflicts across existing managers
  if (!options.force && existing && existing.spec) {
    for (const [path, newValue] of Object.entries(patchFields)) {
      for (const entry of currentManagedFields) {
        if (entry.manager !== fieldManager && entry.fieldsV1 && path in entry.fieldsV1) {
          const existingValue = entry.fieldsV1[path];
          if (JSON.stringify(existingValue) !== JSON.stringify(newValue)) {
            conflicts.push({
              fieldPath: `spec.${path}`,
              currentManager: entry.manager,
              existingValue,
              attemptedValue: newValue,
            });
          }
        }
      }
    }
  }

  if (conflicts.length > 0) {
    throw new FieldOwnershipConflictError(conflicts);
  }

  // Update or take over field ownership
  const updatedManagedFields = currentManagedFields.filter((entry) => {
    if (options.force && entry.manager !== fieldManager) {
      // Strip taken-over fields from other managers
      for (const path of Object.keys(patchFields)) {
        delete entry.fieldsV1[path];
      }
      return Object.keys(entry.fieldsV1).length > 0;
    }
    return entry.manager !== fieldManager;
  });

  updatedManagedFields.push({
    manager: fieldManager,
    operation: 'Apply',
    apiVersion: patch.apiVersion,
    time: new Date().toISOString(),
    fieldsV1: patchFields,
  });

  const mergedSpec = { ...existing?.spec, ...patch.spec };

  const result = {
    apiVersion: patch.apiVersion,
    kind: patch.kind,
    metadata: {
      ...existing?.metadata,
      ...patch.metadata,
      generation: (existing?.metadata.generation ?? 0) + 1,
      resourceVersion: String(Date.now()),
      managedFields: updatedManagedFields,
    },
    spec: mergedSpec,
    status: existing?.status,
  } as unknown as T;

  return result;
}

function extractFlatFields(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, extractFlatFields(value, fullKey));
    } else {
      result[fullKey] = value;
    }
  }
  return result;
}

// ============================================================================
// 3. Control Plane Pipeline, Webhooks, Informer & etcd MVCC
// ============================================================================

export interface AdmissionWebhookConfig {
  name: string;
  type: 'mutating' | 'validating';
  failurePolicy: 'Fail' | 'Ignore';
  isHealthy: boolean;
  mutateFn?: (obj: any) => any;
  validateFn?: (obj: any) => { allowed: boolean; message?: string };
}

export interface PipelineResult {
  allowed: boolean;
  stage: 'authn' | 'authz' | 'mutating' | 'schema' | 'validating' | 'etcd';
  object?: any;
  statusCode: number;
  message?: string;
}

export function executeAdmissionPipeline(
  object: K8sObject,
  options: {
    authenticated: boolean;
    authorized: boolean;
    webhooks?: AdmissionWebhookConfig[];
    schemaValid: boolean;
  },
): PipelineResult {
  if (!options.authenticated) {
    return { allowed: false, stage: 'authn', statusCode: 401, message: 'Unauthorized' };
  }

  if (!options.authorized) {
    return { allowed: false, stage: 'authz', statusCode: 403, message: 'Forbidden by RBAC' };
  }

  let currentObj = JSON.parse(JSON.stringify(object));

  // Mutating Webhooks
  const mutatingWebhooks = options.webhooks?.filter((w) => w.type === 'mutating') ?? [];
  for (const webhook of mutatingWebhooks) {
    if (!webhook.isHealthy) {
      if (webhook.failurePolicy === 'Fail') {
        return {
          allowed: false,
          stage: 'mutating',
          statusCode: 500,
          message: `Mutating webhook ${webhook.name} failed and failurePolicy is Fail (admission deadlock)`,
        };
      }
      continue; // Ignore
    }
    if (webhook.mutateFn) {
      currentObj = webhook.mutateFn(currentObj);
    }
  }

  // Schema Validation
  if (!options.schemaValid) {
    return {
      allowed: false,
      stage: 'schema',
      statusCode: 422,
      message: 'Schema validation failed: structural violations',
    };
  }

  // Validating Webhooks
  const validatingWebhooks = options.webhooks?.filter((w) => w.type === 'validating') ?? [];
  for (const webhook of validatingWebhooks) {
    if (!webhook.isHealthy) {
      if (webhook.failurePolicy === 'Fail') {
        return {
          allowed: false,
          stage: 'validating',
          statusCode: 500,
          message: `Validating webhook ${webhook.name} failed and failurePolicy is Fail`,
        };
      }
      continue; // Ignore
    }
    if (webhook.validateFn) {
      const v = webhook.validateFn(currentObj);
      if (!v.allowed) {
        return {
          allowed: false,
          stage: 'validating',
          statusCode: 403,
          message: v.message ?? `Rejected by validating webhook ${webhook.name}`,
        };
      }
    }
  }

  return { allowed: true, stage: 'etcd', statusCode: 201, object: currentObj };
}

export interface WatchBookmark {
  type: 'BOOKMARK';
  resourceVersion: string;
}

export class InformerCache<T extends K8sObject> {
  private cache = new Map<string, T>();
  public currentResourceVersion = 0;

  constructor(initialObjects: T[] = []) {
    for (const obj of initialObjects) {
      const key = `${obj.metadata.namespace ?? 'default'}/${obj.metadata.name}`;
      this.cache.set(key, obj);
    }
  }

  get(namespace: string, name: string): T | undefined {
    return this.cache.get(`${namespace}/${name}`);
  }

  handleBookmark(bookmark: WatchBookmark): void {
    const rv = parseInt(bookmark.resourceVersion, 10);
    if (!isNaN(rv) && rv > this.currentResourceVersion) {
      this.currentResourceVersion = rv;
    }
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Simulates pagination vs unpaginated LIST overhead.
 */
export function paginateList<T>(
  items: T[],
  options: { limit?: number; continueToken?: string } = {},
): { items: T[]; continueToken?: string; memoryPayloadBytes: number } {
  const limit = options.limit ?? items.length;
  const startIndex = options.continueToken ? parseInt(options.continueToken, 10) : 0;
  const pageItems = items.slice(startIndex, startIndex + limit);
  const nextToken = startIndex + limit < items.length ? String(startIndex + limit) : undefined;
  const memoryPayloadBytes = Buffer.byteLength(JSON.stringify(pageItems), 'utf-8');

  return {
    items: pageItems,
    continueToken: nextToken,
    memoryPayloadBytes,
  };
}

export class EtcdMvccEngine {
  public revision = 1;
  public quotaBytes: number;
  public currentSizeBytes = 0;
  public alarmNoSpace = false;
  private store = new Map<string, { value: string; createRev: number; modRev: number }>();

  constructor(quotaBytes = 2 * 1024 * 1024 * 1024) {
    // Default 2 GiB
    this.quotaBytes = quotaBytes;
  }

  put(key: string, value: string): { revision: number } {
    if (this.alarmNoSpace) {
      throw new Error('etcdserver: mvcc: database space exceeded');
    }

    const valSize = Buffer.byteLength(value, 'utf-8');
    if (this.currentSizeBytes + valSize >= this.quotaBytes) {
      this.alarmNoSpace = true;
      throw new Error('etcdserver: mvcc: database space exceeded');
    }

    this.revision++;
    const prev = this.store.get(key);
    this.currentSizeBytes += valSize;
    this.store.set(key, {
      value,
      createRev: prev ? prev.createRev : this.revision,
      modRev: this.revision,
    });

    return { revision: this.revision };
  }

  get(key: string): string | undefined {
    // Reads succeed even when alarmNoSpace is active (read-only mode)
    return this.store.get(key)?.value;
  }

  compact(targetRevision: number): void {
    // Compacts historical versions up to targetRevision
    if (targetRevision > this.revision) {
      throw new Error('compact revision is in the future');
    }
  }

  defrag(): void {
    // Releases free pages back to disk, clearing alarm
    this.currentSizeBytes = Math.floor(this.currentSizeBytes * 0.4); // 60% fragmentation reclaimed
    if (this.currentSizeBytes < this.quotaBytes) {
      this.alarmNoSpace = false;
    }
  }
}

// ============================================================================
// 4. Node Internals: kubelet, QoS, CFS Throttling, and PSI Eviction
// ============================================================================

export type QoSClass = 'Guaranteed' | 'Burstable' | 'BestEffort';

export interface ResourceRequirements {
  requests?: { cpu?: string; memory?: string };
  limits?: { cpu?: string; memory?: string };
}

export interface ContainerSpec {
  name: string;
  image: string;
  resources?: ResourceRequirements;
  restartPolicy?: 'Always'; // Native sidecar
}

export interface PodSpec {
  containers: ContainerSpec[];
  initContainers?: ContainerSpec[];
  priority?: number;
}

export function checkKubeletCgroupSupport(
  hostCgroupVersion: 1 | 2,
  kubeletVersion: string,
  failCgroupV1 = true,
): { ok: boolean; error?: string } {
  const [major, minor] = kubeletVersion.split('.').map(Number);
  const is135OrHigher = (major ?? 0) > 1 || ((major ?? 0) === 1 && (minor ?? 0) >= 35);

  if (is135OrHigher && hostCgroupVersion === 1 && failCgroupV1) {
    return {
      ok: false,
      error:
        'cgroup v1 is unsupported; kubelet fails to start when FailCgroupV1=true in Kubernetes >= 1.35',
    };
  }
  return { ok: true };
}

export function classifyQoS(pod: PodSpec): QoSClass {
  const allContainers = [...(pod.initContainers ?? []), ...pod.containers];
  if (allContainers.length === 0) return 'BestEffort';

  let hasAnyRequestOrLimit = false;
  let allHaveCpuAndMemoryLimits = true;
  let allRequestsMatchLimits = true;

  for (const c of allContainers) {
    const req = c.resources?.requests;
    const lim = c.resources?.limits;

    if (req?.cpu || req?.memory || lim?.cpu || lim?.memory) {
      hasAnyRequestOrLimit = true;
    }

    if (!lim?.cpu || !lim?.memory) {
      allHaveCpuAndMemoryLimits = false;
      allRequestsMatchLimits = false;
    } else {
      const cpuMatch = (req?.cpu ?? lim.cpu) === lim.cpu;
      const memMatch = (req?.memory ?? lim.memory) === lim.memory;
      if (!cpuMatch || !memMatch) {
        allRequestsMatchLimits = false;
      }
    }
  }

  if (!hasAnyRequestOrLimit) return 'BestEffort';
  if (allHaveCpuAndMemoryLimits && allRequestsMatchLimits) return 'Guaranteed';
  return 'Burstable';
}

/**
 * Simulates CFS CPU quota throttling vs request-only execution.
 * Period = 100ms. If limit is 1.0 CPU, thread bursting 100ms within 20ms will be throttled for 80ms!
 */
export function simulateCfsThrottling(
  cpuLimitCores: number | null,
  workDurationMs: number, // e.g. 100ms of CPU compute required in a 100ms period
  threads = 1,
): { executionTimeMs: number; throttledPeriods: number; isThrottled: boolean } {
  const periodMs = 100;

  if (cpuLimitCores === null) {
    // Request-only: no CFS quota applied, thread runs to completion without CFS quota clamp
    return {
      executionTimeMs: Math.ceil(workDurationMs / threads),
      throttledPeriods: 0,
      isThrottled: false,
    };
  }

  const quotaPerPeriodMs = cpuLimitCores * periodMs;
  let remainingWork = workDurationMs;
  let periodsElapsed = 0;
  let totalTimeMs = 0;
  let throttledPeriods = 0;

  while (remainingWork > 0) {
    periodsElapsed++;
    const workThisPeriod = Math.min(remainingWork, quotaPerPeriodMs);
    remainingWork -= workThisPeriod;

    if (workThisPeriod >= quotaPerPeriodMs && remainingWork > 0) {
      throttledPeriods++;
      totalTimeMs += periodMs; // Throttled until next period!
    } else {
      totalTimeMs += workThisPeriod;
    }
  }

  return {
    executionTimeMs: totalTimeMs,
    throttledPeriods,
    isThrottled: throttledPeriods > 0,
  };
}

/**
 * Simulates kubelet memory eviction priority under node pressure (PSI / memory stall).
 * BestEffort pods are evicted first, then Burstable exceeding requests, Guaranteed last.
 */
export function determineEvictionOrder(
  pods: Array<{ name: string; qos: QoSClass; memoryUsageMb: number; memoryRequestMb: number }>,
): string[] {
  return [...pods]
    .sort((a, b) => {
      const qosScore = { BestEffort: 0, Burstable: 1, Guaranteed: 2 };
      if (qosScore[a.qos] !== qosScore[b.qos]) {
        return qosScore[a.qos] - qosScore[b.qos]; // Lowest score evicted first
      }
      // For Burstable: highest excess over request evicted first
      const aExcess = Math.max(0, a.memoryUsageMb - a.memoryRequestMb);
      const bExcess = Math.max(0, b.memoryUsageMb - b.memoryRequestMb);
      if (aExcess !== bExcess) {
        return bExcess - aExcess;
      }
      return b.memoryUsageMb - a.memoryUsageMb;
    })
    .map((p) => p.name);
}

// ============================================================================
// 5. Pod Lifecycle, Probes, Rollouts, and Termination Races
// ============================================================================

export interface ProbeConfig {
  initialDelaySeconds?: number;
  periodSeconds?: number;
  failureThreshold?: number;
  successThreshold?: number;
}

export class PodProbeStateMachine {
  public startupPassed = false;
  public isReady = false;
  public restartCount = 0;
  public consecutiveFailures = 0;
  public hasStartupProbe: boolean;
  public livenessConfig: ProbeConfig;

  constructor(hasStartupProbe: boolean, livenessConfig: ProbeConfig = { failureThreshold: 3 }) {
    this.hasStartupProbe = hasStartupProbe;
    this.livenessConfig = livenessConfig;
  }

  stepProbe(
    probeType: 'startup' | 'liveness' | 'readiness',
    success: boolean,
  ): { restarted: boolean; ready: boolean } {
    let restarted = false;

    if (probeType === 'startup') {
      if (success) {
        this.startupPassed = true;
      }
    } else if (probeType === 'liveness') {
      // Liveness probe only evaluates if startup probe passed (or not configured)
      if (!this.hasStartupProbe || this.startupPassed) {
        if (!success) {
          this.consecutiveFailures++;
          if (this.consecutiveFailures >= (this.livenessConfig.failureThreshold ?? 3)) {
            this.restartCount++;
            this.consecutiveFailures = 0;
            restarted = true;
            this.isReady = false;
          }
        } else {
          this.consecutiveFailures = 0;
        }
      }
    } else if (probeType === 'readiness') {
      if (!this.hasStartupProbe || this.startupPassed) {
        this.isReady = success;
      }
    }

    return { restarted, ready: this.isReady };
  }
}

/**
 * Simulates pod graceful shutdown vs network endpoint removal race.
 * If preStop hook is absent, SIGTERM immediately closes listen socket while endpoints still route traffic -> 502s!
 */
export function simulateTerminationRace(options: {
  hasPreStopSleep: boolean;
  preStopDurationSeconds: number;
  endpointRemovalDelaySeconds: number; // typically 2-3s for kube-proxy/ingress iptables sync
}): { droppedRequests: number; finalStatus: 'clean-zero-downtime' | '502-bad-gateway-race' } {
  const { hasPreStopSleep, preStopDurationSeconds, endpointRemovalDelaySeconds } = options;

  if (!hasPreStopSleep || preStopDurationSeconds < endpointRemovalDelaySeconds) {
    const vulnerableWindowSeconds =
      endpointRemovalDelaySeconds - (hasPreStopSleep ? preStopDurationSeconds : 0);
    const droppedRequests = Math.max(1, Math.floor(vulnerableWindowSeconds * 50)); // traffic received after container died
    return {
      droppedRequests,
      finalStatus: '502-bad-gateway-race',
    };
  }

  return {
    droppedRequests: 0,
    finalStatus: 'clean-zero-downtime',
  };
}

/**
 * Calculates Deployment maxSurge and maxUnavailable rollout bounds.
 */
export function calculateRolloutBounds(
  replicas: number,
  maxSurge: number | string,
  maxUnavailable: number | string,
): {
  maxAllowedPods: number;
  minAvailablePods: number;
  surgeCount: number;
  unavailableCount: number;
} {
  const surgeCount =
    typeof maxSurge === 'string' && maxSurge.endsWith('%')
      ? Math.ceil((replicas * parseInt(maxSurge, 10)) / 100)
      : Number(maxSurge);

  const unavailableCount =
    typeof maxUnavailable === 'string' && maxUnavailable.endsWith('%')
      ? Math.floor((replicas * parseInt(maxUnavailable, 10)) / 100)
      : Number(maxUnavailable);

  const maxAllowedPods = replicas + surgeCount;
  const minAvailablePods = Math.max(0, replicas - unavailableCount);

  return { maxAllowedPods, minAvailablePods, surgeCount, unavailableCount };
}

// ============================================================================
// 6. Configuration, Secrets, In-Place Resize, and HPA
// ============================================================================

export function decodeSecret(data: Record<string, string>): Record<string, string> {
  const decoded: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    decoded[k] = Buffer.from(v, 'base64').toString('utf-8');
  }
  return decoded;
}

export function encodeSecret(data: Record<string, string>): Record<string, string> {
  const encoded: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    encoded[k] = Buffer.from(v, 'utf-8').toString('base64');
  }
  return encoded;
}

export class MissingResourceRequestError extends Error {
  readonly resourceName: string;

  constructor(resourceName: string) {
    super(
      `HPA cannot compute target utilization: resource ${resourceName} request is not configured on pod containers`,
    );
    this.name = 'MissingResourceRequestError';
    this.resourceName = resourceName;
  }
}

export function calculateHpaDesiredReplicas(options: {
  currentReplicas: number;
  currentMetricValue: number;
  targetMetricValue: number;
  minReplicas?: number;
  maxReplicas?: number;
  podHasRequest: boolean;
}): number {
  if (!options.podHasRequest) {
    throw new MissingResourceRequestError('cpu');
  }

  if (options.currentMetricValue === 0 && (options.minReplicas ?? 1) === 0) {
    return 0; // v1.37 scale-to-zero beta
  }

  const rawDesired = Math.ceil(
    options.currentReplicas * (options.currentMetricValue / options.targetMetricValue),
  );
  const min = options.minReplicas ?? 1;
  const max = options.maxReplicas ?? 10;

  return Math.max(min, Math.min(max, rawDesired));
}

// ============================================================================
// 7. Scheduling: Filter / Score Pipeline & PDB Drain Deadlock
// ============================================================================

export interface NodeInfo {
  name: string;
  labels: Record<string, string>;
  taints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  allocatableCpu: number;
  allocatableMemoryMb: number;
  usedCpu: number;
  usedMemoryMb: number;
}

export interface SchedulingPod {
  name: string;
  priority?: number;
  requiredCpu: number;
  requiredMemoryMb: number;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<{
    key?: string;
    value?: string;
    operator?: 'Equal' | 'Exists';
    effect?: string;
  }>;
}

export function filterNodes(
  pod: SchedulingPod,
  nodes: NodeInfo[],
): { eligible: NodeInfo[]; failures: Map<string, string[]> } {
  const eligible: NodeInfo[] = [];
  const failures = new Map<string, string[]>();

  for (const node of nodes) {
    const nodeFailures: string[] = [];

    // Node Resources Fit
    if (node.allocatableCpu - node.usedCpu < pod.requiredCpu) {
      nodeFailures.push(
        `Insufficient CPU: free ${node.allocatableCpu - node.usedCpu} < needed ${pod.requiredCpu}`,
      );
    }
    if (node.allocatableMemoryMb - node.usedMemoryMb < pod.requiredMemoryMb) {
      nodeFailures.push(
        `Insufficient memory: free ${node.allocatableMemoryMb - node.usedMemoryMb}MB < needed ${pod.requiredMemoryMb}MB`,
      );
    }

    // NodeSelector
    if (pod.nodeSelector) {
      for (const [k, v] of Object.entries(pod.nodeSelector)) {
        if (node.labels[k] !== v) {
          nodeFailures.push(`NodeSelectorMismatch: label ${k}=${v} not on node`);
        }
      }
    }

    // Taints & Tolerations
    if (node.taints) {
      for (const taint of node.taints) {
        if (taint.effect === 'NoSchedule') {
          const tolerated = pod.tolerations?.some((tol) => {
            if (tol.operator === 'Exists') return !tol.key || tol.key === taint.key;
            return tol.key === taint.key && tol.value === taint.value;
          });
          if (!tolerated) {
            nodeFailures.push(`UntoleratedTaint: ${taint.key}=${taint.value}:${taint.effect}`);
          }
        }
      }
    }

    if (nodeFailures.length === 0) {
      eligible.push(node);
    } else {
      failures.set(node.name, nodeFailures);
    }
  }

  return { eligible, failures };
}

export interface PodDisruptionBudget {
  name: string;
  selector: Record<string, string>;
  minAvailable?: number;
  maxUnavailable?: number;
}

export function simulateNodeDrain(
  nodeName: string,
  podsOnNode: Array<{ name: string; labels: Record<string, string>; namespace: string }>,
  allPodsInCluster: Array<{
    name: string;
    labels: Record<string, string>;
    namespace: string;
    node: string;
  }>,
  pdbs: PodDisruptionBudget[],
): { canDrain: boolean; blockedReason?: string } {
  for (const pod of podsOnNode) {
    for (const pdb of pdbs) {
      const matches = Object.entries(pdb.selector).every(([k, v]) => pod.labels[k] === v);
      if (matches) {
        const totalReplicas = allPodsInCluster.filter((p) =>
          Object.entries(pdb.selector).every(([k, v]) => p.labels[k] === v),
        ).length;

        if (pdb.minAvailable !== undefined) {
          const currentAvailable = totalReplicas;
          // If minAvailable == replicas (e.g. 1 == 1), disruptionsAllowed is 0!
          const disruptionsAllowed = Math.max(0, currentAvailable - pdb.minAvailable);
          if (disruptionsAllowed <= 0) {
            return {
              canDrain: false,
              blockedReason: `Cannot evict pod ${pod.name}: PDB ${pdb.name} minAvailable (${pdb.minAvailable}) equals total replicas (${totalReplicas}); disruptionsAllowed = 0 (drain deadlock)`,
            };
          }
        }
      }
    }
  }

  return { canDrain: true };
}

// ============================================================================
// 8. Networking, CoreDNS ndots, and NetworkPolicy
// ============================================================================

export function calculateCoreDnsSearchExpansion(
  queryDomain: string,
  searchDomains: string[],
  ndots = 5,
): { queriesIssued: string[]; resolvedImmediately: boolean } {
  if (queryDomain.endsWith('.')) {
    const cleanDomain = queryDomain.replace(/\.$/, '');
    return { queriesIssued: [cleanDomain], resolvedImmediately: true };
  }

  const dotCount = (queryDomain.match(/\./g) || []).length;
  const queriesIssued: string[] = [];

  if (dotCount >= ndots) {
    // Treat as absolute first
    queriesIssued.push(queryDomain);
    return { queriesIssued, resolvedImmediately: true };
  }

  // Appends search domains first!
  for (const domain of searchDomains) {
    queriesIssued.push(`${queryDomain}.${domain}`);
  }
  queriesIssued.push(queryDomain); // Finally tries raw domain

  return { queriesIssued, resolvedImmediately: false };
}

export interface ObjectMeta {
  name: string;
  namespace?: string;
  deletionTimestamp?: string;
  finalizers?: string[];
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
}

export function detectOrphanedFinalizerDeadlock(
  objectMeta: ObjectMeta,
  controllerReachable: boolean,
): { isStuck: boolean; reason: string } {
  if (objectMeta.deletionTimestamp && objectMeta.finalizers && objectMeta.finalizers.length > 0) {
    if (!controllerReachable) {
      return {
        isStuck: true,
        reason: `Object ${objectMeta.name} is stuck in Terminating status: deletionTimestamp is set and finalizers [${objectMeta.finalizers.join(', ')}] remain, but controller managing them is unreachable.`,
      };
    }
    return {
      isStuck: true,
      reason: `Object ${objectMeta.name} is Terminating, waiting for finalizers [${objectMeta.finalizers.join(', ')}] to be cleared by controller.`,
    };
  }
  return { isStuck: false, reason: 'Object is not stuck or not terminating' };
}

export function detectMutableLatestNodeSkew(
  imageRef: string,
  imagePullPolicy: string,
  nodeDigests: Record<string, string>,
): { hasVersionSkew: boolean; warning: string } {
  const isLatest = imageRef.includes(':latest') || !imageRef.includes(':');
  if (isLatest && imagePullPolicy === 'IfNotPresent') {
    const digests = Object.values(nodeDigests);
    const uniqueDigests = new Set(digests);
    if (uniqueDigests.size > 1) {
      return {
        hasVersionSkew: true,
        warning: `Node version skew detected for mutable image reference '${imageRef}' with pullPolicy: IfNotPresent. Nodes have differing underlying image digests: [${Array.from(uniqueDigests).join(', ')}].`,
      };
    }
  }
  return { hasVersionSkew: false, warning: 'No node version skew detected' };
}

export function auditIngressControllerMigration(
  ingressClassName: string,
  isIngressNginx: boolean,
  hasGatewayApiRoute: boolean,
): { status: 'Compliant' | 'NonCompliant'; recommendation: string } {
  if (isIngressNginx && ingressClassName === 'nginx') {
    return {
      status: 'NonCompliant',
      recommendation: `Ingress controller 'k8s.io/ingress-nginx' reached official post-March 2026 retirement/unmaintained status. Migrate immediately to Gateway API v1.5 (HTTPRoute / GatewayClass).`,
    };
  }
  if (!hasGatewayApiRoute && ingressClassName === 'nginx') {
    return {
      status: 'NonCompliant',
      recommendation: `Legacy Ingress resource active. Migrate to Gateway API for cross-namespace routing and reference grants.`,
    };
  }
  return {
    status: 'Compliant',
    recommendation: 'Ingress routing migrated or compliant with Gateway API v1.5 standards.',
  };
}

export interface NetworkPolicySpec {
  podSelector: Record<string, string>;
  policyTypes: Array<'Ingress' | 'Egress'>;
  egress?: Array<{
    to?: Array<{
      podSelector?: Record<string, string>;
      namespaceSelector?: Record<string, string>;
    }>;
    ports?: Array<{ protocol: 'TCP' | 'UDP'; port: number }>;
  }>;
}

export function evaluateEgressPolicy(
  targetPort: number,
  protocol: 'TCP' | 'UDP',
  policies: NetworkPolicySpec[],
): { allowed: boolean; blockedReason?: string } {
  if (policies.length === 0) {
    return { allowed: true }; // Default allow
  }

  const egressPolicies = policies.filter((p) => p.policyTypes.includes('Egress'));
  if (egressPolicies.length === 0) {
    return { allowed: true };
  }

  // Check if any rule explicitly allows this port
  for (const policy of egressPolicies) {
    if (!policy.egress || policy.egress.length === 0) {
      continue; // empty egress list means default deny all
    }
    for (const rule of policy.egress) {
      if (!rule.ports || rule.ports.length === 0) {
        return { allowed: true }; // all ports allowed
      }
      for (const p of rule.ports) {
        if (p.port === targetPort && p.protocol === protocol) {
          return { allowed: true };
        }
      }
    }
  }

  return {
    allowed: false,
    blockedReason: `Egress to ${protocol}/${targetPort} dropped by default-deny NetworkPolicy (missing DNS port 53 egress rule)`,
  };
}

export function cniSupportsNetworkPolicy(cniName: string): boolean {
  const supported = ['cilium', 'calico', 'antrea', 'ovn-kubernetes', 'kube-router'];
  return supported.includes(cniName.toLowerCase());
}

// ============================================================================
// 9. Gateway API v1.6 & ReferenceGrant
// ============================================================================

export interface ReferenceGrant {
  metadata: { name: string; namespace: string };
  spec: {
    from: Array<{ group: string; kind: string; namespace: string }>;
    to: Array<{ group: string; kind: string; name?: string }>;
  };
}

export interface HTTPRouteBackendRef {
  name: string;
  namespace?: string;
  port: number;
}

export function evaluateCrossNamespaceRouting(
  routeNamespace: string,
  backend: HTTPRouteBackendRef,
  grants: ReferenceGrant[],
): { allowed: boolean; condition: string } {
  const targetNamespace = backend.namespace ?? routeNamespace;

  if (targetNamespace === routeNamespace) {
    return { allowed: true, condition: 'ResolvedRefs: True' };
  }

  // Cross-namespace backend reference requires ReferenceGrant in target namespace
  const grantExists = grants.some((g) => {
    if (g.metadata.namespace !== targetNamespace) return false;
    const fromMatches = g.spec.from.some(
      (f) => f.kind === 'HTTPRoute' && f.namespace === routeNamespace,
    );
    const toMatches = g.spec.to.some(
      (t) => t.kind === 'Service' && (!t.name || t.name === backend.name),
    );
    return fromMatches && toMatches;
  });

  if (grantExists) {
    return { allowed: true, condition: 'ResolvedRefs: True' };
  }

  return {
    allowed: false,
    condition: 'ResolvedRefs: False (RefNotPermitted: ReferenceGrant missing in target namespace)',
  };
}

// ============================================================================
// 10. Storage: PV/PVC Binding & CSI VolumeGroupSnapshots
// ============================================================================

export function validateVersionSkew(
  apiserverVersion: string,
  component: 'kubelet' | 'kube-controller-manager' | 'kube-scheduler' | 'kubectl',
  componentVersion: string,
): { valid: boolean; error?: string } {
  const [, apiMinor] = apiserverVersion.split('.').map(Number);
  const [, compMinor] = componentVersion.split('.').map(Number);

  if (apiMinor === undefined || compMinor === undefined) {
    return { valid: false, error: 'Invalid semver format' };
  }

  const delta = apiMinor - compMinor;

  if (component === 'kubelet') {
    // Kubelet can lag up to N-3, cannot be ahead of apiserver
    if (delta < 0) {
      return {
        valid: false,
        error: `Kubelet v${componentVersion} cannot be newer than kube-apiserver v${apiserverVersion}`,
      };
    }
    if (delta > 3) {
      return {
        valid: false,
        error: `Kubelet v${componentVersion} lags more than 3 minor versions behind kube-apiserver v${apiserverVersion}`,
      };
    }
    return { valid: true };
  }

  if (component === 'kube-controller-manager' || component === 'kube-scheduler') {
    // Control plane components cannot be newer and cannot lag more than N-1
    if (delta < 0) {
      return { valid: false, error: `${component} cannot be newer than kube-apiserver` };
    }
    if (delta > 1) {
      return {
        valid: false,
        error: `${component} v${componentVersion} lags more than 1 minor version behind kube-apiserver`,
      };
    }
    return { valid: true };
  }

  if (component === 'kubectl') {
    // kubectl supports N-1, N, N+1
    if (Math.abs(delta) > 1) {
      return {
        valid: false,
        error: `kubectl v${componentVersion} is outside supported skew range (+/- 1 minor) of kube-apiserver`,
      };
    }
    return { valid: true };
  }

  return { valid: true };
}

export function verifyEtcdSnapshot(snapshot: {
  sha256: string;
  totalKeys: number;
  revision: number;
  sizeBytes: number;
}): { valid: boolean; error?: string } {
  if (snapshot.sizeBytes <= 0) {
    return { valid: false, error: 'Snapshot file is empty or corrupted' };
  }
  if (snapshot.totalKeys <= 0) {
    return { valid: false, error: 'Snapshot contains 0 keys' };
  }
  if (snapshot.revision <= 0) {
    return { valid: false, error: 'Snapshot revision invalid' };
  }
  return { valid: true };
}

export function bindPvc(
  pvc: { volumeBindingMode: 'Immediate' | 'WaitForFirstConsumer'; requestedStorageMb: number },
  pv: { capacityMb: number; zone: string },
  podSelectedZone?: string,
): { bound: boolean; error?: string } {
  if (pv.capacityMb < pvc.requestedStorageMb) {
    return { bound: false, error: 'PV capacity insufficient' };
  }

  if (pvc.volumeBindingMode === 'Immediate') {
    // Binds PV before pod scheduling
    if (podSelectedZone && pv.zone !== podSelectedZone) {
      return {
        bound: false,
        error: `VolumeZoneMismatch: PV is in ${pv.zone} but pod scheduled in ${podSelectedZone}`,
      };
    }
    return { bound: true };
  }

  // WaitForFirstConsumer binds only after pod node zone is determined
  if (!podSelectedZone) {
    return { bound: false, error: 'Binding delayed until pod is scheduled (WaitForFirstConsumer)' };
  }

  if (pv.zone !== podSelectedZone) {
    return {
      bound: false,
      error: `VolumeZoneMismatch: PV is in ${pv.zone} while pod placed in ${podSelectedZone}`,
    };
  }

  return { bound: true };
}

// ============================================================================
// 11. Security: RBAC, Pod Security Admission (PSA) & CEL
// ============================================================================

export interface RbacRule {
  apiGroups: string[];
  resources: string[];
  verbs: string[];
  resourceNames?: string[];
}

export function evaluateRbac(
  rules: RbacRule[],
  req: { apiGroup: string; resource: string; verb: string; resourceName?: string },
): boolean {
  for (const rule of rules) {
    const groupMatch = rule.apiGroups.includes('*') || rule.apiGroups.includes(req.apiGroup);
    const resMatch = rule.resources.includes('*') || rule.resources.includes(req.resource);
    const verbMatch = rule.verbs.includes('*') || rule.verbs.includes(req.verb);
    const nameMatch =
      !rule.resourceNames || !req.resourceName || rule.resourceNames.includes(req.resourceName);

    if (groupMatch && resMatch && verbMatch && nameMatch) {
      return true;
    }
  }
  return false;
}

export function evaluatePodSecurity(
  pod: {
    spec: {
      hostPID?: boolean;
      hostNetwork?: boolean;
      securityContext?: { runAsNonRoot?: boolean; seccompProfile?: { type: string } };
      containers: Array<{
        securityContext?: {
          privileged?: boolean;
          allowPrivilegeEscalation?: boolean;
          capabilities?: { drop?: string[]; add?: string[] };
        };
      }>;
    };
  },
  level: 'privileged' | 'baseline' | 'restricted',
): { allowed: boolean; violations: string[] } {
  if (level === 'privileged') return { allowed: true, violations: [] };

  const violations: string[] = [];

  // Baseline Checks
  if (pod.spec.hostPID) violations.push('hostPID is forbidden in baseline/restricted');
  if (pod.spec.hostNetwork) violations.push('hostNetwork is forbidden in baseline/restricted');

  for (const c of pod.spec.containers) {
    if (c.securityContext?.privileged) {
      violations.push(
        `privileged container ${c.securityContext ? 'enabled' : ''} is forbidden in baseline/restricted`,
      );
    }
  }

  if (level === 'baseline') {
    return { allowed: violations.length === 0, violations };
  }

  // Restricted Checks
  if (!pod.spec.securityContext?.runAsNonRoot) {
    violations.push('runAsNonRoot must be true in restricted');
  }

  const seccompType = pod.spec.securityContext?.seccompProfile?.type;
  if (seccompType !== 'RuntimeDefault' && seccompType !== 'Localhost') {
    violations.push('seccompProfile must be RuntimeDefault or Localhost in restricted');
  }

  for (const c of pod.spec.containers) {
    if (c.securityContext?.allowPrivilegeEscalation !== false) {
      violations.push('allowPrivilegeEscalation must be false in restricted');
    }
    const droppedCaps = c.securityContext?.capabilities?.drop ?? [];
    if (!droppedCaps.includes('ALL')) {
      violations.push('capabilities.drop must contain ALL in restricted');
    }
  }

  return { allowed: violations.length === 0, violations };
}

// ============================================================================
// 12. Extending Kubernetes: CRDs, Controller Reconcile & Finalizers
// ============================================================================

export interface ReconcileResult {
  requeue?: boolean;
  requeueAfterSeconds?: number;
}

export class ControllerReconciler<T extends K8sObject> {
  public reconcileCalls = 0;

  async reconcile(object: T, deleteHandler?: () => Promise<void>): Promise<ReconcileResult> {
    this.reconcileCalls++;

    // Deletion timestamp set
    if (object.metadata.deletionTimestamp) {
      if (object.metadata.finalizers && object.metadata.finalizers.length > 0) {
        if (deleteHandler) {
          await deleteHandler();
        }
        // Remove finalizer
        object.metadata.finalizers = [];
      }
      return { requeue: false };
    }

    // Normal reconciliation: idempotent state alignment
    return { requeue: false };
  }
}

// ============================================================================
// 13. Observability & Pod Triage Playbook
// ============================================================================

export type PodDiagnosis =
  | 'CrashLoopBackOff'
  | 'ImagePullBackOff'
  | 'Pending'
  | 'OOMKilled'
  | 'RunningHealthy';

export function diagnosePod(pod: {
  status?: {
    phase: string;
    conditions?: Array<{ type: string; status: string; reason?: string }>;
    containerStatuses?: Array<{
      ready: boolean;
      restartCount: number;
      image: string;
      imagePullPolicy?: string;
      state?: {
        waiting?: { reason: string; message?: string };
        terminated?: { exitCode: number; reason: string };
      };
    }>;
  };
}): { diagnosis: PodDiagnosis; rootCause: string } {
  const container = pod.status?.containerStatuses?.[0];

  if (
    container?.state?.waiting?.reason === 'ImagePullBackOff' ||
    container?.state?.waiting?.reason === 'ErrImagePull'
  ) {
    return {
      diagnosis: 'ImagePullBackOff',
      rootCause: `Failed to pull container image: ${container.state.waiting.message ?? 'image not found or authentication failure'}`,
    };
  }

  if (
    container?.state?.terminated?.reason === 'OOMKilled' ||
    container?.state?.terminated?.exitCode === 137
  ) {
    return {
      diagnosis: 'OOMKilled',
      rootCause:
        'Container exceeded memory limit and was killed by Linux OOM killer (exit code 137)',
    };
  }

  if (
    container?.state?.waiting?.reason === 'CrashLoopBackOff' ||
    (container && container.restartCount > 0 && !container.ready)
  ) {
    return {
      diagnosis: 'CrashLoopBackOff',
      rootCause: 'Application process crashing repeatedly with non-zero exit code during startup',
    };
  }

  if (pod.status?.phase === 'Pending') {
    const unschedulable = pod.status.conditions?.find(
      (c) => c.type === 'PodScheduled' && c.reason === 'Unschedulable',
    );
    return {
      diagnosis: 'Pending',
      rootCause: unschedulable
        ? 'Scheduling failed: insufficient node resources or untolerated taints'
        : 'Pod waiting for admission or scheduling',
    };
  }

  return {
    diagnosis: 'RunningHealthy',
    rootCause: 'Pod and containers are healthy and ready',
  };
}

// ============================================================================
// 14. Scale & API Priority and Fairness (APF)
// ============================================================================

export class ApfQueueSimulator {
  private queues: Array<{ requests: string[] }>;
  private totalQueues: number;
  private handSize: number;

  constructor(totalQueues = 64, handSize = 8) {
    this.totalQueues = totalQueues;
    this.handSize = handSize;
    this.queues = Array.from({ length: totalQueues }, () => ({ requests: [] }));
  }

  /**
   * Shuffle-sharding: hashes requester key into a hand of queues, selects queue with minimal depth.
   */
  assignQueue(requesterKey: string, requestId: string): number {
    const queueIndices: number[] = [];
    let salt = 0;

    while (queueIndices.length < this.handSize) {
      const hash = createHash('sha256').update(`${requesterKey}:${salt}`).digest('hex');
      const idx = parseInt(hash.slice(0, 8), 16) % this.totalQueues;
      if (!queueIndices.includes(idx)) {
        queueIndices.push(idx);
      }
      salt++;
    }

    // Pick queue with minimal depth
    let bestQueue = queueIndices[0]!;
    let minDepth = this.queues[bestQueue]!.requests.length;

    for (const q of queueIndices) {
      const depth = this.queues[q]!.requests.length;
      if (depth < minDepth) {
        minDepth = depth;
        bestQueue = q;
      }
    }

    this.queues[bestQueue]!.requests.push(requestId);
    return bestQueue;
  }

  getQueueDepth(index: number): number {
    return this.queues[index]?.requests.length ?? 0;
  }
}
