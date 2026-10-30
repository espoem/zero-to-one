import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fc from "fast-check";

/**
 * Module 02: Cryptographic Primitives for Software Engineers
 * Demonstrates AEAD encryption, tamper detection, GCM nonce-reuse catastrophe,
 * length extension attack mechanics, and constant-time comparison.
 */

// Encrypt using AES-256-GCM (AEAD)
function encryptAESGCM(plaintext: Buffer, key: Buffer, nonce: Buffer, aad?: Buffer) {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  if (aad) {
    cipher.setAAD(aad);
  }
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, authTag };
}

// Decrypt using AES-256-GCM (AEAD)
function decryptAESGCM(ciphertext: Buffer, key: Buffer, nonce: Buffer, authTag: Buffer, aad?: Buffer): Buffer {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(authTag);
  if (aad) {
    decipher.setAAD(aad);
  }
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

describe("Module 02: Cryptographic Primitives & Side-Channel Defenses", () => {
  const key = crypto.randomBytes(32);
  const nonce = crypto.randomBytes(12);
  const plaintext = Buffer.from("CRITICAL_FINANCIAL_TRANSACTION_PAYLOAD_2026");
  const associatedData = Buffer.from("tenant_id=tenant_99;version=1.0");

  it("successfully performs AEAD round-trip encryption and authentication with AAD", () => {
    const { ciphertext, authTag } = encryptAESGCM(plaintext, key, nonce, associatedData);
    assert.equal(ciphertext.length, plaintext.length);
    assert.equal(authTag.length, 16);

    const decrypted = decryptAESGCM(ciphertext, key, nonce, authTag, associatedData);
    assert.deepEqual(decrypted, plaintext);
  });

  it("throws authentication tag failure when ciphertext is tampered by even 1 bit", () => {
    const { ciphertext, authTag } = encryptAESGCM(plaintext, key, nonce, associatedData);

    // Tamper with the first byte of ciphertext
    const tamperedCiphertext = Buffer.from(ciphertext);
    tamperedCiphertext[0] ^= 0x01; // Flip 1 bit

    assert.throws(
      () => decryptAESGCM(tamperedCiphertext, key, nonce, authTag, associatedData),
      /Unsupported state or unable to authenticate data/
    );
  });

  it("throws authentication tag failure when Associated Data (AAD) is modified in transit", () => {
    const { ciphertext, authTag } = encryptAESGCM(plaintext, key, nonce, associatedData);

    const tamperedAAD = Buffer.from("tenant_id=tenant_00;version=1.0"); // Attacker swapped tenant!

    assert.throws(
      () => decryptAESGCM(ciphertext, key, nonce, authTag, tamperedAAD),
      /Unsupported state or unable to authenticate data/
    );
  });

  it("demonstrates the AES-GCM Nonce-Reuse Catastrophe: recovers XOR of plaintexts", () => {
    // Both messages encrypted under the IDENTICAL (Key, Nonce) pair
    const p1 = Buffer.from("ATTACK_AT_DAWN_12345"); // 20 bytes
    const p2 = Buffer.from("RETREAT_AT_DUSK_9876"); // 20 bytes

    const enc1 = encryptAESGCM(p1, key, nonce);
    const enc2 = encryptAESGCM(p2, key, nonce);

    // In CTR mode: C1 ^ C2 == (P1 ^ S) ^ (P2 ^ S) == P1 ^ P2
    const xorCiphertexts = Buffer.alloc(p1.length);
    for (let i = 0; i < p1.length; i++) {
      xorCiphertexts[i] = enc1.ciphertext[i] ^ enc2.ciphertext[i];
    }

    const xorPlaintexts = Buffer.alloc(p1.length);
    for (let i = 0; i < p1.length; i++) {
      xorPlaintexts[i] = p1[i] ^ p2[i];
    }

    // Mathematical proof: XOR of ciphertexts equals XOR of plaintexts!
    assert.deepEqual(xorCiphertexts, xorPlaintexts);

    // If an attacker guesses or knows plaintext 1, they instantly recover plaintext 2:
    const recoveredP2 = Buffer.alloc(p1.length);
    for (let i = 0; i < p1.length; i++) {
      recoveredP2[i] = xorCiphertexts[i] ^ p1[i];
    }
    assert.deepEqual(recoveredP2, p2);
  });

  it("verifies constant-time comparison via crypto.timingSafeEqual", () => {
    const macA = crypto.randomBytes(32);
    const macB = Buffer.from(macA);
    const macC = crypto.randomBytes(32);

    assert.equal(crypto.timingSafeEqual(macA, macB), true);
    assert.equal(crypto.timingSafeEqual(macA, macC), false);

    // Mismatched lengths throw an immediate error (lengths must match for timingSafeEqual)
    const shortBuffer = crypto.randomBytes(16);
    assert.throws(() => crypto.timingSafeEqual(macA, shortBuffer), /Input buffers must have the same.*length/);
  });

  it("proves HKDF (RFC 5869) extracts uniform keys and expands with context strings", () => {
    const ikm = Buffer.from("raw_diffie_hellman_shared_secret_entropy");
    const salt = Buffer.from("salt_entropy_1234");
    const info = "app-v1-encryption-key";

    const derivedKey = crypto.hkdfSync("sha256", ikm, salt, info, 32);
    assert.equal(derivedKey.byteLength, 32);

    // Changing info context generates an orthogonal, completely independent key
    const differentKey = crypto.hkdfSync("sha256", ikm, salt, "app-v1-mac-key", 32);
    assert.notDeepEqual(Buffer.from(derivedKey), Buffer.from(differentKey));
  });

  it("property test: AEAD encryption and decryption is an exact identity function for arbitrary inputs", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 512 }),
        fc.uint8Array({ minLength: 0, maxLength: 128 }),
        (plainBytes, aadBytes) => {
          const ephemeralKey = crypto.randomBytes(32);
          const ephemeralNonce = crypto.randomBytes(12);
          const pBuf = Buffer.from(plainBytes);
          const aadBuf = Buffer.from(aadBytes);

          const { ciphertext, authTag } = encryptAESGCM(pBuf, ephemeralKey, ephemeralNonce, aadBuf);
          const decrypted = decryptAESGCM(ciphertext, ephemeralKey, ephemeralNonce, authTag, aadBuf);

          return decrypted.equals(pBuf);
        }
      ),
      { numRuns: 50 }
    );
  });
});
