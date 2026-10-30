import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";

/**
 * Module 01: Threat Modeling, Security Principles & ASVS 5.0
 * Demonstrates trust boundary enforcement, STRIDE mapping, and fail-closed evaluation.
 */

type STRIDEThreat = "Spoofing" | "Tampering" | "Repudiation" | "InformationDisclosure" | "DenialOfService" | "ElevationOfPrivilege";

interface DFDElement {
  id: string;
  type: "ExternalEntity" | "Process" | "DataStore" | "DataFlow";
  trustZone: "UntrustedPublic" | "DMZ" | "InternalSecure";
}

interface DataPacket {
  sourceId: string;
  destinationId: string;
  payload: Record<string, unknown>;
  authenticatedPrincipal?: { id: string; role: string; tokenValid: boolean };
}

// STRIDE element-to-threat capability matrix
const ELEMENT_STRIDE_CAPABILITY: Record<DFDElement["type"], STRIDEThreat[]> = {
  ExternalEntity: ["Spoofing", "Repudiation"],
  Process: ["Spoofing", "Tampering", "Repudiation", "InformationDisclosure", "DenialOfService", "ElevationOfPrivilege"],
  DataStore: ["Tampering", "Repudiation", "InformationDisclosure", "DenialOfService"],
  DataFlow: ["Tampering", "InformationDisclosure", "DenialOfService"]
};

// Trust boundary enforcement engine
class TrustBoundaryGateway {
  private elements: Map<string, DFDElement>;

  constructor(elements: Map<string, DFDElement>) {
    this.elements = elements;
  }

  processFlow(packet: DataPacket): { allowed: boolean; reason?: string } {
    const src = this.elements.get(packet.sourceId);
    const dst = this.elements.get(packet.destinationId);

    if (!src || !dst) {
      return { allowed: false, reason: "Unknown source or destination element" };
    }

    // Trust boundary crossing: Untrusted -> Secure requires valid authenticated principal
    const isBoundaryCrossing = src.trustZone !== dst.trustZone;
    if (isBoundaryCrossing && dst.trustZone === "InternalSecure") {
      if (!packet.authenticatedPrincipal || !packet.authenticatedPrincipal.tokenValid) {
        return { allowed: false, reason: "Fail-closed: unauthenticated crossing of trust boundary" };
      }
      if (packet.authenticatedPrincipal.role === "unprivileged" && dst.type === "DataStore") {
        return { allowed: false, reason: "Least privilege violation: direct access to DataStore forbidden" };
      }
    }

    return { allowed: true };
  }
}

describe("Module 01: Threat Modeling & Trust Boundary Enforcement", () => {
  const elements = new Map<string, DFDElement>([
    ["client", { id: "client", type: "ExternalEntity", trustZone: "UntrustedPublic" }],
    ["gateway", { id: "gateway", type: "Process", trustZone: "DMZ" }],
    ["authService", { id: "authService", type: "Process", trustZone: "InternalSecure" }],
    ["database", { id: "database", type: "DataStore", trustZone: "InternalSecure" }]
  ]);

  const gateway = new TrustBoundaryGateway(elements);

  it("verifies STRIDE threats mapped correctly to DFD element types", () => {
    assert.deepEqual(ELEMENT_STRIDE_CAPABILITY.ExternalEntity, ["Spoofing", "Repudiation"]);
    assert.equal(ELEMENT_STRIDE_CAPABILITY.Process.length, 6); // All 6 STRIDE threats
    assert.ok(!ELEMENT_STRIDE_CAPABILITY.DataStore.includes("Spoofing"));
    assert.ok(ELEMENT_STRIDE_CAPABILITY.DataFlow.includes("InformationDisclosure"));
  });

  it("enforces fail-closed rejection when crossing trust boundary unauthenticated", () => {
    const unauthenticatedPacket: DataPacket = {
      sourceId: "client",
      destinationId: "authService",
      payload: { action: "read_secrets" }
    };

    const result = gateway.processFlow(unauthenticatedPacket);
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /unauthenticated crossing/);
  });

  it("permits authenticated principal crossing into InternalSecure process", () => {
    const authenticatedPacket: DataPacket = {
      sourceId: "client",
      destinationId: "authService",
      payload: { action: "authenticate" },
      authenticatedPrincipal: { id: "user_42", role: "standard_user", tokenValid: true }
    };

    const result = gateway.processFlow(authenticatedPacket);
    assert.equal(result.allowed, true);
  });

  it("enforces least privilege: unprivileged user cannot access internal DataStore directly", () => {
    const directDbAccess: DataPacket = {
      sourceId: "client",
      destinationId: "database",
      payload: { query: "SELECT * FROM secrets" },
      authenticatedPrincipal: { id: "user_42", role: "unprivileged", tokenValid: true }
    };

    const result = gateway.processFlow(directDbAccess);
    assert.equal(result.allowed, false);
    assert.match(result.reason!, /Least privilege violation/);
  });

  it("property test: unauthenticated packets from UntrustedPublic can NEVER enter InternalSecure", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.record({ key: fc.string() }),
        (randomId, payload) => {
          const packet: DataPacket = {
            sourceId: "client",
            destinationId: "authService",
            payload: { randomId, ...payload }
            // Omit authenticatedPrincipal
          };
          const res = gateway.processFlow(packet);
          return res.allowed === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});
