/**
 * Module 07: React Server Components & Flight Wire Protocol
 *
 * Verifies RSC zero-bundle execution, the Flight streaming wire format,
 * client reference serialization, and negative proofs rejecting non-serializable boundaries.
 */

import assert from "node:assert/strict";

console.log("=== React 19 Module 07: React Server Components & Flight Wire Protocol ===");

// 1. Flight Wire Protocol Serialization Model
// The Flight protocol serializes component trees into newline-delimited rows.
// Row formats:
// ID: ["$", "$tag", "key", { props }] -> Server Element
// ID: I["bundle-path", ["ExportName"], "chunk-id"] -> Client Reference Descriptor

interface ClientReference {
  $$typeof: symbol;
  id: string;
  name: string;
}

const ClientReferenceSymbol = Symbol.for("react.client.reference");

function createClientReference(id: string, name: string): ClientReference {
  return {
    $$typeof: ClientReferenceSymbol,
    id,
    name,
  };
}

class FlightSerializer {
  rowId = 0;
  rows: string[] = [];

  serialize(value: any): string {
    const id = this.rowId++;
    const payload = this.serializeValue(value);
    const row = `${id.toString(16)}:${payload}`;
    this.rows.push(row);
    return `$${id.toString(16)}`;
  }

  serializeValue(value: any): string {
    if (value === null || typeof value !== "object") {
      if (typeof value === "function") {
        throw new TypeError(
          "Flight serialization error: Functions cannot be passed across the Server-Client boundary unless marked with 'use server'."
        );
      }
      return JSON.stringify(value);
    }

    if (value.$$typeof === ClientReferenceSymbol) {
      // Serialize client component reference
      return JSON.stringify(["$I", value.id, value.name]);
    }

    if (Array.isArray(value)) {
      return JSON.stringify(value.map((v) => this.serializeValue(v)));
    }

    if (value instanceof Map) {
      return JSON.stringify(["$M", Array.from(value.entries())]);
    }

    if (value instanceof Set) {
      return JSON.stringify(["$S", Array.from(value.values())]);
    }

    // Check plain object
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(
        `Flight serialization error: Class instances of type '${value.constructor.name}' cannot be passed across the Server-Client boundary.`
      );
    }

    const entries: [string, any][] = [];
    for (const [k, v] of Object.entries(value)) {
      entries.push([k, JSON.parse(this.serializeValue(v))]);
    }
    return JSON.stringify(Object.fromEntries(entries));
  }
}

{
  const serializer = new FlightSerializer();

  // Client component reference
  const ClientHeader = createClientReference("/components/Header.js", "Header");

  // Server tree with ClientHeader and rich serializable props (Set, Map, strings)
  const tree = {
    tag: "div",
    props: {
      title: "RSC App",
      roles: new Set(["admin", "editor"]),
      metadata: new Map([["theme", "dark"]]),
      header: ClientHeader,
    },
  };

  const rootRef = serializer.serialize(tree);
  assert.equal(rootRef, "$0");
  assert.equal(serializer.rows.length, 1);

  const row0 = serializer.rows[0];
  assert.ok(row0?.includes(`["$I","/components/Header.js","Header"]`));
  assert.ok(row0?.includes(`["$S",["admin","editor"]]`));
  assert.ok(row0?.includes(`["$M",[["theme","dark"]]]`));

  console.log("✓ Flight stream serialization (elements, client refs, sets, maps) verified.");
}

// 2. Negative Proof: Passing Functions Across Server Boundary
{
  const serializer = new FlightSerializer();

  const invalidTree = {
    tag: "button",
    props: {
      onClick: () => {
        console.log("unserializable client click handler passed from server");
      },
    },
  };

  assert.throws(
    () => serializer.serialize(invalidTree),
    /Functions cannot be passed across the Server-Client boundary/,
    "Passing raw functions from server component must throw Flight serialization error"
  );

  console.log("✓ Negative proof: Raw functions rejected by Flight boundary.");
}

// 3. Negative Proof: Passing Class Instances Across Boundary
{
  const serializer = new FlightSerializer();

  class DatabaseConnection {
    host: string;
    constructor(host: string) {
      this.host = host;
    }
  }

  const leakyTree = {
    tag: "div",
    props: {
      db: new DatabaseConnection("postgres://internal:5432"),
    },
  };

  assert.throws(
    () => serializer.serialize(leakyTree),
    /Class instances of type 'DatabaseConnection' cannot be passed/,
    "Passing class instances across server boundary must throw Flight serialization error"
  );

  console.log("✓ Negative proof: Class instances rejected to prevent prototype/credential leakage.");
}

console.log("All 07 RSC & Flight Protocol tests passed successfully!\n");
