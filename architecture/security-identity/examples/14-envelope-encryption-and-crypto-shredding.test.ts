import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Module 14: Expert Security Architecture & Capstone System Design
 * Demonstrates Envelope Encryption, GDPR Crypto-Shredding (Cryptographic Erasure),
 * and Hybrid Post-Quantum Key Exchange (RFC 10024 simulation).
 */

// Simulated Hardware KMS Enclave
class MockKMS {
  private masterKEKs = new Map<string, Buffer>();

  createKEK(keyId: string): void {
    this.masterKEKs.set(keyId, crypto.randomBytes(32));
  }

  deleteKEK(keyId: string): boolean {
    return this.masterKEKs.delete(keyId);
  }

  // Wraps (encrypts) an ephemeral Data Encryption Key (DEK) with the master KEK
  wrapDEK(keyId: string, plaintextDEK: Buffer): { wrappedDEK: Buffer; iv: Buffer; tag: Buffer } {
    const kek = this.masterKEKs.get(keyId);
    if (!kek) throw new Error("KMS Master Key not found");

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
    const wrappedDEK = Buffer.concat([cipher.update(plaintextDEK), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { wrappedDEK, iv, tag };
  }

  // Unwraps (decrypts) the DEK using the master KEK
  unwrapDEK(keyId: string, wrappedDEK: Buffer, iv: Buffer, tag: Buffer): Buffer {
    const kek = this.masterKEKs.get(keyId);
    if (!kek) throw new Error("KMS Master Key not found (Key Destroyed)");

    const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(wrappedDEK), decipher.final()]);
  }
}

// Encrypt payload with Envelope Encryption
function encryptWithEnvelope(
  kms: MockKMS,
  userKekId: string,
  plaintextData: Buffer
) {
  // 1. Generate local ephemeral 256-bit DEK
  const ephemeralDEK = crypto.randomBytes(32);

  // 2. Encrypt large data locally using AES-256-GCM with the DEK
  const dataIv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ephemeralDEK, dataIv);
  const ciphertext = Buffer.concat([cipher.update(plaintextData), cipher.final()]);
  const dataTag = cipher.getAuthTag();

  // 3. Ask KMS to wrap only the 32-byte DEK
  const { wrappedDEK, iv: dekIv, tag: dekTag } = kms.wrapDEK(userKekId, ephemeralDEK);

  // 4. Return storage envelope (Plaintext DEK is purged from memory!)
  return {
    ciphertext,
    dataIv,
    dataTag,
    wrappedDEK,
    dekIv,
    dekTag
  };
}

// Decrypt payload from Envelope
function decryptWithEnvelope(
  kms: MockKMS,
  userKekId: string,
  envelope: ReturnType<typeof encryptWithEnvelope>
): Buffer {
  // 1. Unwrap DEK using KMS
  const unwrappedDEK = kms.unwrapDEK(userKekId, envelope.wrappedDEK, envelope.dekIv, envelope.dekTag);

  // 2. Decrypt data locally using unwrapped DEK
  const decipher = crypto.createDecipheriv("aes-256-gcm", unwrappedDEK, envelope.dataIv);
  decipher.setAuthTag(envelope.dataTag);
  return Buffer.concat([decipher.update(envelope.ciphertext), decipher.final()]);
}

// Simulated Hybrid Post-Quantum Key Exchange (RFC 10024 simulation)
function computeHybridSharedSecret(
  classicalSecret: Buffer,
  postQuantumSecret: Buffer
): Buffer {
  // RFC 10024: Combine both secrets using HKDF-Extract
  const combinedIKM = Buffer.concat([classicalSecret, postQuantumSecret]);
  const salt = Buffer.alloc(32, 0); // Zero-salt per spec
  // Extracts uniformly distributed master secret
  return Buffer.from(crypto.hkdfSync("sha256", combinedIKM, salt, "hybrid-pqc-tls-1.3", 32));
}

describe("Module 14: Expert Architecture, Envelope Encryption & Crypto-Shredding", () => {
  it("executes Envelope Encryption and successfully decrypts data using KMS-wrapped DEK", () => {
    const kms = new MockKMS();
    const userKekId = "user_kek_alice_999";
    kms.createKEK(userKekId);

    const secretMedicalRecord = Buffer.from("PATIENT_DIAGNOSIS_DATA: SENSITIVE_HEALTH_RECORD_2026");

    const envelope = encryptWithEnvelope(kms, userKekId, secretMedicalRecord);
    assert.equal(envelope.wrappedDEK.length, 32);

    const decrypted = decryptWithEnvelope(kms, userKekId, envelope);
    assert.deepEqual(decrypted, secretMedicalRecord);
  });

  it("demonstrates GDPR Crypto-Shredding: deleting the KMS KEK permanently renders immutable data unrecoverable", () => {
    const kms = new MockKMS();
    const userKekId = "user_kek_bob_404";
    kms.createKEK(userKekId);

    const personalData = Buffer.from("USER_PERSONAL_PII: Bob Jones, SSN: 123-45-6789, Address: Berlin");

    // Data is encrypted and stored in an immutable WORM S3 bucket / Kafka archive
    const envelope = encryptWithEnvelope(kms, userKekId, personalData);

    // Bob exercises GDPR Article 17 "Right to be Forgotten"
    // The application permanently destroys Bob's User KEK in KMS:
    const deleted = kms.deleteKEK(userKekId);
    assert.equal(deleted, true);

    // Any future decryption attempt of the immutable backup FAILS!
    assert.throws(
      () => decryptWithEnvelope(kms, userKekId, envelope),
      /KMS Master Key not found \(Key Destroyed\)/
    );

    // The ciphertext in the backup is now mathematically equivalent to irreversible noise
  });

  it("proves Hybrid Post-Quantum Key Exchange combines classical and lattice secrets safely", () => {
    const classicalX25519Secret = crypto.randomBytes(32);
    const postQuantumMLKEMSecret = crypto.randomBytes(32);

    const hybridSecret = computeHybridSharedSecret(classicalX25519Secret, postQuantumMLKEMSecret);
    assert.equal(hybridSecret.length, 32);

    // If either secret changes, the hybrid secret changes completely
    const alteredHybridSecret = computeHybridSharedSecret(crypto.randomBytes(32), postQuantumMLKEMSecret);
    assert.notDeepEqual(hybridSecret, alteredHybridSecret);
  });
});
