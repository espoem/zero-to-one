import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Module 05: Web Sessions, Cookie Security & Browser Defense Architecture
 * Demonstrates __Host- cookie prefix validation, Anti-CSRF token verification,
 * Fetch Metadata defense, and CSP Level 3 nonce generation.
 */

interface CookieOptions {
  name: string;
  value: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
  domain?: string;
}

// RFC 6265bis __Host- cookie serializer & validator
function serializeCookie(opts: CookieOptions): { header: string; valid: boolean; reason?: string } {
  // If name starts with __Host-, enforce RFC 6265bis invariants:
  if (opts.name.startsWith("__Host-")) {
    // 1. Must be Secure
    if (!opts.secure) {
      return { header: "", valid: false, reason: "__Host- prefix requires Secure attribute" };
    }
    // 2. Must omit Domain attribute entirely
    if (opts.domain !== undefined && opts.domain !== "") {
      return { header: "", valid: false, reason: "__Host- prefix forbids Domain attribute" };
    }
    // 3. Path must be exactly '/'
    if (opts.path !== "/") {
      return { header: "", valid: false, reason: "__Host- prefix requires Path=/" };
    }
  }

  let parts = [`${opts.name}=${opts.value}`];
  if (opts.secure) parts.push("Secure");
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.path) parts.push(`Path=${opts.path}`);
  if (opts.domain) parts.push(`Domain=${opts.domain}`);

  return { header: parts.join("; "), valid: true };
}

// Anti-CSRF Synchronizer Token Manager
class CSRFTokenManager {
  private sessions = new Map<string, string>();

  generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString("hex");
    this.sessions.set(sessionId, token);
    return token;
  }

  verifyToken(sessionId: string, submittedToken: string): boolean {
    const expected = this.sessions.get(sessionId);
    if (!expected) return false;
    if (submittedToken.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(submittedToken), Buffer.from(expected));
  }
}

// Fetch Metadata CSRF Guard Middleware
function verifyFetchMetadata(method: string, secFetchSiteHeader?: string): { allow: boolean; reason?: string } {
  // Safe idempotent methods allowed
  if (method === "GET" || method === "HEAD") {
    return { allow: true };
  }

  // State-changing methods (POST, PUT, DELETE)
  if (!secFetchSiteHeader) {
    // Fallback for older browsers
    return { allow: true };
  }

  if (secFetchSiteHeader === "cross-site") {
    return { allow: false, reason: "Blocked state-changing cross-site request" };
  }

  return { allow: true };
}

describe("Module 05: Session, Cookie & Browser Defense Architecture", () => {
  it("enforces strict RFC 6265bis __Host- cookie prefix validation rules", () => {
    // Valid __Host- cookie
    const validHostCookie = serializeCookie({
      name: "__Host-session",
      value: "xyz123",
      secure: true,
      httpOnly: true,
      sameSite: "Strict",
      path: "/"
    });
    assert.equal(validHostCookie.valid, true);
    assert.match(validHostCookie.header, /__Host-session=xyz123; Secure; HttpOnly; SameSite=Strict; Path=\//);

    // INSECURE: __Host- with Domain attribute -> REJECTED
    const invalidDomain = serializeCookie({
      name: "__Host-session",
      value: "xyz123",
      secure: true,
      path: "/",
      domain: "example.com"
    });
    assert.equal(invalidDomain.valid, false);
    assert.match(invalidDomain.reason!, /forbids Domain/);

    // INSECURE: __Host- without Secure flag -> REJECTED
    const insecureHost = serializeCookie({
      name: "__Host-session",
      value: "xyz123",
      secure: false,
      path: "/"
    });
    assert.equal(insecureHost.valid, false);
    assert.match(insecureHost.reason!, /requires Secure/);

    // INSECURE: __Host- with non-root Path -> REJECTED
    const invalidPath = serializeCookie({
      name: "__Host-session",
      value: "xyz123",
      secure: true,
      path: "/app"
    });
    assert.equal(invalidPath.valid, false);
    assert.match(invalidPath.reason!, /requires Path=\//);
  });

  it("verifies Anti-CSRF Synchronizer tokens with constant-time equality", () => {
    const csrfManager = new CSRFTokenManager();
    const token = csrfManager.generateToken("session_abc");

    assert.equal(csrfManager.verifyToken("session_abc", token), true);
    assert.equal(csrfManager.verifyToken("session_abc", "tampered_token_1234"), false);
    assert.equal(csrfManager.verifyToken("session_unknown", token), false);
  });

  it("enforces Fetch Metadata (Sec-Fetch-Site) zero-token CSRF defense", () => {
    // GET requests from cross-site allowed
    assert.equal(verifyFetchMetadata("GET", "cross-site").allow, true);

    // POST request from same-origin allowed
    assert.equal(verifyFetchMetadata("POST", "same-origin").allow, true);

    // POST request from same-site allowed
    assert.equal(verifyFetchMetadata("POST", "same-site").allow, true);

    // POST request from cross-site REJECTED! (Immediate CSRF protection)
    const crossSitePost = verifyFetchMetadata("POST", "cross-site");
    assert.equal(crossSitePost.allow, false);
    assert.match(crossSitePost.reason!, /Blocked state-changing cross-site/);
  });

  it("generates and formats CSP Level 3 Cryptographic Nonce headers", () => {
    const nonce = crypto.randomBytes(16).toString("base64");
    const cspHeader = `script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none';`;

    assert.ok(cspHeader.includes(`'nonce-${nonce}'`));
    assert.ok(cspHeader.includes("'strict-dynamic'"));
    assert.ok(cspHeader.includes("object-src 'none'"));
  });
});
