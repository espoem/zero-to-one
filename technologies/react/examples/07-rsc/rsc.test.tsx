// @vitest-environment node
/**
 * Module 07 — Server Components & Flight. The server half runs in a child process with
 * `--conditions react-server` (see server.ts); this file is the client half.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createRequire } from "node:module";
import { createContext, use, isValidElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { createFromNodeStream, encodeReply } from "react-server-dom-webpack/client.node";
import { rows, runServer, toStream } from "./flight.ts";

// ---------------------------------------------------------------------------------------------
// The "client bundle": what webpack would load for each client reference id.
// ---------------------------------------------------------------------------------------------
const UserContext = createContext("anonymous");
const clientModules: Record<string, Record<string, unknown>> = {
  "client/counter.js": {
    Counter({ start, label }: { start: number; label: ReactNode }) {
      return (
        <button>
          {label} {start}
        </button>
      );
    },
  },
  "client/user.js": {
    UserContext,
    Greeting() {
      return <p>hello {use(UserContext)}</p>;
    },
  },
};
const g = globalThis as Record<string, unknown>;
beforeAll(() => {
  g.__webpack_require__ = (id: string) => clientModules[id];
  g.__webpack_chunk_load__ = () => Promise.resolve();
});
afterAll(() => {
  delete g.__webpack_require__;
  delete g.__webpack_chunk_load__;
});
const moduleMap = Object.fromEntries(
  Object.entries(clientModules).map(([id, exports]) => [
    id,
    Object.fromEntries(Object.keys(exports).map((name) => [name, { id, chunks: [], name }])),
  ]),
);
const decode = <T,>(flight: string) =>
  createFromNodeStream<T>(toStream(flight), { moduleMap, serverModuleMap: null, moduleLoading: null });

describe("the Flight protocol", () => {
  test("a server tree streams as rows: client reference (I), Suspense symbol, model, late chunk", async () => {
    const { stdout, code } = await runServer(["tree"]);
    expect(code).toBe(0);
    const r = rows(stdout);
    // Row shapes are version-specific (19.3 outlines repeated strings like the module id).
    expect(r).toContain('2:I["$1",[],"Counter"]');
    expect(r).toContain('3:"$Sreact.suspense"');
    const root = r.find((x) => x.startsWith("0:"))!;
    expect(root).toContain('["$","h1",null,{"children":"RSC"}]');
    expect(root).toContain('"$L2"'); // lazy reference to the client component
    expect(root).toContain('"children":"$L4"'); // the async Server Component is a hole…
    expect(r.at(-1)).toBe('4:["$","p",null,{"children":"loaded on the server"}]'); // …filled later
    // The async component's code and the label JSX were rendered on the server; only data shipped.
    expect(stdout).not.toContain("sleep");
  });

  test("the client decodes rows into React elements and renders client components from its own bundle", async () => {
    const { stdout } = await runServer(["tree"]);
    const tree = await decode<ReactNode>(stdout);
    expect(isValidElement(tree)).toBe(true);
    const html = renderToString(tree);
    expect(html).toContain("<h1>RSC</h1>");
    expect(html).toContain("<button><b>server-rendered label</b> <!-- -->3</button>");
    expect(html).toContain("loaded on the server");
  });

  test("rich values survive the boundary: Date, Map, Set, BigInt, undefined, NaN, -0, ±Infinity, bytes, Promise", async () => {
    const { stdout } = await runServer(["values"]);
    expect(stdout).toContain('"date":"$D2026-10-28T00:00:00.000Z"');
    expect(stdout).toContain('"big":"$n18446744073709551616"');
    expect(stdout).toContain('"later":"$@'); // a promise is a reference to a future row
    const el = await decode<{ props: { values: Record<string, unknown> } }>(stdout);
    const v = el.props.values;
    expect(v.date).toEqual(new Date("2026-10-28T00:00:00Z"));
    expect(v.map).toEqual(new Map([["k", 1]]));
    expect(v.set).toEqual(new Set(["a"]));
    expect(v.big).toBe(2n ** 64n);
    expect(v.undef).toBeUndefined();
    expect("undef" in v).toBe(false); // observed in 19.3.1: the key itself is absent after decoding
    expect(Number.isNaN(v.nan)).toBe(true);
    expect(Object.is(v.negZero, -0)).toBe(true);
    expect(v.inf).toBe(-Infinity);
    expect(v.bytes).toEqual(new Uint8Array([1, 2, 3]));
    await expect(v.later as Promise<string>).resolves.toBe("resolved later");
  });

  test("NEGATIVE: a plain function prop cannot cross to a Client Component", async () => {
    const { stderr } = await runServer(["function-prop"]);
    expect(stderr).toMatch(/Event handlers cannot be passed to Client Component props/);
  });

  test("NEGATIVE: class instances (e.g. a DB pool) cannot cross the boundary", async () => {
    const { stderr } = await runServer(["class-prop"]);
    expect(stderr).toMatch(/Only plain objects, and a few built-ins, can be passed to Client Components/);
  });

  test("a Server Function crosses as a reference ($h), never as code", async () => {
    const { stdout } = await runServer(["server-reference"]);
    expect(stdout).toContain('{"id":"server/notes.js#deleteNote","bound":null}');
    expect(stdout).toContain('"onDelete":"$h');
    expect(stdout).not.toContain("async function");
  });

  test("19.3: a Server Component renders a client Context as its provider", async () => {
    const { stdout } = await runServer(["context"]);
    const html = renderToString(await decode<ReactNode>(stdout));
    expect(html).toBe("<p>hello <!-- -->ada</p>");
  });
});

describe("cache() and cacheSignal() (server only)", () => {
  test("cache dedupes within one request; cacheSignal is null outside a render and aborts after it", async () => {
    const { stdout } = await runServer(["cache"]);
    expect(JSON.parse(stdout)).toEqual({
      log: ["db hit 1"], // two components, one fetch
      outsideRenderIsNull: true,
      abortedAfterRender: true,
    });
  });
});

describe("Server Functions are public endpoints", () => {
  test("arguments are whatever the request body says (encodeReply ↔ decodeReply round trip)", async () => {
    const body = await encodeReply(["n2"]);
    expect(typeof body).toBe("string");
    const { stdout } = await runServer(["decode-reply", "unsafe"], body as string);
    expect(JSON.parse(stdout).args).toEqual(["n2"]);
  });

  test("NEGATIVE (IDOR): an action without an authorization check deletes another user's note", async () => {
    // The UI only ever shows alice her own notes. The attacker just POSTs bob's id.
    const { stdout } = await runServer(["decode-reply", "unsafe"], (await encodeReply(["n2"])) as string);
    expect(JSON.parse(stdout).remaining).toEqual(["n1"]); // bob's note is gone
  });

  test("the action re-checks input and ownership on the server", async () => {
    const forged = await runServer(["decode-reply", "safe"], (await encodeReply(["n2"])) as string);
    expect(JSON.parse(forged.stdout)).toMatchObject({ error: "forbidden", remaining: ["n1", "n2"] });
    const wrongType = await runServer(["decode-reply", "safe"], (await encodeReply([{ $ne: null }])) as string);
    expect(JSON.parse(wrongType.stdout)).toMatchObject({ error: "bad input" });
  });
});

describe("security patch level (CVE-2025-55182 and follow-ups)", () => {
  /** First version on each release line that fixes every RSC advisory published so far (see module 07 §8). */
  const SAFE_FLOOR: Record<string, number> = { "19.0": 8, "19.1": 9, "19.2": 8 }; // after CVE-2026-44907

  function isPatched(version: string): boolean {
    const [maj, min, patch] = version.split(".").map(Number) as [number, number, number];
    if (maj !== 19) return maj > 19;
    if (min >= 3) return true; // 19.3.0 (2026-09-09) shipped after every advisory listed in module 07 §8
    const floor = SAFE_FLOOR[`19.${min}`];
    return floor !== undefined && patch >= floor;
  }

  test("the version gate itself: vulnerable versions are rejected", () => {
    expect(isPatched("19.2.0")).toBe(false); // CVE-2025-55182 (RCE)
    expect(isPatched("19.2.1")).toBe(false); // RCE fixed, DoS/source-exposure not
    expect(isPatched("19.2.5")).toBe(false); // CVE-2026-23870 not fixed
    expect(isPatched("19.2.7")).toBe(false); // CVE-2026-44907 not fixed
    expect(isPatched("19.2.8")).toBe(true);
    expect(isPatched("19.0.7")).toBe(false);
    expect(isPatched("19.1.9")).toBe(true);
    expect(isPatched("19.3.1")).toBe(true);
  });

  test("the installed react-server-dom-webpack is at or above the patched floor", () => {
    const require = createRequire(import.meta.url);
    const { version } = require("react-server-dom-webpack/package.json") as { version: string };
    expect(isPatched(version)).toBe(true);
    // react, react-dom and react-server-dom-* must be the exact same version.
    expect(require("react/package.json").version).toBe(version);
    expect(require("react-dom/package.json").version).toBe(version);
  });
});
