import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fc from 'fast-check';
import {
  ACCOUNT_TRANSITIONS,
  ApiConfigError,
  ApiDefensePipeline,
  BoundedMoneyAmount,
  CiSecurityGateEvaluator,
  DEFENSE_STAGE_ORDER,
  DomainInvariantError,
  ENV_POLICIES,
  FieldRedactingAuditLogger,
  MAX_BALANCE_MINOR,
  NaiveControllerRepository,
  PolicyEngine,
  REDACTED,
  REQUIRED_SCANNERS,
  SanitizedQueryFilter,
  TENANT_ISOLATION_FORBID,
  TenantDomainGuard,
  TenantId,
  TenantScopedResourceId,
  VerifiedEmail,
  aclPermit,
  buildStrictCsp,
  encodeForHtml,
  findInjectionKey,
  isSensitiveKey,
  maskSensitiveText,
  ownerPermit,
  rbacPermit,
  redactValue,
  stepUpForbid,
  validateCorsPolicy,
  validatePolicySet,
  validateSessionCookiePolicy,
  type ApiDefenseConfig,
  type ApiRequest,
  type PolicyPrincipal,
  type PolicyResource,
  type ReleaseCandidate,
} from './lib/secure-by-design-models.ts';

function makeValidDefenseConfig(overrides: Partial<ApiDefenseConfig> = {}): ApiDefenseConfig {
  return {
    cors: {
      allowedOrigins: ['https://app.example.com', 'https://admin.example.com'],
      allowCredentials: true,
    },
    sessionCookie: {
      sameSite: 'Lax',
      httpOnly: true,
      secure: true,
    },
    windowMs: 60_000,
    globalLimitPerWindow: 100,
    perClientLimitPerWindow: 10,
    perTenantLimitPerWindow: 20,
    maxBodyBytes: 64 * 1024,
    internalPathPrefix: '/internal/',
    allowedWorkloads: ['spiffe://prod.example.com/ns/payments/sa/checkout'],
    policies: [
      TENANT_ISOLATION_FORBID,
      stepUpForbid('forbid-stale-admin', ['admin', 'delete', 'export'], 300),
      rbacPermit('permit-editor-rw', 'editor', ['read', 'write']),
      rbacPermit('permit-admin-all', 'admin', ['read', 'write', 'delete', 'export', 'admin']),
      aclPermit('permit-auditor-export-doc1', 'doc_1', 'usr_auditor', ['read', 'export']),
      ownerPermit('permit-owner-rw', ['read', 'write']),
    ],
    nonceSource: () => 'nonce-fixed-01',
    ...overrides,
  };
}

function makeHealthyCandidate(overrides: Partial<ReleaseCandidate> = {}): ReleaseCandidate {
  return {
    environment: 'prod',
    nowMs: 1_700_000_000_000,
    scanners: { sast: 'ok', sca: 'ok', secrets: 'ok', iac: 'ok', sbom: 'ok' },
    sast: { critical: 0, high: 0 },
    dependencies: [],
    secretsDetected: 0,
    lockfileIntegrityVerified: true,
    sbom: { present: true, signed: true },
    provenance: { slsaBuildLevel: 3, verified: true },
    iac: [],
    waivers: [],
    ...overrides,
  };
}

describe('Module 26: Secure-by-Design Architecture Executable Proofs', () => {
  describe('1. TenantDomainGuard & DDD Domain Primitives', () => {
    it('blocks cross-tenant BOLA, mass assignment, invalid state transitions, and overflow before persistence', () => {
      const guard = new TenantDomainGuard({ maxDebitMinor: 100_000n });
      guard.seed('t_acme01', 'acct_000001', 50_000n, 'ACTIVE');
      guard.seed('t_globex', 'acct_000002', 90_000n, 'ACTIVE');

      const acmeUser = { subject: 'usr_alice', tenantId: TenantId.parse('t_acme01') };

      // Positive read & debit inside own tenant
      const readOwn = guard.read(acmeUser, 'acct_000001');
      assert.equal(readOwn.ok, true);
      if (readOwn.ok) assert.equal(readOwn.value.balanceMinor, 50_000n);

      const debitOk = guard.debit(acmeUser, 'acct_000001', 10_000n);
      assert.equal(debitOk.ok, true);
      if (debitOk.ok) assert.equal(debitOk.value, 40_000n);
      assert.equal(guard.persistenceLog.length, 1);

      // Negative test (BOLA / IDOR): attempting to read/debit Globex's account without claiming tenant returns NOT_FOUND (no existence oracle)
      const bolaImplicit = guard.read(acmeUser, 'acct_000002');
      assert.deepEqual(bolaImplicit, { ok: false, code: 'NOT_FOUND' });

      // Negative test (Explicit cross-tenant claim): rejected structurally as CROSS_TENANT_ACCESS
      const bolaExplicit = guard.read(acmeUser, 'acct_000002', 't_globex');
      assert.deepEqual(bolaExplicit, { ok: false, code: 'CROSS_TENANT_ACCESS' });

      const bolaDebit = guard.debit(acmeUser, 'acct_000002', 5_000n);
      assert.deepEqual(bolaDebit, { ok: false, code: 'NOT_FOUND' });
      assert.equal(guard.peek('t_globex', 'acct_000002')?.balanceMinor, 90_000n);

      // Negative test (Negative, zero, over-limit, and int64 overflow amounts)
      assert.deepEqual(guard.debit(acmeUser, 'acct_000001', 0n), {
        ok: false,
        code: 'NON_POSITIVE_AMOUNT',
      });
      assert.deepEqual(guard.debit(acmeUser, 'acct_000001', -100n), {
        ok: false,
        code: 'NON_POSITIVE_AMOUNT',
      });
      assert.deepEqual(guard.debit(acmeUser, 'acct_000001', 200_000n), {
        ok: false,
        code: 'AMOUNT_EXCEEDS_LIMIT',
      });
      assert.deepEqual(guard.debit(acmeUser, 'acct_000001', 45_000n), {
        ok: false,
        code: 'INSUFFICIENT_FUNDS',
      });

      guard.seed('t_acme01', 'acct_maxbal', MAX_BALANCE_MINOR - 10n, 'ACTIVE');
      assert.deepEqual(guard.credit(acmeUser, 'acct_maxbal', 50n), {
        ok: false,
        code: 'BALANCE_OVERFLOW',
      });

      // Negative test (Mass Assignment): attempting to inject privileged fields rejects entire command
      const massAssign = guard.patch(acmeUser, 'acct_000001', {
        displayName: 'Payroll',
        balanceMinor: 999_999_999n,
        status: 'ACTIVE',
      });
      assert.deepEqual(massAssign, { ok: false, code: 'MASS_ASSIGNMENT_REJECTED' });
      assert.equal(guard.peek('t_acme01', 'acct_000001')?.displayName, 'acct_000001');

      // Counterexample: NaiveControllerRepository silently allows BOLA + mass assignment
      const naive = new NaiveControllerRepository();
      naive.seed('acct_000002', { tenantId: 't_globex', balanceMinor: 90_000n, role: 'member' });
      naive.updateFromBody('acct_000002', { balanceMinor: 0n, role: 'superadmin' });
      assert.equal(naive.get('acct_000002')?.['role'], 'superadmin');

      // State machine invariants: ACTIVE -> FROZEN blocks debits; CLOSED is terminal
      assert.deepEqual(guard.transition(acmeUser, 'acct_000001', 'FROZEN'), {
        ok: true,
        value: 'FROZEN',
      });
      assert.deepEqual(guard.debit(acmeUser, 'acct_000001', 100n), {
        ok: false,
        code: 'ACCOUNT_NOT_ACTIVE',
      });
      assert.deepEqual(guard.transition(acmeUser, 'acct_000001', 'PENDING'), {
        ok: false,
        code: 'ILLEGAL_STATE_TRANSITION',
      });
      assert.deepEqual(guard.transition(acmeUser, 'acct_000001', 'CLOSED'), {
        ok: true,
        value: 'CLOSED',
      });
      assert.deepEqual(ACCOUNT_TRANSITIONS.CLOSED, []);
      assert.deepEqual(guard.transition(acmeUser, 'acct_000001', 'ACTIVE'), {
        ok: false,
        code: 'ILLEGAL_STATE_TRANSITION',
      });

      // Only the 3 valid mutations (1 debit + 2 state transitions) ever reached persistence
      assert.equal(guard.persistenceLog.length, 3);
    });

    it('enforces domain primitive constructors (VerifiedEmail, BoundedMoneyAmount, TenantScopedResourceId, SanitizedQueryFilter)', () => {
      const okEmail = VerifiedEmail.fromIdentityClaim({
        email: 'Alice@Example.COM',
        emailVerified: true,
      });
      assert.equal(okEmail.value, 'alice@example.com');

      assert.throws(
        () => VerifiedEmail.fromIdentityClaim({ email: 'alice@example.com', emailVerified: false }),
        (err: unknown) => err instanceof DomainInvariantError && err.code === 'EMAIL_NOT_VERIFIED',
      );
      assert.throws(
        () => VerifiedEmail.fromIdentityClaim({ email: 'not-an-email', emailVerified: true }),
        (err: unknown) => err instanceof DomainInvariantError && err.code === 'INVALID_EMAIL',
      );
      assert.throws(
        () => TenantId.parse('invalid-tenant'),
        (err: unknown) => err instanceof DomainInvariantError && err.code === 'INVALID_TENANT_ID',
      );
      assert.throws(
        () => TenantScopedResourceId.bind(TenantId.parse('t_acme01'), '../etc/passwd'),
        (err: unknown) => err instanceof DomainInvariantError && err.code === 'INVALID_RESOURCE_ID',
      );
      assert.throws(
        () => BoundedMoneyAmount.of(-1n, 100n),
        (err: unknown) => err instanceof DomainInvariantError && err.code === 'NON_POSITIVE_AMOUNT',
      );

      const allowed = new Set(['status', 'currency']);
      const filter = SanitizedQueryFilter.parse({ status: 'ACTIVE', currency: 'USD' }, allowed);
      assert.deepEqual(filter.fields, { status: 'ACTIVE', currency: 'USD' });
      assert.throws(
        () => SanitizedQueryFilter.parse({ status: { $ne: 'CLOSED' } }, allowed),
        /NOSQL_OPERATOR_REJECTED/,
      );
      assert.throws(
        () => SanitizedQueryFilter.parse({ tenantId: 't_other' }, allowed),
        /FILTER_FIELD_NOT_ALLOWED/,
      );
    });

    it('property: arbitrary cross-tenant reads and debits never mutate or leak another tenant row', () => {
      fc.assert(
        fc.property(
          fc.bigInt({ min: 1n, max: 1_000_000n }),
          fc.bigInt({ min: -500_000n, max: 2_000_000n }),
          fc.string({ minLength: 1, maxLength: 32 }),
          (victimBalance, attackAmount, arbitraryField) => {
            const guard = new TenantDomainGuard({ maxDebitMinor: 1_000_000n });
            guard.seed('t_victim01', 'acct_victim01', victimBalance, 'ACTIVE');
            const attacker = { subject: 'usr_eve', tenantId: TenantId.parse('t_attack01') };

            const r1 = guard.read(attacker, 'acct_victim01');
            const r2 = guard.debit(attacker, 'acct_victim01', attackAmount);
            const r3 = guard.patch(attacker, 'acct_victim01', { [arbitraryField]: 'pwned' });

            assert.equal(r1.ok, false);
            assert.equal(r2.ok, false);
            assert.equal(r3.ok, false);
            assert.equal(guard.persistenceLog.length, 0);
            assert.equal(guard.peek('t_victim01', 'acct_victim01')?.balanceMinor, victimBalance);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('2. ApiDefensePipeline & PolicyEngine (7-Layer Composition)', () => {
    it('refuses to start on misconfigured CORS (wildcard + credentials, null, pattern, HTTP) or insecure session cookies', () => {
      assert.deepEqual(validateCorsPolicy({ allowedOrigins: ['*'], allowCredentials: true }), [
        'WILDCARD_WITH_CREDENTIALS',
      ]);
      assert.deepEqual(
        validateCorsPolicy({
          allowedOrigins: ['null', 'https://*.example.com', 'http://evil.com'],
          allowCredentials: false,
        }),
        ['NULL_ORIGIN_ALLOWED', 'PATTERN_ORIGIN', 'NON_HTTPS_ORIGIN'],
      );
      assert.deepEqual(
        validateSessionCookiePolicy({ sameSite: 'None', httpOnly: false, secure: false }),
        ['SAMESITE_NONE', 'COOKIE_NOT_HTTPONLY', 'COOKIE_NOT_SECURE'],
      );

      assert.throws(
        () =>
          new ApiDefensePipeline(
            makeValidDefenseConfig({
              cors: { allowedOrigins: ['*'], allowCredentials: true },
            }),
          ),
        (err: unknown) =>
          err instanceof ApiConfigError && err.violations.includes('WILDCARD_WITH_CREDENTIALS'),
      );

      // Boot validation: refusing to start if mandatory cross-tenant forbid policy is missing
      assert.deepEqual(validatePolicySet([rbacPermit('permit-admin', 'admin', ['read'])]), [
        'MISSING_CROSS_TENANT_FORBID',
      ]);
      assert.throws(
        () =>
          new ApiDefensePipeline(
            makeValidDefenseConfig({
              policies: [rbacPermit('permit-editor-rw', 'editor', ['read', 'write'])],
            }),
          ),
        (err: unknown) =>
          err instanceof ApiConfigError && err.violations.includes('MISSING_CROSS_TENANT_FORBID'),
      );
    });

    it('executes layers in edge -> gateway -> service -> data order and enforces CORS, CSRF, NoSQLi, WAF, mTLS, Rate Limits, and XSS headers', () => {
      const pipeline = new ApiDefensePipeline(makeValidDefenseConfig());
      const alice: PolicyPrincipal = {
        subject: 'usr_alice',
        tenantId: 't_acme01',
        roles: ['editor'],
        authAgeSeconds: 60,
      };
      const doc: PolicyResource = {
        id: 'doc_1',
        tenantId: 't_acme01',
        ownerSubject: 'usr_alice',
        classification: 'internal',
      };

      // 1. Happy path through all 9 stages
      const okReq: ApiRequest = {
        method: 'POST',
        path: '/v1/documents/doc_1',
        nowMs: 1_000,
        headers: {
          origin: 'https://app.example.com',
          'sec-fetch-site': 'same-origin',
          'x-csrf-token': 'tok-abc-123',
        },
        bodyBytes: 128,
        body: { title: 'Architecture Review', tags: ['security'] },
        session: { id: 'sess_1', csrfToken: 'tok-abc-123' },
        principal: alice,
        action: 'write',
        resource: doc,
      };
      const okRes = pipeline.handle(okReq);
      assert.equal(okRes.allowed, true);
      assert.equal(okRes.status, 200);
      assert.deepEqual(okRes.trace, [...DEFENSE_STAGE_ORDER]);
      assert.equal(okRes.headers['access-control-allow-origin'], 'https://app.example.com');
      assert.equal(okRes.headers['access-control-allow-credentials'], 'true');
      assert.equal(okRes.headers['vary'], 'Origin');
      assert.equal(okRes.headers['content-security-policy'], buildStrictCsp('nonce-fixed-01'));
      assert.equal(okRes.headers['x-content-type-options'], 'nosniff');

      // 2. WAF blocks path traversal and SQLi signatures before CORS/AuthZ
      const wafRes = pipeline.handle({ ...okReq, path: '/v1/files/%2e%2e/etc/passwd' });
      assert.equal(wafRes.allowed, false);
      assert.equal(wafRes.stage, 'WAF');
      assert.equal(wafRes.status, 403);
      assert.deepEqual(wafRes.trace, ['EDGE_GLOBAL_CAP', 'WAF']);

      // 3. CORS blocks unlisted origin (even subdomain spoofing)
      const corsRes = pipeline.handle({
        ...okReq,
        headers: { ...okReq.headers, origin: 'https://app.example.com.attacker.test' },
      });
      assert.equal(corsRes.allowed, false);
      assert.equal(corsRes.stage, 'CORS');
      assert.equal(corsRes.headers['vary'], 'Origin');
      assert.equal(corsRes.headers['access-control-allow-origin'], undefined);

      // 4. East-west Zero Trust: private RFC 1918 IP alone is rejected without valid SPIFFE workload identity
      const noSpiffe = pipeline.handle({
        ...okReq,
        path: '/internal/ledger/reconcile',
        sourceIp: '10.0.4.22',
        peerSpiffeId: undefined,
      });
      assert.equal(noSpiffe.allowed, false);
      assert.equal(noSpiffe.stage, 'WORKLOAD_IDENTITY');
      assert.equal(noSpiffe.status, 403);

      const goodSpiffe = pipeline.handle({
        ...okReq,
        path: '/internal/ledger/reconcile',
        peerSpiffeId: 'spiffe://prod.example.com/ns/payments/sa/checkout',
      });
      assert.equal(goodSpiffe.allowed, true);

      // SPIFFE-only east-west workload call without a user principal succeeds on /internal/*
      const spiffeOnlyEastWest = pipeline.handle({
        method: 'POST',
        path: '/internal/ledger/reconcile',
        nowMs: 1_000,
        headers: {},
        body: { batchId: 'batch-01' },
        peerSpiffeId: 'spiffe://prod.example.com/ns/payments/sa/checkout',
      });
      assert.equal(spiffeOnlyEastWest.allowed, true);
      assert.equal(spiffeOnlyEastWest.status, 200);

      // 5. CSRF defense: cross-site rejected; same-site BFF POST allowed when Origin + CSRF token match;
      //    cookie session + bearerVerified STILL enforces CSRF; pure Bearer (no session) bypasses CSRF
      const sameSiteBffOk = pipeline.handle({
        ...okReq,
        headers: {
          origin: 'https://app.example.com',
          'sec-fetch-site': 'same-site',
          'x-csrf-token': 'tok-abc-123',
        },
      });
      assert.equal(sameSiteBffOk.allowed, true);
      assert.equal(sameSiteBffOk.status, 200);

      const csrfFetchMeta = pipeline.handle({
        ...okReq,
        headers: { ...okReq.headers, 'sec-fetch-site': 'cross-site' },
      });
      assert.equal(csrfFetchMeta.allowed, false);
      assert.equal(csrfFetchMeta.stage, 'CSRF');
      assert.equal(csrfFetchMeta.reason, 'FETCH_METADATA_CROSS_SITE');

      const csrfBadTok = pipeline.handle({
        ...okReq,
        headers: { ...okReq.headers, 'x-csrf-token': 'wrong-token-different-length' },
      });
      assert.equal(csrfBadTok.allowed, false);
      assert.equal(csrfBadTok.stage, 'CSRF');
      assert.equal(csrfBadTok.reason, 'CSRF_TOKEN_MISMATCH');

      // Ambient cookie session + bearerVerified WITHOUT CSRF token MUST still be rejected
      const cookiePlusBearerNoCsrf = pipeline.handle({
        ...okReq,
        bearerVerified: true,
        headers: { origin: 'https://app.example.com', 'sec-fetch-site': 'same-origin' },
      });
      assert.equal(cookiePlusBearerNoCsrf.allowed, false);
      assert.equal(cookiePlusBearerNoCsrf.stage, 'CSRF');
      assert.equal(cookiePlusBearerNoCsrf.reason, 'CSRF_TOKEN_MISMATCH');

      const bearerOk = pipeline.handle({
        ...okReq,
        session: undefined,
        bearerVerified: true,
        headers: { origin: 'https://app.example.com' },
      });
      assert.equal(bearerOk.allowed, true);

      // 6. NoSQL operator injection ($ne, $where, __proto__) blocked before AUTHZ/DB
      const nosqlRes = pipeline.handle({
        ...okReq,
        body: { filter: { password: { $ne: '' } } },
      });
      assert.equal(nosqlRes.allowed, false);
      assert.equal(nosqlRes.stage, 'INPUT_SANITIZATION');
      assert.equal(nosqlRes.status, 400);
      assert.match(nosqlRes.reason ?? '', /NOSQL_OPERATOR_REJECTED:\$body\.filter\.password\.\$ne/);

      assert.equal(
        findInjectionKey({ nested: [{ $where: 'sleep(5000)' }] }),
        '$body.nested[0].$where',
      );
      assert.equal(
        encodeForHtml('<img src=x onerror="alert(1)">'),
        '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;',
      );
    });

    it('enforces multi-tier rate limits (identity-keyed client quota, tenant quota, global edge cap)', () => {
      const pipeline = new ApiDefensePipeline(
        makeValidDefenseConfig({
          globalLimitPerWindow: 5,
          perClientLimitPerWindow: 2,
          perTenantLimitPerWindow: 3,
        }),
      );
      const resource: PolicyResource = {
        id: 'doc_1',
        tenantId: 't_acme01',
        ownerSubject: 'usr_1',
        classification: 'internal',
      };
      const reqFor = (subject: string, tenantId: string): ApiRequest => ({
        method: 'GET',
        path: '/v1/documents/doc_1',
        nowMs: 10_000,
        headers: {},
        sourceIp: '100.64.0.10', // Shared CGN IP across all users
        principal: { subject, tenantId, roles: ['editor'], authAgeSeconds: 10 },
        action: 'read',
        resource: { ...resource, tenantId },
      });

      // usr_1 hits per-client limit on 3rd call
      assert.equal(pipeline.handle(reqFor('usr_1', 't_acme01')).allowed, true);
      assert.equal(pipeline.handle(reqFor('usr_1', 't_acme01')).allowed, true);
      const client429 = pipeline.handle(reqFor('usr_1', 't_acme01'));
      assert.equal(client429.allowed, false);
      assert.equal(client429.status, 429);
      assert.equal(client429.reason, 'CLIENT_QUOTA');
      assert.ok(Number(client429.headers['retry-after']) > 0);

      // usr_2 behind the SAME CGN IP still succeeds (not punished by IP-keyed rate limiting)
      assert.equal(pipeline.handle(reqFor('usr_2', 't_acme01')).allowed, true);
      // 4th request for t_acme01 (usr_2's 2nd) hits TENANT_QUOTA (3)
      const tenant429 = pipeline.handle(reqFor('usr_2', 't_acme01'));
      assert.equal(tenant429.allowed, false);
      assert.equal(tenant429.status, 429);
      assert.equal(tenant429.reason, 'TENANT_QUOTA');

      // 6th total request hits EDGE_GLOBAL_CAP (5) with 503
      const global503 = pipeline.handle(reqFor('usr_other', 't_other01'));
      assert.equal(global503.allowed, false);
      assert.equal(global503.status, 503);
      assert.equal(global503.stage, 'EDGE_GLOBAL_CAP');
    });

    it('PolicyEngine enforces default-deny and explicit forbid-overrides-permit across RBAC/ABAC/ACL/ReBAC', () => {
      const engine = new PolicyEngine(makeValidDefenseConfig().policies);
      const admin: PolicyPrincipal = {
        subject: 'usr_admin',
        tenantId: 't_acme01',
        roles: ['admin'],
        authAgeSeconds: 120,
      };
      const staleAdmin: PolicyPrincipal = { ...admin, authAgeSeconds: 900 };
      const auditor: PolicyPrincipal = {
        subject: 'usr_auditor',
        tenantId: 't_acme01',
        roles: [],
        authAgeSeconds: 30,
      };
      const stranger: PolicyPrincipal = {
        subject: 'usr_stranger',
        tenantId: 't_acme01',
        roles: [],
        authAgeSeconds: 30,
      };
      const acmeDoc: PolicyResource = {
        id: 'doc_1',
        tenantId: 't_acme01',
        ownerSubject: 'usr_owner',
        classification: 'restricted',
      };
      const otherTenantDoc: PolicyResource = { ...acmeDoc, tenantId: 't_globex' };

      // Fresh admin allowed
      assert.equal(
        engine.evaluate({ principal: admin, action: 'delete', resource: acmeDoc }).decision,
        'ALLOW',
      );
      // Admin across tenant boundary: ABAC forbid overrides RBAC permit
      const crossTenant = engine.evaluate({
        principal: admin,
        action: 'read',
        resource: otherTenantDoc,
      });
      assert.equal(crossTenant.decision, 'DENY');
      assert.equal(crossTenant.reason, 'FORBID_OVERRIDE');
      assert.deepEqual(crossTenant.determiningPolicies, ['forbid-cross-tenant']);

      // Stale auth admin attempting delete: step-up ABAC forbid overrides RBAC permit
      const staleDelete = engine.evaluate({
        principal: staleAdmin,
        action: 'delete',
        resource: acmeDoc,
      });
      assert.equal(staleDelete.decision, 'DENY');
      assert.equal(staleDelete.reason, 'FORBID_OVERRIDE');

      // ACL grants auditor export on doc_1
      assert.equal(
        engine.evaluate({ principal: auditor, action: 'export', resource: acmeDoc }).decision,
        'ALLOW',
      );
      // Stranger with no matching policy hits DEFAULT_DENY
      const denied = engine.evaluate({ principal: stranger, action: 'read', resource: acmeDoc });
      assert.equal(denied.decision, 'DENY');
      assert.equal(denied.reason, 'DEFAULT_DENY');
    });

    it('property: any cross-tenant PolicyEngine query is always denied regardless of roles or ACLs', () => {
      const engine = new PolicyEngine(makeValidDefenseConfig().policies);
      fc.assert(
        fc.property(
          fc.subarray(['admin', 'editor', 'viewer']),
          fc.constantFrom<'read' | 'write' | 'delete' | 'export' | 'admin'>(
            'read',
            'write',
            'delete',
            'export',
            'admin',
          ),
          fc.integer({ min: 0, max: 1000 }),
          (roles, action, authAgeSeconds) => {
            const decision = engine.evaluate({
              principal: { subject: 'usr_owner', tenantId: 't_tenantA', roles, authAgeSeconds },
              action,
              resource: {
                id: 'doc_1',
                tenantId: 't_tenantB',
                ownerSubject: 'usr_owner',
                classification: 'public',
              },
            });
            assert.equal(decision.decision, 'DENY');
            assert.equal(decision.reason, 'FORBID_OVERRIDE');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('3. FieldRedactingAuditLogger', () => {
    it('recursively masks secret keys, nested arrays, circular refs, JWTs, Bearer headers, SSNs, emails, and Luhn PANs without mutating input', () => {
      const logger = new FieldRedactingAuditLogger(() => Date.UTC(2026, 9, 15, 12, 0, 0));
      const payload: Record<string, unknown> = {
        headers: {
          Authorization: 'Bearer sk_live_secret_token_999',
          'X-Api-Key': 'ak_live_header_secret_777',
          'x-api-key': 'ak_live_lower_secret_888',
          'X-Request-Id': 'req-42',
        },
        body: {
          password: 'CorrectHorseBatteryStaple!',
          refresh_token: 'rt_live_123456',
          ssn: '123-45-6789',
          note: 'Contact alice.smith@example.com with SSN 987-65-4321 and card 4111-1111-1111-1111',
          rawTokenInFreeText: 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ1c3JfMSJ9.sig_abc',
          orderId: 'ord-9999999999999', // non-Luhn 13 digits should NOT be false-positive masked
        },
      };
      payload['self'] = payload;

      const entry = logger.log('auth.login', 'bob@example.com', 't_acme01', 'denied', payload);
      assert.equal(entry.ts, '2026-10-15T12:00:00.000Z');
      assert.equal(entry.actor, 'b***@example.com');
      assert.equal(logger.emitted.length, 1);

      const serialized = logger.emitted[0] ?? '';
      assert.doesNotMatch(serialized, /sk_live_secret_token_999/);
      assert.doesNotMatch(serialized, /ak_live_header_secret_777/);
      assert.doesNotMatch(serialized, /ak_live_lower_secret_888/);
      assert.doesNotMatch(serialized, /CorrectHorseBatteryStaple/);
      assert.doesNotMatch(serialized, /rt_live_123456/);
      assert.doesNotMatch(serialized, /123-45-6789/);
      assert.doesNotMatch(serialized, /987-65-4321/);
      assert.doesNotMatch(serialized, /4111-1111-1111-1111/);
      assert.doesNotMatch(serialized, /alice\.smith@example\.com/);
      assert.doesNotMatch(serialized, /eyJhbGciOiJFUzI1NiJ9/);

      assert.match(serialized, /\[REDACTED\]/);
      assert.match(serialized, /\[CARD \*\*\*\*1111\]/);
      assert.match(serialized, /a\*\*\*@example\.com/);
      assert.match(serialized, /\[REDACTED_JWT\]/);
      assert.match(serialized, /\[CIRCULAR\]/);
      assert.match(serialized, /req-42/);
      // Non-Luhn 13-digit orderId must be preserved verbatim (no false-positive PAN masking)
      assert.match(serialized, /ord-9999999999999/);
      assert.equal(isSensitiveKey('X-Api-Key'), true);
      assert.equal(isSensitiveKey('x-api-key'), true);
      assert.equal(isSensitiveKey('X-Request-Id'), false);

      // Original input was never mutated
      assert.equal(
        (payload['body'] as Record<string, unknown>)['password'],
        'CorrectHorseBatteryStaple!',
      );
      assert.equal(maskSensitiveText('Bearer tok_abc'), `Bearer ${REDACTED}`);
    });

    it('property: sensitive key values never appear in serialized output across arbitrary nesting', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Authorization',
            'X-Api-Key',
            'password',
            'refreshToken',
            'api_key',
            'client-secret',
            'ssn',
          ),
          fc.stringMatching(/^[A-Za-z0-9]{12,24}$/),
          (secretKey, secretVal) => {
            const out = JSON.stringify(redactValue({ nested: [{ [secretKey]: secretVal }] }));
            assert.equal(out.includes(secretVal), false);
            assert.equal(out.includes(REDACTED), true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('4. CiSecurityGateEvaluator', () => {
    it('promotes clean prod candidates and fails closed on critical CVEs, KEV, secrets, lockfile/SBOM/SLSA gaps, IaC high, and scanner errors', () => {
      const gate = new CiSecurityGateEvaluator();

      // 1. Clean prod candidate promotes and progressive ENV_POLICIES strictness holds
      assert.equal(ENV_POLICIES.dev.requireAllScanners, false);
      assert.equal(ENV_POLICIES.staging.requireAllScanners, true);
      assert.equal(ENV_POLICIES.staging.minSlsaLevel, 2);
      assert.equal(ENV_POLICIES.prod.requireAllScanners, true);
      assert.equal(ENV_POLICIES.prod.minSlsaLevel, 3);
      const clean = gate.evaluate(makeHealthyCandidate());
      assert.equal(clean.promote, true);
      assert.deepEqual(clean.violations, []);

      // 2. Scanner error, skip, or omitted required scanner fails closed in prod (and secrets fails closed in dev)
      assert.equal(REQUIRED_SCANNERS.length, 5);
      const brokenScanner = gate.evaluate(
        makeHealthyCandidate({
          scanners: { sast: 'error', sca: 'ok', secrets: 'ok', iac: 'ok', sbom: 'ok' },
        }),
      );
      assert.equal(brokenScanner.promote, false);
      assert.ok(brokenScanner.violations.includes('SCANNER_ERROR:sast'));

      const omittedScanner = gate.evaluate(
        makeHealthyCandidate({
          scanners: { sast: 'ok', sca: 'ok', secrets: 'ok', iac: 'ok' }, // sbom omitted
        }),
      );
      assert.equal(omittedScanner.promote, false);
      assert.ok(omittedScanner.violations.includes('SCANNER_SKIPPED:sbom'));

      const omittedSecretsInDev = gate.evaluate(
        makeHealthyCandidate({
          environment: 'dev',
          scanners: { sast: 'ok', sca: 'ok', iac: 'ok', sbom: 'ok' }, // secrets omitted
        }),
      );
      assert.equal(omittedSecretsInDev.promote, false);
      assert.ok(omittedSecretsInDev.violations.includes('SCANNER_SKIPPED:secrets'));

      // 3. Leaked secret blocks even in dev and cannot be waived
      const leakedSecret = gate.evaluate(
        makeHealthyCandidate({
          environment: 'dev',
          secretsDetected: 1,
          waivers: [
            { findingId: 'SECRETS_DETECTED:1', expiresAtMs: 2_000_000_000_000, approvedBy: 'ciso' },
          ],
        }),
      );
      assert.equal(leakedSecret.promote, false);
      assert.ok(leakedSecret.violations.includes('SECRETS_DETECTED:1'));

      // 4. Critical CVE (CVSS >= 9) blocks unless non-KEV active waiver exists; CISA KEV blocks even with waiver
      const cveBlocked = gate.evaluate(
        makeHealthyCandidate({
          dependencies: [{ id: 'CVE-2026-0001', cvss: 9.8, kev: false, epss: 0.72 }],
        }),
      );
      assert.equal(cveBlocked.promote, false);
      assert.ok(cveBlocked.violations.includes('CRITICAL_CVE:CVE-2026-0001'));

      const cveWaived = gate.evaluate(
        makeHealthyCandidate({
          dependencies: [{ id: 'CVE-2026-0001', cvss: 9.1, kev: false, epss: 0.1 }],
          waivers: [
            { findingId: 'CVE-2026-0001', expiresAtMs: 1_700_086_400_000, approvedBy: 'sec-lead' },
          ],
        }),
      );
      assert.equal(cveWaived.promote, true);
      assert.ok(cveWaived.advisories.includes('WAIVED_CRITICAL:CVE-2026-0001'));

      // Expired waiver must fail closed
      const expiredWaiver = gate.evaluate(
        makeHealthyCandidate({
          dependencies: [{ id: 'CVE-2026-0001', cvss: 9.1, kev: false, epss: 0.1 }],
          waivers: [
            { findingId: 'CVE-2026-0001', expiresAtMs: 1_699_999_999_999, approvedBy: 'sec-lead' },
          ],
        }),
      );
      assert.equal(expiredWaiver.promote, false);
      assert.ok(expiredWaiver.violations.includes('CRITICAL_CVE:CVE-2026-0001'));

      // EPSS-only high finding (CVSS < 7, not KEV, but EPSS >= 0.5) blocks prod
      const epssHigh = gate.evaluate(
        makeHealthyCandidate({
          dependencies: [{ id: 'CVE-2026-4242', cvss: 5.5, kev: false, epss: 0.62 }],
        }),
      );
      assert.equal(epssHigh.promote, false);
      assert.ok(epssHigh.violations.includes('HIGH_CVE:CVE-2026-4242'));

      const kevUnwaivable = gate.evaluate(
        makeHealthyCandidate({
          dependencies: [{ id: 'CVE-2026-9999', cvss: 7.5, kev: true, epss: 0.94 }],
          waivers: [
            { findingId: 'CVE-2026-9999', expiresAtMs: 1_700_086_400_000, approvedBy: 'sec-lead' },
          ],
        }),
      );
      assert.equal(kevUnwaivable.promote, false);
      assert.ok(kevUnwaivable.violations.includes('CRITICAL_CVE:CVE-2026-9999'));

      // 5. Unverified lockfile, unsigned SBOM, SLSA < L3, and high IaC all block prod
      const supplyChainFail = gate.evaluate(
        makeHealthyCandidate({
          lockfileIntegrityVerified: false,
          sbom: { present: true, signed: false },
          provenance: { slsaBuildLevel: 2, verified: true },
          iac: [{ rule: 'TF-S3-PUBLIC-READ', severity: 'high' }],
        }),
      );
      assert.equal(supplyChainFail.promote, false);
      assert.deepEqual(supplyChainFail.violations, [
        'LOCKFILE_UNVERIFIED',
        'SBOM_MISSING_OR_UNSIGNED',
        'PROVENANCE_BELOW_SLSA_L3',
        'IAC_HIGH:TF-S3-PUBLIC-READ',
      ]);

      // 6. Layered strictness: high IaC & high SAST are advisory in dev, blocking in prod
      const devAdvisory = gate.evaluate(
        makeHealthyCandidate({
          environment: 'dev',
          sast: { critical: 0, high: 2 },
          iac: [{ rule: 'TF-SG-BROAD-EGRESS', severity: 'high' }],
          sbom: { present: false, signed: false },
          provenance: { slsaBuildLevel: 0, verified: false },
        }),
      );
      assert.equal(devAdvisory.promote, true);
      assert.ok(devAdvisory.advisories.includes('SAST_HIGH:2'));
      assert.ok(devAdvisory.advisories.includes('IAC_HIGH:TF-SG-BROAD-EGRESS'));
    });
  });
});
