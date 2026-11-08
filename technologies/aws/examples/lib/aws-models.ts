import { createHmac, createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

// ============================================================================
// 1. IAM Policy Evaluation Engine
// ============================================================================

export type Effect = 'Allow' | 'Deny';

export interface Statement {
  Sid?: string;
  Effect: Effect;
  Principal?: string | string[] | Record<string, string | string[]>;
  Action: string | string[];
  Resource: string | string[];
  Condition?: Record<string, Record<string, string | number | boolean>>;
}

export interface PolicyDocument {
  Version: string;
  Statement: Statement[];
}

export interface EvaluationContext {
  principalArn: string;
  action: string;
  resourceArn: string;
  isSameAccount: boolean;
  identityPolicies: PolicyDocument[];
  resourcePolicy?: PolicyDocument;
  scpPolicies?: PolicyDocument[];
  permissionBoundary?: PolicyDocument;
  sessionPolicy?: PolicyDocument;
  contextValues?: Record<string, string | number | boolean>;
}

export type EvaluationDecision =
  | 'ACCESS_ALLOWED'
  | 'EXPLICIT_DENY'
  | 'DEFAULT_DENY'
  | 'SCP_DENY'
  | 'PERMISSION_BOUNDARY_DENY'
  | 'SESSION_POLICY_DENY'
  | 'CROSS_ACCOUNT_IDENTITY_DENY';

export interface EvaluationResult {
  decision: EvaluationDecision;
  allowed: boolean;
  reason: string;
  matchedStatements: Statement[];
}

function matchPattern(pattern: string, value: string): boolean {
  if (pattern === '*') return true;
  if (!pattern.includes('*') && !pattern.includes('?')) {
    return pattern.toLowerCase() === value.toLowerCase();
  }
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(value);
}

function matchesAction(statementAction: string | string[], targetAction: string): boolean {
  const actions = Array.isArray(statementAction) ? statementAction : [statementAction];
  return actions.some((act) => matchPattern(act, targetAction));
}

function matchesResource(statementResource: string | string[], targetResource: string): boolean {
  const resources = Array.isArray(statementResource) ? statementResource : [statementResource];
  return resources.some((res) => matchPattern(res, targetResource));
}

function evaluateConditions(
  condition: Statement['Condition'],
  contextValues?: Record<string, string | number | boolean>,
): boolean {
  if (!condition || Object.keys(condition).length === 0) return true;
  if (!contextValues) return false;

  for (const [operator, keyMap] of Object.entries(condition)) {
    for (const [key, expectedValue] of Object.entries(keyMap)) {
      const actualValue = contextValues[key];
      if (actualValue === undefined) return false;

      if (operator === 'StringEquals') {
        if (String(actualValue) !== String(expectedValue)) return false;
      } else if (operator === 'StringNotEquals') {
        if (String(actualValue) === String(expectedValue)) return false;
      } else if (operator === 'NumericLessThanEquals') {
        if (Number(actualValue) > Number(expectedValue)) return false;
      } else if (operator === 'Bool') {
        if (Boolean(actualValue) !== Boolean(expectedValue)) return false;
      }
    }
  }
  return true;
}

function findStatements(
  policies: PolicyDocument[],
  action: string,
  resource: string,
  contextValues?: Record<string, string | number | boolean>,
): Statement[] {
  const matched: Statement[] = [];
  for (const policy of policies) {
    for (const stmt of policy.Statement) {
      if (
        matchesAction(stmt.Action, action) &&
        matchesResource(stmt.Resource, resource) &&
        evaluateConditions(stmt.Condition, contextValues)
      ) {
        matched.push(stmt);
      }
    }
  }
  return matched;
}

export function evaluateIamPolicy(ctx: EvaluationContext): EvaluationResult {
  const allPolicies: PolicyDocument[] = [...ctx.identityPolicies];
  if (ctx.resourcePolicy) allPolicies.push(ctx.resourcePolicy);
  if (ctx.scpPolicies) allPolicies.push(...ctx.scpPolicies);
  if (ctx.permissionBoundary) allPolicies.push(ctx.permissionBoundary);
  if (ctx.sessionPolicy) allPolicies.push(ctx.sessionPolicy);

  // 1. Check for ANY explicit deny across all applicable policies
  const allStatements = findStatements(allPolicies, ctx.action, ctx.resourceArn, ctx.contextValues);
  const explicitDenies = allStatements.filter((s) => s.Effect === 'Deny');
  if (explicitDenies.length > 0) {
    return {
      decision: 'EXPLICIT_DENY',
      allowed: false,
      reason: `Action '${ctx.action}' explicitly denied by statement '${explicitDenies[0]?.Sid ?? 'Unnamed'}'`,
      matchedStatements: explicitDenies,
    };
  }

  // 2. Check Service Control Policies (SCPs)
  if (ctx.scpPolicies && ctx.scpPolicies.length > 0) {
    const scpMatches = findStatements(
      ctx.scpPolicies,
      ctx.action,
      ctx.resourceArn,
      ctx.contextValues,
    );
    const scpAllows = scpMatches.filter((s) => s.Effect === 'Allow');
    if (scpAllows.length === 0) {
      return {
        decision: 'SCP_DENY',
        allowed: false,
        reason: `Action '${ctx.action}' not allowed by Organization Service Control Policies`,
        matchedStatements: scpMatches,
      };
    }
  }

  // 3. Evaluate Resource Policy vs Identity Policy
  let resourceAllowed = false;
  if (ctx.resourcePolicy) {
    const resStatements = findStatements(
      [ctx.resourcePolicy],
      ctx.action,
      ctx.resourceArn,
      ctx.contextValues,
    );
    if (resStatements.some((s) => s.Effect === 'Allow')) {
      resourceAllowed = true;
    }
  }

  const identityStatements = findStatements(
    ctx.identityPolicies,
    ctx.action,
    ctx.resourceArn,
    ctx.contextValues,
  );
  const identityAllowed = identityStatements.some((s) => s.Effect === 'Allow');

  if (ctx.isSameAccount) {
    if (!resourceAllowed && !identityAllowed) {
      return {
        decision: 'DEFAULT_DENY',
        allowed: false,
        reason: `No matching Allow in identity or resource policies in same-account context`,
        matchedStatements: [],
      };
    }
  } else {
    // Cross-account evaluation
    if (ctx.resourcePolicy && resourceAllowed) {
      if (!identityAllowed) {
        return {
          decision: 'CROSS_ACCOUNT_IDENTITY_DENY',
          allowed: false,
          reason: `Cross-account access allowed by resource policy but missing required Allow in principal identity policy`,
          matchedStatements: identityStatements,
        };
      }
    } else {
      return {
        decision: 'DEFAULT_DENY',
        allowed: false,
        reason: `Cross-account access denied: resource policy did not permit principal`,
        matchedStatements: [],
      };
    }
  }

  // 4. Permission Boundary check (constrains identity policies; does not block resource policy grants in same-account)
  if (ctx.permissionBoundary && (!resourceAllowed || !ctx.isSameAccount)) {
    const boundaryStatements = findStatements(
      [ctx.permissionBoundary],
      ctx.action,
      ctx.resourceArn,
      ctx.contextValues,
    );
    if (!boundaryStatements.some((s) => s.Effect === 'Allow')) {
      return {
        decision: 'PERMISSION_BOUNDARY_DENY',
        allowed: false,
        reason: `Action allowed by identity policy but blocked by Permission Boundary`,
        matchedStatements: boundaryStatements,
      };
    }
  }

  // 5. Session Policy check
  if (ctx.sessionPolicy) {
    const sessionStatements = findStatements(
      [ctx.sessionPolicy],
      ctx.action,
      ctx.resourceArn,
      ctx.contextValues,
    );
    if (!sessionStatements.some((s) => s.Effect === 'Allow')) {
      return {
        decision: 'SESSION_POLICY_DENY',
        allowed: false,
        reason: `Action blocked by temporary credentials Session Policy`,
        matchedStatements: sessionStatements,
      };
    }
  }

  return {
    decision: 'ACCESS_ALLOWED',
    allowed: true,
    reason: `Access granted by applicable IAM policies`,
    matchedStatements: allStatements.filter((s) => s.Effect === 'Allow'),
  };
}

// ============================================================================
// 2. S3 Presigned URL Generator and SigV4 Validator
// ============================================================================

export interface PresignedUrlParams {
  bucket: string;
  region: string;
  key: string;
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD';
  accessKeyId: string;
  secretKey: string;
  expiresInSeconds: number;
  timestamp: Date;
}

export interface SigV4ValidationResult {
  valid: boolean;
  error?: string;
  bucket?: string;
  key?: string;
  expired?: boolean;
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function hashSha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

function getSignatureKey(
  key: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
): Buffer {
  const kDate = hmac('AWS4' + key, dateStamp);
  const kRegion = hmac(kDate, regionName);
  const kService = hmac(kRegion, serviceName);
  return hmac(kService, 'aws4_request');
}

export function generatePresignedUrl(params: PresignedUrlParams): string {
  const isoDate = params.timestamp.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = isoDate.substring(0, 8);
  const credentialScope = `${params.accessKeyId}/${dateStamp}/${params.region}/s3/aws4_request`;

  const host = `${params.bucket}.s3.${params.region}.amazonaws.com`;
  const canonicalUri = `/${encodeURIComponent(params.key).replace(/%2F/g, '/')}`;

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': credentialScope,
    'X-Amz-Date': isoDate,
    'X-Amz-Expires': params.expiresInSeconds.toString(),
    'X-Amz-SignedHeaders': 'host',
  });

  const canonicalQueryString = Array.from(queryParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    params.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    isoDate,
    `${dateStamp}/${params.region}/s3/aws4_request`,
    hashSha256(canonicalRequest),
  ].join('\n');

  const signingKey = getSignatureKey(params.secretKey, dateStamp, params.region, 's3');
  const signature = createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

  queryParams.set('X-Amz-Signature', signature);

  return `https://${host}${canonicalUri}?${queryParams.toString()}`;
}

export function validatePresignedUrl(
  rawUrl: string,
  method: 'GET' | 'PUT' | 'DELETE' | 'HEAD',
  secretKey: string,
  currentTime: Date,
): SigV4ValidationResult {
  try {
    const parsed = new URL(rawUrl);
    const searchParams = parsed.searchParams;

    const algorithm = searchParams.get('X-Amz-Algorithm');
    if (algorithm !== 'AWS4-HMAC-SHA256') {
      return { valid: false, error: 'Unsupported algorithm: expected AWS4-HMAC-SHA256' };
    }

    const credential = searchParams.get('X-Amz-Credential');
    const dateStr = searchParams.get('X-Amz-Date');
    const expiresStr = searchParams.get('X-Amz-Expires');
    const providedSignature = searchParams.get('X-Amz-Signature');

    if (!credential || !dateStr || !expiresStr || !providedSignature) {
      return { valid: false, error: 'Missing required SigV4 query parameters' };
    }

    const credParts = credential.split('/');
    if (credParts.length !== 5) {
      return { valid: false, error: 'Malformed X-Amz-Credential' };
    }
    const [, dateStamp, region] = credParts;
    const expiresIn = parseInt(expiresStr, 10);

    // Expiration check
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    const hour = parseInt(dateStr.substring(9, 11), 10);
    const min = parseInt(dateStr.substring(11, 13), 10);
    const sec = parseInt(dateStr.substring(13, 15), 10);
    const requestDate = new Date(Date.UTC(year, month, day, hour, min, sec));

    const expirationTime = new Date(requestDate.getTime() + expiresIn * 1000);
    if (currentTime.getTime() > expirationTime.getTime()) {
      return { valid: false, expired: true, error: 'Presigned URL has expired' };
    }

    // Reconstruct canonical query string without X-Amz-Signature
    const queryEntries: [string, string][] = [];
    for (const [k, v] of searchParams.entries()) {
      if (k !== 'X-Amz-Signature') {
        queryEntries.push([k, v]);
      }
    }
    const canonicalQuery = queryEntries
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');

    const host = parsed.host;
    const canonicalUri = parsed.pathname;
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      dateStr,
      `${dateStamp}/${region}/s3/aws4_request`,
      hashSha256(canonicalRequest),
    ].join('\n');

    if (!dateStamp || !region) {
      return { valid: false, error: 'Missing dateStamp or region in credential scope' };
    }

    const signingKey = getSignatureKey(secretKey, dateStamp, region, 's3');
    const expectedSignature = createHmac('sha256', signingKey)
      .update(stringToSign, 'utf8')
      .digest('hex');

    if (expectedSignature !== providedSignature) {
      return { valid: false, error: 'Signature mismatch: verification failed' };
    }

    const bucket = host.split('.')[0];
    const key = decodeURIComponent(parsed.pathname.substring(1));

    return { valid: true, bucket, key };
  } catch (err: unknown) {
    return { valid: false, error: (err as Error).message };
  }
}

// ============================================================================
// 3. DynamoDB Single-Table Design & Key Validator
// ============================================================================

export interface DynamoItem {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  entityType: string;
  [key: string]: unknown;
}

export interface DynamoQueryInput {
  tableName: string;
  indexName?: string;
  partitionKey: { attribute: string; value: string };
  sortKeyCondition?: {
    attribute: string;
    operator: '=' | 'begins_with' | 'between' | '<' | '<=' | '>' | '>=';
    value: string;
    secondValue?: string;
  };
}

export interface QueryValidationResult {
  valid: boolean;
  errors: string[];
  matchedItems: DynamoItem[];
  consumedRcuEstimate: number;
}

export class DynamoSingleTableStore {
  private items: DynamoItem[] = [];

  public putItem(item: DynamoItem): void {
    const existingIndex = this.items.findIndex((i) => i.PK === item.PK && i.SK === item.SK);
    if (existingIndex >= 0) {
      this.items[existingIndex] = item;
    } else {
      this.items.push(item);
    }
  }

  public getItem(pk: string, sk: string): DynamoItem | undefined {
    return this.items.find((i) => i.PK === pk && i.SK === sk);
  }

  public query(input: DynamoQueryInput): QueryValidationResult {
    const errors: string[] = [];

    // DynamoDB Query Rules
    if (!input.partitionKey.value) {
      errors.push('Partition key value must be non-empty.');
    }

    if (input.sortKeyCondition?.operator === 'between' && !input.sortKeyCondition.secondValue) {
      errors.push("'between' sort key condition requires secondValue.");
    }

    if (errors.length > 0) {
      return { valid: false, errors, matchedItems: [], consumedRcuEstimate: 0 };
    }

    const isGsi = Boolean(input.indexName);
    const pkAttr = isGsi
      ? input.indexName === 'GSI1'
        ? 'GSI1PK'
        : input.partitionKey.attribute
      : 'PK';
    const skAttr = isGsi
      ? input.indexName === 'GSI1'
        ? 'GSI1SK'
        : (input.sortKeyCondition?.attribute ?? 'SK')
      : 'SK';

    const matched = this.items.filter((item) => {
      const itemPk = (item as Record<string, unknown>)[pkAttr];
      if (itemPk !== input.partitionKey.value) return false;

      if (!input.sortKeyCondition) return true;

      const itemSk = String((item as Record<string, unknown>)[skAttr] ?? '');
      const { operator, value, secondValue } = input.sortKeyCondition;

      switch (operator) {
        case '=':
          return itemSk === value;
        case 'begins_with':
          return itemSk.startsWith(value);
        case '<':
          return itemSk < value;
        case '<=':
          return itemSk <= value;
        case '>':
          return itemSk > value;
        case '>=':
          return itemSk >= value;
        case 'between':
          return secondValue ? itemSk >= value && itemSk <= secondValue : false;
        default:
          return false;
      }
    });

    // In DynamoDB, each RCU reads up to 4 KB of data (strongly consistent) or 8 KB (eventually consistent)
    const totalBytes = matched.reduce((acc, curr) => acc + JSON.stringify(curr).length, 0);
    const consumedRcu = Math.max(1, Math.ceil(totalBytes / 4096));

    return {
      valid: true,
      errors: [],
      matchedItems: matched,
      consumedRcuEstimate: consumedRcu,
    };
  }
}

// ============================================================================
// 4. SQS Dead-Letter Queue & Visibility Timeout Simulation
// ============================================================================

export interface SqsMessage {
  id: string;
  body: string;
  receiptHandle: string;
  receiveCount: number;
  sentAt: number;
  visibleAt: number;
}

export class SqsQueueSimulation {
  private messages: SqsMessage[] = [];
  private dlqMessages: SqsMessage[] = [];
  public readonly visibilityTimeoutSeconds: number;
  public readonly maxReceiveCount: number;

  constructor(options: { visibilityTimeoutSeconds?: number; maxReceiveCount?: number } = {}) {
    this.visibilityTimeoutSeconds = options.visibilityTimeoutSeconds ?? 30;
    this.maxReceiveCount = options.maxReceiveCount ?? 3;
  }

  public sendMessage(body: string, currentTime: number = Date.now()): SqsMessage {
    const msg: SqsMessage = {
      id: `msg-${Math.random().toString(36).substring(2, 9)}`,
      body,
      receiptHandle: `rcpt-${Math.random().toString(36).substring(2, 9)}`,
      receiveCount: 0,
      sentAt: currentTime,
      visibleAt: currentTime,
    };
    this.messages.push(msg);
    return msg;
  }

  public receiveMessages(maxBatchSize: number, currentTime: number = Date.now()): SqsMessage[] {
    const available: SqsMessage[] = [];
    const remaining: SqsMessage[] = [];

    for (const msg of this.messages) {
      if (currentTime >= msg.visibleAt) {
        msg.receiveCount += 1;
        if (msg.receiveCount > this.maxReceiveCount) {
          // Route to Dead-Letter Queue
          this.dlqMessages.push(msg);
        } else {
          msg.visibleAt = currentTime + this.visibilityTimeoutSeconds * 1000;
          msg.receiptHandle = `rcpt-${Math.random().toString(36).substring(2, 9)}`;
          if (available.length < maxBatchSize) {
            available.push(msg);
            remaining.push(msg);
          } else {
            msg.receiveCount -= 1; // Not delivered in this batch
            remaining.push(msg);
          }
        }
      } else {
        remaining.push(msg);
      }
    }

    this.messages = remaining;
    return available;
  }

  public deleteMessage(receiptHandle: string): boolean {
    const initialLen = this.messages.length;
    this.messages = this.messages.filter((m) => m.receiptHandle !== receiptHandle);
    return this.messages.length < initialLen;
  }

  public redriveDlq(): number {
    const count = this.dlqMessages.length;
    for (const msg of this.dlqMessages) {
      msg.receiveCount = 0;
      msg.visibleAt = Date.now();
      this.messages.push(msg);
    }
    this.dlqMessages = [];
    return count;
  }

  public getQueueLength(): { primary: number; dlq: number; inFlight: number } {
    const now = Date.now();
    const inFlight = this.messages.filter((m) => m.visibleAt > now).length;
    return {
      primary: this.messages.length,
      dlq: this.dlqMessages.length,
      inFlight,
    };
  }
}

// ============================================================================
// 5. S3 Prefix Partitioning & Conditional Writes Simulator
// ============================================================================

export interface S3StoredObject {
  key: string;
  prefix: string;
  etag: string;
  content: string;
  versionId: string;
  lastModified: number;
}

export interface S3PutObjectInput {
  key: string;
  content: string;
  ifNoneMatch?: string; // e.g. "*" or specific ETag
  ifMatch?: string; // specific ETag
}

export interface S3OperationResult<T = void> {
  statusCode: number;
  data?: T;
  error?: string;
  etag?: string;
  partitionId?: string;
}

export class S3BucketPartitionSimulation {
  public static readonly BASE_PUT_RATE_LIMIT = 3500;
  public static readonly BASE_GET_RATE_LIMIT = 5500;

  private partitions: Map<
    string,
    { currentPuts: number; currentGets: number; subPartitions: string[] }
  > = new Map();
  private objects: Map<string, S3StoredObject> = new Map();
  private partitionSplitCount = 0;

  constructor() {
    this.partitions.set('root', { currentPuts: 0, currentGets: 0, subPartitions: [] });
  }

  private getPrefix(key: string): string {
    const lastSlash = key.lastIndexOf('/');
    return lastSlash >= 0 ? key.substring(0, lastSlash + 1) : '';
  }

  public getSplitCount(): number {
    return this.partitionSplitCount;
  }

  public resetRateWindows(): void {
    for (const part of this.partitions.values()) {
      part.currentPuts = 0;
      part.currentGets = 0;
    }
  }

  public putObject(
    input: S3PutObjectInput,
  ): S3OperationResult<{ etag: string; versionId: string }> {
    const prefix = this.getPrefix(input.key);
    let part = this.partitions.get(prefix);
    if (!part) {
      part = { currentPuts: 0, currentGets: 0, subPartitions: [] };
      this.partitions.set(prefix, part);
    }

    part.currentPuts += 1;
    if (part.currentPuts > S3BucketPartitionSimulation.BASE_PUT_RATE_LIMIT) {
      this.partitionSplitCount += 1;
      part.subPartitions.push(`${prefix}sub-a/`, `${prefix}sub-b/`);
    }

    const existing = this.objects.get(input.key);

    // Conditional Write: If-None-Match: * (prevent overwriting existing object)
    if (input.ifNoneMatch === '*' && existing) {
      return {
        statusCode: 412,
        error:
          'PreconditionFailed: At least one of the pre-conditions you specified did not hold (object exists).',
      };
    }

    // Conditional Write: If-None-Match matching existing ETag
    if (
      input.ifNoneMatch &&
      input.ifNoneMatch !== '*' &&
      existing &&
      existing.etag === input.ifNoneMatch
    ) {
      return {
        statusCode: 412,
        error: 'PreconditionFailed: Object ETag matched If-None-Match condition.',
      };
    }

    // Conditional Write: If-Match matching current ETag
    if (input.ifMatch && (!existing || existing.etag !== input.ifMatch)) {
      return {
        statusCode: 412,
        error: 'PreconditionFailed: Object ETag does not match If-Match condition.',
      };
    }

    const etag = `"${createHash('md5').update(input.content).digest('hex')}"`;
    const versionId = `v-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const stored: S3StoredObject = {
      key: input.key,
      prefix,
      etag,
      content: input.content,
      versionId,
      lastModified: Date.now(),
    };

    this.objects.set(input.key, stored);

    return {
      statusCode: 200,
      etag,
      data: { etag, versionId },
      partitionId: prefix || 'root',
    };
  }

  public getObject(key: string): S3OperationResult<S3StoredObject> {
    const prefix = this.getPrefix(key);
    let part = this.partitions.get(prefix);
    if (!part) {
      part = { currentPuts: 0, currentGets: 0, subPartitions: [] };
      this.partitions.set(prefix, part);
    }

    part.currentGets += 1;
    if (part.currentGets > S3BucketPartitionSimulation.BASE_GET_RATE_LIMIT) {
      this.partitionSplitCount += 1;
    }

    const obj = this.objects.get(key);
    if (!obj) {
      return {
        statusCode: 404,
        error: 'NoSuchKey: The specified key does not exist.',
      };
    }

    return {
      statusCode: 200,
      data: obj,
      etag: obj.etag,
      partitionId: prefix || 'root',
    };
  }
}

// ============================================================================
// 6. Aurora 6-Way Quorum Storage Engine Simulation
// ============================================================================

export interface AuroraLogRecord {
  lsn: number;
  transactionId: string;
  data: string;
}

export interface StorageNode {
  id: number;
  az: 'AZ1' | 'AZ2' | 'AZ3';
  isOnline: boolean;
  records: Map<number, AuroraLogRecord>;
  maxLsn: number;
}

export interface WriteQuorumResult {
  success: boolean;
  lsn: number;
  acks: number;
  requiredQuorum: number;
  respondingNodes: number[];
  failedNodes: number[];
}

export interface ReadQuorumResult {
  success: boolean;
  lsn: number;
  requiredQuorum: number;
  respondingNodes: number[];
  data?: string;
  reconstructedFromLsn: number;
}

export class AuroraStorageCluster {
  public static readonly TOTAL_NODES = 6;
  public static readonly WRITE_QUORUM = 4;
  public static readonly READ_QUORUM = 3;

  private nodes: StorageNode[] = [];

  constructor() {
    const azs: Array<'AZ1' | 'AZ2' | 'AZ3'> = ['AZ1', 'AZ1', 'AZ2', 'AZ2', 'AZ3', 'AZ3'];
    for (let i = 0; i < AuroraStorageCluster.TOTAL_NODES; i++) {
      this.nodes.push({
        id: i,
        az: azs[i]!,
        isOnline: true,
        records: new Map(),
        maxLsn: 0,
      });
    }
  }

  public setNodeStatus(nodeId: number, isOnline: boolean): void {
    const node = this.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.isOnline = isOnline;
    }
  }

  public writeRedoLog(record: AuroraLogRecord): WriteQuorumResult {
    const respondingNodes: number[] = [];
    const failedNodes: number[] = [];

    for (const node of this.nodes) {
      if (node.isOnline) {
        node.records.set(record.lsn, { ...record });
        node.maxLsn = Math.max(node.maxLsn, record.lsn);
        respondingNodes.push(node.id);
      } else {
        failedNodes.push(node.id);
      }
    }

    const acks = respondingNodes.length;
    const success = acks >= AuroraStorageCluster.WRITE_QUORUM;

    return {
      success,
      lsn: record.lsn,
      acks,
      requiredQuorum: AuroraStorageCluster.WRITE_QUORUM,
      respondingNodes,
      failedNodes,
    };
  }

  public readRecord(lsn: number): ReadQuorumResult {
    const respondingNodes: number[] = [];
    let bestRecord: AuroraLogRecord | undefined;
    let highestLsn = -1;

    for (const node of this.nodes) {
      if (node.isOnline) {
        respondingNodes.push(node.id);
        const rec = node.records.get(lsn);
        if (rec && node.maxLsn >= highestLsn) {
          highestLsn = node.maxLsn;
          bestRecord = rec;
        }
        if (respondingNodes.length === AuroraStorageCluster.READ_QUORUM) {
          break;
        }
      }
    }

    const success =
      respondingNodes.length >= AuroraStorageCluster.READ_QUORUM && bestRecord !== undefined;

    return {
      success,
      lsn,
      requiredQuorum: AuroraStorageCluster.READ_QUORUM,
      respondingNodes,
      data: bestRecord?.data,
      reconstructedFromLsn: highestLsn,
    };
  }

  public peerGossipRepair(): {
    repairedNodes: number;
    details: Array<{ nodeId: number; recoveredLsns: number[] }>;
  } {
    let highestCommittedLsn = 0;
    const masterMap = new Map<number, AuroraLogRecord>();

    for (const node of this.nodes) {
      for (const [lsn, rec] of node.records.entries()) {
        if (!masterMap.has(lsn)) {
          masterMap.set(lsn, rec);
        }
        if (lsn > highestCommittedLsn) {
          highestCommittedLsn = lsn;
        }
      }
    }

    let repairedCount = 0;
    const details: Array<{ nodeId: number; recoveredLsns: number[] }> = [];

    for (const node of this.nodes) {
      if (node.isOnline) {
        const missingLsns: number[] = [];
        for (const [lsn, rec] of masterMap.entries()) {
          if (!node.records.has(lsn)) {
            node.records.set(lsn, { ...rec });
            missingLsns.push(lsn);
          }
        }
        if (missingLsns.length > 0) {
          node.maxLsn = highestCommittedLsn;
          repairedCount++;
          details.push({ nodeId: node.id, recoveredLsns: missingLsns });
        }
      }
    }

    return { repairedNodes: repairedCount, details };
  }

  public getNode(id: number): StorageNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }
}

// ============================================================================
// 7. EventBridge Event Pattern Evaluation Engine
// ============================================================================

export interface EventBridgeEvent {
  id: string;
  source: string;
  'detail-type': string;
  account: string;
  time: string;
  region: string;
  resources?: string[];
  detail: Record<string, unknown>;
}

export type EventPattern = {
  source?: string[];
  'detail-type'?: string[];
  account?: string[];
  region?: string[];
  resources?: string[];
  detail?: Record<string, unknown>;
  [key: string]: unknown;
};

export function evaluateEventPattern(pattern: EventPattern, event: EventBridgeEvent): boolean {
  for (const [key, expected] of Object.entries(pattern)) {
    if (key === 'detail') {
      if (typeof expected === 'object' && expected !== null) {
        if (!evaluateDetailPattern(expected as Record<string, unknown>, event.detail ?? {})) {
          return false;
        }
      }
    } else {
      const eventValue = (event as unknown as Record<string, unknown>)[key];
      if (Array.isArray(expected)) {
        if (!matchValueAgainstPatternList(expected, eventValue)) {
          return false;
        }
      } else if (typeof expected === 'object' && expected !== null) {
        if (!evaluateConditionObject(expected as Record<string, unknown>, eventValue)) {
          return false;
        }
      }
    }
  }
  return true;
}

function matchValueAgainstPatternList(patternList: unknown[], value: unknown): boolean {
  return patternList.some((pat) => {
    if (typeof pat === 'object' && pat !== null) {
      return evaluateConditionObject(pat as Record<string, unknown>, value);
    }
    return pat === value;
  });
}

function evaluateConditionObject(cond: Record<string, unknown>, value: unknown): boolean {
  if ('prefix' in cond && typeof cond.prefix === 'string') {
    if (typeof value !== 'string') return false;
    return value.startsWith(cond.prefix);
  }

  if ('anything-but' in cond) {
    const excluded = cond['anything-but'];
    if (Array.isArray(excluded)) {
      return !excluded.includes(value);
    }
    return value !== excluded;
  }

  if ('exists' in cond) {
    const shouldExist = Boolean(cond.exists);
    const doesExist = value !== undefined && value !== null;
    return shouldExist === doesExist;
  }

  if ('numeric' in cond && Array.isArray(cond.numeric)) {
    if (typeof value !== 'number') return false;
    const tokens = cond.numeric;
    for (let i = 0; i < tokens.length; i += 2) {
      const op = tokens[i];
      const limit = tokens[i + 1];
      if (typeof limit !== 'number') return false;
      switch (op) {
        case '>':
          if (!(value > limit)) return false;
          break;
        case '>=':
          if (!(value >= limit)) return false;
          break;
        case '<':
          if (!(value < limit)) return false;
          break;
        case '<=':
          if (!(value <= limit)) return false;
          break;
        case '=':
          if (!(value === limit)) return false;
          break;
        default:
          return false;
      }
    }
    return true;
  }

  return false;
}

function evaluateDetailPattern(
  detailPattern: Record<string, unknown>,
  eventDetail: Record<string, unknown>,
): boolean {
  for (const [field, expectedRule] of Object.entries(detailPattern)) {
    const actualVal = eventDetail[field];
    if (Array.isArray(expectedRule)) {
      if (!matchValueAgainstPatternList(expectedRule, actualVal)) {
        return false;
      }
    } else if (typeof expectedRule === 'object' && expectedRule !== null) {
      if (
        'prefix' in expectedRule ||
        'anything-but' in expectedRule ||
        'exists' in expectedRule ||
        'numeric' in expectedRule
      ) {
        if (!evaluateConditionObject(expectedRule as Record<string, unknown>, actualVal)) {
          return false;
        }
      } else {
        if (typeof actualVal !== 'object' || actualVal === null) return false;
        if (
          !evaluateDetailPattern(
            expectedRule as Record<string, unknown>,
            actualVal as Record<string, unknown>,
          )
        ) {
          return false;
        }
      }
    } else {
      if (actualVal !== expectedRule) return false;
    }
  }
  return true;
}

// ============================================================================
// 8. AWS Key Management Service (KMS) & Envelope Encryption Simulator
// ============================================================================

export interface KmsGrant {
  grantId: string;
  granteePrincipal: string;
  retiringPrincipal?: string;
  operations: string[];
  name?: string;
}

export interface KmsKeyRecord {
  keyId: string;
  arn: string;
  account: string;
  keyPolicy: PolicyDocument;
  keyState: 'Enabled' | 'Disabled';
  keySpec: 'SYMMETRIC_DEFAULT' | 'RSA_2048';
  multiRegion: boolean;
  replicaRegions: string[];
  grants: Map<string, KmsGrant>;
  rawMasterKey: Buffer;
}

export class KmsEngine {
  private keys = new Map<string, KmsKeyRecord>();
  public apiCallCount = 0;

  createKey(
    account: string,
    keyPolicy: PolicyDocument,
    options: { multiRegion?: boolean; keySpec?: 'SYMMETRIC_DEFAULT' | 'RSA_2048' } = {},
  ): KmsKeyRecord {
    const keyId = `k-${randomBytes(8).toString('hex')}`;
    const arn = `arn:aws:kms:us-east-1:${account}:key/${keyId}`;
    const rawMasterKey = randomBytes(32);

    const record: KmsKeyRecord = {
      keyId,
      arn,
      account,
      keyPolicy,
      keyState: 'Enabled',
      keySpec: options.keySpec ?? 'SYMMETRIC_DEFAULT',
      multiRegion: options.multiRegion ?? false,
      replicaRegions: [],
      grants: new Map(),
      rawMasterKey,
    };

    this.keys.set(keyId, record);
    this.keys.set(arn, record);
    return record;
  }

  getKey(keyIdOrArn: string): KmsKeyRecord | undefined {
    return this.keys.get(keyIdOrArn);
  }

  setKeyState(keyIdOrArn: string, state: 'Enabled' | 'Disabled'): void {
    const key = this.getKey(keyIdOrArn);
    if (!key) throw new Error(`KMS key not found: ${keyIdOrArn}`);
    key.keyState = state;
  }

  createGrant(keyIdOrArn: string, grant: Omit<KmsGrant, 'grantId'>): string {
    const key = this.getKey(keyIdOrArn);
    if (!key) throw new Error(`KMS key not found: ${keyIdOrArn}`);
    const grantId = `grant-${randomBytes(6).toString('hex')}`;
    const fullGrant: KmsGrant = { ...grant, grantId };
    key.grants.set(grantId, fullGrant);
    return grantId;
  }

  retireGrant(keyIdOrArn: string, grantId: string): boolean {
    const key = this.getKey(keyIdOrArn);
    if (!key) throw new Error(`KMS key not found: ${keyIdOrArn}`);
    return key.grants.delete(grantId);
  }

  evaluateAccess(
    keyIdOrArn: string,
    principalArn: string,
    action: string,
    identityPolicies: PolicyDocument[] = [],
  ): { allowed: boolean; reason: string } {
    const key = this.getKey(keyIdOrArn);
    if (!key) {
      return { allowed: false, reason: 'NotFound' };
    }
    if (key.keyState !== 'Enabled') {
      return { allowed: false, reason: 'KeyDisabled' };
    }

    // 1. Check Key Policy statements
    let explicitDenyInKeyPolicy = false;
    let explicitAllowInKeyPolicy = false;
    let rootDelegationInKeyPolicy = false;

    const rootArn = `arn:aws:iam::${key.account}:root`;

    for (const stmt of key.keyPolicy.Statement) {
      const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
      const actionMatches = actions.some((act) => act === '*' || act === 'kms:*' || act === action);
      if (!actionMatches) continue;

      const rawPrincipal = (stmt as unknown as { Principal?: unknown }).Principal;
      const principalMatches = this.matchesPrincipal(rawPrincipal, principalArn, rootArn);

      if (stmt.Effect === 'Deny' && principalMatches) {
        explicitDenyInKeyPolicy = true;
        break;
      }

      if (stmt.Effect === 'Allow') {
        if (principalMatches) {
          explicitAllowInKeyPolicy = true;
        }
        if (this.isRootDelegation(rawPrincipal, rootArn)) {
          rootDelegationInKeyPolicy = true;
        }
      }
    }

    if (explicitDenyInKeyPolicy) {
      return { allowed: false, reason: 'ExplicitDenyInKeyPolicy' };
    }

    if (explicitAllowInKeyPolicy) {
      return { allowed: true, reason: 'AllowedByKeyPolicy' };
    }

    // 2. If Key Policy delegates to root, check caller's IAM Identity Policies
    if (rootDelegationInKeyPolicy) {
      for (const idPolicy of identityPolicies) {
        for (const stmt of idPolicy.Statement) {
          const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
          const actionMatches = actions.some(
            (act) => act === '*' || act === 'kms:*' || act === action,
          );
          if (!actionMatches) continue;

          const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];
          const resourceMatches = resources.some(
            (res) => res === '*' || res === key.arn || res === key.keyId,
          );
          if (!resourceMatches) continue;

          if (stmt.Effect === 'Deny') {
            return { allowed: false, reason: 'ExplicitDenyInIdentityPolicy' };
          }
          if (stmt.Effect === 'Allow') {
            return { allowed: true, reason: 'AllowedViaIamDelegation' };
          }
        }
      }
    }

    // 3. Check Active Grants on the key
    for (const grant of key.grants.values()) {
      if (grant.granteePrincipal === principalArn || grant.granteePrincipal === '*') {
        const matchesOp = grant.operations.some(
          (op) => op === '*' || op === action || `kms:${op}` === action,
        );
        if (matchesOp) {
          return { allowed: true, reason: 'AllowedViaGrant' };
        }
      }
    }

    // If Key Policy omits root delegation and principal is not in key policy, identity policy cannot help!
    return {
      allowed: false,
      reason: rootDelegationInKeyPolicy
        ? 'DefaultDeny'
        : 'DeniedBecauseKeyPolicyOmitsIamDelegation',
    };
  }

  private matchesPrincipal(principal: unknown, callerArn: string, _rootArn?: string): boolean {
    if (!principal) return false;
    if (principal === '*') return true;
    if (typeof principal === 'object' && principal !== null) {
      const pObj = principal as Record<string, unknown>;
      if (pObj.AWS) {
        const awsPrincipals = Array.isArray(pObj.AWS) ? pObj.AWS : [pObj.AWS];
        return awsPrincipals.some((p) => p === '*' || p === callerArn);
      }
    }
    return false;
  }

  private isRootDelegation(principal: unknown, rootArn: string): boolean {
    if (!principal) return false;
    if (principal === '*') return true;
    if (typeof principal === 'object' && principal !== null) {
      const pObj = principal as Record<string, unknown>;
      if (pObj.AWS) {
        const awsPrincipals = Array.isArray(pObj.AWS) ? pObj.AWS : [pObj.AWS];
        return awsPrincipals.some((p) => p === '*' || p === rootArn);
      }
    }
    return false;
  }

  generateDataKey(
    keyIdOrArn: string,
    callerArn: string,
    identityPolicies: PolicyDocument[] = [],
    _keySpec: 'AES_256' = 'AES_256',
  ): { plaintext: Buffer; ciphertext: Buffer } {
    this.apiCallCount++;
    const auth = this.evaluateAccess(
      keyIdOrArn,
      callerArn,
      'kms:GenerateDataKey',
      identityPolicies,
    );
    if (!auth.allowed) {
      throw new Error(`AccessDeniedException: KMS access denied. Reason: ${auth.reason}`);
    }

    const key = this.getKey(keyIdOrArn)!;
    const plaintextKey = randomBytes(32);

    // Encrypt DEK with KMS raw master key using AES-256-GCM
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key.rawMasterKey, iv);
    const encrypted = Buffer.concat([cipher.update(plaintextKey), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Ciphertext blob packs: [12-byte IV][16-byte Tag][encrypted key bytes]
    const ciphertext = Buffer.concat([iv, tag, encrypted]);
    return { plaintext: plaintextKey, ciphertext };
  }

  decrypt(
    keyIdOrArn: string,
    ciphertextBlob: Buffer,
    callerArn: string,
    identityPolicies: PolicyDocument[] = [],
  ): Buffer {
    this.apiCallCount++;
    const auth = this.evaluateAccess(keyIdOrArn, callerArn, 'kms:Decrypt', identityPolicies);
    if (!auth.allowed) {
      throw new Error(`AccessDeniedException: KMS access denied. Reason: ${auth.reason}`);
    }

    const key = this.getKey(keyIdOrArn)!;
    if (ciphertextBlob.length < 28) {
      throw new Error('InvalidCiphertextException: Ciphertext blob too short');
    }

    const iv = ciphertextBlob.subarray(0, 12);
    const tag = ciphertextBlob.subarray(12, 28);
    const encrypted = ciphertextBlob.subarray(28);

    const decipher = createDecipheriv('aes-256-gcm', key.rawMasterKey, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }
}

export function envelopeEncrypt(
  plaintext: Buffer,
  keyIdOrArn: string,
  kmsEngine: KmsEngine,
  callerArn: string,
  identityPolicies: PolicyDocument[] = [],
): { ciphertextPayload: Buffer; encryptedDataKey: Buffer; iv: Buffer; authTag: Buffer } {
  // 1. Request DEK from KMS
  const { plaintext: dek, ciphertext: encryptedDataKey } = kmsEngine.generateDataKey(
    keyIdOrArn,
    callerArn,
    identityPolicies,
  );

  // 2. Encrypt plaintext payload with local DEK
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dek, iv);
  const ciphertextPayload = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 3. Zero out plaintext DEK from memory
  dek.fill(0);

  return { ciphertextPayload, encryptedDataKey, iv, authTag };
}

export function envelopeDecrypt(
  payload: { ciphertextPayload: Buffer; encryptedDataKey: Buffer; iv: Buffer; authTag: Buffer },
  keyIdOrArn: string,
  kmsEngine: KmsEngine,
  callerArn: string,
  identityPolicies: PolicyDocument[] = [],
): Buffer {
  // 1. Decrypt DEK via KMS
  const dek = kmsEngine.decrypt(keyIdOrArn, payload.encryptedDataKey, callerArn, identityPolicies);

  // 2. Decrypt payload with DEK
  const decipher = createDecipheriv('aes-256-gcm', dek, payload.iv);
  decipher.setAuthTag(payload.authTag);
  const plaintext = Buffer.concat([decipher.update(payload.ciphertextPayload), decipher.final()]);

  // 3. Zero out plaintext DEK
  dek.fill(0);

  return plaintext;
}

export class S3BucketKeySimulation {
  public kmsEngine: KmsEngine;
  public keyId: string;
  public callerArn: string;
  public identityPolicies: PolicyDocument[];
  private bucketDataKeyCache: Buffer | null = null;

  constructor(
    kmsEngine: KmsEngine,
    keyId: string,
    callerArn: string,
    identityPolicies: PolicyDocument[] = [],
  ) {
    this.kmsEngine = kmsEngine;
    this.keyId = keyId;
    this.callerArn = callerArn;
    this.identityPolicies = identityPolicies;
  }

  putObjectWithoutBucketKey(key: string, data: Buffer): { key: string; bytes: number } {
    // Every PUT requests a unique KMS GenerateDataKey
    const { plaintext } = this.kmsEngine.generateDataKey(
      this.keyId,
      this.callerArn,
      this.identityPolicies,
    );
    plaintext.fill(0);
    return { key, bytes: data.length };
  }

  getObjectWithoutBucketKey(key: string, encryptedKeyBlob: Buffer): Buffer {
    // Every GET decrypts with KMS
    return this.kmsEngine.decrypt(
      this.keyId,
      encryptedKeyBlob,
      this.callerArn,
      this.identityPolicies,
    );
  }

  putObjectWithBucketKey(key: string, data: Buffer): { key: string; bytes: number } {
    // S3 negotiates a single bucket-level data key from KMS and caches it for the session
    if (!this.bucketDataKeyCache) {
      const { plaintext } = this.kmsEngine.generateDataKey(
        this.keyId,
        this.callerArn,
        this.identityPolicies,
      );
      this.bucketDataKeyCache = plaintext;
    }
    // Object key is derived locally using HMAC-SHA256 from bucket key and object path (0 KMS API calls)
    const derivedKey = createHmac('sha256', this.bucketDataKeyCache).update(key).digest();
    derivedKey.fill(0);
    return { key, bytes: data.length };
  }
}

// ============================================================================
// 9. CloudWatch Embedded Metric Format (EMF) & Alarms Engine
// ============================================================================

export interface EmfMetricDefinition {
  Name: string;
  Unit?: string;
}

export interface EmfCloudWatchMetrics {
  Namespace: string;
  Dimensions: string[][];
  Metrics: EmfMetricDefinition[];
}

export interface EmfLogPayload {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: EmfCloudWatchMetrics[];
  };
  [key: string]: unknown;
}

export function formatEmf(params: {
  namespace: string;
  dimensions: Record<string, string>;
  metrics: Record<string, { value: number; unit?: string }>;
  customFields?: Record<string, unknown>;
  timestamp?: number;
}): string {
  const dimensionKeys = Object.keys(params.dimensions);
  const metricDefinitions: EmfMetricDefinition[] = [];
  const payload: Record<string, unknown> = {
    ...params.customFields,
    ...params.dimensions,
  };

  for (const [name, meta] of Object.entries(params.metrics)) {
    metricDefinitions.push({ Name: name, Unit: meta.unit });
    payload[name] = meta.value;
  }

  const emfEnvelope: EmfLogPayload = {
    _aws: {
      Timestamp: params.timestamp ?? Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: params.namespace,
          Dimensions: [dimensionKeys],
          Metrics: metricDefinitions,
        },
      ],
    },
    ...payload,
  };

  return JSON.stringify(emfEnvelope);
}

export interface ExtractedMetric {
  namespace: string;
  name: string;
  value: number;
  unit?: string;
  dimensions: Record<string, string>;
  timestamp: number;
}

export function extractEmfMetrics(emfJsonLine: string): ExtractedMetric[] {
  const parsed = JSON.parse(emfJsonLine) as EmfLogPayload;
  if (!parsed._aws || !Array.isArray(parsed._aws.CloudWatchMetrics)) {
    throw new Error('Invalid EMF: missing _aws.CloudWatchMetrics block');
  }

  const timestamp = parsed._aws.Timestamp;
  const results: ExtractedMetric[] = [];

  for (const cwMetric of parsed._aws.CloudWatchMetrics) {
    const namespace = cwMetric.Namespace;
    const dimensionSets = cwMetric.Dimensions;

    for (const metricDef of cwMetric.Metrics) {
      const val = parsed[metricDef.Name];
      if (typeof val !== 'number') continue;

      for (const dimList of dimensionSets) {
        const dims: Record<string, string> = {};
        for (const dimKey of dimList) {
          dims[dimKey] = String(parsed[dimKey] ?? '');
        }
        results.push({
          namespace,
          name: metricDef.Name,
          value: val,
          unit: metricDef.Unit,
          dimensions: dims,
          timestamp,
        });
      }
    }
  }

  return results;
}

export type AlarmState = 'OK' | 'ALARM' | 'INSUFFICIENT_DATA';

export function evaluateMetricAlarm(
  config: {
    threshold: number;
    comparisonOperator:
      | 'GreaterThanThreshold'
      | 'GreaterThanOrEqualToThreshold'
      | 'LessThanThreshold'
      | 'LessThanOrEqualToThreshold';
    evaluationPeriods: number;
    datapointsToAlarm: number;
  },
  datapoints: number[],
): AlarmState {
  if (datapoints.length < config.evaluationPeriods) {
    return 'INSUFFICIENT_DATA';
  }

  const window = datapoints.slice(-config.evaluationPeriods);
  let breachCount = 0;

  for (const dp of window) {
    let breached = false;
    switch (config.comparisonOperator) {
      case 'GreaterThanThreshold':
        breached = dp > config.threshold;
        break;
      case 'GreaterThanOrEqualToThreshold':
        breached = dp >= config.threshold;
        break;
      case 'LessThanThreshold':
        breached = dp < config.threshold;
        break;
      case 'LessThanOrEqualToThreshold':
        breached = dp <= config.threshold;
        break;
    }
    if (breached) breachCount++;
  }

  return breachCount >= config.datapointsToAlarm ? 'ALARM' : 'OK';
}

export function evaluateCompositeAlarm(
  expression: string,
  alarmStates: Record<string, AlarmState>,
): AlarmState {
  const tokens = expression.match(
    /\b(?:ALARM|OK|INSUFFICIENT_DATA)\s*\(\s*["']?[^"')\s]+["']?\s*\)|\b(?:NOT|AND|OR)\b|[()]/g,
  );
  if (!tokens) return 'INSUFFICIENT_DATA';

  let pos = 0;

  function parsePrimary(): boolean {
    if (pos >= tokens!.length) return false;
    const token = tokens![pos++];
    if (!token) return false;

    if (token === '(') {
      const val = parseOr();
      if (tokens![pos] === ')') pos++;
      return val;
    }

    const funcMatch = token.match(
      /^(ALARM|OK|INSUFFICIENT_DATA)\s*\(\s*["']?([^"')\s]+)["']?\s*\)$/,
    );
    if (funcMatch && funcMatch[1] && funcMatch[2]) {
      const func = funcMatch[1];
      const name = funcMatch[2];
      const state = alarmStates[name] ?? 'INSUFFICIENT_DATA';
      if (func === 'ALARM') return state === 'ALARM';
      if (func === 'OK') return state === 'OK';
      if (func === 'INSUFFICIENT_DATA') return state === 'INSUFFICIENT_DATA';
    }

    return false;
  }

  function parseNot(): boolean {
    if (tokens![pos] === 'NOT') {
      pos++;
      return !parseNot();
    }
    return parsePrimary();
  }

  function parseAnd(): boolean {
    let left = parseNot();
    while (pos < tokens!.length && tokens![pos] === 'AND') {
      pos++;
      const right = parseNot();
      left = left && right;
    }
    return left;
  }

  function parseOr(): boolean {
    let left = parseAnd();
    while (pos < tokens!.length && tokens![pos] === 'OR') {
      pos++;
      const right = parseAnd();
      left = left || right;
    }
    return left;
  }

  const result = parseOr();
  return result ? 'ALARM' : 'OK';
}

// ============================================================================
// 10. Shuffle Sharding Router & Resilience Simulator
// ============================================================================

export class ShuffleShardingRouter {
  public totalNodes: number;
  public nodesPerShard: number;
  public nodePrefix: string;

  constructor(totalNodes: number, nodesPerShard: number, nodePrefix = 'worker-node-') {
    if (totalNodes < nodesPerShard) {
      throw new Error('totalNodes must be greater than or equal to nodesPerShard');
    }
    if (nodesPerShard < 1) {
      throw new Error('nodesPerShard must be at least 1');
    }
    this.totalNodes = totalNodes;
    this.nodesPerShard = nodesPerShard;
    this.nodePrefix = nodePrefix;
  }

  calculateCombinations(): number {
    let numerator = 1;
    let denominator = 1;
    for (let i = 0; i < this.nodesPerShard; i++) {
      numerator *= this.totalNodes - i;
      denominator *= i + 1;
    }
    return Math.round(numerator / denominator);
  }

  assignTenant(tenantId: string): string[] {
    const hash = createHash('sha256').update(tenantId).digest();
    const candidateIndices: number[] = [];
    for (let i = 0; i < this.totalNodes; i++) {
      candidateIndices.push(i);
    }

    const selected: number[] = [];
    let offset = 0;

    for (let step = 0; step < this.nodesPerShard; step++) {
      const randValue = hash.readUInt16BE(offset % 30);
      offset += 2;
      const indexInCandidates = randValue % candidateIndices.length;
      const chosen = candidateIndices[indexInCandidates];
      if (chosen !== undefined) {
        selected.push(chosen);
      }
      candidateIndices.splice(indexInCandidates, 1);
    }

    selected.sort((a, b) => a - b);
    return selected.map((idx) => `${this.nodePrefix}${idx.toString().padStart(2, '0')}`);
  }

  computeOverlap(tenantA: string, tenantB: string): number {
    const shardA = new Set(this.assignTenant(tenantA));
    const shardB = this.assignTenant(tenantB);
    let common = 0;
    for (const node of shardB) {
      if (shardA.has(node)) common++;
    }
    return common;
  }

  simulatePoisonPill(
    poisonTenantId: string,
    candidateTenants: string[],
  ): {
    crashedNodes: string[];
    fullyDownedTenants: string[];
    degradedTenants: string[];
    unaffectedTenants: string[];
    blastRadiusPercent: number;
  } {
    const crashedNodes = this.assignTenant(poisonTenantId);
    const crashedSet = new Set(crashedNodes);

    const fullyDownedTenants: string[] = [];
    const degradedTenants: string[] = [];
    const unaffectedTenants: string[] = [];

    for (const tenant of candidateTenants) {
      if (tenant === poisonTenantId) continue;
      const shard = this.assignTenant(tenant);
      const deadNodes = shard.filter((node) => crashedSet.has(node)).length;

      if (deadNodes === this.nodesPerShard) {
        fullyDownedTenants.push(tenant);
      } else if (deadNodes > 0) {
        degradedTenants.push(tenant);
      } else {
        unaffectedTenants.push(tenant);
      }
    }

    const otherTenantsCount = candidateTenants.filter((t) => t !== poisonTenantId).length;
    const blastRadiusPercent =
      otherTenantsCount > 0 ? (fullyDownedTenants.length / otherTenantsCount) * 100 : 0;

    return {
      crashedNodes,
      fullyDownedTenants,
      degradedTenants,
      unaffectedTenants,
      blastRadiusPercent,
    };
  }
}
