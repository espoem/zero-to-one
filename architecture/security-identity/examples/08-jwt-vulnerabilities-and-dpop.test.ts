import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import * as jose from "jose";

/**
 * Module 08: JOSE Architecture, JWT Vulnerabilities & Sender-Constrained Tokens (DPoP)
 * Demonstrates defense against alg:none and RS256/HS256 algorithm confusion,
 * explicit typ enforcement (RFC 9068), and DPoP Proof verification (RFC 9449).
 */

// Compute DPoP access token hash (ath)
function computeDPoPAth(accessToken: string): string {
  return crypto.createHash("sha256").update(accessToken, "ascii").digest("base64url");
}

describe("Module 08: JWT Vulnerabilities & DPoP Sender-Constraining", () => {
  it("rejects forged tokens using alg: 'none' via strict algorithm allowlists", async () => {
    const { publicKey } = await jose.generateKeyPair("RS256");

    // Attacker crafts forged admin token with alg: 'none'
    const forgedHeader = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const forgedPayload = Buffer.from(JSON.stringify({ sub: "attacker", role: "admin", exp: 9999999999 })).toString("base64url");
    const forgedToken = `${forgedHeader}.${forgedPayload}.`;

    // Modern jose library with algorithm allowlist strictly rejects 'none'
    await assert.rejects(
      async () => {
        await jose.jwtVerify(forgedToken, publicKey, { algorithms: ["RS256"] });
      },
      /"alg" \(Algorithm\) Header Parameter value not allowed/
    );
  });

  it("prevents RS256/HS256 Algorithm Confusion attacks", async () => {
    // Generate RSA key pair
    const { publicKey, privateKey } = await jose.generateKeyPair("RS256");

    // Attacker exports the public key as text SPKI
    const spkiText = await jose.exportSPKI(publicKey);

    // Attacker signs a forged admin token using HMAC-SHA256 with the PUBLIC key as HMAC secret!
    const forgedHmacKey = crypto.createSecretKey(Buffer.from(spkiText, "utf8"));
    const forgedToken = await new jose.SignJWT({ sub: "attacker", role: "admin" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime("1h")
      .sign(forgedHmacKey);

    // SECURE SERVER: Verifies with algorithms: ['RS256']
    // Server immediately rejects the HS256 algorithm confusion token!
    await assert.rejects(
      async () => {
        await jose.jwtVerify(forgedToken, publicKey, { algorithms: ["RS256"] });
      },
      /"alg" \(Algorithm\) Header Parameter value not allowed/
    );
  });

  it("enforces explicit typing (typ: 'at+jwt') per RFC 9068 to prevent token confusion", async () => {
    const { publicKey, privateKey } = await jose.generateKeyPair("RS256");

    // Token with generic typ: 'JWT' (e.g. an ID token)
    const idToken = await new jose.SignJWT({ sub: "alice" })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setExpirationTime("1h")
      .sign(privateKey);

    // Token with explicit access token typ: 'at+jwt' (RFC 9068)
    const accessToken = await new jose.SignJWT({ sub: "alice", scope: "read:orders" })
      .setProtectedHeader({ alg: "RS256", typ: "at+jwt" })
      .setExpirationTime("1h")
      .sign(privateKey);

    // Verifier expecting access token rejects generic token
    await assert.rejects(
      async () => {
        await jose.jwtVerify(idToken, publicKey, { typ: "at+jwt", algorithms: ["RS256"] });
      },
      /unexpected "typ" JWT header value/
    );

    // Explicit at+jwt token accepted
    const { payload } = await jose.jwtVerify(accessToken, publicKey, { typ: "at+jwt", algorithms: ["RS256"] });
    assert.equal(payload.sub, "alice");
  });

  it("generates and verifies a DPoP Proof JWT bound to an access token (RFC 9449)", async () => {
    // Client generates ephemeral key pair (ES256)
    const clientKeys = await jose.generateKeyPair("ES256");
    const clientJwk = await jose.exportJWK(clientKeys.publicKey);

    const accessToken = "at_sample_dpop_access_token_xyz987";
    const ath = computeDPoPAth(accessToken);

    const httpMethod = "POST";
    const httpTargetUri = "https://api.example.com/orders";

    // 1. Client mints DPoP Proof
    const dpopProof = await new jose.SignJWT({
      htm: httpMethod,
      htu: httpTargetUri,
      ath: ath,
      jti: crypto.randomUUID()
    })
      .setProtectedHeader({
        alg: "ES256",
        typ: "dpop+jwt",
        jwk: clientJwk
      })
      .setIssuedAt()
      .sign(clientKeys.privateKey);

    // 2. Resource Server verifies DPoP Proof
    // Parse header to extract the client's embedded public JWK
    const protectedHeader = jose.decodeProtectedHeader(dpopProof);
    assert.equal(protectedHeader.typ, "dpop+jwt");
    assert.ok(protectedHeader.jwk);

    const importedClientKey = await jose.importJWK(protectedHeader.jwk as jose.JWK, "ES256");

    // Verify signature with client's public key
    const { payload } = await jose.jwtVerify(dpopProof, importedClientKey, {
      typ: "dpop+jwt",
      algorithms: ["ES256"]
    });

    // Enforce DPoP invariants:
    assert.equal(payload.htm, httpMethod);
    assert.equal(payload.htu, httpTargetUri);
    assert.equal(payload.ath, ath);

    // Stolen access token paired with wrong ath is rejected!
    const wrongAth = computeDPoPAth("stolen_access_token_abc");
    assert.notEqual(payload.ath, wrongAth);
  });
});
