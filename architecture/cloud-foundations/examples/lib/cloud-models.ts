/**
 * Cloud Foundations Architecture Domain Engine
 *
 * Provides deterministic simulation models for:
 * 1. IAM Policy Evaluation (Explicit Deny, Allow, Condition Matching)
 * 2. IPv4 CIDR Subnetting & Overlap Detection
 * 3. Availability Zone & Shuffle Sharding Allocator
 * 4. Storage Tiering & Early Deletion Penalty Economics
 * 5. Database Replication Lag & RPO/RTO Recovery Simulation
 * 6. At-Least-Once Messaging, Visibility Timeout & DLQ Thresholds
 * 7. Saga Distributed Workflow & Retry Storm Backoff
 * 8. FinOps Cost Engine (Egress, Cross-AZ, NAT Data Processing)
 * 9. Policy-as-Code Guardrail Engine
 */

export interface IamStatement {
  sid?: string;
  effect: 'Allow' | 'Deny';
  principals?: string[]; // '*' or specific principal ARN/ID
  actions: string[]; // e.g. ['s3:GetObject', 's3:*']
  resources: string[]; // e.g. ['arn:aws:s3:::my-bucket/*']
  conditions?: Record<string, Record<string, unknown>>; // e.g. { 'StringEquals': { 'aws:PrincipalTag/Team': 'DevOps' } }
}

export interface IamPolicy {
  version?: string;
  statements: IamStatement[];
}

export interface IamEvaluationRequest {
  principal: string;
  principalTags?: Record<string, string>;
  action: string;
  resource: string;
  sourceIp?: string;
  secureTransport?: boolean;
}

export type IamDecision = 'DENIED_EXPLICIT' | 'ALLOWED' | 'DENIED_DEFAULT';

export class IamEvaluator {
  private static matchWildcard(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    const regexPattern =
      '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$';
    return new RegExp(regexPattern).test(value);
  }

  private static evaluateCondition(
    conditionOperator: string,
    key: string,
    expectedValue: unknown,
    request: IamEvaluationRequest,
  ): boolean {
    let actualValue: unknown;
    if (key === 'aws:SourceIp') {
      actualValue = request.sourceIp;
    } else if (key === 'aws:SecureTransport') {
      actualValue =
        request.secureTransport !== undefined ? String(request.secureTransport) : undefined;
    } else if (key.startsWith('aws:PrincipalTag/')) {
      const tagKey = key.replace('aws:PrincipalTag/', '');
      actualValue = request.principalTags?.[tagKey];
    } else {
      actualValue = undefined;
    }

    if (conditionOperator === 'StringEquals') {
      return String(actualValue) === String(expectedValue);
    }
    if (conditionOperator === 'StringNotEquals') {
      return String(actualValue) !== String(expectedValue);
    }
    if (conditionOperator === 'Bool') {
      return String(actualValue).toLowerCase() === String(expectedValue).toLowerCase();
    }
    if (conditionOperator === 'IpAddress') {
      // Simplified CIDR match or exact match
      return String(actualValue) === String(expectedValue);
    }
    return false;
  }

  public static evaluate(policies: IamPolicy[], request: IamEvaluationRequest): IamDecision {
    let hasExplicitAllow = false;

    for (const policy of policies) {
      for (const statement of policy.statements) {
        const actionMatch = statement.actions.some((a) => this.matchWildcard(a, request.action));
        if (!actionMatch) continue;

        const resourceMatch = statement.resources.some((r) =>
          this.matchWildcard(r, request.resource),
        );
        if (!resourceMatch) continue;

        if (statement.principals && !statement.principals.includes('*')) {
          const principalMatch = statement.principals.some((p) =>
            this.matchWildcard(p, request.principal),
          );
          if (!principalMatch) continue;
        }

        // Evaluate conditions if present
        let conditionMet = true;
        if (statement.conditions) {
          for (const [op, conditionBody] of Object.entries(statement.conditions)) {
            for (const [key, expectedVal] of Object.entries(conditionBody)) {
              if (!this.evaluateCondition(op, key, expectedVal, request)) {
                conditionMet = false;
                break;
              }
            }
            if (!conditionMet) break;
          }
        }

        if (conditionMet) {
          if (statement.effect === 'Deny') {
            return 'DENIED_EXPLICIT';
          }
          if (statement.effect === 'Allow') {
            hasExplicitAllow = true;
          }
        }
      }
    }

    return hasExplicitAllow ? 'ALLOWED' : 'DENIED_DEFAULT';
  }
}

// -------------------------------------------------------------
// CIDR Allocation & Overlap Detection
// -------------------------------------------------------------

export class CidrBlock {
  public readonly cidr: string;
  public readonly baseIp: number;
  public readonly prefixLen: number;
  public readonly size: number;

  constructor(cidr: string) {
    this.cidr = cidr;
    const parts = cidr.trim().split('/');
    if (parts.length !== 2) throw new Error(`Invalid CIDR format: ${cidr}`);
    const ipStr = parts[0]!;
    const prefix = parseInt(parts[1]!, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) {
      throw new Error(`Invalid prefix length: ${prefix}`);
    }
    this.prefixLen = prefix;
    this.baseIp = CidrBlock.ipToNumber(ipStr);
    this.size = 2 ** (32 - prefix);

    // Normalize base IP to network boundary
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    this.baseIp = (this.baseIp & mask) >>> 0;
  }

  public static ipToNumber(ip: string): number {
    const octets = ip.split('.').map((o) => parseInt(o, 10));
    if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
      throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>> 0;
  }

  public static numberToIp(num: number): string {
    return [(num >>> 24) & 255, (num >>> 16) & 255, (num >>> 8) & 255, num & 255].join('.');
  }

  public overlaps(other: CidrBlock): boolean {
    const startA = this.baseIp;
    const endA = startA + this.size - 1;
    const startB = other.baseIp;
    const endB = startB + other.size - 1;
    return !(endA < startB || startA > endB);
  }

  public split(newPrefixLen: number): CidrBlock[] {
    if (newPrefixLen <= this.prefixLen || newPrefixLen > 32) {
      throw new Error(`New prefix ${newPrefixLen} must be greater than current ${this.prefixLen}`);
    }
    const count = 2 ** (newPrefixLen - this.prefixLen);
    const subSize = 2 ** (32 - newPrefixLen);
    const result: CidrBlock[] = [];
    for (let i = 0; i < count; i++) {
      const subBase = (this.baseIp + i * subSize) >>> 0;
      result.push(new CidrBlock(`${CidrBlock.numberToIp(subBase)}/${newPrefixLen}`));
    }
    return result;
  }
}

// -------------------------------------------------------------
// Shuffle Sharding & Blast Radius
// -------------------------------------------------------------

export class ShuffleShardAllocator {
  public static getCombinations<T>(items: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (items.length < k) return [];
    const [head, ...tail] = items;
    const withHead = this.getCombinations(tail, k - 1).map((combo) => [head!, ...combo]);
    const withoutHead = this.getCombinations(tail, k);
    return [...withHead, ...withoutHead];
  }

  public static totalShards(n: number, k: number): number {
    let result = 1;
    for (let i = 1; i <= k; i++) {
      result = (result * (n - i + 1)) / i;
    }
    return Math.round(result);
  }

  public static assignCustomer(
    customerId: string,
    availableNodes: string[],
    shardSize: number,
  ): string[] {
    // Deterministic hash assignment
    let hash = 0;
    for (let i = 0; i < customerId.length; i++) {
      hash = (hash * 31 + customerId.charCodeAt(i)) >>> 0;
    }
    const pool = [...availableNodes];
    const assigned: string[] = [];
    for (let i = 0; i < shardSize; i++) {
      const index = (hash + i * 17) % pool.length;
      assigned.push(pool[index]!);
      pool.splice(index, 1);
    }
    return assigned.sort();
  }
}

// -------------------------------------------------------------
// Storage Tiering & Early Deletion Economics
// -------------------------------------------------------------

export interface StorageTierSpec {
  name: string;
  monthlyPerGb: number;
  retrievalPerGb: number;
  minimumRetentionDays: number;
}

export class StorageEconomics {
  public static calculateCost(
    tier: StorageTierSpec,
    sizeGb: number,
    heldDays: number,
    retrievedGb: number,
  ): {
    baseStorageCost: number;
    earlyDeletionFee: number;
    retrievalCost: number;
    totalCost: number;
  } {
    const baseStorageCost = sizeGb * (heldDays / 30) * tier.monthlyPerGb;
    const earlyDeletionDays = Math.max(0, tier.minimumRetentionDays - heldDays);
    const earlyDeletionFee = sizeGb * (earlyDeletionDays / 30) * tier.monthlyPerGb;
    const retrievalCost = retrievedGb * tier.retrievalPerGb;
    const totalCost = baseStorageCost + earlyDeletionFee + retrievalCost;
    return {
      baseStorageCost: Number(baseStorageCost.toFixed(4)),
      earlyDeletionFee: Number(earlyDeletionFee.toFixed(4)),
      retrievalCost: Number(retrievalCost.toFixed(4)),
      totalCost: Number(totalCost.toFixed(4)),
    };
  }
}

// -------------------------------------------------------------
// Database Replication & RPO/RTO Simulator
// -------------------------------------------------------------

export interface DatabaseClusterConfig {
  mode: 'SYNCHRONOUS_STANDBY' | 'ASYNCHRONOUS_REPLICA';
  replicationLagSeconds: number;
  dnsTtlSeconds: number;
  detectionTimeSeconds: number;
  promotionTimeSeconds: number;
}

export class DatabaseRecoverySimulator {
  public static simulateFailover(config: DatabaseClusterConfig): {
    rpoSeconds: number;
    rtoSeconds: number;
    totalClientOutageSeconds: number;
  } {
    const rpoSeconds = config.mode === 'SYNCHRONOUS_STANDBY' ? 0 : config.replicationLagSeconds;
    const rtoSeconds = config.detectionTimeSeconds + config.promotionTimeSeconds;
    // Clients experience outage until DNS TTL expires and route to new primary
    const totalClientOutageSeconds = rtoSeconds + config.dnsTtlSeconds;
    return {
      rpoSeconds,
      rtoSeconds,
      totalClientOutageSeconds,
    };
  }
}

// -------------------------------------------------------------
// At-Least-Once Messaging, Visibility & Idempotency
// -------------------------------------------------------------

export interface MessageEnvelope {
  id: string;
  body: string;
  idempotencyKey: string;
  receiveCount: number;
  visibleAfter: number; // millisecond timestamp
}

export class CloudQueue {
  public readonly visibilityTimeoutMs: number;
  public readonly maxReceiveCount: number;
  private messages: MessageEnvelope[] = [];
  public deadLetterQueue: MessageEnvelope[] = [];
  private processedKeys = new Set<string>();

  constructor(visibilityTimeoutMs: number, maxReceiveCount: number) {
    this.visibilityTimeoutMs = visibilityTimeoutMs;
    this.maxReceiveCount = maxReceiveCount;
  }

  public enqueue(body: string, idempotencyKey: string, now: number = Date.now()): void {
    const msg: MessageEnvelope = {
      id: `msg-${Math.random().toString(36).slice(2, 9)}`,
      body,
      idempotencyKey,
      receiveCount: 0,
      visibleAfter: now,
    };
    this.messages.push(msg);
  }

  public receive(now: number = Date.now()): MessageEnvelope | null {
    const index = this.messages.findIndex((m) => m.visibleAfter <= now);
    if (index === -1) return null;

    const msg = this.messages[index]!;
    msg.receiveCount++;
    if (msg.receiveCount > this.maxReceiveCount) {
      this.messages.splice(index, 1);
      this.deadLetterQueue.push(msg);
      return null;
    }

    msg.visibleAfter = now + this.visibilityTimeoutMs;
    return msg;
  }

  public acknowledge(
    messageId: string,
    idempotencyKey: string,
  ): { processed: boolean; duplicate: boolean } {
    const idx = this.messages.findIndex((m) => m.id === messageId);
    if (idx !== -1) {
      this.messages.splice(idx, 1);
    }
    if (this.processedKeys.has(idempotencyKey)) {
      return { processed: false, duplicate: true };
    }
    this.processedKeys.add(idempotencyKey);
    return { processed: true, duplicate: false };
  }
}

// -------------------------------------------------------------
// Distributed Saga & Exponential Backoff Retry Storm
// -------------------------------------------------------------

export interface SagaStep {
  name: string;
  execute: () => Promise<boolean>;
  compensate: () => Promise<void>;
}

export class SagaCoordinator {
  public executedSteps: string[] = [];
  public compensatedSteps: string[] = [];

  public async run(steps: SagaStep[]): Promise<{ success: boolean; failedAt?: string }> {
    for (const step of steps) {
      try {
        const ok = await step.execute();
        if (!ok) {
          await this.rollback(steps);
          return { success: false, failedAt: step.name };
        }
        this.executedSteps.push(step.name);
      } catch {
        await this.rollback(steps);
        return { success: false, failedAt: step.name };
      }
    }
    return { success: true };
  }

  private async rollback(allSteps: SagaStep[]): Promise<void> {
    const executedInReverse = [...this.executedSteps].reverse();
    for (const executedName of executedInReverse) {
      const step = allSteps.find((s) => s.name === executedName);
      if (step) {
        await step.compensate();
        this.compensatedSteps.push(step.name);
      }
    }
  }

  public static calculateExponentialBackoff(
    attempt: number,
    baseMs: number,
    maxMs: number,
    jitter: boolean = true,
  ): number {
    const raw = Math.min(maxMs, baseMs * 2 ** attempt);
    if (!jitter) return raw;
    // Full jitter between 0 and raw
    return Math.floor(Math.random() * raw);
  }
}

// -------------------------------------------------------------
// FinOps Multi-Dimensional Cost Calculator
// -------------------------------------------------------------

export interface FinOpsUsage {
  computeHours: number;
  computeHourlyRate: number;
  dataProcessedByNatGb: number;
  crossAzDataTransferGb: number;
  publicEgressGb: number;
  storageGbMonth: number;
  storageRatePerGbMonth: number;
}

export class FinOpsCalculator {
  // Standard cloud benchmarks:
  // NAT Gateway processing: ~$0.045 / GB
  // Cross-AZ egress (intra-region): ~$0.01 / GB in each direction
  // Internet Egress: ~$0.09 / GB (hyperscaler tier) vs $0.00 (Cloudflare R2)
  public static calculate(usage: FinOpsUsage): {
    computeCost: number;
    natProcessingCost: number;
    crossAzCost: number;
    internetEgressCost: number;
    storageCost: number;
    totalCost: number;
    networkCostPercentage: number;
  } {
    const computeCost = usage.computeHours * usage.computeHourlyRate;
    const natProcessingCost = usage.dataProcessedByNatGb * 0.045;
    const crossAzCost = usage.crossAzDataTransferGb * 0.02; // Billed both sender and receiver AZ ($0.01 + $0.01)
    const internetEgressCost = usage.publicEgressGb * 0.09;
    const storageCost = usage.storageGbMonth * usage.storageRatePerGbMonth;

    const totalCost =
      computeCost + natProcessingCost + crossAzCost + internetEgressCost + storageCost;
    const totalNetworkCost = natProcessingCost + crossAzCost + internetEgressCost;
    const networkCostPercentage =
      totalCost === 0 ? 0 : Number(((totalNetworkCost / totalCost) * 100).toFixed(2));

    return {
      computeCost: Number(computeCost.toFixed(2)),
      natProcessingCost: Number(natProcessingCost.toFixed(2)),
      crossAzCost: Number(crossAzCost.toFixed(2)),
      internetEgressCost: Number(internetEgressCost.toFixed(2)),
      storageCost: Number(storageCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      networkCostPercentage,
    };
  }
}

// -------------------------------------------------------------
// Policy-as-Code Guardrail Rule Engine
// -------------------------------------------------------------

export interface ResourceDefinition {
  type: string;
  id: string;
  properties: Record<string, unknown>;
}

export interface PolicyViolation {
  resourceId: string;
  ruleId: string;
  message: string;
}

export class PolicyGuardrailEngine {
  public static checkPublicBucket(res: ResourceDefinition): PolicyViolation | null {
    if (
      res.type === 'aws_s3_bucket' ||
      res.type === 'google_storage_bucket' ||
      res.type === 'azurerm_storage_account'
    ) {
      const isPublic =
        res.properties['acl'] === 'public-read' ||
        res.properties['allow_public_access'] === true ||
        res.properties['public_network_access_enabled'] === true;
      if (isPublic) {
        return {
          resourceId: res.id,
          ruleId: 'SEC-01-NO-PUBLIC-OBJECT-STORAGE',
          message: 'Object storage must not allow public internet access.',
        };
      }
    }
    return null;
  }

  public static checkOpenSshSecurityGroup(res: ResourceDefinition): PolicyViolation | null {
    if (
      res.type === 'aws_security_group_rule' ||
      res.type === 'google_compute_firewall' ||
      res.type === 'azurerm_network_security_rule'
    ) {
      const cidr = res.properties['cidr_blocks'] as string[] | undefined;
      const port = res.properties['from_port'] as number | undefined;
      if (
        cidr?.includes('0.0.0.0/0') &&
        (port === 22 ||
          res.properties['ports'] === 22 ||
          res.properties['destination_port_range'] === '22')
      ) {
        return {
          resourceId: res.id,
          ruleId: 'NET-02-NO-OPEN-INGRESS-PORT-22',
          message: 'Security group or firewall must not allow open SSH ingress (0.0.0.0/0:22).',
        };
      }
    }
    return null;
  }
}
