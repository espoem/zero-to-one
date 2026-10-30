import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Module 09: Passkeys, WebAuthn Level 3 & Multi-Factor Authentication (MFA)
 * Demonstrates WebAuthn clientDataJSON validation, authenticatorData flag unpacking,
 * Assertion signature verification over hardware origin, and RFC 6238 TOTP computation.
 */

// Unpack authenticatorData bitfield flags (W3C WebAuthn §6.1)
function parseAuthDataFlags(flagByte: number) {
  return {
    up: (flagByte & 0x01) !== 0, // Bit 0: User Presence
    uv: (flagByte & 0x04) !== 0, // Bit 2: User Verified (Biometrics/PIN)
    be: (flagByte & 0x08) !== 0, // Bit 3: Backup Eligibility (Can be synced passkey)
    bs: (flagByte & 0x10) !== 0, // Bit 4: Backup State (Currently synced)
    at: (flagByte & 0x40) !== 0, // Bit 6: Attestation Data included
    ed: (flagByte & 0x80) !== 0  // Bit 7: Extension Data included
  };
}

// Compute RFC 6238 TOTP Token
function computeTOTP(secret: Buffer, timeSeconds: number, timeStep: number = 30, digits: number = 6): string {
  const counter = Math.floor(timeSeconds / timeStep);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac("sha1", secret).update(counterBuffer).digest();

  // Dynamic Truncation (RFC 4226 §5.3)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binaryCode % 10 ** digits;
  return otp.toString().padStart(digits, "0");
}

describe("Module 09: WebAuthn Assertion Math & RFC 6238 TOTP", () => {
  it("unpacks WebAuthn authenticatorData flags bitfield accurately", () => {
    // 0x1D = 0b00011101 -> UP (1), UV (1), BE (1), BS (1) -> Synced passkey with biometric verification!
    const flags = parseAuthDataFlags(0x1d);
    assert.equal(flags.up, true);
    assert.equal(flags.uv, true);
    assert.equal(flags.be, true);
    assert.equal(flags.bs, true);
    assert.equal(flags.at, false);

    // 0x01 = 0b00000001 -> UP only (e.g. YubiKey physical tap without PIN)
    const yubiFlags = parseAuthDataFlags(0x01);
    assert.equal(yubiFlags.up, true);
    assert.equal(yubiFlags.uv, false);
    assert.equal(yubiFlags.bs, false);
  });

  it("verifies WebAuthn assertion signature over authenticatorData and clientDataJSON", () => {
    const keyPair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });

    const serverChallenge = crypto.randomBytes(32).toString("base64url");
    const expectedOrigin = "https://bank.example.com";
    const rpId = "bank.example.com";

    // 1. Client constructs clientDataJSON
    const clientDataObj = {
      type: "webauthn.get",
      challenge: serverChallenge,
      origin: expectedOrigin,
      crossOrigin: false
    };
    const clientDataJSON = Buffer.from(JSON.stringify(clientDataObj), "utf8");
    const clientDataHash = crypto.createHash("sha256").update(clientDataJSON).digest();

    // 2. Authenticator builds authenticatorData (37 bytes: 32B rpIdHash + 1B flags + 4B signCount)
    const rpIdHash = crypto.createHash("sha256").update(rpId, "utf8").digest();
    const flagsByte = 0x05; // UP + UV
    const signCount = Buffer.alloc(4);
    signCount.writeUInt32BE(101, 0);

    const authenticatorData = Buffer.concat([rpIdHash, Buffer.from([flagsByte]), signCount]);

    // 3. Authenticator signs over (authenticatorData || clientDataHash)
    const signedPayload = Buffer.concat([authenticatorData, clientDataHash]);
    const signer = crypto.createSign("SHA256");
    signer.update(signedPayload);
    signer.end();
    const signature = signer.sign(keyPair.privateKey);

    // 4. Server verifies assertion signature
    const verifier = crypto.createVerify("SHA256");
    verifier.update(Buffer.concat([authenticatorData, clientDataHash]));
    verifier.end();
    const isValid = verifier.verify(keyPair.publicKey, signature);
    assert.equal(isValid, true);

    // Prove Phishing Resistance: If the origin was a phishing site, clientDataHash fails verification!
    const phishedClientData = Buffer.from(JSON.stringify({ ...clientDataObj, origin: "https://phishing-bank.com" }));
    const phishedHash = crypto.createHash("sha256").update(phishedClientData).digest();

    const phishVerifier = crypto.createVerify("SHA256");
    phishVerifier.update(Buffer.concat([authenticatorData, phishedHash]));
    phishVerifier.end();
    assert.equal(phishVerifier.verify(keyPair.publicKey, signature), false);
  });

  it("calculates deterministic RFC 6238 TOTP tokens matching reference test vector", () => {
    // RFC 6238 Appendix B test secret: "12345678901234567890" in ASCII
    const secret = Buffer.from("12345678901234567890", "ascii");

    // At Unix timestamp 59s: timeStep = 30 -> counter = 1 -> RFC vector is 287082
    const token59 = computeTOTP(secret, 59, 30, 6);
    assert.equal(token59, "287082");

    // At Unix timestamp 1111111109s: RFC vector is 081804
    const tokenEpoch = computeTOTP(secret, 1111111109, 30, 6);
    assert.equal(tokenEpoch, "081804");
  });
});
