import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fc from "fast-check";

/**
 * Module 03: Passwords, Credential Defense & Secrets at Rest
 * Demonstrates Argon2id hashing, KMS Pepper integration, the bcrypt 72-byte truncation flaw,
 * and k-Anonymity breached password search.
 */

// Production Argon2id hash generator
function hashPassword(password: string, salt: Buffer, pepper?: Buffer): Buffer {
  return (crypto as any).argon2Sync("argon2id", {
    message: Buffer.from(password, "utf8"),
    nonce: salt,
    parallelism: 1,
    memory: 19456, // 19 MiB
    passes: 2,     // 2 iterations
    tagLength: 32, // 32 bytes
    secret: pepper
  });
}

// Constant-time verification
function verifyPassword(password: string, salt: Buffer, expectedHash: Buffer, pepper?: Buffer): boolean {
  const computed = hashPassword(password, salt, pepper);
  return crypto.timingSafeEqual(computed, expectedHash);
}

// Simulated k-Anonymity HIBP Search Engine
class KAnonymityBreachedDB {
  private breachedHashes = new Set<string>();

  addBreachedPassword(password: string) {
    const fullHash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
    this.breachedHashes.add(fullHash);
  }

  // Returns matching suffixes for a 5-char prefix
  queryPrefix(prefix5: string): string[] {
    const p = prefix5.toUpperCase();
    const results: string[] = [];
    for (const hash of this.breachedHashes) {
      if (hash.startsWith(p)) {
        results.push(hash.slice(5)); // Return suffix only
      }
    }
    return results;
  }
}

// Client-side k-Anonymity lookup (zero plain password leakage)
function checkPasswordBreached(password: string, db: KAnonymityBreachedDB): boolean {
  const fullHash = crypto.createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = fullHash.slice(0, 5);
  const suffix = fullHash.slice(5);

  // Client requests ONLY the 5-character prefix across network
  const candidates = db.queryPrefix(prefix);
  // Match locally
  return candidates.includes(suffix);
}

describe("Module 03: Passwords, Peppering & k-Anonymity", () => {
  const salt = crypto.randomBytes(16);
  const pepper = crypto.randomBytes(32);
  const password = "correct horse battery staple 2026";

  it("hashes and verifies password using native Argon2id (RFC 9106)", () => {
    const hash = hashPassword(password, salt, pepper);
    assert.equal(hash.length, 32);

    // Correct password and pepper verifies true
    const valid = verifyPassword(password, salt, hash, pepper);
    assert.equal(valid, true);

    // Wrong password fails
    const invalidPass = verifyPassword("wrong password", salt, hash, pepper);
    assert.equal(invalidPass, false);

    // Wrong pepper fails (protects against database dumps)
    const wrongPepper = crypto.randomBytes(32);
    const invalidPepper = verifyPassword(password, salt, hash, wrongPepper);
    assert.equal(invalidPepper, false);
  });

  it("proves the bcrypt 72-byte truncation vulnerability vs Argon2id unbounded support", () => {
    // Simulated bcrypt Blowfish 72-byte ceiling
    function simulatedBcryptHash(pass: string): string {
      const truncated = Buffer.from(pass, "utf8").subarray(0, 72);
      return crypto.createHash("sha256").update(truncated).digest("hex");
    }

    const base72 = "A".repeat(72);
    const passA = base72 + "FIRST_SECRET_SUFFIX";
    const passB = base72 + "SECOND_DIFFERENT_SUFFIX";

    // In bcrypt: Passwords differing ONLY after byte 72 produce IDENTICAL hashes!
    assert.equal(simulatedBcryptHash(passA), simulatedBcryptHash(passB));

    // In Argon2id: Both long passwords produce completely different, unique hashes!
    const argonHashA = hashPassword(passA, salt);
    const argonHashB = hashPassword(passB, salt);
    assert.notDeepEqual(argonHashA, argonHashB);
  });

  it("demonstrates k-Anonymity breached password defense without leaking plaintext password", () => {
    const hibp = new KAnonymityBreachedDB();
    hibp.addBreachedPassword("P@ssw0rd1");
    hibp.addBreachedPassword("admin123456");
    hibp.addBreachedPassword("qwertyuiop");

    // "P@ssw0rd1" is identified as breached
    assert.equal(checkPasswordBreached("P@ssw0rd1", hibp), true);

    // Safe, unbreached passphrase is not found
    assert.equal(checkPasswordBreached("UniqueSecurePassphrase987654321!", hibp), false);
  });

  it("property test: different salts always produce distinct Argon2id hashes for identical passwords", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 8, maxLength: 64 }),
        (plain) => {
          const s1 = crypto.randomBytes(16);
          const s2 = crypto.randomBytes(16);
          const h1 = hashPassword(plain, s1);
          const h2 = hashPassword(plain, s2);
          return !h1.equals(h2);
        }
      ),
      { numRuns: 10 } // Argon2id is intentionally memory-intensive; 10 property runs prove the invariant
    );
  });
});
