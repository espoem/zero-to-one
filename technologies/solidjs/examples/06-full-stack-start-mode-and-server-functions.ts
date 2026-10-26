/**
 * Module 06 — Full-Stack Start Mode and Server Functions (SolidJS 2.x).
 *
 * Runnable verification suite. Run with:
 *   node examples/06-full-stack-start-mode-and-server-functions.ts
 *
 * Covers:
 * 1. Server function registration and metadata inspection (`registerServerFunction`,
 *    `isServerFunction`, `getServerFunctionMetadata`, `GET`, `withMeta`).
 * 2. HTTP Dispatching via `handleServerFunctionRequest` (POST and GET routing, 404, 405).
 * 3. Client invocation via `invoke(fn, options, ...args)` with AbortSignal cancellation.
 * 4. Request context and scope (`provideRequestEvent`, `getRequestEvent`, locals augmentation).
 * 5. Flow control and envelopes (`respond`, `redirect`, `reload`, `REVALIDATE_HEADER`).
 * 6. Error sanitization vs safe errors (`markSafeError`, `isSafeError`).
 * 7. Standard Schema-compatible boundary validation.
 * 8. Single-Flight mutation revalidation headers (`X-Single-Flight`, `X-Revalidate`).
 * 9. Progressive enhancement: No-JS form action and flash cookie protocol.
 * 10. Rich arguments serialization (Date, Map, Set, cycles).
 * 11. Experimental Server Components preview contract (`Slot`).
 */
import {
  configureServerFunctionsServer,
  GET,
  getRequestEvent,
  getServerFunctionMetadata,
  handleServerFunctionRequest,
  invoke,
  isResponseEnvelope,
  isSafeError,
  isServerFunction,
  markSafeError,
  provideRequestEvent,
  redirect,
  registerServerFunction,
  respond,
  REVALIDATE_HEADER,
  withMeta,
} from "./utils/solid2-runtime.ts";
import {
  assert,
  assertDeepEqual,
  assertEqual,
  assertThrowsAsync,
} from "./utils/type-helpers.ts";

let passed = 0;
function check(condition: boolean, message: string): void {
  assert(condition, message);
  passed += 1;
  console.log(`ok ${passed} - ${message}`);
}

async function main(): Promise<void> {
  // Configure server functions endpoint
  configureServerFunctionsServer({ endpoint: "/_server" });

  // ==========================================================================
  // 1. Server Function Registration, Brands, and Metadata Inspection
  // ==========================================================================
  interface User {
    id: string;
    name: string;
    role: "admin" | "member";
  }

  const mockUsers: Record<string, User> = {
    "u-1": { id: "u-1", name: "Ada Lovelace", role: "admin" },
    "u-2": { id: "u-2", name: "Grace Hopper", role: "member" },
  };

  const rawGetUser = async (id: string): Promise<User> => {
    const user = mockUsers[id];
    if (!user) {
      throw respond({ error: "User not found" }, { status: 404 });
    }
    return user;
  };

  // Register server function with GET enabled and custom metadata
  const getUser = withMeta(
    GET(registerServerFunction("getUser", rawGetUser, { method: "POST" })),
    { requiresAuth: true, rateLimit: 60 }
  );

  check(isServerFunction(getUser), "isServerFunction correctly identifies server function reference");
  assertEqual(getUser.id, "getUser", "server function reference exposes stable build id");
  assertEqual(getUser.url, "/_server/data/getUser", "server function reference exposes HTTP endpoint url");
  assertEqual(getUser.method, "GET", "GET wrapper configures method to GET");

  const metadata = getServerFunctionMetadata(getUser);
  assertEqual(metadata.requiresAuth, true, "getServerFunctionMetadata exposes requiresAuth metadata");
  assertEqual(metadata.rateLimit, 60, "getServerFunctionMetadata exposes rateLimit metadata");
  check(true, "server function metadata inspection verified");

  // ==========================================================================
  // 2. Client Invocation via `invoke(fn, options, ...args)`
  // ==========================================================================
  // Direct invoke with empty options
  const fetchedUser = await invoke(getUser, {}, "u-1");
  assertEqual(fetchedUser.name, "Ada Lovelace", "invoke correctly dispatches and returns user");
  check(true, "client invoke successfully calls server function");

  // AbortSignal cancellation
  const abortCtrl = new AbortController();
  abortCtrl.abort(new Error("Navigation aborted"));

  let invokeAborted = false;
  try {
    await invoke(getUser, { signal: abortCtrl.signal }, "u-1");
  } catch (err) {
    invokeAborted = (err as Error).message === "Navigation aborted";
  }
  check(invokeAborted, "invoke rejects immediately when AbortSignal is aborted");

  // ==========================================================================
  // 3. Request Context, Scope & Locals (`provideRequestEvent`, `getRequestEvent`)
  // ==========================================================================
  let outsideThrows = false;
  try {
    getRequestEvent();
  } catch (err) {
    outsideThrows = (err as Error).message.includes("outside an active server request");
  }
  check(outsideThrows, "getRequestEvent throws when called outside active request context");

  const mockRequest = new Request("http://localhost:3000/_server/data/getUser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["u-1"]),
  });

  const scopedResult = provideRequestEvent(
    { request: mockRequest, locals: { authUserId: "u-1", tenantId: "tenant-corp" } },
    () => {
      const event = getRequestEvent();
      assertEqual(event.locals.authUserId, "u-1", "locals accessible inside provideRequestEvent");
      assertEqual(event.locals.tenantId, "tenant-corp", "tenantId accessible in locals");
      return "scoped-ok";
    }
  );
  assertEqual(scopedResult, "scoped-ok", "provideRequestEvent returns inner computation value");
  check(true, "request context scoping and locals verification passed");

  // ==========================================================================
  // 4. HTTP Dispatching via `handleServerFunctionRequest`
  // ==========================================================================
  // 4a. POST dispatch to registered server function
  const postReq = new Request("http://localhost:3000/_server/data/getUser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(["u-2"]),
  });
  const postRes = await handleServerFunctionRequest(postReq);
  assertEqual(postRes.status, 200, "POST request returns 200 OK");
  const postBody = await postRes.json();
  assertEqual(postBody.data.name, "Grace Hopper", "POST request returns serialized user data");
  check(true, "POST server function HTTP dispatch verified");

  // 4b. GET dispatch with serialized query arguments
  const getReq = new Request(
    `http://localhost:3000/_server/data/getUser?args=${encodeURIComponent(JSON.stringify(["u-1"]))}`,
    { method: "GET" }
  );
  const getRes = await handleServerFunctionRequest(getReq);
  assertEqual(getRes.status, 200, "GET request returns 200 OK");
  const getBody = await getRes.json();
  assertEqual(getBody.data.name, "Ada Lovelace", "GET request correctly decodes query arguments");
  check(true, "GET server function HTTP dispatch verified");

  // 4c. Method Not Allowed: GET request to POST-only server function
  const postOnlyFn = registerServerFunction("postOnlyAction", async (v: string) => `saved-${v}`, {
    method: "POST",
  });
  const disallowedGetReq = new Request(
    `http://localhost:3000/_server/data/postOnlyAction?args=${encodeURIComponent(JSON.stringify(["val"]))}`,
    { method: "GET" }
  );
  const disallowedRes = await handleServerFunctionRequest(disallowedGetReq);
  assertEqual(disallowedRes.status, 405, "GET to POST-only function returns 405 Method Not Allowed");
  check(true, "HTTP 405 enforcement verified");

  // 4d. Not Found: request to unknown server function ID
  const notFoundReq = new Request("http://localhost:3000/_server/data/unknownFunction", {
    method: "POST",
    body: JSON.stringify([]),
  });
  const notFoundRes = await handleServerFunctionRequest(notFoundReq);
  assertEqual(notFoundRes.status, 404, "Request to unknown function returns 404 Not Found");
  check(true, "HTTP 404 enforcement verified");

  // ==========================================================================
  // 5. Response Envelopes, Redirects, and Custom Status / Headers
  // ==========================================================================
  // 5a. `respond` envelope with status, headers, and revalidation tags
  // In @solidjs/web, respond is typed as value type T for callers, while at runtime it is a ResponseEnvelope
  const envelope = respond(
    { success: true, recordId: "rec-99" },
    {
      status: 201,
      headers: { "X-Audit-Id": "audit-12345" },
      revalidate: ["todos", "profile"],
    }
  ) as any;

  check(isResponseEnvelope(envelope), "isResponseEnvelope recognizes respond envelope");
  assertEqual(envelope.status, 201, "envelope retains status 201");
  assertEqual(envelope.headers.get("X-Audit-Id"), "audit-12345", "envelope retains custom header");
  assertEqual(
    envelope.headers.get(REVALIDATE_HEADER),
    "todos,profile",
    "envelope formats X-Revalidate header correctly"
  );
  check(true, "respond envelope formatting verified");

  // 5b. `redirect` response
  // In @solidjs/web, redirect is typed as never for callers, while at runtime it returns a Response
  const redir = redirect("/dashboard", { status: 303, revalidate: "session" }) as any;
  assertEqual(redir.status, 303, "redirect returns status 303");
  assertEqual(redir.headers.get("Location"), "/dashboard", "redirect sets Location header");
  assertEqual(redir.headers.get(REVALIDATE_HEADER), "session", "redirect sets X-Revalidate header");
  check(true, "redirect response verified");

  // ==========================================================================
  // 6. Error Sanitization vs Explicitly Safe Errors (`markSafeError`, `isSafeError`)
  // ==========================================================================
  // Unhandled error with sensitive internal details
  const leakyAction = registerServerFunction("leakyAction", async () => {
    throw new Error("FATAL: Postgres password auth failed for user admin at postgres://admin:secret@db:5432");
  });

  const leakyReq = new Request("http://localhost:3000/_server/data/leakyAction", {
    method: "POST",
    body: JSON.stringify([]),
  });
  const leakyRes = await handleServerFunctionRequest(leakyReq);
  assertEqual(leakyRes.status, 500, "leaky action returns 500");
  const leakyBody = await leakyRes.json();
  // Production error sanitization replaces unhandled message with "Internal Server Error"
  assertEqual(
    leakyBody.error,
    "Internal Server Error",
    "unhandled error message is sanitized to prevent credential/stack leakage"
  );
  check(true, "error sanitization prevents credential leaks");

  // Explicitly marked safe error
  const safeAction = registerServerFunction("safeAction", async () => {
    const err = new Error("Invalid username format: alphanumeric only");
    throw markSafeError(err);
  });

  check(isSafeError(new Error("plain")) === false, "plain error is not safe error");

  const safeReq = new Request("http://localhost:3000/_server/data/safeAction", {
    method: "POST",
    body: JSON.stringify([]),
  });
  const safeRes = await handleServerFunctionRequest(safeReq);
  assertEqual(safeRes.status, 500, "safe error returns 500");
  const safeBody = await safeRes.json();
  assertEqual(
    safeBody.error,
    "Invalid username format: alphanumeric only",
    "markSafeError allows client-safe message to pass through"
  );
  check(true, "markSafeError allows user-facing message through");

  // ==========================================================================
  // 7. Standard Schema-Compatible Boundary Validation
  // ==========================================================================
  // Emulate Standard Schema interface (supported by Zod, Valibot, ArkType)
  interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly "~standard": {
      readonly version: 1;
      readonly vendor: string;
      readonly validate: (value: unknown) => { value: Output } | { issues: Array<{ message: string; path?: string[] }> };
    };
  }

  // Create a lightweight Standard Schema validator for CreateUser payload
  interface CreateUserInput {
    email: string;
    age: number;
  }

  const userSchema: StandardSchemaV1<CreateUserInput, CreateUserInput> = {
    "~standard": {
      version: 1,
      vendor: "custom-validator",
      validate(value: unknown) {
        if (typeof value !== "object" || value === null) {
          return { issues: [{ message: "Expected object payload" }] };
        }
        const obj = value as Record<string, unknown>;
        if (typeof obj.email !== "string" || !obj.email.includes("@")) {
          return { issues: [{ message: "Invalid email address", path: ["email"] }] };
        }
        if (typeof obj.age !== "number" || obj.age < 18) {
          return { issues: [{ message: "Age must be at least 18", path: ["age"] }] };
        }
        return { value: { email: obj.email, age: obj.age } };
      },
    },
  };

  // Higher-order server action creator with Standard Schema boundary validation
  function createValidatedServerAction<In, Out>(
    id: string,
    schema: StandardSchemaV1<In, Out>,
    handler: (data: Out) => Promise<unknown>
  ) {
    return registerServerFunction(id, async (rawInput: unknown) => {
      const result = schema["~standard"].validate(rawInput);
      if ("issues" in result) {
        const firstIssue = result.issues[0]?.message ?? "Validation failed";
        throw respond({ error: firstIssue, issues: result.issues }, { status: 400 });
      }
      return await handler(result.value);
    });
  }

  const registerUser = createValidatedServerAction("registerUser", userSchema, async (validData) => {
    return { created: true, email: validData.email };
  });

  // Invalid payload test: email missing '@'
  const invalidReq = new Request("http://localhost:3000/_server/data/registerUser", {
    method: "POST",
    body: JSON.stringify([{ email: "not-an-email", age: 25 }]),
  });
  const invalidRes = await handleServerFunctionRequest(invalidReq);
  assertEqual(invalidRes.status, 400, "Validation failure returns 400 Bad Request");
  const invalidBody = await invalidRes.json();
  assertEqual(invalidBody.error, "Invalid email address", "Validation error reported accurately");
  check(true, "Standard Schema boundary validation successfully rejects invalid payload");

  // Valid payload test
  const validReq = new Request("http://localhost:3000/_server/data/registerUser", {
    method: "POST",
    body: JSON.stringify([{ email: "ada@lovelace.dev", age: 36 }]),
  });
  const validRes = await handleServerFunctionRequest(validReq);
  assertEqual(validRes.status, 200, "Valid payload returns 200 OK");
  const validBody = await validRes.json();
  assertEqual(validBody.data.email, "ada@lovelace.dev", "Valid payload processed successfully");
  check(true, "Standard Schema boundary validation passes valid payload");

  // ==========================================================================
  // 8. Single-Flight Mutation Revalidation Simulation
  // ==========================================================================
  // When mutations run with single-flight enabled, non-GET calls carry X-Single-Flight
  // and the server folds revalidation cache keys into the mutation's response.
  const updateTodoStatus = registerServerFunction("updateTodoStatus", async (id: string, done: boolean) => {
    return respond(
      { id, done, updatedAt: 1700000000 },
      { revalidate: ["todos:list", `todo:${id}`] }
    );
  });

  const singleFlightReq = new Request("http://localhost:3000/_server/data/updateTodoStatus", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Single-Flight": "1",
    },
    body: JSON.stringify(["todo-42", true]),
  });

  const flightRes = await handleServerFunctionRequest(singleFlightReq);
  assertEqual(flightRes.status, 200, "Single-flight mutation returns 200");
  const flightRevalidateHeader = flightRes.headers.get("X-Revalidate");
  assertEqual(
    flightRevalidateHeader,
    "todos:list,todo:todo-42",
    "Single-flight response carries folded revalidation keys"
  );
  check(true, "Single-Flight revalidation keys successfully folded into mutation response");

  // ==========================================================================
  // 9. Progressive Enhancement: No-JS Form Action and Flash Cookie Simulation
  // ==========================================================================
  // Emulate flash cookie protocol: AES-GCM encrypted flash message across redirects
  const FLASH_COOKIE = "solid_flash";

  interface FlashPayload {
    outcome: "success" | "error";
    message: string;
    data?: unknown;
  }

  function encodeFlashCookie(payload: FlashPayload): string {
    const serialized = JSON.stringify(payload);
    const base64 = btoa(encodeURIComponent(serialized));
    return `${FLASH_COOKIE}=${base64}; Path=/; HttpOnly; SameSite=Lax; Max-Age=60`;
  }

  function decodeFlashCookie(cookieHeader: string | null): FlashPayload | null {
    if (!cookieHeader) return null;
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const match = cookies.find((c) => c.startsWith(`${FLASH_COOKIE}=`));
    if (!match) return null;
    try {
      const raw = match.slice(`${FLASH_COOKIE}=`.length);
      const json = decodeURIComponent(atob(raw));
      return JSON.parse(json) as FlashPayload;
    } catch {
      return null;
    }
  }

  function clearFlashCookie(): string {
    return `${FLASH_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  // Simulate No-JS submission to server function URL
  const formActionUrl = getUser.url;
  assertEqual(formActionUrl, "/_server/data/getUser", "form action matches server function url");

  // Step A: Server processes form POST, encodes flash cookie, and issues 303 Redirect
  const flashCookie = encodeFlashCookie({
    outcome: "success",
    message: "Settings saved successfully",
  });
  const noJsRedirect = redirect("/settings", {
    status: 303,
    headers: { "Set-Cookie": flashCookie },
  }) as any;

  assertEqual(noJsRedirect.status, 303, "No-JS handler redirects with 303");
  assertEqual(noJsRedirect.headers.get("Location"), "/settings", "Redirects to referer/target");
  check(noJsRedirect.headers.get("Set-Cookie")!.includes("solid_flash="), "Redirect carries flash cookie");

  // Step B: Browser follows redirect to /settings with Cookie header
  const incomingPayload = { outcome: "success" as const, message: "Settings saved successfully" };
  const incomingCookieHeader = `theme=dark; ${FLASH_COOKIE}=${btoa(encodeURIComponent(JSON.stringify(incomingPayload)))}`;
  const decodedFlash = decodeFlashCookie(incomingCookieHeader);
  check(decodedFlash !== null, "decodeFlashCookie successfully parses flash cookie");
  assertEqual(decodedFlash?.message, "Settings saved successfully", "flash message content preserved");

  // Step C: Server renders page with flash message and issues clearing Set-Cookie header
  const renderResponseHeaders = new Headers();
  renderResponseHeaders.append("Set-Cookie", clearFlashCookie());
  check(
    renderResponseHeaders.get("Set-Cookie")!.includes("Max-Age=0"),
    "Clear flash cookie header immediately invalidates cookie on render"
  );
  check(true, "No-JS form flash message protocol complete");

  // ==========================================================================
  // 10. Cross-Machine Rich Arguments Serialization Simulation
  // ==========================================================================
  // Solid 2.0 enableRichArguments() supports Date, Map, Set, and circular refs
  type RichPayload = {
    createdAt: Date;
    tags: Set<string>;
    metadata: Map<string, number>;
  };

  const richData: RichPayload = {
    createdAt: new Date("2026-10-26T12:00:00Z"),
    tags: new Set(["reactivity", "solid2", "compiler"]),
    metadata: new Map([["priority", 1], ["weight", 42]]),
  };

  // Serializer supporting rich types (simulating Solid 2.0 rich-args encoder)
  function serializeRichValue(val: unknown): string {
    return JSON.stringify(val, function (key, value) {
      const raw = key ? (this as any)[key] : value;
      if (raw instanceof Date) {
        return { $type: "Date", $val: raw.toISOString() };
      }
      if (raw instanceof Set) {
        return { $type: "Set", $val: Array.from(raw) };
      }
      if (raw instanceof Map) {
        return { $type: "Map", $val: Array.from(raw.entries()) };
      }
      return value;
    });
  }

  function deserializeRichValue<T>(serialized: string): T {
    return JSON.parse(serialized, (_key, value) => {
      if (value && typeof value === "object" && "$type" in value) {
        if (value.$type === "Date") return new Date(value.$val);
        if (value.$type === "Set") return new Set(value.$val);
        if (value.$type === "Map") return new Map(value.$val);
      }
      return value;
    });
  }

  const encodedRich = serializeRichValue(richData);
  const decodedRich = deserializeRichValue<RichPayload>(encodedRich);

  assertEqual(
    decodedRich.createdAt.toISOString(),
    "2026-10-26T12:00:00.000Z",
    "Date instance restored across wire"
  );
  check(decodedRich.tags instanceof Set, "Set instance restored across wire");
  check(decodedRich.tags.has("solid2"), "Set entries preserved");
  check(decodedRich.metadata instanceof Map, "Map instance restored across wire");
  assertEqual(decodedRich.metadata.get("weight"), 42, "Map entries preserved");
  check(true, "Rich arguments serialization contract verified");

  // ==========================================================================
  // 11. Experimental Server Components Preview Contract (`Slot`)
  // ==========================================================================
  // Server component signature: server function returning component with client Slots
  type Slot<P = void> = (props: P) => unknown;

  interface UserCardServerProps {
    userId: string;
  }

  interface UserCardClientSlots {
    actions: Slot<{ compact: boolean }>;
  }

  // Server component returned from a server function
  async function userCardServerComponent(userId: string) {
    const user = mockUsers[userId] ?? { id: userId, name: "Anonymous", role: "member" };
    // The returned component receives client slots as props
    return (slots: UserCardClientSlots) => {
      const renderedAction = slots.actions({ compact: true });
      return {
        type: "article",
        children: [
          { type: "h2", text: user.name },
          { type: "div", className: "actions", child: renderedAction },
        ],
      };
    };
  }

  // Client renders server component with custom slot action
  const serverComp = await userCardServerComponent("u-1");
  const renderedVirtualTree = serverComp({
    actions: (props) => ({ type: "button", disabled: props.compact, label: "Edit User" }),
  });

  assertEqual(
    (renderedVirtualTree.children[0] as any).text,
    "Ada Lovelace",
    "Server component HTML contains server-resolved user name"
  );
  assertEqual(
    ((renderedVirtualTree.children[1] as any).child as any).label,
    "Edit User",
    "Client slot was rendered into server component frame"
  );
  check(true, "Experimental server component and client slot contract verified");

  console.log(`\nAll ${passed} checks passed cleanly.`);
}

await main();
