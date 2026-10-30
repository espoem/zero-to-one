import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Module 04: Public Key Infrastructure, X.509 & Mutual TLS (mTLS)
 * Demonstrates RFC 5280 path validation, SAN hostname matching,
 * BasicConstraints checking, and SPIFFE workload identity extraction.
 */

interface MockX509Cert {
  subject: string;
  issuer: string;
  notBefore: number;
  notAfter: number;
  isCA: boolean;
  pathLenConstraint?: number;
  sanDNS: string[];
  sanURI?: string[];
  publicKey: crypto.KeyObject;
  signature: Buffer;
  tbsBytes: Buffer;
}

// Signs a mock certificate using issuer's private key
function issueCert(
  subject: string,
  issuer: string,
  isCA: boolean,
  sanDNS: string[],
  issuerPrivKey: crypto.KeyObject,
  subjectPubKey: crypto.KeyObject,
  notBefore: number,
  notAfter: number,
  sanURI?: string[]
): MockX509Cert {
  const tbsString = `${subject}|${issuer}|${isCA}|${sanDNS.sort().join(",")}|${sanURI?.join(",") || ""}|${notBefore}|${notAfter}`;
  const tbsBytes = Buffer.from(tbsString, "utf8");

  const signer = crypto.createSign("SHA256");
  signer.update(tbsBytes);
  signer.end();
  const signature = signer.sign(issuerPrivKey);

  return {
    subject,
    issuer,
    notBefore,
    notAfter,
    isCA,
    sanDNS,
    sanURI,
    publicKey: subjectPubKey,
    signature,
    tbsBytes
  };
}

// Validates a leaf certificate against an issuer certificate
function verifyCert(child: MockX509Cert, issuer: MockX509Cert, currentTime: number): { valid: boolean; reason?: string } {
  // 1. Issuer relationship check
  if (child.issuer !== issuer.subject) {
    return { valid: false, reason: "Issuer distinguished name mismatch" };
  }

  // 2. Issuer must be a valid CA
  if (!issuer.isCA) {
    return { valid: false, reason: "Issuer certificate BasicConstraints is not a CA (cA: FALSE)" };
  }

  // 3. Temporal validity check
  if (currentTime < child.notBefore || currentTime > child.notAfter) {
    return { valid: false, reason: "Certificate is expired or not yet valid" };
  }

  // 4. Cryptographic signature check
  const verifier = crypto.createVerify("SHA256");
  verifier.update(child.tbsBytes);
  verifier.end();
  const sigValid = verifier.verify(issuer.publicKey, child.signature);
  if (!sigValid) {
    return { valid: false, reason: "Cryptographic signature verification failed" };
  }

  return { valid: true };
}

// Matches target hostname against SAN entries
function matchSAN(hostname: string, sanList: string[]): boolean {
  const hLower = hostname.toLowerCase();
  for (const san of sanList) {
    const sLower = san.toLowerCase();
    if (sLower === hLower) return true;

    // Single-label wildcard match (*.example.com)
    if (sLower.startsWith("*.")) {
      const baseDomain = sLower.slice(2);
      if (hLower.endsWith("." + baseDomain)) {
        const prefix = hLower.slice(0, -(baseDomain.length + 1));
        // Wildcard matches exactly one DNS label (no dots in prefix)
        if (!prefix.includes(".")) {
          return true;
        }
      }
    }
  }
  return false;
}

// Validates SPIFFE ID URI
function validateSPIFFEID(uri: string, expectedTrustDomain: string): { valid: boolean; workloadPath?: string } {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "spiffe:") return { valid: false };
    if (parsed.hostname !== expectedTrustDomain) return { valid: false };
    return { valid: true, workloadPath: parsed.pathname };
  } catch {
    return { valid: false };
  }
}

describe("Module 04: X.509 Certification Path & Workload Identity", () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Key pairs
  const rootKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const intermediateKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const leafKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });

  // Certificates
  const rootCert = issueCert("CN=Root CA", "CN=Root CA", true, [], rootKeys.privateKey, rootKeys.publicKey, now - 100 * day, now + 1000 * day);
  const intermediateCert = issueCert("CN=Inter CA", "CN=Root CA", true, [], rootKeys.privateKey, intermediateKeys.publicKey, now - 50 * day, now + 500 * day);
  const leafCert = issueCert(
    "CN=api.example.com",
    "CN=Inter CA",
    false,
    ["api.example.com", "*.internal.example.com"],
    intermediateKeys.privateKey,
    leafKeys.publicKey,
    now - 1 * day,
    now + 45 * day, // SC-081 compliant 45-day validity
    ["spiffe://cluster.local/ns/prod/sa/order-service"]
  );

  it("validates legitimate X.509 certificate chain successfully", () => {
    const interCheck = verifyCert(intermediateCert, rootCert, now);
    assert.equal(interCheck.valid, true);

    const leafCheck = verifyCert(leafCert, intermediateCert, now);
    assert.equal(leafCheck.valid, true);
  });

  it("rejects certificates issued by a non-CA (BasicConstraints cA: FALSE violation)", () => {
    const rogueKeys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    // Leaf attempts to act as a CA and issue another cert!
    const fraudulentCert = issueCert("CN=fraud.com", "CN=api.example.com", false, ["fraud.com"], leafKeys.privateKey, rogueKeys.publicKey, now - 1 * day, now + 10 * day);

    const result = verifyCert(fraudulentCert, leafCert, now);
    assert.equal(result.valid, false);
    assert.match(result.reason!, /cA: FALSE/);
  });

  it("rejects expired certificates (Temporal validity check)", () => {
    const expiredTime = now + 60 * day; // After leaf expiration (45 days)
    const result = verifyCert(leafCert, intermediateCert, expiredTime);
    assert.equal(result.valid, false);
    assert.match(result.reason!, /expired/);
  });

  it("correctly validates SAN hostnames and enforces single-label wildcard rules", () => {
    const sans = ["api.example.com", "*.internal.example.com"];

    assert.equal(matchSAN("api.example.com", sans), true);
    assert.equal(matchSAN("db.internal.example.com", sans), true);
    assert.equal(matchSAN("billing.internal.example.com", sans), true);

    // Single-label wildcard rejection: *.internal.example.com does NOT match deep.nested.internal.example.com
    assert.equal(matchSAN("deep.nested.internal.example.com", sans), false);
    assert.equal(matchSAN("evil.com", sans), false);
  });

  it("extracts and validates SPIFFE workload identity from SAN URI", () => {
    const spiffeURI = leafCert.sanURI![0];
    const validation = validateSPIFFEID(spiffeURI, "cluster.local");
    assert.equal(validation.valid, true);
    assert.equal(validation.workloadPath, "/ns/prod/sa/order-service");

    // Foreign trust domain rejected
    const foreignValidation = validateSPIFFEID(spiffeURI, "evil-cloud.com");
    assert.equal(foreignValidation.valid, false);
  });
});
