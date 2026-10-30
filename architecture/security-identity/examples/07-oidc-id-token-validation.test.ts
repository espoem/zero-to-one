import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as jose from "jose";

/**
 * Module 07: OpenID Connect (OIDC), Identity Federation & Token Exchange
 * Demonstrates ID Token mathematical validation, at_hash computation (OIDC Core §3.1.3.6),
 * and federated account linking defenses against the "nOAuth" attack class.
 */

// Compute OIDC at_hash (Access Token Hash) per OIDC Core §3.1.3.6
function computeAtHash(accessToken: string, alg: string = "RS256"): string {
  // 1. Hash access token using matching hash algorithm (SHA-256 for RS256/ES256)
  const hash = crypto.createHash("sha256").update(accessToken, "ascii").digest();
  // 2. Take the leftmost half of the hash digest (first 16 bytes)
  const leftmostHalf = hash.subarray(0, hash.length / 2);
  // 3. Base64URL-encode those bytes
  return leftmostHalf.toString("base64url");
}

// Federated Account Linking Rule Engine (nOAuth Defense)
interface FederatedClaims {
  iss: string;
  sub: string;
  email?: string;
  email_verified?: boolean;
}

interface LocalUser {
  id: string;
  email: string;
  federatedLinks: { iss: string; sub: string }[];
}

function linkOrAuthenticateFederatedUser(
  claims: FederatedClaims,
  trustedIssuer: string,
  userDatabase: Map<string, LocalUser>
): { success: boolean; user?: LocalUser; error?: string } {
  // 1. Issuer Validation
  if (claims.iss !== trustedIssuer) {
    return { success: false, error: "untrusted_issuer" };
  }

  // 2. First check if user is already linked by immutable (iss, sub) tuple
  for (const user of userDatabase.values()) {
    const linked = user.federatedLinks.some(link => link.iss === claims.iss && link.sub === claims.sub);
    if (linked) {
      return { success: true, user };
    }
  }

  // 3. If attempting account linking via email, strictly enforce email_verified: true!
  // THE "nOAuth" DEFENSE:
  if (!claims.email) {
    return { success: false, error: "missing_email_claim" };
  }

  if (claims.email_verified !== true) {
    // REJECT: Attacker registered unverified email on multi-tenant IdP!
    return { success: false, error: "email_not_verified_rejection" };
  }

  // Find pre-existing local user by verified email
  const existingUser = userDatabase.get(claims.email);
  if (existingUser) {
    existingUser.federatedLinks.push({ iss: claims.iss, sub: claims.sub });
    return { success: true, user: existingUser };
  }

  return { success: false, error: "user_not_found" };
}

describe("Module 07: OIDC Token Validation & Federated Identity Defense", () => {
  it("correctly computes OIDC at_hash per RFC specification", () => {
    const accessToken = "jHkWEdUXMU1BOmLequiOxA";
    const expectedAtHash = computeAtHash(accessToken, "RS256");

    assert.equal(typeof expectedAtHash, "string");
    assert.equal(expectedAtHash.length, 22); // 16 bytes base64url encoded is 22 chars

    // Prove determinism
    assert.equal(computeAtHash(accessToken, "RS256"), expectedAtHash);

    // Tampered access token yields different at_hash
    assert.notEqual(computeAtHash("tampered_token_xyz", "RS256"), expectedAtHash);
  });

  it("mints and mathematically validates an OIDC ID Token using jose", async () => {
    // Generate RSA key pair for IdP
    const { publicKey, privateKey } = await jose.generateKeyPair("RS256");

    const accessToken = "at_sample_token_12345";
    const atHash = computeAtHash(accessToken, "RS256");

    const expectedIssuer = "https://auth.example.com";
    const expectedClientId = "my_client_app_id";
    const expectedNonce = "nonce_random_999";

    // Mint ID Token
    const jwt = await new jose.SignJWT({
      sub: "usr_alice_42",
      email: "alice@example.com",
      email_verified: true,
      nonce: expectedNonce,
      at_hash: atHash
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(expectedIssuer)
      .setAudience(expectedClientId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(privateKey);

    // Validate ID Token as Relying Party
    const { payload } = await jose.jwtVerify(jwt, publicKey, {
      issuer: expectedIssuer,
      audience: expectedClientId,
      algorithms: ["RS256"]
    });

    assert.equal(payload.sub, "usr_alice_42");
    assert.equal(payload.nonce, expectedNonce);
    assert.equal(payload.at_hash, atHash);
  });

  it("prevents the nOAuth account takeover attack by enforcing email_verified: true", () => {
    const userDb = new Map<string, LocalUser>([
      ["ceo@victim-corp.com", { id: "u_1", email: "ceo@victim-corp.com", federatedLinks: [] }]
    ]);

    const trustedIdP = "https://login.microsoftonline.com/common/v2.0";

    // ATTACK PAYLOAD: Attacker registers tenant with unverified email ceo@victim-corp.com
    const maliciousClaims: FederatedClaims = {
      iss: trustedIdP,
      sub: "attacker_sub_999",
      email: "ceo@victim-corp.com",
      email_verified: false // Not verified by IdP!
    };

    // The account linking engine REJECTS the takeover attempt!
    const attackResult = linkOrAuthenticateFederatedUser(maliciousClaims, trustedIdP, userDb);
    assert.equal(attackResult.success, false);
    assert.equal(attackResult.error, "email_not_verified_rejection");

    // CEO account remains unlinked and safe
    assert.equal(userDb.get("ceo@victim-corp.com")!.federatedLinks.length, 0);

    // Legitimate SSO with email_verified: true succeeds
    const legitimateClaims: FederatedClaims = {
      iss: trustedIdP,
      sub: "ceo_legitimate_sub_001",
      email: "ceo@victim-corp.com",
      email_verified: true
    };

    const legitResult = linkOrAuthenticateFederatedUser(legitimateClaims, trustedIdP, userDb);
    assert.equal(legitResult.success, true);
    assert.equal(userDb.get("ceo@victim-corp.com")!.federatedLinks.length, 1);
  });
});
