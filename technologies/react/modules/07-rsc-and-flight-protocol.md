# 07: React Server Components & Flight Wire Protocol

## 1. Formal Foundations: The Two-Tier Architecture

React Server Components (RSC) fundamentally alters the execution model of React by dividing component execution into two separate environments:
- **Server Tier (Default)**: Components execute exclusively on the server at request time or build time. Their dependencies, backend libraries (`fs`, DB drivers, internal API clients), and source code are never shipped to the client browser (0 KB JS bundle impact).
- **Client Tier (`"use client"`)**: Interactive components that hydrate in the browser, register DOM event listeners, and maintain stateful hooks.

---

## 2. Multi-Tier Progression: The Flight Wire Protocol

Server Components do not emit HTML to the client reconciler. Instead, the server compiler lower trees into a streaming format known as the **Flight Wire Protocol**.

### 2.1 Flight Stream Row Format

The Flight protocol streams newline-delimited rows of serialized JSON-like records:

```text
M1:{"id":"./src/Avatar.js","chunks":["client-chunk-1"],"name":"Avatar"}
0:["$","div",null,{"className":"profile","children":["$","$L1",null,{"userId":"u123"}]}]
```

- `M1`: Declares a **Client Module Reference** specifying the client bundle chunk and exported component name.
- `0`: Defines the root element tree where `$L1` references the client component slot declared in row `M1`.

When the browser receives this stream, it renders the server-rendered elements and dynamically imports the client bundles only where client reference slots appear.

### 2.2 Serialization Boundaries & Supported Primitives

Props passed across the Server-Client boundary must be serializable by the Flight serializer.
- **Allowed Types**: Primitives (`string`, `number`, `boolean`, `null`), plain objects, arrays, `Map`, `Set`, `Date`, TypedArrays, Promises, JSX elements, and Server Actions (`"use server"`).
- **Forbidden Types (Boundary Violations)**:
  - Standard functions (e.g. `onClick={() => {}}`): Cannot be passed from a Server Component to a Client Component.
  - Class instances: Rejected to prevent leaking internal methods and prototype chains.
  - Symbols (except well-known React symbols): Rejected due to non-serializability.

---

## 3. Server Actions & Directives

- `"use client"`: Marks a module as a client boundary. All components defined within and imported by this file are bundled for the browser.
- `"use server"`: Marks an asynchronous function as a **Server Action**. The compiler generates a secure RPC endpoint, allowing client code to invoke the function remotely via POST requests with automatic argument serialization and CSRF protection.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [07-rsc-and-flight-protocol.ts](../examples/07-rsc-and-flight-protocol.ts) provides deterministic verification:
- **Flight Row Serialization**: Proves serialization of element trees, client component references, Sets, and Maps.
- **Negative Proof of Raw Functions**: Validates that passing raw client functions from server components throws a Flight serialization error.
- **Negative Proof of Class Instances**: Demonstrates that passing class instances (such as database connection pools) across boundaries is rejected.
