/**
 * Module 08 — SSR, request isolation and server functions.
 * Runs in the vitest "server" project: node environment, server export
 * conditions, SSR codegen (isServer === true), real @solidjs/web server build.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createMemo, Loading } from "solid-js";
import { renderToString, renderToStream, isServer, getRequestEvent, markSafeError, redirect } from "@solidjs/web";
import { provideRequestEvent } from "@solidjs/web/storage";
import {
  registerServerFunction,
  handleServerFunctionRequest,
  configureServerFunctionsServer,
} from "@solidjs/web/server-functions/server";
import { configureServerFunctionsClient, createServerReference } from "@solidjs/web/server-functions/client";

const ORIGIN = "http://app.example.com";
/** How the fake transport stamps requests; tests flip it to simulate a cross-site caller. */
let site: { secFetchSite: string; origin?: string } = { secFetchSite: "same-origin" };
let lastResponse: Response | undefined;

beforeAll(() => {
  // Server: run every call inside a request-event scope (what start mode wires for you).
  configureServerFunctionsServer({ provideEvent: provideRequestEvent });
  // Client transport: instead of the network, hand the request straight to the
  // real handler, stamped the way a same-origin browser fetch is.
  configureServerFunctionsClient({
    fetch: (address: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      headers.set("sec-fetch-site", site.secFetchSite);
      if (site.origin) headers.set("origin", site.origin);
      return handleServerFunctionRequest(new Request(new URL(address, ORIGIN), { ...init, headers })).then((res) => {
        lastResponse = res.clone();
        return res;
      });
    },
  });
});

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("08 · server rendering", () => {
  it("the server posture: isServer is true and JSX renders to an HTML string", () => {
    expect(isServer).toBe(true);
    const html = renderToString(() => (
      <p class={{ active: true }} data-n={2}>
        hi {1 + 1}
      </p>
    ));
    expect(html).toBe('<p class="active" data-n="2">hi 2</p>');
  });

  it("renderToString escapes untrusted text", () => {
    const evil = "<img src=x onerror=alert(1)>";
    expect(renderToString(() => <p>{evil}</p>)).toBe("<p>&lt;img src=x onerror=alert(1)></p>");
  });

  it("renderToStream flushes the shell with the fallback first, then streams the resolved content", async () => {
    const chunks: string[] = [];
    const stream = renderToStream(() => {
      const data = createMemo(async () => {
        await wait(5);
        return "late data";
      });
      return (
        <main>
          <Loading fallback={<i>loading</i>}>
            <b>{data()}</b>
          </Loading>
        </main>
      );
    });
    await new Promise<void>((resolve) => stream.pipe({ write: (c) => chunks.push(c), end: () => resolve() }));
    const all = chunks.join("");
    expect(chunks.length).toBeGreaterThan(1); // shell, then later fragments
    expect(chunks[0]).toContain("loading"); // fallback in the first flush
    expect(all).toContain("late data"); // content streamed in afterwards
  });

  it("awaiting renderToStream yields the fully settled HTML", async () => {
    const html = await renderToStream(() => {
      const data = createMemo(async () => {
        await wait(1);
        return "settled";
      });
      return (
        <Loading fallback={<i>…</i>}>
          <b>{data()}</b>
        </Loading>
      );
    });
    expect(html).toContain("<b>settled</b>");
  });
});

describe("08 · request isolation", () => {
  it("negative: module-scope state leaks between concurrent requests", async () => {
    let currentUser = ""; // ❌ module scope = shared by every request in the process
    async function handle(user: string, delay: number) {
      currentUser = user;
      return renderToStream(() => {
        const greeting = createMemo(async () => {
          await wait(delay);
          return `hello ${currentUser}`;
        });
        return (
          <Loading fallback="…">
            <p>{greeting()}</p>
          </Loading>
        );
      });
    }
    const [a, b] = await Promise.all([handle("alice", 10), handle("bob", 1)]);
    expect(a).toContain("hello bob"); // alice was served bob's data
    expect(b).toContain("hello bob");
  });

  it("per-request state through the request event stays isolated", async () => {
    async function handle(user: string, delay: number) {
      const event = { request: new Request(`${ORIGIN}/`), locals: { user } };
      return provideRequestEvent(event as never, () =>
        renderToStream(() => {
          const greeting = createMemo(async () => {
            const who = (getRequestEvent()!.locals as { user: string }).user; // read before await
            await wait(delay);
            return `hello ${who}`;
          });
          return (
            <Loading fallback="…">
              <p>{greeting()}</p>
            </Loading>
          );
        }),
      );
    }
    const [a, b] = await Promise.all([handle("alice", 10), handle("bob", 1)]);
    expect(a).toContain("hello alice");
    expect(b).toContain("hello bob");
  });
});

describe("08 · server functions (real client transport → real handler)", () => {
  it("a registered function round-trips arguments and results through the wire codec", async () => {
    registerServerFunction("math#add", async (a: number, b: number) => a + b);
    const add = createServerReference("math#add") as unknown as (a: number, b: number) => Promise<number>;
    await expect(add(2, 3)).resolves.toBe(5);
  });

  it("results are encoded with the seroval codec (Date, Map survive); arguments are JSON unless rich args are enabled", async () => {
    registerServerFunction("clock#now", async () => ({ when: new Date("2026-10-28T12:00:00Z"), tags: new Map([["a", 1]]) }));
    const now = createServerReference("clock#now") as unknown as () => Promise<{ when: Date; tags: Map<string, number> }>;
    const out = await now();
    expect(out.when).toBeInstanceOf(Date);
    expect(out.tags.get("a")).toBe(1);

    registerServerFunction("echo#rich", async (v: unknown) => v);
    const echo = createServerReference("echo#rich") as unknown as (v: unknown) => Promise<unknown>;
    // Arguments default to plain JSON: a Date argument is refused before sending.
    await expect(echo(new Date())).rejects.toThrow(/enableRichArguments/);
  });

  it("validates untrusted input at the boundary (Standard Schema shape)", async () => {
    // A minimal Standard Schema v1 validator; zod/valibot/arktype expose the same `~standard` key.
    const Title = {
      "~standard": {
        version: 1 as const,
        vendor: "example",
        validate: (v: unknown) =>
          typeof v === "string" && v.length > 0 ? { value: v } : { issues: [{ message: "title required" }] },
      },
    };
    registerServerFunction("todos#create", async (input: unknown) => {
      const result = Title["~standard"].validate(input);
      if ("issues" in result) return { ok: false as const, issues: result.issues };
      return { ok: true as const, title: result.value };
    });
    const create = createServerReference("todos#create") as unknown as (i: unknown) => Promise<unknown>;
    await expect(create("")).resolves.toEqual({ ok: false, issues: [{ message: "title required" }] });
    await expect(create("Buy milk")).resolves.toEqual({ ok: true, title: "Buy milk" });
  });

  it("the call runs inside a request-event scope", async () => {
    registerServerFunction("whoami#url", async () => new URL(getRequestEvent()!.request.url).pathname);
    const whoami = createServerReference("whoami#url") as unknown as () => Promise<string>;
    await expect(whoami()).resolves.toMatch(/^\/_server/);
  });

  it("a cross-site request without an allowlisted origin is refused (CSRF default)", async () => {
    let ran = false;
    registerServerFunction("danger#delete", async () => {
      ran = true;
      return "deleted";
    });
    const del = createServerReference("danger#delete") as unknown as () => Promise<string>;
    site = { secFetchSite: "cross-site", origin: "https://evil.example.net" };
    try {
      await expect(del()).rejects.toThrow();
    } finally {
      site = { secFetchSite: "same-origin" };
    }
    expect(ran).toBe(false); // the function body never executed
    expect(lastResponse!.status).toBe(403);
  });

  it("non-POST methods are refused for functions that did not declare GET", async () => {
    registerServerFunction("write#only", async () => "x");
    const res = await handleServerFunctionRequest(
      new Request(`${ORIGIN}/_server/data/write%23only`, { method: "GET", headers: { "sec-fetch-site": "same-origin" } }),
    );
    expect(res.status).toBe(405);
  });

  it("markSafeError content reaches the client; redirect() is control flow, not an error", async () => {
    registerServerFunction("errors#safe", async () => {
      throw markSafeError(new Error("Title already taken"));
    });
    const safe = createServerReference("errors#safe") as unknown as () => Promise<never>;
    await expect(safe()).rejects.toThrow("Title already taken");

    registerServerFunction("nav#login", async () => {
      throw redirect("/login");
    });
    const login = createServerReference("nav#login") as unknown as () => Promise<unknown>;
    await login().catch(() => undefined); // the client transport consumes the redirect
    expect(lastResponse!.status).toBeLessThan(500);
    const headerDump = JSON.stringify([...lastResponse!.headers.entries()]);
    expect(headerDump).toContain("/login"); // forwarded as redirect metadata, not as an error body
  });
});
