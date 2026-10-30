# Module 05: Classes, Mutability & TS-Only Syntax

> Example and tests: [`examples/05-classes-mutability/classes-mutability.test.ts`](../examples/05-classes-mutability/classes-mutability.test.ts) (widening and `as const`, readonly arrays, the `as const` object pattern, `#private` vs `private`, `override`, abstract classes and polymorphic `this`, `this` parameters). The `erasableSyntaxOnly` fixture is in [Module 01](./01-toolchain-and-compiler-model.md)'s examples.
> Run: `mise exec -- node --test examples/05-classes-mutability/`
>
> Ownership: class *runtime* semantics (prototypes, fields, `#private` brand semantics, `this` binding rules) belong to `languages/javascript`. This module covers how TypeScript types them and which TypeScript-only syntax to avoid.

---

## Module Overview & Learning Objectives

This module explores the boundary between JavaScript's dynamic runtime mutability and TypeScript's compile-time type system. In real-world TypeScript applications, subtle inference behaviors—such as property widening and array assignability—frequently cause baffling type errors. Furthermore, legacy constructs inherited from TypeScript's early days can introduce runtime bloat and toolchain breakage.

### Key Objectives
- Understand the root cause of property widening and master `readonly`, `Readonly<T>`, and `as const`.
- Differentiate between mutable and read-only arrays, fix unsafe tuple inferences, and leverage `@total-typescript/ts-reset`.
- Master modern TypeScript classes: access modifiers (`public`, `protected`, `private`), ECMAScript `#private` hard fields, `implements`, `extends`, `override`, and typing `this`.
- Diagnose the pitfalls of legacy TS-only features (numeric enums, string enums, `const enum`, namespaces, parameter properties) and replace them with the `as const` object + union pattern.
- Derive type definitions directly from runtime values using `typeof`, `keyof`, indexed access (`T[K]`, `T[number]`), and constructor utilities like `InstanceType<T>`.

---

## Lesson 5.1: Mutability, Object Property Inference, `readonly` & `as const`

### The Variable vs. Property Widening Dilemma

When declaring a variable with `const`, TypeScript infers a literal type because primitives cannot be reassigned:

```typescript
const method = "GET";
//    ^? const method: "GET"
```

However, JavaScript objects are mutable reference types. When you declare an object with `const`, the reference is fixed, but its properties remain mutable. To allow future property mutations, TypeScript widens property types from literals to base primitives:

```typescript
const req = {
  endpoint: "/api/users",
  method: "GET",
};
// ^? const req: { endpoint: string; method: string }

req.method = "POST"; // Valid JS mutation!
```

This creates an immediate assignment error when passing the property to a function expecting a strict union of string literals:

```typescript
function executeRequest(url: string, method: "GET" | "POST") {}

// @ts-expect-error Argument of type 'string' is not assignable to parameter of type '"GET" | "POST"'.
executeRequest(req.endpoint, req.method);
```

### Fixing Assignment Inference Errors

You have four standard techniques to resolve this issue:

```typescript
// 1. Explicit variable annotation (enforces type at declaration)
type RequestConfig = { endpoint: string; method: "GET" | "POST" };
const c1: RequestConfig = { endpoint: "/api", method: "GET" };

// 2. Property-level literal assertion (narrows only the single property)
const c2 = { endpoint: "/api", method: "GET" as const };
//    ^? const c2: { endpoint: string; method: "GET" }

// 3. Deep const assertion (freezes all properties recursively into literals)
const c3 = { endpoint: "/api", method: "GET" } as const;
//    ^? const c3: { readonly endpoint: "/api"; readonly method: "GET" }

// 4. The satisfies operator (validates conformance without widening)
const c4 = { endpoint: "/api", method: "GET" } satisfies RequestConfig;
//    ^? const c4: { endpoint: string; method: "GET" }
```

### The `readonly` Modifier, `Readonly<T>`, and Arrays

The `readonly` modifier prevents reassignment to properties during type checking:

```typescript
type DatabaseConfig = {
  readonly host: string;
  port: number;
};

const db: DatabaseConfig = { host: "localhost", port: 5432 };
db.port = 5433; // Allowed
// @ts-expect-error Cannot assign to 'host' because it is a read-only property.
db.host = "remote";
```

TypeScript provides the built-in utility type `Readonly<T>`, which marks every property as `readonly`. Note that `Readonly<T>` is strictly **shallow**:

```typescript
type NestedConfig = {
  server: { url: string };
};
const config: Readonly<NestedConfig> = { server: { url: "http://localhost" } };
// @ts-expect-error Cannot assign to 'server' because it is a read-only property.
config.server = { url: "other" };
config.server.url = "http://remote"; // Allowed! Nested properties are NOT readonly!
```

#### Array Mutability and Assignability Rules
Arrays can be typed as read-only using `readonly T[]` or `ReadonlyArray<T>`. All mutating methods (`push`, `pop`, `splice`, `shift`, `unshift`, `sort`, `reverse`) are removed from the type:

```typescript
const tags: readonly string[] = ["typescript", "javascript"];
// @ts-expect-error Property 'push' does not exist on type 'readonly string[]'.
tags.push("node");
```

**Assignability Direction:** A mutable array is assignable to a read-only array because a read-only array promises *fewer* operations. However, a read-only array is **never** assignable to a mutable array:

```typescript
function logItems(items: readonly string[]) { console.log(items.join(", ")); }
function sortInPlace(items: string[]) { items.sort(); }

const mutable = ["b", "a"];
const immutable: readonly string[] = ["b", "a"];

logItems(mutable);    // OK: mutable fulfills all readonly requirements
// @ts-expect-error Type 'readonly string[]' is 'readonly' and cannot be assigned to mutable type 'string[]'.
sortInPlace(immutable);
```

### `Object.freeze` vs. `as const` & Unsafe Tuples

| Feature | `Object.freeze(val)` | `val as const` |
| :--- | :--- | :--- |
| **Execution** | Runtime JS function call | Compile-time type assertion (0 bytes JS) |
| **Depth** | Shallow at runtime | Deeply recursive at type level |
| **Type Narrowing** | Retains widened types (`string`, `number`) | Narrows primitives to exact literal types |
| **Tuples** | Retains standard array inference (`T[]`) | Converts array literals to `readonly` tuples |

```typescript
// Unsafe Array Inference
const coords = [40.7128, -74.0060];
//    ^? const coords: number[]
coords.push(999); // Valid number[], but invalid 2D coordinate!

// Safe Tuple Inference with `as const`
const safeCoords = [40.7128, -74.0060] as const;
//    ^? const safeCoords: readonly [40.7128, -74.006]
```

### Standard Library Gaps & `@total-typescript/ts-reset`

In standard TypeScript, `Array.prototype.includes` fails on `readonly` arrays when checking against wider types:

```typescript
const ALLOWED_METHODS = ["GET", "POST"] as const;
function validate(m: string) {
  // @ts-expect-error Argument of type 'string' is not assignable to parameter of type '"GET" | "POST"'.
  return ALLOWED_METHODS.includes(m);
}
```
Importing `@total-typescript/ts-reset` fixes this global typing rule, making `.includes()` accept candidate strings safely.

### Improving Async Function Return Inference
When returning status tuples from async operations, use `as const` to preserve tuple discrimination:

```typescript
async function fetchToken(success: boolean) {
  if (success) return ["ok", "jwt_token_xyz"] as const;
  return ["err", new Error("Unauthorized")] as const;
}

async function run() {
  const [status, payload] = await fetchToken(true);
  if (status === "ok") {
    console.log(payload.toUpperCase()); // payload is narrowed to string!
  }
}
```

---

## Lesson 5.2: Classes in TypeScript

TypeScript classes compile directly to ECMAScript classes while providing static typing, member visibility, and compile-time contract enforcement.

### Class Anatomy & Member Visibility

```typescript
class BankAccount {
  public readonly accountNumber: string;
  public balance: number = 0;
  protected interestRate: number = 0.05;
  private auditLogSecret: string = "secret_audit";

  constructor(accountNumber: string, initialBalance: number = 0) {
    this.accountNumber = accountNumber;
    this.balance = initialBalance;
  }

  public deposit(amount: number): void {
    if (amount <= 0) throw new Error("Amount must be positive");
    this.balance += amount;
  }

  get isOverdrawn(): boolean { return this.balance < 0; }
  set overdrawnRate(rate: number) { this.interestRate = rate; }
}
```
- `public` (default): Accessible from any scope.
- `protected`: Accessible within the declaring class and its subclasses.
- `private`: Accessible only inside the declaring class at compile time.

### TypeScript `private` vs. ECMAScript `#private` Hard Fields

TypeScript's `private` keyword is **purely compile-time**. When compiled to JavaScript, `private` members become normal public properties:

```typescript
class TsSecret {
  private key = "compile_time_only";
}
const s = new TsSecret();
console.log((s as any).key); // "compile_time_only" (accessible at runtime!)
```

Modern ECMAScript introduces `#private` fields, which are enforced by the JavaScript engine runtime:

```typescript
class HardSecret {
  #key = "runtime_hard_private";

  public verify(candidate: string): boolean {
    return this.#key === candidate;
  }
}
const h = new HardSecret();
// @ts-expect-error Property '#key' is not accessible outside class 'HardSecret' because it has a private identifier.
h.#key; // Throws a runtime SyntaxError in native JavaScript if executed outside the class!
```

> [!IMPORTANT]
> Use `#private` whenever you need true runtime encapsulation (e.g. library secrets, tokens, or security boundaries). Use TypeScript's `private` only when targeting legacy JavaScript engines that do not support ES2022 private fields.

### `extends`, `super()`, `implements`, and `override`

When creating class hierarchies, contracts should be strictly enforced using `implements` and `override`:

```typescript
interface CacheDriver<T> {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
}

abstract class BaseCache<T> implements CacheDriver<T> {
  #store = new Map<string, T>();

  public get(key: string): T | undefined { return this.#store.get(key); }
  public set(key: string, value: T): void { this.#store.set(key, value); }
}

class InstrumentedCache<T> extends BaseCache<T> {
  public hitCount = 0;

  // `override` requires "noImplicitOverride": true in tsconfig.json
  public override get(key: string): T | undefined {
    const val = super.get(key);
    if (val !== undefined) this.hitCount++;
    return val;
  }

  // If you mistype a method name with `override`, TypeScript catches it immediately:
  // @ts-expect-error This member cannot have an 'override' modifier because it is not declared in the base class.
  public override purge(): void {}
}
```

### Typing `this`

How `this` is *bound* at runtime (call-site rules, arrow functions, `bind`) is taught in `languages/javascript`. TypeScript adds three typing tools:

- **`this` parameters.** A first parameter named `this` declares the required receiver and is erased: `function shout(this: { name: string })`. Calling it without a matching receiver is a compile error, and under `noImplicitThis` (part of `strict`) an unannotated `this` in a function is an error rather than `any`.
- **Polymorphic `this` types.** A method returning `this` returns the type of the *receiver*, so fluent chains on subclasses keep subclass methods (`new UserRepo().save(u).count()` in the example).
- **`ThisType<T>`** in an object literal's contextual type sets the type of `this` inside its methods (used by Vue's options API and builder DSLs).

### Abstract classes, `override` and `accessor`

- `abstract` classes cannot be instantiated; `abstract` members must be implemented by concrete subclasses. Unlike interfaces, they can carry implementation and `protected` state.
- `override` (with `noImplicitOverride`) marks members that replace a base member. A typo in an overriding name becomes **TS4113** instead of silently adding a new method.
- `accessor name = value` (TS 4.9+, TC39 decorators proposal) declares an auto-accessor: a private storage slot plus a getter/setter pair. It exists mainly as a decoration target ([Module 10](./10-type-safe-api-design-patterns.md)); like decorators, Node 26 does not execute it natively.

---

## Lesson 5.3: TypeScript-Only Features & Why to Avoid Them

Early versions of TypeScript introduced syntax extensions that emit custom JavaScript runtime code. In modern TypeScript, the general rule is: **prefer standard ECMAScript features over TypeScript-only syntax**.

### 1. Parameter Properties
```typescript
class UserService {
  constructor(public db: Database, private token: string) {}
}
```
*Why to Avoid:* Parameter properties introduce non-standard JavaScript syntax into constructor signatures, complicating build tooling (Babel, SWC, esbuild) and obscuring class field declarations.

### 2. Numeric Enums & Reverse Mapping
```typescript
enum Direction {
  Up = 0,
  Down = 1,
}
```
TypeScript emits a reverse-mapping object at runtime:
```javascript
var Direction;
(function (Direction) {
  Direction[Direction["Up"] = 0] = "Up";
  Direction[Direction["Down"] = 1] = "Down";
})(Direction || (Direction = {}));
```
*Why to Avoid:*
- Reverse mapping doubles object size in runtime memory (`Direction[0] === "Up"`).
- Prior to TypeScript 5.0, arbitrary numbers could be assigned without a type error (`const d: Direction = 999;`).

### 3. String Enums & Nominal Typing
```typescript
enum Role { Admin = "ADMIN", User = "USER" }
function assign(r: Role) {}

// @ts-expect-error Argument of type '"ADMIN"' is not assignable to parameter of type 'Role'.
assign("ADMIN"); // Fails because string enums are nominally typed!
```

### 4. `const enum` & `isolatedModules`
`const enum` inlines literal values at call sites to eliminate runtime code generation. However, modern bundlers (Vite, Next.js, esbuild, SWC) compile files in isolation (`"isolatedModules": true`). Without full AST knowledge across files, transpilers cannot inline `const enum` values, resulting in runtime `ReferenceError` crashes.

### 5. Namespaces
`namespace` (formerly internal modules) was created before ES modules existed. Modern codebases must use standard ECMAScript modules (`import` / `export`).

---

### Then vs now: TS-only syntax and `erasableSyntaxOnly`

**Then (TS 1.x–5.7).** `enum`, `namespace`, parameter properties and `import x = require()` were idiomatic; TypeScript emitted the runtime code, and tools like Babel/esbuild re-implemented the transforms (except `const enum` across files).

**Now (TS 5.8+ `erasableSyntaxOnly`; Node 23.6+/22.18+ type stripping by default; Node 26 rejects these constructs with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`).** Code meant to run by stripping types must avoid all four constructs. `tsc` 7.0 still compiles them when the flag is off: they are discouraged, not removed. `declare enum`/`declare namespace` (ambient, no emit) remain allowed.

**Migration.**
1. Turn on `erasableSyntaxOnly`; every violation is TS1294 ([Module 01](./01-toolchain-and-compiler-model.md)).
2. Enums → `as const` objects plus a derived union type (below). Numeric enums used as bit flags → `as const` objects of numbers.
3. Parameter properties → explicit fields assigned in the constructor.
4. Value namespaces → modules; `import x = require()` → `import`.

**Pitfalls.** String enums are **nominal** (a raw `"ADMIN"` is not a `Role.Admin`), while the `as const` replacement is structural, so API consumers that passed string literals start compiling where they did not before, which is usually desired. Code that iterated `Object.values(NumericEnum)` relied on reverse mappings (and got both names and numbers); the `as const` object has no reverse mapping.

### The Modern Standard: `as const` Object + Union Pattern

```typescript
// 1. Runtime single source of truth (plain, tree-shakeable JS object)
export const STATUS = {
  Pending: "pending",
  Active: "active",
  Archived: "archived",
} as const;

// 2. Derive the union of values: "pending" | "active" | "archived"
export type Status = (typeof STATUS)[keyof typeof STATUS];

// 3. Derive the union of keys: "Pending" | "Active" | "Archived"
export type StatusKey = keyof typeof STATUS;
```

#### Why This Pattern is Superior:
1. **Zero Runtime Bloat:** Emits a standard, lightweight JavaScript object literal.
2. **Structural Typing:** Accepts raw strings (`"pending"`) without forcing consumers to import an enum object.
3. **Bundler Compatible:** 100% compatible with `isolatedModules: true`, Vite, Next.js, esbuild, and SWC.
4. **Standard Iteration:** Works seamlessly with `Object.values(STATUS)` and `Object.keys(STATUS)`.

---

## Lesson 5.4: Deriving Types from Values

In well-architected TypeScript codebases, runtime constants serve as the single source of truth, and types are derived dynamically.

### Value Space vs. Type Space

TypeScript maintains two parallel worlds:
- **Value Space:** Code that exists after compilation into JavaScript (variables, functions, classes).
- **Type Space:** Code that is completely erased at compile time (interfaces, type aliases).

```typescript
const AppEnv = { dev: "DEV", prod: "PROD" }; // Value space
type AppEnv = typeof AppEnv;                 // Type space (Valid to share name!)
```

### `typeof`, `keyof`, and `keyof typeof`

The type-level `typeof` operator inspects a runtime value identifier and extracts its type:

```typescript
const appConfig = {
  host: "localhost",
  port: 8080,
  debug: true,
};

type AppConfig = typeof appConfig;
// type AppConfig = { host: string; port: number; debug: boolean }

type ConfigKey = keyof typeof appConfig;
// type ConfigKey = "host" | "port" | "debug"
```

### Indexed Access Types

Indexed access (`T[K]`) extracts property types using bracket notation:

```typescript
type ApiResponse = {
  data: {
    user: { id: string; email: string };
    roles: string[];
  };
};

type UserData = ApiResponse["data"]["user"];
// type UserData = { id: string; email: string }

// Indexing with a union extracts a union of property types:
type UserFields = ApiResponse["data"]["user"]["id" | "email"];
// type UserFields = string

// Indexing arrays with [number] extracts element types:
const SUPPORTED_LOCALES = ["en-US", "fr-FR", "es-ES"] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];
// type Locale = "en-US" | "fr-FR" | "es-ES"

// Extracting all values from an as const object:
const COLOR_PALETTE = { primary: "#0070f3", success: "#0070f3" } as const;
type ColorValue = (typeof COLOR_PALETTE)[keyof typeof COLOR_PALETTE];
```

### Deriving Types from Functions and Classes

TypeScript provides built-in utilities to extract types from callable values:

```typescript
function initServer(port: number, verbose: boolean) {
  return { port, verbose, startedAt: new Date() };
}

type ServerParams = Parameters<typeof initServer>;   // [port: number, verbose: boolean]
type ServerInstance = ReturnType<typeof initServer>;  // { port: number; verbose: boolean; startedAt: Date }

// Async return extraction:
async function loadUserData(id: string) {
  return { id, role: "admin" as const };
}
type UserResult = Awaited<ReturnType<typeof loadUserData>>; // { id: string; role: "admin" }

// Deriving instance type from classes:
class SocketPool {
  public static defaultLimit = 10;
  public connect() { return true; }
}

type SocketPoolConstructor = typeof SocketPool;     // Constructor with static limit
type SocketPoolInstance = InstanceType<typeof SocketPool>; // Instance with .connect()
```

---

## Anti-Patterns vs. Best Practices

| Anti-Pattern | Best Practice | Rationale |
| :--- | :--- | :--- |
| `enum Status { Active, Inactive }` | `const STATUS = { ... } as const` | Avoids reverse mapping, isolated module failures, and nominal type traps. |
| Type assertions like `data as Config` | `as const` or `satisfies Config` | Preserves real immutability and literal types without masking structural errors. |
| `private secret: string` for secrets | `#secret: string` | TS `private` is erased at runtime; `#` fields are enforced by the JS engine. |
| Duplicate types alongside constant objects | Derive types with `typeof` & `keyof` | Single source of truth prevents type drift when constants are updated. |
| Mutable array `const coords = [10, 20]` | `const coords = [10, 20] as const` | Prevents runtime array mutation and out-of-bounds index bugs. |

```typescript
// Comparison Example:
// ANTI-PATTERN: String enum prevents passing raw matching strings
enum HttpMethod { Get = "GET", Post = "POST" }
function send(m: HttpMethod) {}
// @ts-expect-error Argument of type '"GET"' is not assignable to parameter of type 'HttpMethod'
send("GET");

// BEST PRACTICE: as const object allows structural matching
const HTTP_METHOD = { Get: "GET", Post: "POST" } as const;
type HttpMethodType = (typeof HTTP_METHOD)[keyof typeof HTTP_METHOD];
function sendSafe(m: HttpMethodType) {}
sendSafe("GET"); // Clean, idiomatic, and fully type-safe!
```

---

## Hands-On Exercises & Step-by-Step Solutions

```typescript
// Total TypeScript verification test helpers
export type Expect<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
```

### Exercise 5.1: The Type-Safe Route Registry
**Problem:** Derive the route keys and route paths from an immutable routing configuration without duplicating strings in manual type declarations.

```typescript
const APP_ROUTES = {
  home: "/",
  users: "/users",
  userDetail: "/users/:id",
  postDetail: "/posts/:category/:slug",
} as const;

// Solution:
export type RouteKey = keyof typeof APP_ROUTES;
export type RoutePath = (typeof APP_ROUTES)[RouteKey];

// Type verification tests:
type test_Key = Expect<Equal<RouteKey, "home" | "users" | "userDetail" | "postDetail">>;
type test_Path = Expect<Equal<RoutePath, "/" | "/users" | "/users/:id" | "/posts/:category/:slug">>;
```

---

### Exercise 5.2: Entity Repository with `#private` State & `override`
**Problem:** Implement an abstract base repository and a subclass enforcing contract adherence with `implements`, genuine runtime privacy with `#private`, and override verification with `override`.

```typescript
interface Entity { id: string; }
interface Repository<T extends Entity> {
  findById(id: string): T | undefined;
  save(entity: T): void;
}

export abstract class BaseRepository<T extends Entity> implements Repository<T> {
  #store = new Map<string, T>();

  public findById(id: string): T | undefined {
    return this.#store.get(id);
  }
  public save(entity: T): void {
    this.#store.set(entity.id, entity);
  }
}

export interface User extends Entity { id: string; username: string; }

export class UserRepository extends BaseRepository<User> {
  public queryCount = 0;

  public override findById(id: string): User | undefined {
    this.queryCount++;
    return super.findById(id);
  }
}

// Type verification test:
const repo = new UserRepository();
repo.save({ id: "u_1", username: "alice" });
const result = repo.findById("u_1");
type test_Result = Expect<Equal<typeof result, User | undefined>>;
```

---

### Exercise 5.3: Refactoring Legacy Enums to `as const` Objects
**Problem:** Refactor a legacy numeric HTTP status enum to the `as const` pattern, derive value and key union types, and implement a type-safe status name lookup helper.

```typescript
// Solution:
export const HTTP_STATUS = {
  Ok: 200,
  Created: 201,
  BadRequest: 400,
  Unauthorized: 401,
  NotFound: 404,
} as const;

export type HttpStatus = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];
export type HttpStatusName = keyof typeof HTTP_STATUS;

export function getStatusName(status: HttpStatus): HttpStatusName | undefined {
  const match = Object.entries(HTTP_STATUS).find(([_, code]) => code === status);
  return match ? (match[0] as HttpStatusName) : undefined;
}

// Type verification tests:
type test_Status = Expect<Equal<HttpStatus, 200 | 201 | 400 | 401 | 404>>;
type test_StatusName = Expect<Equal<HttpStatusName, "Ok" | "Created" | "BadRequest" | "Unauthorized" | "NotFound">>;
```

---

### Exercise 5.4: Dynamic Event Dispatcher & Payload Extraction
**Problem:** From a dictionary of event action handlers, extract the union of event names and derive the parameter payload type for each event dynamically using `Parameters<T>`.

```typescript
const eventHandlers = {
  LOGIN: (payload: { userId: string; timestamp: number }) => true,
  UPDATE_ROLE: (payload: { userId: string; newRole: "admin" | "editor" }) => true,
  LOGOUT: (payload: { userId: string }) => true,
};

// Solution:
export type EventName = keyof typeof eventHandlers;
export type EventPayload<K extends EventName> = Parameters<(typeof eventHandlers)[K]>[0];

export function dispatch<K extends EventName>(event: K, payload: EventPayload<K>): boolean {
  const handler = eventHandlers[event] as (p: EventPayload<K>) => boolean;
  return handler(payload);
}

// Type verification tests:
type test_LoginPayload = Expect<
  Equal<EventPayload<"LOGIN">, { userId: string; timestamp: number }>
>;
type test_RolePayload = Expect<
  Equal<EventPayload<"UPDATE_ROLE">, { userId: string; newRole: "admin" | "editor" }>
>;
```

---

## Module Summary & Cheat Sheet

### Mutability & Widening Rules
- `const x = "val"` produces literal `"val"`. `const obj = { k: "val" }` widens `k` to `string`.
- `as const` produces deep compile-time immutability, literal inference, and fixed-length read-only tuples.
- `Readonly<T>` is strictly shallow.
- `readonly T[]` strips all mutating methods (`push`, `pop`, `splice`). Mutable arrays can be assigned to `readonly` arrays, but not vice-versa.

### Modern Classes
- Prefer `#field` over TS `private` when true runtime encapsulation is required.
- Enable `noImplicitOverride: true` and decorate overridden methods with `override`.
- Use `implements` to enforce public instance contracts.

### Modern Alternative to TS-Only Features
- Avoid `enum`, `const enum`, `namespace`, and parameter properties.
- Use the modern standard:
  ```typescript
  export const MAP = { A: "a", B: "b" } as const;
  export type MapValues = (typeof MAP)[keyof typeof MAP];
  ```

### Deriving Types
- `typeof expr`: lifts runtime value into type space.
- `keyof T`: extracts keys of object type `T`.
- `T[K]`: indexes property `K` of type `T`.
- `(typeof ARRAY)[number]`: extracts union of array elements.
- `(typeof OBJ)[keyof typeof OBJ]`: extracts union of object values.
- `Parameters<typeof fn>` & `ReturnType<typeof fn>`: extracts function argument and return types.
- `InstanceType<typeof Class>`: extracts instance type from class constructors.

---

## Interview Drill

<details><summary>1. Why does <code>{ mode: "dark" }</code> infer <code>mode: string</code>, and what are the fixes?</summary>

Object properties are mutable, so literal types widen to their base type. Fixes: `as const` (literal and `readonly`), a literal-typed annotation, `satisfies` with a literal-typed target, or a `const` type parameter in a helper function ([Module 07](./07-generics-and-inference.md)).
</details>

<details><summary>2. <code>private</code> vs <code>#private</code>?</summary>

`private` is a compile-time check, erased; the property exists, is enumerable and reachable through casts or `obj["x"]`. `#private` is an ECMAScript private name enforced by the runtime, invisible to `Object.keys`, and enables `#x in obj` brand checks. `#private` also makes classes nominal: two classes with the same `#field` are not assignable to each other.
</details>

<details><summary>3. Why avoid <code>enum</code> today?</summary>

It emits runtime code (not erasable, so Node type stripping rejects it), numeric enums have reverse mappings and weak typing history, string enums are nominal, and `const enum` breaks under isolated transpilation. The `as const` object plus union gives the same autocompletion with plain JavaScript.
</details>

<details><summary>4. What does a method returning <code>this</code> give you?</summary>

Polymorphic `this`: the return type is the receiver's type, so a chain started on a subclass keeps subclass members. Returning the class name instead would lose them after the first call.
</details>

<details><summary>5. Is <code>readonly T[]</code> assignable to <code>T[]</code>? Why not?</summary>

No: a `T[]` parameter could be mutated by the callee, violating the caller's read-only view. The reverse is allowed. Accept `readonly T[]` in parameters so callers can pass both.
</details>

<details><summary>6. What does <code>noImplicitOverride</code> catch?</summary>

Members that override a base member without `override` (silent shadowing), and `override` on a member that does not exist in the base (TS4113), which catches renames in base classes.
</details>
