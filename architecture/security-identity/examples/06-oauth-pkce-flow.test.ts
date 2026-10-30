import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Module 06: OAuth 2.1 Core Protocol & The RFC 9700 Security BCP
 * Demonstrates RFC 7636 PKCE S256 challenge generation and verification,
 * exact redirect-URI string matching, and Refresh Token Rotation (RTR) family revocation.
 */

// Helper: Base64URL encode without padding
function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

// Generate high-entropy code_verifier (RFC 7636 §4.1)
function generateCodeVerifier(): string {
  return crypto.randomBytes(64).toString("base64url"); // 86 chars, within 43-128 char limit
}

// Derive S256 code_challenge (RFC 7636 §4.2)
function deriveCodeChallenge(verifier: string, method: "S256" | "plain"): string {
  if (method === "plain") {
    // Plain is explicitly forbidden in OAuth 2.1!
    throw new Error("OAuth 2.1 forbids code_challenge_method=plain");
  }
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64UrlEncode(hash);
}

// Validates code_verifier against stored challenge
function verifyCodeChallenge(verifier: string, storedChallenge: string): boolean {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  const computedChallenge = base64UrlEncode(hash);
  return crypto.timingSafeEqual(Buffer.from(computedChallenge), Buffer.from(storedChallenge));
}

// OAuth 2.1 Exact Redirect URI Matcher (RFC 9700 §4.1)
function validateRedirectURI(requestedURI: string, registeredURI: string): boolean {
  // OAuth 2.1 strictly mandates exact, byte-for-byte string equality
  // Wildcards (*), subdomains, and partial string prefixes are strictly forbidden!
  return requestedURI === registeredURI;
}

// Refresh Token Family Tree Manager (RFC 9700 §4.14)
class RefreshTokenManager {
  // FamilyId -> { currentActiveToken, invalidatedTokens: Set, isFamilyCompromised }
  private families = new Map<string, { currentToken: string; invalidatedTokens: Set<string>; compromised: boolean }>();

  createFamily(initialToken: string): string {
    const familyId = crypto.randomUUID();
    this.families.set(familyId, {
      currentToken: initialToken,
      invalidatedTokens: new Set<string>(),
      compromised: false
    });
    return familyId;
  }

  rotateToken(familyId: string, submittedToken: string, newToken: string): { success: boolean; error?: string } {
    const fam = this.families.get(familyId);
    if (!fam) return { success: false, error: "invalid_grant" };

    if (fam.compromised) {
      return { success: false, error: "family_compromised" };
    }

    // Check if token was previously invalidated -> REUSE DETECTED!
    if (fam.invalidatedTokens.has(submittedToken)) {
      fam.compromised = true; // Invalidate entire token family!
      return { success: false, error: "token_reuse_detected_family_revoked" };
    }

    // Verify submitted token is currently active token
    if (fam.currentToken !== submittedToken) {
      fam.compromised = true;
      return { success: false, error: "unknown_token_family_revoked" };
    }

    // Valid rotation: Retire current token, install new token
    fam.invalidatedTokens.add(submittedToken);
    fam.currentToken = newToken;
    return { success: true };
  }

  isFamilyActive(familyId: string): boolean {
    const fam = this.families.get(familyId);
    return fam ? !fam.compromised : false;
  }
}

describe("Module 06: OAuth 2.1 & PKCE S256 Hardening", () => {
  it("generates valid PKCE S256 code_verifier and code_challenge pair", () => {
    const verifier = generateCodeVerifier();
    assert.ok(verifier.length >= 43 && verifier.length <= 128);

    const challenge = deriveCodeChallenge(verifier, "S256");
    assert.ok(challenge.length >= 43);

    // Verifier correctly validates against challenge
    assert.equal(verifyCodeChallenge(verifier, challenge), true);

    // Tampered verifier fails validation
    assert.equal(verifyCodeChallenge("wrong_verifier_string_12345", challenge), false);
  });

  it("strictly forbids code_challenge_method=plain under OAuth 2.1 rules", () => {
    const verifier = generateCodeVerifier();
    assert.throws(() => deriveCodeChallenge(verifier, "plain"), /forbids code_challenge_method=plain/);
  });

  it("enforces exact byte-for-byte Redirect-URI string comparison", () => {
    const registered = "https://app.example.com/oauth/callback";

    // Exact match passes
    assert.equal(validateRedirectURI("https://app.example.com/oauth/callback", registered), true);

    // Path traversal / prefix extensions REJECTED
    assert.equal(validateRedirectURI("https://app.example.com/oauth/callback/open-redirect", registered), false);

    // Subdomain variations REJECTED
    assert.equal(validateRedirectURI("https://attacker.app.example.com/oauth/callback", registered), false);

    // Case differences REJECTED (RFC 9700 strictly mandates exact comparison)
    assert.equal(validateRedirectURI("https://app.example.com/OAuth/Callback", registered), false);
  });

  it("demonstrates Refresh Token Rotation (RTR) and automated family revocation upon reuse", () => {
    const rtr = new RefreshTokenManager();
    const token1 = "rt_token_1";
    const token2 = "rt_token_2";
    const token3 = "rt_token_3";

    const familyId = rtr.createFamily(token1);
    assert.equal(rtr.isFamilyActive(familyId), true);

    // Legitimate rotation: Token 1 -> Token 2
    const rotate1 = rtr.rotateToken(familyId, token1, token2);
    assert.equal(rotate1.success, true);
    assert.equal(rtr.isFamilyActive(familyId), true);

    // Legitimate rotation: Token 2 -> Token 3
    const rotate2 = rtr.rotateToken(familyId, token2, token3);
    assert.equal(rotate2.success, true);

    // ATTACK: An adversary attempts to redeem the previously used Token 1!
    const attack = rtr.rotateToken(familyId, token1, "rt_attacker_token");
    assert.equal(attack.success, false);
    assert.equal(attack.error, "token_reuse_detected_family_revoked");

    // Entire token family is now REVOKED! Even legitimate Token 3 is dead.
    assert.equal(rtr.isFamilyActive(familyId), false);
    const legitimateAttempt = rtr.rotateToken(familyId, token3, "rt_token_4");
    assert.equal(legitimateAttempt.success, false);
    assert.equal(legitimateAttempt.error, "family_compromised");
  });
});
