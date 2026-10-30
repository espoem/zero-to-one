import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Module 13: Security Operations, Detection & Incident Response (OWASP A09:2025)
 * Demonstrates automated log redaction of sensitive credentials,
 * impossible travel anomaly detection, and EPSS/CVSS vulnerability prioritization.
 */

// Automated log redaction interceptor (OWASP A09)
function redactAuditLog(logObj: Record<string, any>): Record<string, any> {
  const SENSITIVE_KEYS = new Set([
    "password", "secret", "token", "accesstoken", "refreshtoken",
    "authorization", "apikey", "creditcard", "ssn"
  ]);

  function redactRecursive(val: any): any {
    if (val === null || typeof val !== "object") {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(redactRecursive);
    }
    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const lowerKey = k.toLowerCase().replace(/[-_]/g, "");
      if (SENSITIVE_KEYS.has(lowerKey)) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = redactRecursive(v);
      }
    }
    return sanitized;
  }

  return redactRecursive(logObj);
}

// Great-circle distance between two coordinates (Haversine formula in km)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Impossible Travel Detector
function checkImpossibleTravel(
  login1: { lat: number; lon: number; timestampMs: number },
  login2: { lat: number; lon: number; timestampMs: number }
): { isAnomaly: boolean; velocityKmH: number } {
  const distanceKm = calculateDistanceKm(login1.lat, login1.lon, login2.lat, login2.lon);
  const timeHours = Math.abs(login2.timestampMs - login1.timestampMs) / (1000 * 60 * 60);

  if (timeHours === 0) {
    return { isAnomaly: distanceKm > 10, velocityKmH: Infinity };
  }

  const velocityKmH = distanceKm / timeHours;
  // Threshold: > 900 km/h (faster than commercial passenger aircraft)
  return {
    isAnomaly: velocityKmH > 900,
    velocityKmH: Math.round(velocityKmH)
  };
}

// Vulnerability Triage (CVSS + EPSS)
function triageVulnerability(cvss: number, epss: number): "Act" | "Attend" | "Track" {
  // High EPSS (> 10% probability of active in-the-wild exploitation)
  if (epss >= 0.10 && cvss >= 7.0) {
    return "Act"; // Critical emergency out-of-band hotfix
  }
  if (cvss >= 8.0 || epss >= 0.05) {
    return "Attend"; // Next sprint release
  }
  return "Track"; // Standard patch schedule
}

describe("Module 13: Security Operations & Detection Signals", () => {
  it("automatically redacts passwords, tokens, and authorization headers from audit logs", () => {
    const rawAuditPayload = {
      action: "user.login",
      user: "alice@example.com",
      headers: {
        authorization: "Bearer secret_access_token_xyz_999",
        userAgent: "Mozilla/5.0"
      },
      request: {
        password: "MySuperSecretPassword2026!",
        apiKey: "sk_live_999888777"
      }
    };

    const sanitized = redactAuditLog(rawAuditPayload);

    assert.equal(sanitized.action, "user.login");
    assert.equal(sanitized.user, "alice@example.com");
    assert.equal(sanitized.headers.authorization, "[REDACTED]");
    assert.equal(sanitized.request.password, "[REDACTED]");
    assert.equal(sanitized.request.apiKey, "[REDACTED]");
    assert.equal(sanitized.headers.userAgent, "Mozilla/5.0");
  });

  it("detects Impossible Travel velocity anomalies across consecutive logins", () => {
    const london = { lat: 51.5074, lon: -0.1278, timestampMs: 1700000000000 };
    // Tokyo (approx 9,560 km away), 15 minutes later
    const tokyo = { lat: 35.6762, lon: 139.6503, timestampMs: 1700000000000 + 15 * 60 * 1000 };

    const check = checkImpossibleTravel(london, tokyo);
    assert.equal(check.isAnomaly, true);
    assert.ok(check.velocityKmH > 35000); // Over 35,000 km/h required -> Physical impossibility!

    // Realistic travel: 2 hours between London and Paris (340 km -> ~170 km/h Eurostar)
    const paris = { lat: 48.8566, lon: 2.3522, timestampMs: 1700000000000 + 2 * 60 * 60 * 1000 };
    const normalTravel = checkImpossibleTravel(london, paris);
    assert.equal(normalTravel.isAnomaly, false);
    assert.ok(normalTravel.velocityKmH < 300);
  });

  it("prioritizes remediation via combined CVSS and EPSS scoring", () => {
    // Actively weaponized CVE with high EPSS (0.35) and high CVSS (8.8) -> ACT
    assert.equal(triageVulnerability(8.8, 0.35), "Act");

    // Theoretical CVSS 9.8 but near-zero real-world exploitation (EPSS 0.001) -> ATTEND
    assert.equal(triageVulnerability(9.8, 0.001), "Attend");

    // Low severity CVSS 4.2 and low EPSS (0.002) -> TRACK
    assert.equal(triageVulnerability(4.2, 0.002), "Track");
  });
});
