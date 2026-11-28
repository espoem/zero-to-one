import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type http from 'node:http';
import express, { type NextFunction, type Request, type Response } from 'express';
import * as jose from 'jose';

/**
 * Module 15: Production Express 5 OAuth 2.1 BFF & RFC 8725 Resource API
 * Demonstrates a real Express 5.3.0 Backend-for-Frontend (BFF) authenticating
 * against an in-process OAuth 2.1 + OIDC Core 1.0 Authorization Server using
 * PKCE S256, RFC 9207 `iss` mix-up checks, Refresh Token Rotation (RTR),
 * `__Host-` HttpOnly cookies, Fetch Metadata CSRF defense, and `jose` EdDSA
 * JWT verification with `typ: "at+jwt"`.
 */

const AS_ISSUER = 'https://auth.example.com';
const CLIENT_ID = 'express-bff-client';
const REDIRECT_URI = 'https://app.example.com/auth/callback';
const API_AUDIENCE = 'https://orders-api.example.com';
const SESSION_COOKIE = '__Host-sid';

function computeS256Challenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

function computeAtHash(accessToken: string): string {
  const digest = crypto.createHash('sha256').update(accessToken, 'ascii').digest();
  return digest.subarray(0, 16).toString('base64url');
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) result[key] = decodeURIComponent(val);
  }
  return result;
}

function listenEphemeral(app: express.Express): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Expected TCP address'));
        return;
      }
      resolve({ server, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
    server.on('error', reject);
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

interface AuthCodeRecord {
  sub: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
}

interface RefreshFamily {
  sub: string;
  currentToken: string;
  usedTokens: Set<string>;
  compromised: boolean;
}

class InMemoryAuthServer {
  private privateKey!: CryptoKey;
  public publicKey!: CryptoKey;
  private publicJwk!: jose.JWK;
  private readonly kid = 'as-ed25519-2026-11';
  private readonly codes = new Map<string, AuthCodeRecord>();
  private readonly families = new Map<string, RefreshFamily>();
  private readonly tokenToFamily = new Map<string, string>();

  async init(): Promise<void> {
    const pair = await jose.generateKeyPair('EdDSA', { crv: 'Ed25519' });
    this.privateKey = pair.privateKey;
    this.publicKey = pair.publicKey;
    const exported = await jose.exportJWK(pair.publicKey);
    this.publicJwk = { ...exported, kid: this.kid, use: 'sig', alg: 'EdDSA' };
  }

  getJwks(): { keys: jose.JWK[] } {
    return { keys: [this.publicJwk] };
  }

  authorize(params: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    nonce: string;
    sub?: string;
  }): { code: string; iss: string } {
    if (params.clientId !== CLIENT_ID || params.redirectUri !== REDIRECT_URI) {
      throw new Error('invalid_request');
    }
    if (params.codeChallengeMethod !== 'S256') {
      throw new Error('plain_pkce_forbidden');
    }
    const code = `code_${crypto.randomBytes(24).toString('base64url')}`;
    this.codes.set(code, {
      sub: params.sub ?? 'user-42',
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      nonce: params.nonce,
    });
    return { code, iss: AS_ISSUER };
  }

  async exchangeCode(params: {
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }): Promise<{ accessToken: string; idToken: string; refreshToken: string }> {
    const record = this.codes.get(params.code);
    this.codes.delete(params.code);
    if (!record || record.redirectUri !== params.redirectUri) {
      throw new Error('invalid_grant');
    }

    const computed = computeS256Challenge(params.codeVerifier);
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(record.codeChallenge, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error('invalid_pkce_verifier');
    }

    const familyId = `fam_${crypto.randomUUID()}`;
    const refreshToken = `rt_${crypto.randomBytes(24).toString('base64url')}`;
    this.families.set(familyId, {
      sub: record.sub,
      currentToken: refreshToken,
      usedTokens: new Set(),
      compromised: false,
    });
    this.tokenToFamily.set(refreshToken, familyId);

    const accessToken = await this.mintAccessToken({
      sub: record.sub,
      scope: 'orders:read orders:write',
    });
    const idToken = await this.mintIdToken({
      sub: record.sub,
      nonce: record.nonce,
      accessToken,
    });
    return { accessToken, idToken, refreshToken };
  }

  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const familyId = this.tokenToFamily.get(refreshToken);
    if (!familyId) throw new Error('invalid_grant');
    const family = this.families.get(familyId);
    if (!family) throw new Error('invalid_grant');

    if (family.compromised || family.usedTokens.has(refreshToken)) {
      family.compromised = true;
      throw new Error('refresh_token_reuse_detected');
    }
    if (family.currentToken !== refreshToken) {
      family.compromised = true;
      throw new Error('refresh_token_reuse_detected');
    }

    family.usedTokens.add(refreshToken);
    const nextRt = `rt_${crypto.randomBytes(24).toString('base64url')}`;
    family.currentToken = nextRt;
    this.tokenToFamily.set(nextRt, familyId);

    const accessToken = await this.mintAccessToken({
      sub: family.sub,
      scope: 'orders:read orders:write',
    });
    return { accessToken, refreshToken: nextRt };
  }

  async mintAccessToken(opts: {
    sub: string;
    scope: string;
    aud?: string;
    typ?: string;
    expiresIn?: string;
  }): Promise<string> {
    return await new jose.SignJWT({ scope: opts.scope })
      .setProtectedHeader({ alg: 'EdDSA', typ: opts.typ ?? 'at+jwt', kid: this.kid })
      .setIssuer(AS_ISSUER)
      .setSubject(opts.sub)
      .setAudience(opts.aud ?? API_AUDIENCE)
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime(opts.expiresIn ?? '5m')
      .sign(this.privateKey);
  }

  async mintIdToken(opts: { sub: string; nonce: string; accessToken: string }): Promise<string> {
    return await new jose.SignJWT({
      nonce: opts.nonce,
      at_hash: computeAtHash(opts.accessToken),
      email: 'alice@example.com',
      email_verified: true,
    })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT', kid: this.kid })
      .setIssuer(AS_ISSUER)
      .setSubject(opts.sub)
      .setAudience(CLIENT_ID)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(this.privateKey);
  }
}

interface AuthedRequest extends Request {
  jwtClaims?: jose.JWTPayload;
}

function buildResourceApi(jwksUrl: string): express.Express {
  const app = express();
  app.use(express.json({ limit: '32kb' }));

  const remoteJwks = jose.createRemoteJWKSet(new URL(jwksUrl));

  async function requireAccessToken(
    req: AuthedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const authHeader = req.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'missing_bearer_token' });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();

    try {
      const { payload } = await jose.jwtVerify(token, remoteJwks, {
        algorithms: ['EdDSA'],
        typ: 'at+jwt',
        issuer: AS_ISSUER,
        audience: API_AUDIENCE,
        clockTolerance: 60,
        requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'jti'],
      });
      req.jwtClaims = payload;
      next();
    } catch {
      res.status(401).json({ error: 'invalid_access_token' });
    }
  }

  app.post('/orders', requireAccessToken, (req: AuthedRequest, res: Response) => {
    const scope = String(req.jwtClaims?.['scope'] ?? '').split(' ');
    if (!scope.includes('orders:write')) {
      res.status(403).json({ error: 'insufficient_scope' });
      return;
    }
    res.status(201).json({
      orderId: 'ord-500',
      owner: req.jwtClaims?.sub,
      item: req.body?.item,
    });
  });

  return app;
}

interface BffSession {
  sub: string;
  accessToken: string;
  refreshToken: string;
}

function buildBffApp(
  authServer: InMemoryAuthServer,
  resourceBaseUrl: string,
): { app: express.Express; sessions: Map<string, BffSession> } {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '32kb' }));

  const pendingTx = new Map<string, { nonce: string; verifier: string }>();
  const sessions = new Map<string, BffSession>();
  const localJwks = jose.createLocalJWKSet(authServer.getJwks());

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  function enforceFetchMetadata(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.get('sec-fetch-site') === 'cross-site') {
        res.status(403).json({ error: 'cross_site_csrf_blocked' });
        return;
      }
    }
    next();
  }

  app.get('/auth/login', (_req, res) => {
    const state = crypto.randomBytes(24).toString('base64url');
    const nonce = crypto.randomBytes(24).toString('base64url');
    const verifier = crypto.randomBytes(48).toString('base64url');
    const codeChallenge = computeS256Challenge(verifier);
    pendingTx.set(state, { nonce, verifier });

    res.json({
      state,
      nonce,
      codeChallenge,
      codeChallengeMethod: 'S256',
    });
  });

  // Express 5 forwards rejected async handler promises directly to the error middleware
  app.get('/auth/callback', async (req, res) => {
    const code = String(req.query['code'] ?? '');
    const state = String(req.query['state'] ?? '');
    const iss = String(req.query['iss'] ?? '');

    if (iss !== AS_ISSUER) {
      res.status(400).json({ error: 'issuer_mixup_detected' });
      return;
    }

    const tx = pendingTx.get(state);
    pendingTx.delete(state);
    if (!tx) {
      res.status(400).json({ error: 'invalid_or_replayed_state' });
      return;
    }

    const tokens = await authServer.exchangeCode({
      code,
      redirectUri: REDIRECT_URI,
      codeVerifier: tx.verifier,
    });

    const { payload: idClaims } = await jose.jwtVerify(tokens.idToken, localJwks, {
      algorithms: ['EdDSA'],
      issuer: AS_ISSUER,
      audience: CLIENT_ID,
      clockTolerance: 60,
      requiredClaims: ['iss', 'sub', 'aud', 'exp', 'iat', 'nonce'],
    });

    const nonceBuf = Buffer.from(String(idClaims['nonce'] ?? ''), 'utf8');
    const expectedNonceBuf = Buffer.from(tx.nonce, 'utf8');
    if (
      nonceBuf.length !== expectedNonceBuf.length ||
      !crypto.timingSafeEqual(nonceBuf, expectedNonceBuf)
    ) {
      res.status(401).json({ error: 'invalid_oidc_nonce' });
      return;
    }

    if (idClaims['email_verified'] !== true) {
      res.status(403).json({ error: 'unverified_email_rejected' });
      return;
    }

    const expectedAtHash = computeAtHash(tokens.accessToken);
    if (idClaims['at_hash'] !== expectedAtHash) {
      res.status(401).json({ error: 'invalid_at_hash' });
      return;
    }

    const sid = crypto.randomBytes(32).toString('base64url');
    sessions.set(sid, {
      sub: String(idClaims.sub),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });

    // __Host- requires Secure + Path=/ + no Domain attribute
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600`,
    );
    res.json({ authenticated: true, sub: idClaims.sub });
  });

  app.post('/bff/refresh', enforceFetchMetadata, async (req, res) => {
    const sid = parseCookies(req.get('cookie'))[SESSION_COOKIE];
    const session = sid ? sessions.get(sid) : undefined;
    if (!sid || !session) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    try {
      const rotated = await authServer.rotateRefreshToken(session.refreshToken);
      session.accessToken = rotated.accessToken;
      session.refreshToken = rotated.refreshToken;
      res.json({ refreshed: true });
    } catch {
      sessions.delete(sid);
      res.setHeader(
        'Set-Cookie',
        `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      );
      res.status(401).json({ error: 'session_revoked_on_reuse' });
    }
  });

  app.post('/bff/orders', enforceFetchMetadata, async (req, res) => {
    const sid = parseCookies(req.get('cookie'))[SESSION_COOKIE];
    const session = sid ? sessions.get(sid) : undefined;
    if (!sid || !session) {
      res.status(401).json({ error: 'unauthenticated' });
      return;
    }

    const upstream = await fetch(`${resourceBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(req.body),
    });
    const body = await upstream.json();
    res.status(upstream.status).json(body);
  });

  app.get('/bff/async-boom', async () => {
    throw new Error('simulated_async_failure');
  });

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({ error: 'internal_error', message: err.message });
  });

  return { app, sessions };
}

describe('Module 15: Express 5 OAuth 2.1 BFF & RFC 8725 Resource API', async () => {
  const authServer = new InMemoryAuthServer();
  await authServer.init();

  const jwksApp = express();
  jwksApp.get('/.well-known/jwks.json', (_req, res) => {
    res.json(authServer.getJwks());
  });

  const jwksHost = await listenEphemeral(jwksApp);
  const resourceApi = buildResourceApi(`${jwksHost.baseUrl}/.well-known/jwks.json`);
  const resourceHost = await listenEphemeral(resourceApi);
  const bffBundle = buildBffApp(authServer, resourceHost.baseUrl);
  const bffHost = await listenEphemeral(bffBundle.app);

  after(async () => {
    await closeServer(bffHost.server);
    await closeServer(resourceHost.server);
    await closeServer(jwksHost.server);
  });

  async function loginViaBff(): Promise<{ cookiePair: string; sid: string }> {
    const loginRes = await fetch(`${bffHost.baseUrl}/auth/login`);
    assert.equal(loginRes.status, 200);
    const loginData = (await loginRes.json()) as {
      state: string;
      nonce: string;
      codeChallenge: string;
      codeChallengeMethod: string;
    };

    const authz = authServer.authorize({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      codeChallenge: loginData.codeChallenge,
      codeChallengeMethod: loginData.codeChallengeMethod,
      nonce: loginData.nonce,
      sub: 'alice-42',
    });

    const cbUrl = new URL(`${bffHost.baseUrl}/auth/callback`);
    cbUrl.searchParams.set('code', authz.code);
    cbUrl.searchParams.set('state', loginData.state);
    cbUrl.searchParams.set('iss', authz.iss);

    const cbRes = await fetch(cbUrl);
    assert.equal(cbRes.status, 200);
    const cbJson = (await cbRes.json()) as Record<string, unknown>;
    assert.equal(cbJson['sub'], 'alice-42');
    assert.equal(cbJson['accessToken'], undefined);

    const setCookie = cbRes.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /__Host-sid=[^;]+; HttpOnly; Secure; SameSite=Lax; Path=\//);
    const cookiePair = setCookie.split(';')[0] ?? '';
    const sid = cookiePair.slice(`${SESSION_COOKIE}=`.length);
    return { cookiePair, sid };
  }

  it('completes OAuth 2.1 PKCE + OIDC login via Express 5 BFF and proxies to JWKS-protected API', async () => {
    const { cookiePair } = await loginViaBff();

    const orderRes = await fetch(`${bffHost.baseUrl}/bff/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookiePair,
        'sec-fetch-site': 'same-origin',
      },
      body: JSON.stringify({ item: 'hardware-key' }),
    });
    assert.equal(orderRes.status, 201);
    const orderJson = (await orderRes.json()) as Record<string, unknown>;
    assert.equal(orderJson['owner'], 'alice-42');
    assert.equal(orderJson['item'], 'hardware-key');
  });

  it('blocks RFC 9207 mix-up attacks, cross-site CSRF, and forwards async Express 5 errors', async () => {
    const loginRes = await fetch(`${bffHost.baseUrl}/auth/login`);
    const loginData = (await loginRes.json()) as {
      state: string;
      nonce: string;
      codeChallenge: string;
    };
    const authz = authServer.authorize({
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      codeChallenge: loginData.codeChallenge,
      codeChallengeMethod: 'S256',
      nonce: loginData.nonce,
    });

    const mixupUrl = new URL(`${bffHost.baseUrl}/auth/callback`);
    mixupUrl.searchParams.set('code', authz.code);
    mixupUrl.searchParams.set('state', loginData.state);
    mixupUrl.searchParams.set('iss', 'https://evil-as.example.com');
    const mixupRes = await fetch(mixupUrl);
    assert.equal(mixupRes.status, 400);
    assert.deepEqual(await mixupRes.json(), { error: 'issuer_mixup_detected' });

    const { cookiePair } = await loginViaBff();
    const csrfRes = await fetch(`${bffHost.baseUrl}/bff/orders`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: cookiePair,
        'sec-fetch-site': 'cross-site',
      },
      body: JSON.stringify({ item: 'evil' }),
    });
    assert.equal(csrfRes.status, 403);
    assert.deepEqual(await csrfRes.json(), { error: 'cross_site_csrf_blocked' });

    const asyncErrRes = await fetch(`${bffHost.baseUrl}/bff/async-boom`);
    assert.equal(asyncErrRes.status, 500);
    assert.deepEqual(await asyncErrRes.json(), {
      error: 'internal_error',
      message: 'simulated_async_failure',
    });
  });

  it('rejects alg:none, EdDSA/HS256 confusion, wrong typ (ID token confusion), and wrong aud on the Express 5 Resource API', async () => {
    const algNoneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'at+jwt' })).toString(
      'base64url',
    );
    const algNonePayload = Buffer.from(
      JSON.stringify({
        iss: AS_ISSUER,
        sub: 'attacker',
        aud: API_AUDIENCE,
        exp: 9999999999,
        iat: 1700000000,
        jti: '1',
      }),
    ).toString('base64url');
    const algNone = `${algNoneHeader}.${algNonePayload}.`;

    const r1 = await fetch(`${resourceHost.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${algNone}` },
      body: JSON.stringify({ item: 'x' }),
    });
    assert.equal(r1.status, 401);

    const spkiPem = await jose.exportSPKI(authServer.publicKey);
    const hmacSecret = crypto.createSecretKey(Buffer.from(spkiPem, 'utf8'));
    const confusedToken = await new jose.SignJWT({ scope: 'orders:write' })
      .setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' })
      .setIssuer(AS_ISSUER)
      .setSubject('attacker')
      .setAudience(API_AUDIENCE)
      .setJti('confused-1')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(hmacSecret);

    const rConfused = await fetch(`${resourceHost.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${confusedToken}` },
      body: JSON.stringify({ item: 'x' }),
    });
    assert.equal(rConfused.status, 401);

    const validAt = await authServer.mintAccessToken({ sub: 'alice-42', scope: 'orders:write' });
    const idToken = await authServer.mintIdToken({
      sub: 'alice-42',
      nonce: 'n-1',
      accessToken: validAt,
    });
    const r2 = await fetch(`${resourceHost.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ item: 'x' }),
    });
    assert.equal(r2.status, 401);

    const wrongAudAt = await authServer.mintAccessToken({
      sub: 'alice-42',
      scope: 'orders:write',
      aud: 'https://billing.example.com',
    });
    const r3 = await fetch(`${resourceHost.baseUrl}/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${wrongAudAt}` },
      body: JSON.stringify({ item: 'x' }),
    });
    assert.equal(r3.status, 401);
  });

  it('rotates refresh tokens server-side and revokes the BFF session when reuse is detected', async () => {
    const { cookiePair, sid } = await loginViaBff();
    const firstRt = bffBundle.sessions.get(sid)?.refreshToken;
    assert.ok(firstRt);

    const rotRes = await fetch(`${bffHost.baseUrl}/bff/refresh`, {
      method: 'POST',
      headers: { cookie: cookiePair, 'sec-fetch-site': 'same-origin' },
    });
    assert.equal(rotRes.status, 200);
    assert.notEqual(bffBundle.sessions.get(sid)?.refreshToken, firstRt);

    // Replay of firstRt compromises the family
    await assert.rejects(
      () => authServer.rotateRefreshToken(firstRt),
      /refresh_token_reuse_detected/,
    );

    const postCompromiseRes = await fetch(`${bffHost.baseUrl}/bff/refresh`, {
      method: 'POST',
      headers: { cookie: cookiePair, 'sec-fetch-site': 'same-origin' },
    });
    assert.equal(postCompromiseRes.status, 401);
    assert.equal(bffBundle.sessions.has(sid), false);
  });
});
