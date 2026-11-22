import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Executable models for Module 26: Secure-by-Design System Architecture.
 * Covers:
 *  1. `TenantDomainGuard`: DDD domain primitives (`TenantId`, `TenantScopedResourceId`,
 *     `BoundedMoneyAmount`, `VerifiedEmail`) that make cross-tenant BOLA/IDOR access,
 *     mass assignment, negative/overflow amounts, and illegal state transitions unrepresentable
 *     before any write reaches persistence.
 *  2. `ApiDefensePipeline`: an ordered edge -> gateway -> service -> data composition of the
 *     seven API protections (rate limiting, CORS, NoSQL operator stripping, WAF, workload
 *     identity, CSRF, XSS headers) plus a default-deny RBAC/ABAC/ACL `PolicyEngine` in which an
 *     explicit `forbid` overrides any `permit`.
 *  3. `FieldRedactingAuditLogger`: recursive key- and pattern-based masking of secrets and PII
 *     before a structured log line is emitted.
 *  4. `CiSecurityGateEvaluator`: a fail-closed release gate where critical CVEs, leaked secrets,
 *     unverified lockfiles/SBOM/provenance, high-risk IaC findings, or a failed scanner block
 *     promotion.
 * Everything is pure and deterministic: clocks and nonces are injected, and nothing touches the
 * network.
 */

// ---------------------------------------------------------------------------
// 1. Domain primitives and TenantDomainGuard
// ---------------------------------------------------------------------------

export type DomainErrorCode =
  | 'INVALID_TENANT_ID'
  | 'INVALID_RESOURCE_ID'
  | 'CROSS_TENANT_ACCESS'
  | 'NOT_FOUND'
  | 'NON_POSITIVE_AMOUNT'
  | 'AMOUNT_EXCEEDS_LIMIT'
  | 'INSUFFICIENT_FUNDS'
  | 'BALANCE_OVERFLOW'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'INVALID_EMAIL'
  | 'EMAIL_NOT_VERIFIED'
  | 'MASS_ASSIGNMENT_REJECTED'
  | 'ILLEGAL_STATE_TRANSITION';

export class DomainInvariantError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DomainInvariantError';
    this.code = code;
  }
}

export type DomainResult<T> = { ok: true; value: T } | { ok: false; code: DomainErrorCode };

const TENANT_ID_PATTERN = /^t_[a-z0-9]{4,32}$/;
const RESOURCE_ID_PATTERN = /^acct_[a-z0-9]{6,40}$/;
/** Upper bound for a balance, so `bigint` arithmetic cannot exceed a signed 64-bit column. */
export const MAX_BALANCE_MINOR = (1n << 63n) - 1n;

/** A validated tenant identifier. The private constructor means every instance passed `parse`. */
export class TenantId {
  readonly value: string;
  private constructor(value: string) {
    this.value = value;
  }

  static parse(raw: unknown): TenantId {
    if (typeof raw !== 'string' || !TENANT_ID_PATTERN.test(raw)) {
      throw new DomainInvariantError('INVALID_TENANT_ID');
    }
    return new TenantId(raw);
  }

  equals(other: TenantId): boolean {
    return this.value === other.value;
  }
}

/**
 * A resource identifier that cannot exist without the tenant it belongs to. The tenant comes
 * from the authenticated principal, never from the request path or body, so a client cannot
 * name another tenant's row.
 */
export class TenantScopedResourceId {
  readonly tenantId: TenantId;
  readonly resourceId: string;
  private constructor(tenantId: TenantId, resourceId: string) {
    this.tenantId = tenantId;
    this.resourceId = resourceId;
  }

  static bind(tenantId: TenantId, rawResourceId: unknown): TenantScopedResourceId {
    if (typeof rawResourceId !== 'string' || !RESOURCE_ID_PATTERN.test(rawResourceId)) {
      throw new DomainInvariantError('INVALID_RESOURCE_ID');
    }
    return new TenantScopedResourceId(tenantId, rawResourceId);
  }

  /** Composite storage key: tenant is part of the primary key, not a filter you can forget. */
  get storageKey(): string {
    return `${this.tenantId.value}:${this.resourceId}`;
  }
}

/** A strictly positive amount in integer minor units, capped by a per-command business limit. */
export class BoundedMoneyAmount {
  readonly minor: bigint;
  private constructor(minor: bigint) {
    this.minor = minor;
  }

  static of(minor: bigint, maxMinor: bigint): BoundedMoneyAmount {
    if (minor <= 0n) {
      throw new DomainInvariantError('NON_POSITIVE_AMOUNT');
    }
    if (minor > maxMinor) {
      throw new DomainInvariantError('AMOUNT_EXCEEDS_LIMIT');
    }
    return new BoundedMoneyAmount(minor);
  }
}

const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,255}\.[a-z]{2,63}$/i;

/** An e-mail address that can only be built from an identity-provider claim marked verified. */
export class VerifiedEmail {
  readonly value: string;
  private constructor(value: string) {
    this.value = value;
  }

  static fromIdentityClaim(claim: { email: unknown; emailVerified: unknown }): VerifiedEmail {
    if (typeof claim.email !== 'string' || !EMAIL_PATTERN.test(claim.email)) {
      throw new DomainInvariantError('INVALID_EMAIL');
    }
    if (claim.emailVerified !== true) {
      throw new DomainInvariantError('EMAIL_NOT_VERIFIED');
    }
    return new VerifiedEmail(claim.email.toLowerCase());
  }
}

export type AccountStatus = 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CLOSED';

/** Legal transitions of the account lifecycle state machine; anything else is rejected. */
export const ACCOUNT_TRANSITIONS: Readonly<Record<AccountStatus, readonly AccountStatus[]>> = {
  PENDING: ['ACTIVE', 'CLOSED'],
  ACTIVE: ['FROZEN', 'CLOSED'],
  FROZEN: ['ACTIVE', 'CLOSED'],
  CLOSED: [],
};

export type DomainPrincipal = { subject: string; tenantId: TenantId };

type AccountRecord = {
  tenantId: string;
  resourceId: string;
  balanceMinor: bigint;
  status: AccountStatus;
  displayName: string;
};

export type PersistenceWrite = { key: string; field: string; value: string };

/**
 * Aggregate boundary for tenant accounts. Every command binds the resource to the principal's
 * tenant, validates domain primitives, and checks invariants before appending to
 * `persistenceLog`. A rejected command never produces a persistence write.
 */
export class TenantDomainGuard {
  private readonly rows = new Map<string, AccountRecord>();
  readonly persistenceLog: PersistenceWrite[] = [];
  readonly maxDebitMinor: bigint;
  static readonly PATCHABLE_FIELDS: ReadonlySet<string> = new Set(['displayName']);

  constructor(options: { maxDebitMinor: bigint }) {
    this.maxDebitMinor = options.maxDebitMinor;
  }

  seed(
    tenant: string,
    resourceId: string,
    balanceMinor: bigint,
    status: AccountStatus = 'ACTIVE',
  ): void {
    const id = TenantScopedResourceId.bind(TenantId.parse(tenant), resourceId);
    this.rows.set(id.storageKey, {
      tenantId: id.tenantId.value,
      resourceId: id.resourceId,
      balanceMinor,
      status,
      displayName: resourceId,
    });
  }

  /** Test seam: read a row by tenant and id without going through authorization. */
  peek(tenant: string, resourceId: string): Readonly<AccountRecord> | undefined {
    return this.rows.get(`${tenant}:${resourceId}`);
  }

  private resolve(
    principal: DomainPrincipal,
    rawResourceId: unknown,
    claimedTenant?: unknown,
  ): DomainResult<{ id: TenantScopedResourceId; row: AccountRecord }> {
    try {
      if (
        claimedTenant !== undefined &&
        !TenantId.parse(claimedTenant).equals(principal.tenantId)
      ) {
        return { ok: false, code: 'CROSS_TENANT_ACCESS' };
      }
      const id = TenantScopedResourceId.bind(principal.tenantId, rawResourceId);
      const row = this.rows.get(id.storageKey);
      // Another tenant's row is indistinguishable from a missing row: no existence oracle.
      if (!row) {
        return { ok: false, code: 'NOT_FOUND' };
      }
      return { ok: true, value: { id, row } };
    } catch (error) {
      if (error instanceof DomainInvariantError) {
        return { ok: false, code: error.code };
      }
      throw error;
    }
  }

  read(
    principal: DomainPrincipal,
    rawResourceId: unknown,
    claimedTenant?: unknown,
  ): DomainResult<Readonly<AccountRecord>> {
    const resolved = this.resolve(principal, rawResourceId, claimedTenant);
    if (!resolved.ok) return resolved;
    return { ok: true, value: { ...resolved.value.row } };
  }

  debit(principal: DomainPrincipal, rawResourceId: unknown, minor: bigint): DomainResult<bigint> {
    const resolved = this.resolve(principal, rawResourceId);
    if (!resolved.ok) return resolved;
    const { id, row } = resolved.value;
    let amount: BoundedMoneyAmount;
    try {
      amount = BoundedMoneyAmount.of(minor, this.maxDebitMinor);
    } catch (error) {
      if (error instanceof DomainInvariantError) return { ok: false, code: error.code };
      throw error;
    }
    if (row.status !== 'ACTIVE') return { ok: false, code: 'ACCOUNT_NOT_ACTIVE' };
    if (row.balanceMinor < amount.minor) return { ok: false, code: 'INSUFFICIENT_FUNDS' };
    row.balanceMinor -= amount.minor;
    this.persistenceLog.push({
      key: id.storageKey,
      field: 'balanceMinor',
      value: String(row.balanceMinor),
    });
    return { ok: true, value: row.balanceMinor };
  }

  credit(principal: DomainPrincipal, rawResourceId: unknown, minor: bigint): DomainResult<bigint> {
    const resolved = this.resolve(principal, rawResourceId);
    if (!resolved.ok) return resolved;
    const { id, row } = resolved.value;
    let amount: BoundedMoneyAmount;
    try {
      amount = BoundedMoneyAmount.of(minor, this.maxDebitMinor);
    } catch (error) {
      if (error instanceof DomainInvariantError) return { ok: false, code: error.code };
      throw error;
    }
    if (row.status !== 'ACTIVE') return { ok: false, code: 'ACCOUNT_NOT_ACTIVE' };
    if (row.balanceMinor > MAX_BALANCE_MINOR - amount.minor)
      return { ok: false, code: 'BALANCE_OVERFLOW' };
    row.balanceMinor += amount.minor;
    this.persistenceLog.push({
      key: id.storageKey,
      field: 'balanceMinor',
      value: String(row.balanceMinor),
    });
    return { ok: true, value: row.balanceMinor };
  }

  /** Explicit allowlist DTO binding: unknown or privileged fields reject the whole command. */
  patch(
    principal: DomainPrincipal,
    rawResourceId: unknown,
    body: Record<string, unknown>,
  ): DomainResult<string[]> {
    const resolved = this.resolve(principal, rawResourceId);
    if (!resolved.ok) return resolved;
    const keys = Object.keys(body);
    if (keys.some((k) => !TenantDomainGuard.PATCHABLE_FIELDS.has(k))) {
      return { ok: false, code: 'MASS_ASSIGNMENT_REJECTED' };
    }
    const displayName = body['displayName'];
    if (typeof displayName !== 'string' || displayName.length === 0 || displayName.length > 80) {
      return { ok: false, code: 'MASS_ASSIGNMENT_REJECTED' };
    }
    const { id, row } = resolved.value;
    row.displayName = displayName;
    this.persistenceLog.push({ key: id.storageKey, field: 'displayName', value: displayName });
    return { ok: true, value: keys };
  }

  transition(
    principal: DomainPrincipal,
    rawResourceId: unknown,
    to: AccountStatus,
  ): DomainResult<AccountStatus> {
    const resolved = this.resolve(principal, rawResourceId);
    if (!resolved.ok) return resolved;
    const { id, row } = resolved.value;
    if (!ACCOUNT_TRANSITIONS[row.status].includes(to)) {
      return { ok: false, code: 'ILLEGAL_STATE_TRANSITION' };
    }
    row.status = to;
    this.persistenceLog.push({ key: id.storageKey, field: 'status', value: to });
    return { ok: true, value: to };
  }
}

/**
 * Anti-pattern for comparison: a controller-level repository that trusts the id from the URL
 * and binds the whole body onto the row. Used only by negative tests.
 */
export class NaiveControllerRepository {
  private readonly rows = new Map<string, Record<string, unknown>>();

  seed(resourceId: string, row: Record<string, unknown>): void {
    this.rows.set(resourceId, { ...row });
  }

  get(resourceId: string): Record<string, unknown> | undefined {
    return this.rows.get(resourceId);
  }

  updateFromBody(resourceId: string, body: Record<string, unknown>): void {
    const row = this.rows.get(resourceId);
    if (row) Object.assign(row, body);
  }
}

// ---------------------------------------------------------------------------
// 2. ApiDefensePipeline and PolicyEngine
// ---------------------------------------------------------------------------

export type Action = 'read' | 'write' | 'delete' | 'export' | 'admin';

export type PolicyPrincipal = {
  subject: string;
  tenantId: string;
  roles: readonly string[];
  /** Seconds since the last strong (phishing-resistant) authentication. */
  authAgeSeconds: number;
};

export type PolicyResource = {
  id: string;
  tenantId: string;
  ownerSubject: string;
  classification: 'public' | 'internal' | 'restricted';
};

export type PolicyContext = {
  principal: PolicyPrincipal;
  action: Action;
  resource: PolicyResource;
};

export type Policy = {
  id: string;
  kind: 'RBAC' | 'ABAC' | 'ACL' | 'ReBAC';
  effect: 'permit' | 'forbid';
  matches: (ctx: PolicyContext) => boolean;
};

export type PolicyDecision = {
  decision: 'ALLOW' | 'DENY';
  determiningPolicies: string[];
  reason: 'FORBID_OVERRIDE' | 'PERMIT' | 'DEFAULT_DENY';
};

/** Cedar-style evaluation: any matching forbid denies; otherwise any matching permit allows; otherwise deny. */
export class PolicyEngine {
  private readonly policies: readonly Policy[];
  constructor(policies: readonly Policy[]) {
    this.policies = policies;
  }

  evaluate(ctx: PolicyContext): PolicyDecision {
    const forbids = this.policies
      .filter((p) => p.effect === 'forbid' && p.matches(ctx))
      .map((p) => p.id);
    if (forbids.length > 0)
      return { decision: 'DENY', determiningPolicies: forbids, reason: 'FORBID_OVERRIDE' };
    const permits = this.policies
      .filter((p) => p.effect === 'permit' && p.matches(ctx))
      .map((p) => p.id);
    if (permits.length > 0)
      return { decision: 'ALLOW', determiningPolicies: permits, reason: 'PERMIT' };
    return { decision: 'DENY', determiningPolicies: [], reason: 'DEFAULT_DENY' };
  }
}

export function rbacPermit(id: string, role: string, actions: readonly Action[]): Policy {
  return {
    id,
    kind: 'RBAC',
    effect: 'permit',
    matches: (ctx) => ctx.principal.roles.includes(role) && actions.includes(ctx.action),
  };
}

export function aclPermit(
  id: string,
  resourceId: string,
  subject: string,
  actions: readonly Action[],
): Policy {
  return {
    id,
    kind: 'ACL',
    effect: 'permit',
    matches: (ctx) =>
      ctx.resource.id === resourceId &&
      ctx.principal.subject === subject &&
      actions.includes(ctx.action),
  };
}

export function ownerPermit(id: string, actions: readonly Action[]): Policy {
  return {
    id,
    kind: 'ReBAC',
    effect: 'permit',
    matches: (ctx) =>
      ctx.resource.ownerSubject === ctx.principal.subject && actions.includes(ctx.action),
  };
}

/** ABAC guard rails that no role can bypass. */
export const TENANT_ISOLATION_FORBID: Policy = {
  id: 'forbid-cross-tenant',
  kind: 'ABAC',
  effect: 'forbid',
  matches: (ctx) => ctx.principal.tenantId !== ctx.resource.tenantId,
};

export function stepUpForbid(
  id: string,
  actions: readonly Action[],
  maxAuthAgeSeconds: number,
): Policy {
  return {
    id,
    kind: 'ABAC',
    effect: 'forbid',
    matches: (ctx) =>
      actions.includes(ctx.action) && ctx.principal.authAgeSeconds > maxAuthAgeSeconds,
  };
}

export type CorsPolicy = { allowedOrigins: readonly string[]; allowCredentials: boolean };
export type CorsViolation =
  | 'WILDCARD_WITH_CREDENTIALS'
  | 'NULL_ORIGIN_ALLOWED'
  | 'PATTERN_ORIGIN'
  | 'NON_HTTPS_ORIGIN';

/** Boot-time validation: a misconfigured CORS policy must stop the gateway from starting. */
export function validateCorsPolicy(policy: CorsPolicy): CorsViolation[] {
  const violations: CorsViolation[] = [];
  for (const origin of policy.allowedOrigins) {
    if (origin === '*' && policy.allowCredentials) violations.push('WILDCARD_WITH_CREDENTIALS');
    else if (origin === 'null') violations.push('NULL_ORIGIN_ALLOWED');
    else if (origin !== '*' && origin.includes('*')) violations.push('PATTERN_ORIGIN');
    else if (
      origin !== '*' &&
      !origin.startsWith('https://') &&
      !origin.startsWith('http://localhost:')
    ) {
      violations.push('NON_HTTPS_ORIGIN');
    }
  }
  return violations;
}

export type SessionCookiePolicy = {
  sameSite: 'Strict' | 'Lax' | 'None';
  httpOnly: boolean;
  secure: boolean;
};

export function validateSessionCookiePolicy(policy: SessionCookiePolicy): string[] {
  const violations: string[] = [];
  if (policy.sameSite === 'None') violations.push('SAMESITE_NONE');
  if (!policy.httpOnly) violations.push('COOKIE_NOT_HTTPONLY');
  if (!policy.secure) violations.push('COOKIE_NOT_SECURE');
  return violations;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively rejects MongoDB-style operator keys (`$ne`, `$where`, `$gt`), dotted paths, and
 * prototype-pollution keys. Returns the offending key path, or `undefined` when the value is clean.
 */
export function findInjectionKey(value: unknown, path = '$body', depth = 0): string | undefined {
  if (depth > 32) return `${path}(depth)`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findInjectionKey(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return undefined;
  }
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.') || FORBIDDEN_KEYS.has(key))
        return `${path}.${key}`;
      const hit = findInjectionKey(
        (value as Record<string, unknown>)[key],
        `${path}.${key}`,
        depth + 1,
      );
      if (hit) return hit;
    }
  }
  return undefined;
}

/** A filter object that has passed `findInjectionKey` and an allowlist of scalar fields. */
export class SanitizedQueryFilter {
  readonly fields: Readonly<Record<string, string | number | boolean>>;
  private constructor(fields: Record<string, string | number | boolean>) {
    this.fields = fields;
  }

  static parse(raw: unknown, allowedFields: ReadonlySet<string>): SanitizedQueryFilter {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('FILTER_NOT_OBJECT');
    if (findInjectionKey(raw)) throw new Error('NOSQL_OPERATOR_REJECTED');
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!allowedFields.has(key)) throw new Error('FILTER_FIELD_NOT_ALLOWED');
      if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
        throw new Error('FILTER_VALUE_NOT_SCALAR');
      }
      out[key] = value;
    }
    return new SanitizedQueryFilter(out);
  }
}

/** Context-aware HTML text/attribute encoding (OWASP rule #1/#2 equivalent). */
export function encodeForHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

export function buildStrictCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "require-trusted-types-for 'script'",
  ].join('; ');
}

export type DefenseStage =
  | 'EDGE_GLOBAL_CAP'
  | 'WAF'
  | 'CORS'
  | 'GATEWAY_RATE_LIMIT'
  | 'WORKLOAD_IDENTITY'
  | 'CSRF'
  | 'INPUT_SANITIZATION'
  | 'AUTHZ'
  | 'RESPONSE_HEADERS';

export const DEFENSE_STAGE_ORDER: readonly DefenseStage[] = [
  'EDGE_GLOBAL_CAP',
  'WAF',
  'CORS',
  'GATEWAY_RATE_LIMIT',
  'WORKLOAD_IDENTITY',
  'CSRF',
  'INPUT_SANITIZATION',
  'AUTHZ',
  'RESPONSE_HEADERS',
];

export type ApiRequest = {
  method: 'GET' | 'HEAD' | 'OPTIONS' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  nowMs: number;
  /** Lower-cased header names. */
  headers: Readonly<Record<string, string | undefined>>;
  bodyBytes?: number;
  body?: unknown;
  /** Present when the browser sent the session cookie. */
  session?: { id: string; csrfToken: string };
  /** Present when a bearer token was verified upstream (no ambient browser credential). */
  bearerVerified?: boolean;
  /** SPIFFE ID from the verified mTLS peer certificate, for east-west calls. */
  peerSpiffeId?: string;
  /** Network source; deliberately ignored for trust decisions. */
  sourceIp?: string;
  principal?: PolicyPrincipal;
  action?: Action;
  resource?: PolicyResource;
};

export type ApiDecision = {
  allowed: boolean;
  status: number;
  stage?: DefenseStage;
  reason?: string;
  headers: Record<string, string>;
  trace: DefenseStage[];
};

export type ApiDefenseConfig = {
  cors: CorsPolicy;
  sessionCookie: SessionCookiePolicy;
  windowMs: number;
  globalLimitPerWindow: number;
  perClientLimitPerWindow: number;
  perTenantLimitPerWindow: number;
  maxBodyBytes: number;
  internalPathPrefix: string;
  allowedWorkloads: readonly string[];
  policies: readonly Policy[];
  nonceSource: () => string;
};

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const WAF_SIGNATURES: readonly RegExp[] = [
  /\.\.[/\\]/,
  /%2e%2e/i,
  /<script/i,
  /\bunion\s+select\b/i,
];

export class ApiConfigError extends Error {
  readonly violations: readonly string[];
  constructor(violations: readonly string[]) {
    super(`Refusing to start: ${violations.join(', ')}`);
    this.name = 'ApiConfigError';
    this.violations = violations;
  }
}

export function validatePolicySet(policies: readonly Policy[]): string[] {
  const crossTenantProbe: PolicyContext = {
    principal: {
      subject: '__boot_probe__',
      tenantId: '__probe_tenant_a__',
      roles: ['admin'],
      authAgeSeconds: 0,
    },
    action: 'read',
    resource: {
      id: '__probe_res__',
      tenantId: '__probe_tenant_b__',
      ownerSubject: '__boot_probe__',
      classification: 'public',
    },
  };
  const hasCrossTenantForbid = policies.some(
    (p) => p.effect === 'forbid' && p.matches(crossTenantProbe),
  );
  return hasCrossTenantForbid ? [] : ['MISSING_CROSS_TENANT_FORBID'];
}

function constantTimeTokenEqual(presented: string, expected: string): boolean {
  if (expected.length === 0) return false;
  const presentedDigest = createHash('sha256').update(presented).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(presentedDigest, expectedDigest);
}

/**
 * Deterministic simulator of the layered API defense. Stages run in `DEFENSE_STAGE_ORDER`, and
 * the first failing stage short-circuits, so cheap volumetric checks run before expensive
 * policy evaluation and nothing reaches the data tier unless every earlier layer passed.
 */
export class ApiDefensePipeline {
  private readonly config: ApiDefenseConfig;
  private readonly policyEngine: PolicyEngine;
  private readonly counters = new Map<string, number>();

  constructor(config: ApiDefenseConfig) {
    const violations = [
      ...validateCorsPolicy(config.cors),
      ...validateSessionCookiePolicy(config.sessionCookie),
      ...validatePolicySet(config.policies),
    ];
    if (violations.length > 0) throw new ApiConfigError(violations);
    this.config = config;
    this.policyEngine = new PolicyEngine(config.policies);
  }

  private bump(key: string, nowMs: number): number {
    const window = Math.floor(nowMs / this.config.windowMs);
    const fullKey = `${window}:${key}`;
    const next = (this.counters.get(fullKey) ?? 0) + 1;
    this.counters.set(fullKey, next);
    return next;
  }

  private static deny(
    trace: DefenseStage[],
    stage: DefenseStage,
    status: number,
    reason: string,
    headers: Record<string, string> = {},
  ): ApiDecision {
    return { allowed: false, status, stage, reason, headers, trace };
  }

  handle(req: ApiRequest): ApiDecision {
    const trace: DefenseStage[] = [];
    const headers: Record<string, string> = {};
    const retryAfter = String(
      Math.ceil((this.config.windowMs - (req.nowMs % this.config.windowMs)) / 1000),
    );

    // Layer 1a (edge): global volumetric cap protects the origin from DDoS regardless of identity.
    trace.push('EDGE_GLOBAL_CAP');
    if (this.bump('global', req.nowMs) > this.config.globalLimitPerWindow) {
      return ApiDefensePipeline.deny(trace, 'EDGE_GLOBAL_CAP', 503, 'GLOBAL_CAPACITY_SHED', {
        'retry-after': retryAfter,
      });
    }

    // Layer 4 (edge): WAF / L7 filtering of known-bad shapes and oversized bodies.
    trace.push('WAF');
    if ((req.bodyBytes ?? 0) > this.config.maxBodyBytes) {
      return ApiDefensePipeline.deny(trace, 'WAF', 413, 'BODY_TOO_LARGE');
    }
    let decodedPath = req.path;
    try {
      decodedPath = decodeURIComponent(req.path);
    } catch {
      return ApiDefensePipeline.deny(trace, 'WAF', 400, 'MALFORMED_PATH');
    }
    if (WAF_SIGNATURES.some((sig) => sig.test(req.path) || sig.test(decodedPath))) {
      return ApiDefensePipeline.deny(trace, 'WAF', 403, 'WAF_SIGNATURE');
    }

    // Layer 2 (gateway): CORS with exact-match allowlist; reflects only allowlisted origins.
    trace.push('CORS');
    const origin = req.headers['origin'];
    if (origin !== undefined) {
      headers['vary'] = 'Origin';
      if (!this.config.cors.allowedOrigins.includes(origin)) {
        return ApiDefensePipeline.deny(trace, 'CORS', 403, 'ORIGIN_NOT_ALLOWED', headers);
      }
      headers['access-control-allow-origin'] = origin;
      if (this.config.cors.allowCredentials) headers['access-control-allow-credentials'] = 'true';
    }
    if (req.method === 'OPTIONS') {
      return { allowed: true, status: 204, headers, trace };
    }

    // Layer 1b (gateway): identity-keyed per-client and per-tenant quotas (never keyed on IP alone).
    trace.push('GATEWAY_RATE_LIMIT');
    const clientKey =
      req.principal?.subject ?? req.peerSpiffeId ?? `anon:${req.sourceIp ?? 'unknown'}`;
    if (this.bump(`client:${clientKey}`, req.nowMs) > this.config.perClientLimitPerWindow) {
      return ApiDefensePipeline.deny(trace, 'GATEWAY_RATE_LIMIT', 429, 'CLIENT_QUOTA', {
        ...headers,
        'retry-after': retryAfter,
      });
    }
    if (
      req.principal &&
      this.bump(`tenant:${req.principal.tenantId}`, req.nowMs) > this.config.perTenantLimitPerWindow
    ) {
      return ApiDefensePipeline.deny(trace, 'GATEWAY_RATE_LIMIT', 429, 'TENANT_QUOTA', {
        ...headers,
        'retry-after': retryAfter,
      });
    }

    // Layer 5 (service mesh): internal routes need a verified workload identity, not a private IP.
    trace.push('WORKLOAD_IDENTITY');
    if (req.path.startsWith(this.config.internalPathPrefix)) {
      if (!req.peerSpiffeId || !this.config.allowedWorkloads.includes(req.peerSpiffeId)) {
        return ApiDefensePipeline.deny(
          trace,
          'WORKLOAD_IDENTITY',
          403,
          'WORKLOAD_NOT_AUTHORIZED',
          headers,
        );
      }
    }

    // Layer 6 (service): whenever an ambient cookie session is present on an unsafe method,
    // ALWAYS enforce CSRF regardless of bearerVerified. Deny `cross-site`; allow `same-origin`,
    // `same-site` (e.g. app.example.com -> api.example.com), and `none`, then require a valid token.
    trace.push('CSRF');
    if (UNSAFE_METHODS.has(req.method) && req.session) {
      const site = req.headers['sec-fetch-site'];
      if (site === 'cross-site') {
        return ApiDefensePipeline.deny(trace, 'CSRF', 403, 'FETCH_METADATA_CROSS_SITE', headers);
      }
      const presented = req.headers['x-csrf-token'] ?? '';
      if (!constantTimeTokenEqual(presented, req.session.csrfToken)) {
        return ApiDefensePipeline.deny(trace, 'CSRF', 403, 'CSRF_TOKEN_MISMATCH', headers);
      }
    }

    // Layer 3 (service -> data): reject operator injection before a query is ever built.
    trace.push('INPUT_SANITIZATION');
    const injected = findInjectionKey(req.body);
    if (injected) {
      return ApiDefensePipeline.deny(
        trace,
        'INPUT_SANITIZATION',
        400,
        `NOSQL_OPERATOR_REJECTED:${injected}`,
        headers,
      );
    }

    // Authorization at the resource, default deny, forbid overrides permit.
    trace.push('AUTHZ');
    if (!req.principal || !req.action || !req.resource) {
      if (!req.path.startsWith(this.config.internalPathPrefix)) {
        return ApiDefensePipeline.deny(trace, 'AUTHZ', 401, 'UNAUTHENTICATED', headers);
      }
    } else {
      const decision = this.policyEngine.evaluate({
        principal: req.principal,
        action: req.action,
        resource: req.resource,
      });
      if (decision.decision === 'DENY') {
        return ApiDefensePipeline.deny(trace, 'AUTHZ', 403, decision.reason, headers);
      }
    }

    // Layer 7 (response): XSS hardening headers for anything a browser may render.
    trace.push('RESPONSE_HEADERS');
    headers['content-security-policy'] = buildStrictCsp(this.config.nonceSource());
    headers['x-content-type-options'] = 'nosniff';
    return { allowed: true, status: 200, headers, trace };
  }
}

// ---------------------------------------------------------------------------
// 3. FieldRedactingAuditLogger
// ---------------------------------------------------------------------------

export const REDACTED = '[REDACTED]';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'password',
  'passwd',
  'passphrase',
  'secret',
  'clientsecret',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'apikey',
  'privatekey',
  'ssn',
  'nationalid',
  'cvv',
  'cvc',
  'pan',
  'cardnumber',
  'otp',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll(/[-_\s]/g, '');
}

export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(normalizeKey(lower))) return true;
  if (/^x[-_\s]/.test(lower)) {
    return SENSITIVE_KEYS.has(normalizeKey(lower.replace(/^x[-_\s]/, '')));
  }
  return false;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

const JWT_PATTERN = /\beyJ[\w-]{4,}\.[\w-]{4,}\.[\w-]*/g;
const BEARER_PATTERN = /\b(Bearer|Basic)\s+[\w\-.~+/=]+/gi;
const EMAIL_IN_TEXT = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
const CARD_CANDIDATE = /\b(?:\d[ -]?){12,18}\d\b/g;

/** Pattern-based masking for free-text values whose key did not identify them as sensitive. */
export function maskSensitiveText(input: string): string {
  return input
    .replaceAll(JWT_PATTERN, '[REDACTED_JWT]')
    .replaceAll(BEARER_PATTERN, (_m, scheme: string) => `${scheme} ${REDACTED}`)
    .replaceAll(SSN_PATTERN, '***-**-****')
    .replaceAll(CARD_CANDIDATE, (match) => {
      const digits = match.replaceAll(/[ -]/g, '');
      if (digits.length < 13 || digits.length > 19 || !luhnValid(digits)) return match;
      return `[CARD ****${digits.slice(-4)}]`;
    })
    .replaceAll(EMAIL_IN_TEXT, (_m, first: string, domain: string) => `${first}***@${domain}`);
}

/** Returns a redacted deep copy; the input object is never mutated. */
export function redactValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  if (depth > 16) return '[TRUNCATED]';
  if (typeof value === 'string') return maskSensitiveText(value);
  if (typeof value === 'bigint') return value.toString();
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => redactValue(v, seen, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redactValue(inner, seen, depth + 1);
  }
  return out;
}

export type AuditEvent = {
  ts: string;
  event: string;
  actor: string;
  tenant: string;
  outcome: 'success' | 'denied' | 'error';
  fields: unknown;
};

/** Structured logger whose only output path runs through `redactValue`. */
export class FieldRedactingAuditLogger {
  readonly emitted: string[] = [];
  private readonly clock: () => number;
  constructor(clock: () => number) {
    this.clock = clock;
  }

  log(
    event: string,
    actor: string,
    tenant: string,
    outcome: AuditEvent['outcome'],
    fields: unknown,
  ): AuditEvent {
    const entry: AuditEvent = {
      ts: new Date(this.clock()).toISOString(),
      event,
      actor: maskSensitiveText(actor),
      tenant,
      outcome,
      fields: redactValue(fields),
    };
    this.emitted.push(JSON.stringify(entry));
    return entry;
  }
}

// ---------------------------------------------------------------------------
// 4. CiSecurityGateEvaluator
// ---------------------------------------------------------------------------

export type Environment = 'dev' | 'staging' | 'prod';
export type ScannerName = 'sast' | 'sca' | 'secrets' | 'iac' | 'sbom';
export type ScannerStatus = 'ok' | 'error' | 'skipped';

export const REQUIRED_SCANNERS: readonly ScannerName[] = ['sast', 'sca', 'secrets', 'iac', 'sbom'];

export type DependencyFinding = {
  id: string;
  cvss: number;
  /** Listed in CISA Known Exploited Vulnerabilities. */
  kev: boolean;
  epss: number;
};

export type IacFinding = { rule: string; severity: 'low' | 'medium' | 'high' | 'critical' };

export type Waiver = { findingId: string; expiresAtMs: number; approvedBy: string };

export type ReleaseCandidate = {
  environment: Environment;
  nowMs: number;
  scanners: Readonly<Partial<Record<ScannerName, ScannerStatus>>>;
  sast: { critical: number; high: number };
  dependencies: readonly DependencyFinding[];
  secretsDetected: number;
  lockfileIntegrityVerified: boolean;
  sbom: { present: boolean; signed: boolean };
  provenance: { slsaBuildLevel: 0 | 1 | 2 | 3; verified: boolean };
  iac: readonly IacFinding[];
  waivers: readonly Waiver[];
};

export type GateResult = { promote: boolean; violations: string[]; advisories: string[] };

type EnvPolicy = {
  requireAllScanners: boolean;
  blockSastHigh: boolean;
  blockDependencyHigh: boolean;
  requireLockfile: boolean;
  requireSignedSbom: boolean;
  minSlsaLevel: 0 | 1 | 2 | 3;
  blockIacHigh: boolean;
};

export const ENV_POLICIES: Readonly<Record<Environment, EnvPolicy>> = {
  dev: {
    requireAllScanners: false,
    blockSastHigh: false,
    blockDependencyHigh: false,
    requireLockfile: true,
    requireSignedSbom: false,
    minSlsaLevel: 0,
    blockIacHigh: false,
  },
  staging: {
    requireAllScanners: true,
    blockSastHigh: false,
    blockDependencyHigh: false,
    requireLockfile: true,
    requireSignedSbom: true,
    minSlsaLevel: 2,
    blockIacHigh: true,
  },
  prod: {
    requireAllScanners: true,
    blockSastHigh: true,
    blockDependencyHigh: true,
    requireLockfile: true,
    requireSignedSbom: true,
    minSlsaLevel: 3,
    blockIacHigh: true,
  },
};

/**
 * Release gate. Strictness increases dev -> staging -> prod: secret scanning fails closed in all
 * environments, while all five required scanners fail closed in staging and prod (an omitted,
 * errored, or skipped scanner never silently passes as "no findings").
 */
export class CiSecurityGateEvaluator {
  evaluate(c: ReleaseCandidate): GateResult {
    const policy = ENV_POLICIES[c.environment];
    const violations: string[] = [];
    const advisories: string[] = [];
    const waived = (id: string): boolean =>
      c.waivers.some(
        (w) => w.findingId === id && w.expiresAtMs > c.nowMs && w.approvedBy.length > 0,
      );

    for (const name of REQUIRED_SCANNERS) {
      const status: ScannerStatus = c.scanners[name] ?? 'skipped';
      if (status !== 'ok') {
        if (policy.requireAllScanners || name === 'secrets')
          violations.push(`SCANNER_${status.toUpperCase()}:${name}`);
        else advisories.push(`SCANNER_${status.toUpperCase()}:${name}`);
      }
    }
    // Leaked secrets block everywhere and can never be waived: the fix is rotation, not an exception.
    if (c.secretsDetected > 0) violations.push(`SECRETS_DETECTED:${c.secretsDetected}`);

    if (c.sast.critical > 0) violations.push(`SAST_CRITICAL:${c.sast.critical}`);
    if (c.sast.high > 0)
      (policy.blockSastHigh ? violations : advisories).push(`SAST_HIGH:${c.sast.high}`);

    for (const f of c.dependencies) {
      const critical = f.cvss >= 9 || f.kev;
      const high = !critical && (f.cvss >= 7 || f.epss >= 0.5);
      if (critical) {
        if (waived(f.id) && !f.kev) advisories.push(`WAIVED_CRITICAL:${f.id}`);
        else violations.push(`CRITICAL_CVE:${f.id}`);
      } else if (high) {
        if (policy.blockDependencyHigh && !waived(f.id)) violations.push(`HIGH_CVE:${f.id}`);
        else advisories.push(`HIGH_CVE:${f.id}`);
      }
    }

    if (policy.requireLockfile && !c.lockfileIntegrityVerified)
      violations.push('LOCKFILE_UNVERIFIED');
    if (policy.requireSignedSbom && !(c.sbom.present && c.sbom.signed))
      violations.push('SBOM_MISSING_OR_UNSIGNED');
    if (
      policy.minSlsaLevel > 0 &&
      (!c.provenance.verified || c.provenance.slsaBuildLevel < policy.minSlsaLevel)
    ) {
      violations.push(`PROVENANCE_BELOW_SLSA_L${policy.minSlsaLevel}`);
    }

    for (const f of c.iac) {
      if (f.severity === 'critical') violations.push(`IAC_CRITICAL:${f.rule}`);
      else if (f.severity === 'high')
        (policy.blockIacHigh ? violations : advisories).push(`IAC_HIGH:${f.rule}`);
    }

    return { promote: violations.length === 0, violations, advisories };
  }
}
