import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Module 10: Authorization Models: RBAC, ABAC, ReBAC (Zanzibar) & Cedar
 * Demonstrates ReBAC graph traversal with userset rewrites,
 * Cedar forbid-overrides-permit evaluation, and BOLA/IDOR prevention.
 */

// Tuple: object#relation@user
interface ReBACTuple {
  object: string;   // e.g. "document:doc_1" or "folder:f_1"
  relation: string; // e.g. "owner", "editor", "viewer", "parent"
  user: string;     // e.g. "user:alice" or "group:eng#member"
}

// ReBAC Engine implementing Zanzibar-style graph evaluation
class ReBACEngine {
  private tuples: ReBACTuple[] = [];

  addTuple(t: ReBACTuple) {
    this.tuples.push(t);
  }

  // Check if targetUser has targetRelation on targetObject (with graph inheritance)
  check(targetObject: string, targetRelation: string, targetUser: string, visited: Set<string> = new Set()): boolean {
    const stateKey = `${targetObject}#${targetRelation}@${targetUser}`;
    if (visited.has(stateKey)) return false; // Cycle detection
    visited.add(stateKey);

    // 1. Direct tuple match
    for (const t of this.tuples) {
      if (t.object === targetObject && t.relation === targetRelation && t.user === targetUser) {
        return true;
      }
    }

    // 2. Computed Userset (Hierarchy): owner implies editor, editor implies viewer
    if (targetRelation === "viewer") {
      if (this.check(targetObject, "editor", targetUser, visited)) return true;
      if (this.check(targetObject, "owner", targetUser, visited)) return true;
    }
    if (targetRelation === "editor") {
      if (this.check(targetObject, "owner", targetUser, visited)) return true;
    }

    // 3. Indirect Group Membership: if object#rel@group:X#member, check if targetUser is member of group:X
    for (const t of this.tuples) {
      if (t.object === targetObject && t.relation === targetRelation && t.user.endsWith("#member")) {
        const groupObj = t.user.slice(0, -7); // "group:eng#member" -> "group:eng"
        if (this.check(groupObj, "member", targetUser, visited)) {
          return true;
        }
      }
    }

    // 4. Tuple-to-Userset (Parent Folder Inheritance)
    // Find parent folder: targetObject#parent@folder:F
    for (const t of this.tuples) {
      if (t.object === targetObject && t.relation === "parent") {
        const parentFolder = t.user;
        if (this.check(parentFolder, targetRelation, targetUser, visited)) {
          return true;
        }
      }
    }

    return false;
  }
}

// Cedar Policy Evaluation Engine (Forbid-Overrides-Permit & Default Deny)
interface CedarPolicy {
  id: string;
  effect: "permit" | "forbid";
  principalRole?: string;
  action: string;
  resourcePrefix?: string;
  condition?: (context: Record<string, unknown>) => boolean;
}

class CedarEngine {
  private policies: CedarPolicy[];

  constructor(policies: CedarPolicy[]) {
    this.policies = policies;
  }

  evaluate(principalRole: string, action: string, resource: string, context: Record<string, unknown>): "permit" | "deny" {
    let hasPermit = false;

    for (const p of this.policies) {
      // Check action
      if (p.action !== "*" && p.action !== action) continue;

      // Check principal role
      if (p.principalRole && p.principalRole !== principalRole) continue;

      // Check resource prefix
      if (p.resourcePrefix && !resource.startsWith(p.resourcePrefix)) continue;

      // Check dynamic condition
      if (p.condition && !p.condition(context)) continue;

      // FORBID-OVERRIDES-PERMIT: Any matching forbid immediately halts with deny!
      if (p.effect === "forbid") {
        return "deny";
      }

      if (p.effect === "permit") {
        hasPermit = true;
      }
    }

    // DEFAULT DENY: Must have at least one explicit permit
    return hasPermit ? "permit" : "deny";
  }
}

describe("Module 10: Authorization Models (ReBAC & Cedar)", () => {
  it("traverses ReBAC relationship graphs and userset rewrites successfully", () => {
    const rebac = new ReBACEngine();

    // Alice is a member of engineering group
    rebac.addTuple({ object: "group:eng", relation: "member", user: "user:alice" });

    // Engineering group has editor access to folder:project_phoenix
    rebac.addTuple({ object: "folder:project_phoenix", relation: "editor", user: "group:eng#member" });

    // doc_2026 has parent folder:project_phoenix
    rebac.addTuple({ object: "document:doc_2026", relation: "parent", user: "folder:project_phoenix" });

    // Alice wants to view doc_2026:
    // Path: doc_2026 --(parent)--> folder:project_phoenix --(editor/viewer)--> group:eng#member --(member)--> user:alice
    assert.equal(rebac.check("document:doc_2026", "viewer", "user:alice"), true);
    assert.equal(rebac.check("document:doc_2026", "editor", "user:alice"), true);

    // Bob is not in engineering and has no access
    assert.equal(rebac.check("document:doc_2026", "viewer", "user:bob"), false);
  });

  it("enforces Cedar Forbid-Overrides-Permit and Default-Deny semantics", () => {
    const policies: CedarPolicy[] = [
      // Policy 1: Engineers can read/write EngineeringDocs
      {
        id: "p1",
        effect: "permit",
        principalRole: "Engineer",
        action: "Read",
        resourcePrefix: "doc:eng:"
      },
      // Policy 2: Strict security guardrail: FORBID access if IP is suspicious!
      {
        id: "p2",
        effect: "forbid",
        action: "*",
        condition: (ctx) => ctx.isSuspiciousIP === true
      }
    ];

    const cedar = new CedarEngine(policies);

    // Normal engineer on clean IP -> PERMIT
    assert.equal(cedar.evaluate("Engineer", "Read", "doc:eng:spec", { isSuspiciousIP: false }), "permit");

    // Engineer on suspicious IP -> FORBID OVERRIDES PERMIT! -> DENY
    assert.equal(cedar.evaluate("Engineer", "Read", "doc:eng:spec", { isSuspiciousIP: true }), "deny");

    // Unmatched action or role -> DEFAULT DENY
    assert.equal(cedar.evaluate("Engineer", "Delete", "doc:eng:spec", { isSuspiciousIP: false }), "deny");
    assert.equal(cedar.evaluate("Intern", "Read", "doc:eng:spec", { isSuspiciousIP: false }), "deny");
  });

  it("prevents BOLA / IDOR by enforcing tenant and user ownership matching", () => {
    interface Invoice {
      id: string;
      tenantId: string;
      amount: number;
    }

    const invoices: Invoice[] = [
      { id: "inv_100", tenantId: "tenant_alice", amount: 500 },
      { id: "inv_101", tenantId: "tenant_bob", amount: 9999 }
    ];

    // Secure accessor function
    function getInvoiceSecure(requestedId: string, authenticatedTenant: string): Invoice | null {
      // Invariant: BOLA is defeated by binding the query to authenticated tenant identity!
      return invoices.find(inv => inv.id === requestedId && inv.tenantId === authenticatedTenant) || null;
    }

    // Alice queries her own invoice -> Allowed
    assert.ok(getInvoiceSecure("inv_100", "tenant_alice"));

    // Alice queries Bob's invoice (BOLA attempt) -> Rejected (null)
    assert.equal(getInvoiceSecure("inv_101", "tenant_alice"), null);
  });
});
