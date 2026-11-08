/**
 * Deterministic architectural models, IAM inheritance engine, VPC firewall evaluation,
 * Cloud NAT port allocation, Cloud Storage consistency, Spanner TrueTime simulation,
 * and Pub/Sub stream models for the Zero-to-One Google Cloud Platform track.
 */

// ============================================================================
// 1. Resource Hierarchy & IAM Policy Evaluation Engine
// ============================================================================

export type ResourceNodeType = 'ORGANIZATION' | 'FOLDER' | 'PROJECT' | 'RESOURCE';

export interface ResourceNode {
  id: string;
  name: string;
  type: ResourceNodeType;
  parentId?: string;
  tags?: Record<string, string>;
}

export interface IamCondition {
  expression: string; // CEL expression, e.g. "resource.tags['environment'] == 'prod'"
  title?: string;
}

export interface AllowBinding {
  role: string;
  members: string[]; // e.g. ["user:alice@example.com", "serviceAccount:sa@project.iam.gserviceaccount.com"]
  condition?: IamCondition;
}

export interface DenyRule {
  deniedPermissions: string[]; // e.g. ["storage.objects.delete"]
  deniedPrincipals: string[]; // e.g. ["principalSet://goog/public:all"]
  exceptionPrincipals?: string[]; // e.g. ["user:admin@example.com"]
  denialCondition?: IamCondition;
}

export interface IamPolicy {
  nodeId: string;
  allowBindings: AllowBinding[];
  denyRules?: DenyRule[];
}

export interface IamEvaluationRequest {
  principal: string;
  permission: string;
  resourceId: string;
  context?: {
    requestTime?: Date;
    resourceTags?: Record<string, string>;
  };
}

export interface IamEvaluationResult {
  allowed: boolean;
  decision: 'ALLOW' | 'DENY' | 'DEFAULT_DENY';
  reason: string;
  grantedAtNodeId?: string;
  grantedRole?: string;
  deniedAtNodeId?: string;
}

export interface PrincipalAccessBoundary {
  principal: string;
  permittedResourcePrefixes: string[]; // e.g. ["//cloudresourcemanager.googleapis.com/projects/my-prod-*"]
}

export class ResourceHierarchyEngine {
  private nodes: Map<string, ResourceNode> = new Map();
  private policies: Map<string, IamPolicy> = new Map();
  private roles: Map<string, string[]> = new Map(); // role -> permissions
  private boundaries: Map<string, PrincipalAccessBoundary> = new Map();

  public addNode(node: ResourceNode): void {
    this.nodes.set(node.id, node);
  }

  public registerRole(role: string, permissions: string[]): void {
    this.roles.set(role, permissions);
  }

  public setPolicy(policy: IamPolicy): void {
    this.policies.set(policy.nodeId, policy);
  }

  public setPrincipalAccessBoundary(pab: PrincipalAccessBoundary): void {
    this.boundaries.set(pab.principal, pab);
  }

  public getAncestryPath(resourceId: string): ResourceNode[] {
    const path: ResourceNode[] = [];
    let current = this.nodes.get(resourceId);

    // If sub-resource is not explicitly registered, fall back to enclosing project
    if (!current) {
      const projectMatch = resourceId.match(/^(projects\/[^/]+)/);
      if (projectMatch && projectMatch[1]) {
        current = this.nodes.get(projectMatch[1]);
      }
    }

    while (current) {
      path.push(current);
      if (!current.parentId) break;
      current = this.nodes.get(current.parentId);
    }

    return path; // from target resource up to Organization root
  }

  private evaluateCondition(
    condition: IamCondition,
    context?: IamEvaluationRequest['context'],
  ): boolean {
    const expr = condition.expression.trim();

    // Tag matching: e.g. resource.tags['environment'] == 'prod'
    const tagMatch = expr.match(/resource\.tags\['([^']+)'\]\s*==\s*'([^']+)'/);
    if (tagMatch) {
      const [, tagKey, tagValue] = tagMatch;
      return context?.resourceTags?.[tagKey!] === tagValue;
    }

    return false;
  }

  public evaluateAccess(request: IamEvaluationRequest): IamEvaluationResult {
    // Step 1: Principal Access Boundary (PAB) check
    const boundary = this.boundaries.get(request.principal);
    if (boundary) {
      const resourceAllowed = boundary.permittedResourcePrefixes.some((prefix) =>
        request.resourceId.startsWith(prefix.replace(/\*$/, '')),
      );
      if (!resourceAllowed) {
        return {
          allowed: false,
          decision: 'DENY',
          reason: `Access blocked by Principal Access Boundary for ${request.principal}`,
        };
      }
    }

    const ancestry = this.getAncestryPath(request.resourceId);
    if (ancestry.length === 0) {
      return {
        allowed: false,
        decision: 'DEFAULT_DENY',
        reason: `Resource ${request.resourceId} not found in hierarchy`,
      };
    }

    // Step 2: Evaluate Deny policies across hierarchy (Deny trumps Allow everywhere)
    for (const node of ancestry) {
      const policy = this.policies.get(node.id);
      if (!policy?.denyRules) continue;

      for (const denyRule of policy.denyRules) {
        // Check if permission matches
        const permissionMatches =
          denyRule.deniedPermissions.includes(request.permission) ||
          denyRule.deniedPermissions.includes('*');

        if (!permissionMatches) continue;

        // Check if principal is covered and not in exceptions
        const isException = denyRule.exceptionPrincipals?.includes(request.principal);
        if (isException) continue;

        const isDeniedPrincipal =
          denyRule.deniedPrincipals.includes(request.principal) ||
          denyRule.deniedPrincipals.includes('principalSet://goog/public:all');

        if (isDeniedPrincipal) {
          // Check condition if present
          if (denyRule.denialCondition) {
            const condApplies = this.evaluateCondition(denyRule.denialCondition, request.context);
            if (!condApplies) continue;
          }

          return {
            allowed: false,
            decision: 'DENY',
            reason: `Explicit Deny policy at ${node.type} ${node.id}`,
            deniedAtNodeId: node.id,
          };
        }
      }
    }

    // Step 3: Evaluate Allow policies inheriting from Organization down to Resource
    // In GCP, permissions union down the hierarchy
    for (const node of ancestry) {
      const policy = this.policies.get(node.id);
      if (!policy?.allowBindings) continue;

      for (const binding of policy.allowBindings) {
        const principalMatches =
          binding.members.includes(request.principal) ||
          binding.members.includes('allUsers') ||
          binding.members.includes('allAuthenticatedUsers');

        if (!principalMatches) continue;

        const rolePermissions = this.roles.get(binding.role) ?? [];
        if (!rolePermissions.includes(request.permission) && !rolePermissions.includes('*')) {
          continue;
        }

        // Check IAM condition if present
        if (binding.condition) {
          const conditionPassed = this.evaluateCondition(binding.condition, request.context);
          if (!conditionPassed) continue;
        }

        return {
          allowed: true,
          decision: 'ALLOW',
          reason: `Granted by role ${binding.role} bound at ${node.type} ${node.id}`,
          grantedAtNodeId: node.id,
          grantedRole: binding.role,
        };
      }
    }

    return {
      allowed: false,
      decision: 'DEFAULT_DENY',
      reason: `No Allow binding grants permission ${request.permission} to ${request.principal}`,
    };
  }
}

// ============================================================================
// 2. VPC Hierarchical Firewall & VPC Firewall Rules Evaluation Engine
// ============================================================================

export type FirewallLevel = 'ORGANIZATION' | 'FOLDER' | 'VPC';
export type FirewallAction = 'ALLOW' | 'DENY';
export type FirewallDirection = 'INGRESS' | 'EGRESS';

export interface FirewallRule {
  name: string;
  priority: number; // 0 to 65535 (lower evaluates first)
  direction: FirewallDirection;
  action: FirewallAction;
  level: FirewallLevel;
  sourceRanges?: string[]; // e.g. ["10.0.0.0/8", "0.0.0.0/0"]
  destinationRanges?: string[];
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  ports?: number[]; // e.g. [80, 443]
  targetTags?: string[];
  targetServiceAccounts?: string[];
  disabled?: boolean;
}

export interface NetworkPacket {
  direction: FirewallDirection;
  sourceIp: string;
  destinationIp: string;
  protocol: 'tcp' | 'udp' | 'icmp';
  port?: number;
  vmTags?: string[];
  vmServiceAccount?: string;
}

export interface FirewallEvaluationResult {
  action: FirewallAction;
  matchedRule: string;
  matchedPriority: number;
  matchedLevel: FirewallLevel;
  isDefaultRule: boolean;
}

export class FirewallEvaluationEngine {
  private rules: FirewallRule[] = [];

  public addRule(rule: FirewallRule): void {
    this.rules.push(rule);
  }

  private ipMatchesCidr(ip: string, cidr: string): boolean {
    if (cidr === '0.0.0.0/0' || cidr === ip) return true;
    const [range, bitsStr] = cidr.split('/');
    if (!range || !bitsStr) return false;
    const bits = parseInt(bitsStr, 10);
    const ipToNum = (addr: string) =>
      addr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipToNum(ip) & mask) === (ipToNum(range) & mask);
  }

  public evaluatePacket(packet: NetworkPacket): FirewallEvaluationResult {
    // Hierarchical rules evaluate before VPC rules when priorities conflict.
    // Within the same level or overall, lower priority numbers evaluate first (0 is highest precedence).
    const sorted = [...this.rules]
      .filter((r) => !r.disabled && r.direction === packet.direction)
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const levelWeight: Record<FirewallLevel, number> = {
          ORGANIZATION: 1,
          FOLDER: 2,
          VPC: 3,
        };
        return levelWeight[a.level] - levelWeight[b.level];
      });

    for (const rule of sorted) {
      // 1. Protocol match
      if (rule.protocol !== 'all' && rule.protocol !== packet.protocol) {
        continue;
      }

      // 2. Port match (for TCP/UDP)
      if (rule.ports && rule.ports.length > 0 && packet.port !== undefined) {
        if (!rule.ports.includes(packet.port)) {
          continue;
        }
      }

      // 3. IP range match
      if (packet.direction === 'INGRESS' && rule.sourceRanges && rule.sourceRanges.length > 0) {
        const matchesRange = rule.sourceRanges.some((cidr) =>
          this.ipMatchesCidr(packet.sourceIp, cidr),
        );
        if (!matchesRange) continue;
      }
      if (
        packet.direction === 'EGRESS' &&
        rule.destinationRanges &&
        rule.destinationRanges.length > 0
      ) {
        const matchesRange = rule.destinationRanges.some((cidr) =>
          this.ipMatchesCidr(packet.destinationIp, cidr),
        );
        if (!matchesRange) continue;
      }

      // 4. Target tag match
      if (rule.targetTags && rule.targetTags.length > 0) {
        const hasTag = rule.targetTags.some((tag) => packet.vmTags?.includes(tag));
        if (!hasTag) continue;
      }

      // 5. Target Service Account match
      if (rule.targetServiceAccounts && rule.targetServiceAccounts.length > 0) {
        const hasSa = rule.targetServiceAccounts.includes(packet.vmServiceAccount ?? '');
        if (!hasSa) continue;
      }

      // Rule matched
      return {
        action: rule.action,
        matchedRule: rule.name,
        matchedPriority: rule.priority,
        matchedLevel: rule.level,
        isDefaultRule: false,
      };
    }

    // Default Google Cloud firewall behavior (priority 65535)
    if (packet.direction === 'INGRESS') {
      return {
        action: 'DENY',
        matchedRule: 'default-implied-deny-ingress',
        matchedPriority: 65535,
        matchedLevel: 'VPC',
        isDefaultRule: true,
      };
    } else {
      return {
        action: 'ALLOW',
        matchedRule: 'default-implied-allow-egress',
        matchedPriority: 65535,
        matchedLevel: 'VPC',
        isDefaultRule: true,
      };
    }
  }
}

// ============================================================================
// 3. Cloud NAT Port Allocation & Connection Simulator
// ============================================================================

export interface CloudNatConfig {
  mode: 'STATIC' | 'DYNAMIC';
  minPortsPerVm: number; // default 64 for static, 32 for dynamic
  maxPortsPerVm?: number; // for dynamic e.g. 1024
  allocatedPublicIps: number; // each IPv4 provides 64,512 usable source ports
}

export interface NatAllocationResult {
  totalUsablePorts: number;
  allocatedPortsPerVm: number;
  maxSupportedVms: number;
  connectionsAllowed: number;
  connectionsDropped: number;
  portExhaustionOccurred: boolean;
}

export class CloudNatSimulator {
  public static simulateVmLoad(
    vmCount: number,
    concurrentConnectionsPerVm: number,
    config: CloudNatConfig,
  ): NatAllocationResult {
    const USABLE_PORTS_PER_IP = 64512;
    const totalUsablePorts = config.allocatedPublicIps * USABLE_PORTS_PER_IP;

    let portsAssignedPerVm: number;

    if (config.mode === 'STATIC') {
      portsAssignedPerVm = config.minPortsPerVm;
    } else {
      // Dynamic allocation scales up in powers of 2 based on demand
      const maxLimit = config.maxPortsPerVm ?? 1024;
      let needed = config.minPortsPerVm;
      while (needed < concurrentConnectionsPerVm && needed < maxLimit) {
        needed *= 2;
      }
      portsAssignedPerVm = Math.min(needed, maxLimit);
    }

    const totalDemandedPorts = vmCount * portsAssignedPerVm;
    const gatewayExhausted = totalDemandedPorts > totalUsablePorts;

    // Per-VM connection capability
    const maxConnPerVm = portsAssignedPerVm;
    let droppedConns = 0;
    let allowedConns = 0;

    for (let i = 0; i < vmCount; i++) {
      if (concurrentConnectionsPerVm > maxConnPerVm) {
        allowedConns += maxConnPerVm;
        droppedConns += concurrentConnectionsPerVm - maxConnPerVm;
      } else {
        allowedConns += concurrentConnectionsPerVm;
      }
    }

    const maxSupportedVms = Math.floor(totalUsablePorts / portsAssignedPerVm);

    return {
      totalUsablePorts,
      allocatedPortsPerVm: portsAssignedPerVm,
      maxSupportedVms,
      connectionsAllowed: gatewayExhausted ? 0 : allowedConns,
      connectionsDropped: gatewayExhausted ? vmCount * concurrentConnectionsPerVm : droppedConns,
      portExhaustionOccurred: droppedConns > 0 || gatewayExhausted,
    };
  }
}

// ============================================================================
// 4. Cloud Storage Consistency & Bucket Lock Model
// ============================================================================

export interface StorageObjectMetadata {
  generation: number;
  sizeBytes: number;
  md5Hash: string;
  createdAt: number;
  retentionExpiresAt?: number;
}

export class CloudStorageBucketModel {
  public readonly name: string;
  public readonly uniformBucketLevelAccess: boolean;
  public retentionPeriodSeconds?: number;
  public isBucketLocked: boolean = false;
  private objects: Map<string, StorageObjectMetadata> = new Map();
  private generationCounter: number = 1000;

  constructor(name: string, uniformBucketLevelAccess: boolean = true) {
    this.name = name;
    this.uniformBucketLevelAccess = uniformBucketLevelAccess;
  }

  public setRetentionPolicy(seconds: number): void {
    if (this.isBucketLocked) {
      if (!this.retentionPeriodSeconds || seconds < this.retentionPeriodSeconds) {
        throw new Error('Bucket Lock Violation: Cannot reduce retention period on a locked bucket');
      }
    }
    this.retentionPeriodSeconds = seconds;
  }

  public lockBucket(): void {
    if (!this.retentionPeriodSeconds || this.retentionPeriodSeconds <= 0) {
      throw new Error('Cannot lock a bucket without an existing retention policy');
    }
    this.isBucketLocked = true;
  }

  public putObject(
    name: string,
    sizeBytes: number,
    md5Hash: string,
    nowMs: number = Date.now(),
  ): StorageObjectMetadata {
    this.generationCounter++;
    const meta: StorageObjectMetadata = {
      generation: this.generationCounter,
      sizeBytes,
      md5Hash,
      createdAt: nowMs,
      retentionExpiresAt: this.retentionPeriodSeconds
        ? nowMs + this.retentionPeriodSeconds * 1000
        : undefined,
    };

    // Strongly consistent write: immediate availability
    this.objects.set(name, meta);
    return meta;
  }

  public getObject(name: string): StorageObjectMetadata | undefined {
    // Strongly consistent read: immediately reflects latest write or delete
    return this.objects.get(name);
  }

  public deleteObject(name: string, nowMs: number = Date.now()): boolean {
    const existing = this.objects.get(name);
    if (!existing) return false;

    if (existing.retentionExpiresAt && nowMs < existing.retentionExpiresAt) {
      throw new Error(
        `Object Retention Violation: Object ${name} is protected by retention until ${new Date(
          existing.retentionExpiresAt,
        ).toISOString()}`,
      );
    }

    this.objects.delete(name);
    return true;
  }
}

// ============================================================================
// 5. Cloud Spanner TrueTime & Monotonic Key Hotspot Detection
// ============================================================================

export interface TrueTimeInterval {
  earliestMs: number;
  latestMs: number;
  uncertaintyMs: number; // epsilon = (latest - earliest) / 2
}

export class SpannerTrueTimeSimulator {
  public static getTrueTime(currentTimeMs: number, epsilonMs: number = 3): TrueTimeInterval {
    return {
      earliestMs: currentTimeMs - epsilonMs,
      latestMs: currentTimeMs + epsilonMs,
      uncertaintyMs: epsilonMs,
    };
  }

  public static simulateCommitWait(
    requestTimeMs: number,
    epsilonMs: number = 3,
  ): { commitTimestampMs: number; commitWaitDurationMs: number } {
    // Pick commit timestamp s >= t.latest
    const tt = this.getTrueTime(requestTimeMs, epsilonMs);
    const commitTimestampMs = tt.latestMs;

    // Wait until t.earliest > commitTimestampMs
    // At real time t' where t'.earliest > commitTimestampMs:
    // t' - epsilonMs > commitTimestampMs => t' > commitTimestampMs + epsilonMs = requestTimeMs + 2*epsilonMs
    const commitWaitDurationMs = 2 * epsilonMs;

    return {
      commitTimestampMs,
      commitWaitDurationMs,
    };
  }

  public static analyzeKeyDistribution(
    keys: string[],
    splitCount: number = 4,
    existingKeyRangeBounds?: string[],
  ): {
    isHotspotting: boolean;
    maxSplitFraction: number;
    distribution: number[];
  } {
    // Default 4 equal split bounds: ["4", "8", "c"]
    const bounds = existingKeyRangeBounds ?? ['4', '8', 'c'];
    const distribution = new Array(splitCount).fill(0);

    keys.forEach((key) => {
      let split = 0;
      for (let i = 0; i < bounds.length; i++) {
        if (key >= bounds[i]!) {
          split = i + 1;
        } else {
          break;
        }
      }
      distribution[split]++;
    });

    const maxCount = Math.max(...distribution);
    const maxSplitFraction = keys.length > 0 ? maxCount / keys.length : 0;

    // If a single split absorbs > 80% of writes, it's a hotspot
    const isHotspotting = maxSplitFraction > 0.8 && keys.length >= 10;

    return {
      isHotspotting,
      maxSplitFraction,
      distribution,
    };
  }
}

// ============================================================================
// 6. Cloud Pub/Sub Ordering Keys & Dead-Letter Queue (DLQ) Model
// ============================================================================

export interface PubSubMessage {
  id: string;
  data: string;
  orderingKey?: string;
  publishTimeMs: number;
  deliveryAttempts: number;
}

export class PubSubSubscriptionSimulator {
  private messages: PubSubMessage[] = [];
  private deadLetterQueue: PubSubMessage[] = [];
  private inFlightKeys: Set<string> = new Set();
  public readonly enableMessageOrdering: boolean;
  public readonly ackDeadlineSeconds: number;
  public readonly maxDeliveryAttempts?: number;

  constructor(
    enableMessageOrdering: boolean = false,
    ackDeadlineSeconds: number = 10,
    maxDeliveryAttempts?: number,
  ) {
    this.enableMessageOrdering = enableMessageOrdering;
    this.ackDeadlineSeconds = ackDeadlineSeconds;
    this.maxDeliveryAttempts = maxDeliveryAttempts;
  }

  public publish(msg: Omit<PubSubMessage, 'deliveryAttempts'>): void {
    this.messages.push({
      ...msg,
      deliveryAttempts: 0,
    });
  }

  public pull(_nowMs: number = Date.now()): PubSubMessage[] {
    // If ordering is enabled, messages with the same orderingKey must be delivered sequentially
    if (!this.enableMessageOrdering) {
      return this.messages.map((m) => {
        m.deliveryAttempts++;
        return m;
      });
    }

    const eligible: PubSubMessage[] = [];

    for (const msg of this.messages) {
      if (msg.orderingKey) {
        if (!this.inFlightKeys.has(msg.orderingKey)) {
          this.inFlightKeys.add(msg.orderingKey);
          msg.deliveryAttempts++;
          eligible.push(msg);
        }
      } else {
        msg.deliveryAttempts++;
        eligible.push(msg);
      }
    }

    return eligible;
  }

  public acknowledge(messageId: string): boolean {
    const idx = this.messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      const msg = this.messages[idx];
      if (msg?.orderingKey) {
        this.inFlightKeys.delete(msg.orderingKey);
      }
      this.messages.splice(idx, 1);
      return true;
    }
    return false;
  }

  public handleNackOrTimeout(messageId: string): { movedToDlq: boolean } {
    const msg = this.messages.find((m) => m.id === messageId);
    if (!msg) return { movedToDlq: false };

    if (msg.orderingKey) {
      this.inFlightKeys.delete(msg.orderingKey);
    }

    if (this.maxDeliveryAttempts && msg.deliveryAttempts >= this.maxDeliveryAttempts) {
      // Forward to DLQ and remove from primary subscription
      this.deadLetterQueue.push(msg);
      const idx = this.messages.findIndex((m) => m.id === messageId);
      if (idx !== -1) this.messages.splice(idx, 1);
      return { movedToDlq: true };
    }

    return { movedToDlq: false };
  }

  public getPendingCount(): number {
    return this.messages.length;
  }

  public getDlqCount(): number {
    return this.deadLetterQueue.length;
  }
}

// ============================================================================
// 7. BigQuery Columnar Storage & Query Execution Cost Model
// ============================================================================

export interface BigQueryColumn {
  name: string;
  type: 'STRING' | 'INT64' | 'FLOAT64' | 'TIMESTAMP';
  bytesPerRow: number;
}

export interface BigQueryTable {
  projectId?: string;
  datasetId?: string;
  tableId?: string;
  totalRows: number;
  columns: BigQueryColumn[];
  partitionColumn?: string;
  partitionCount?: number;
  isClustered?: boolean;
}

export class BigQueryCostModel {
  public static calculateScanBytes(
    table: BigQueryTable,
    selectedColumns: string[],
    partitionsScannedRatio: number = 1.0,
    clusterPruningRatio: number = 1.0,
  ): { totalScannedBytes: number; costUsd: number } {
    const PRICE_PER_TIB = 6.25;
    const MINIMUM_BILLABLE_BYTES = 10 * 1024 * 1024; // 10 MiB minimum per query

    let bytesPerRow = 0;
    const targetCols = selectedColumns.includes('*')
      ? table.columns
      : table.columns.filter((c) => selectedColumns.includes(c.name));

    for (const col of targetCols) {
      bytesPerRow += col.bytesPerRow;
    }

    const rowsScanned = table.totalRows * partitionsScannedRatio * clusterPruningRatio;
    const rawBytes = Math.ceil(rowsScanned * bytesPerRow);
    const billableBytes = Math.max(rawBytes, rawBytes > 0 ? MINIMUM_BILLABLE_BYTES : 0);

    const costUsd = (billableBytes / (1024 * 1024 * 1024 * 1024)) * PRICE_PER_TIB;

    return {
      totalScannedBytes: billableBytes,
      costUsd,
    };
  }
}

export interface CloudRunServiceConfig {
  name: string;
  minInstances: number;
  maxInstances: number;
  concurrency: number; // default 80
  cpuAlwaysAllocated: boolean; // false = request-based, true = instance-based
  vCpu: number; // e.g. 1, 2, 4
  memoryMb: number; // e.g. 512, 1024, 2048
}

export class CloudRunExecutionSimulator {
  public readonly config: CloudRunServiceConfig;

  constructor(config: CloudRunServiceConfig) {
    this.config = config;
  }

  public calculateRequiredInstances(activeRequests: number): number {
    if (activeRequests === 0) {
      return this.config.minInstances;
    }
    const computed = Math.ceil(activeRequests / this.config.concurrency);
    return Math.min(Math.max(computed, this.config.minInstances), this.config.maxInstances);
  }

  public executeBackgroundTask(
    workloadCycles: number,
    isWithinActiveRequest: boolean,
  ): {
    completionTimeMs: number;
    wasThrottled: boolean;
  } {
    // If cpuAlwaysAllocated is true, or work runs during an active HTTP request, full CPU rate applies
    if (this.config.cpuAlwaysAllocated || isWithinActiveRequest) {
      const completionTimeMs = workloadCycles / (this.config.vCpu * 1000);
      return {
        completionTimeMs,
        wasThrottled: false,
      };
    }

    // In request-based billing outside active requests, CPU is severely throttled (~95% reduction)
    const throttledCpu = 0.05;
    const completionTimeMs = workloadCycles / (throttledCpu * 1000);
    return {
      completionTimeMs,
      wasThrottled: true,
    };
  }
}
