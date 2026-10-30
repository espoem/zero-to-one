/**
 * Module 07 — the SERVER half. Runs in its own Node process with the `react-server`
 * export condition (the "server module graph"):
 *
 *   NODE_ENV=production node --conditions react-server examples/07-rsc/server.ts <scenario>
 *
 * Writes the Flight stream (or a JSON report) to stdout. The test file spawns this script
 * and decodes the output with the CLIENT half of react-server-dom-webpack.
 * No bundler is involved: client and server references are registered by hand, which is
 * exactly what a bundler plugin generates for "use client" / "use server" modules.
 */
import { Suspense, cache, cacheSignal, createElement as h, type ReactNode } from "react";
import {
  decodeReply,
  registerClientReference,
  registerServerReference,
  renderToPipeableStream,
} from "react-server-dom-webpack/server";

const scenario = process.argv[2] ?? "tree";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** What a bundler emits for `export function Counter` in a "use client" module. */
function clientRef<T>(id: string, name: string): T {
  return registerClientReference(
    () => {
      throw new Error(`${name} is a Client Component and cannot be called on the server`);
    },
    id,
    name,
  ) as T;
}
const Counter = clientRef<(p: { start: number; label: ReactNode }) => ReactNode>("client/counter.js", "Counter");
const UserContext = clientRef<object>("client/user.js", "UserContext");
const Greeting = clientRef<() => ReactNode>("client/user.js", "Greeting");

/**
 * The client manifest (what webpack's RSC plugin writes): reference id → chunk metadata.
 * The client resolves `id` with __webpack_require__ and reads export `name`.
 */
export const clientManifest = {
  "client/counter.js#Counter": { id: "client/counter.js", chunks: [], name: "Counter" },
  "client/user.js#UserContext": { id: "client/user.js", chunks: [], name: "UserContext" },
  "client/user.js#Greeting": { id: "client/user.js", chunks: [], name: "Greeting" },
};

function render(node: ReactNode, onError?: (e: unknown) => string | void) {
  const { pipe } = renderToPipeableStream(node, clientManifest, { onError: onError ?? (() => "digest") });
  pipe(process.stdout);
}

switch (scenario) {
  case "tree": {
    // An async Server Component: awaits data directly; its code never reaches the client.
    async function Profile() {
      await sleep(5);
      return h("p", null, "loaded on the server");
    }
    function Page() {
      return h(
        "main",
        null,
        h("h1", null, "RSC"),
        h(Counter, { start: 3, label: h("b", null, "server-rendered label") }),
        h(Suspense, { fallback: h("i", null, "loading") }, h(Profile)),
      );
    }
    render(h(Page));
    break;
  }
  case "values": {
    // Values Flight can serialise, passed as props to a Client Component.
    render(
      h(Counter, {
        start: 1,
        label: null,
        // @ts-expect-error extra props for the demo
        values: {
          date: new Date("2026-10-28T00:00:00Z"),
          map: new Map([["k", 1]]),
          set: new Set(["a"]),
          big: 2n ** 64n,
          undef: undefined,
          nan: NaN,
          negZero: -0,
          inf: -Infinity,
          bytes: new Uint8Array([1, 2, 3]),
          later: sleep(5).then(() => "resolved later"),
          shared: "same",
        },
      }),
    );
    break;
  }
  case "function-prop": {
    // A plain function cannot cross the boundary.
    // @ts-expect-error demo
    render(h(Counter, { start: 1, label: null, onClick: () => {} }), (e) => {
      process.stderr.write(String((e as Error).message));
    });
    break;
  }
  case "class-prop": {
    class Pool {
      query() {}
    }
    // @ts-expect-error demo
    render(h(Counter, { start: 1, label: null, pool: new Pool() }), (e) => {
      process.stderr.write(String((e as Error).message));
    });
    break;
  }
  case "server-reference": {
    // What a bundler emits for `export async function deleteNote` in a "use server" module.
    async function deleteNote(_id: string) {}
    registerServerReference(deleteNote, "server/notes.js", "deleteNote");
    // @ts-expect-error demo
    render(h(Counter, { start: 1, label: null, onDelete: deleteNote }));
    break;
  }
  case "context": {
    // React 19.3: a Server Component renders a client Context as a provider directly.
    async function Layout() {
      const user = await Promise.resolve("ada");
      return h(UserContext as never, { value: user }, h(Greeting));
    }
    render(h(Layout));
    break;
  }
  case "cache": {
    // cache(): per-request memoisation; cacheSignal(): aborted when the render is done.
    const log: string[] = [];
    let signal: AbortSignal | null = null;
    const getUser = cache(async (id: string) => {
      log.push(`db hit ${id}`);
      signal = cacheSignal();
      return { id };
    });
    async function A() {
      return h("span", null, (await getUser("1")).id);
    }
    async function B() {
      return h("span", null, (await getUser("1")).id);
    }
    const outsideRender = cacheSignal();
    const { pipe } = renderToPipeableStream(h("div", null, h(A), h(B)), clientManifest);
    const sink = new (await import("node:stream")).PassThrough();
    sink.resume();
    sink.on("end", () => {
      setTimeout(() => {
        process.stdout.write(
          JSON.stringify({
            log,
            outsideRenderIsNull: outsideRender === null,
            abortedAfterRender: (signal as AbortSignal | null)?.aborted ?? null,
          }),
        );
      }, 10);
    });
    pipe(sink);
    break;
  }
  case "decode-reply": {
    // A Server Function endpoint: the request body is decoded into arguments.
    // The body arrives on stdin, exactly as an attacker could POST it.
    const notes = new Map([
      ["n1", { owner: "alice" }],
      ["n2", { owner: "bob" }],
    ]);
    const session = { user: "alice" };
    async function deleteNoteUnsafe(id: string) {
      notes.delete(id); // trusts the client: IDOR
    }
    async function deleteNoteSafe(id: unknown) {
      if (typeof id !== "string") throw new Error("bad input");
      const note = notes.get(id);
      if (!note || note.owner !== session.user) throw new Error("forbidden");
      notes.delete(id);
    }
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    const body = Buffer.concat(chunks).toString();
    const args = (await decodeReply(body, {})) as unknown[];
    const which = process.argv[3];
    let error: string | null = null;
    try {
      await (which === "safe" ? deleteNoteSafe : deleteNoteUnsafe)(args[0] as string);
    } catch (e) {
      error = (e as Error).message;
    }
    process.stdout.write(JSON.stringify({ args, remaining: [...notes.keys()], error }));
    break;
  }
  default:
    throw new Error(`unknown scenario ${scenario}`);
}
