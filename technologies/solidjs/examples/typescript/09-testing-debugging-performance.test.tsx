/**
 * Module 09 — Testing, debugging and performance tooling.
 */
import { describe, it, expect, afterEach } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createSignal, createMemo, createEffect, createRoot, flush, OBSERVE } from "solid-js";
import { attribution, subscriptions } from "solid-js/attribution";
import { render, screen, cleanup, fireEvent } from "@solidjs/testing-library";
import { enablePerformanceTracks } from "@solidjs/web/performance-tracks";
import { captureDiagnostics } from "./support/diagnostics.ts";

afterEach(() => cleanup());

// Vitest runs from the track root (where vitest.config.ts lives); import.meta.url is not a file: URL under jsdom.
const trackRoot = process.cwd();

describe("09 · component tests with @solidjs/testing-library", () => {
  function Counter(props: { start: number }) {
    const [n, setN] = createSignal(props.start);
    return (
      <button type="button" onClick={() => setN((v) => v + 1)}>
        clicked {n()}
      </button>
    );
  }

  it("render takes a function; query by role; flush (or await) before asserting", () => {
    render(() => <Counter start={1} />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("clicked 1");
    fireEvent.click(button);
    expect(button.textContent).toBe("clicked 1"); // the write is queued…
    flush();
    expect(button.textContent).toBe("clicked 2"); // …and committed
  });

  it("findBy* queries wait across microtasks, so they also see committed updates", async () => {
    render(() => <Counter start={5} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("clicked 6")).toBeTruthy();
  });
});

describe("09 · build variants are export conditions", () => {
  const probe = (conditions: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, [...conditions, "examples/typescript/support/build-variant-probe.mjs"], {
        cwd: trackRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    ) as { resolved: string; dev: boolean; observe: boolean; ownedWrite: string };

  it("dev: diagnostics live, invariants throw", () => {
    const r = probe(["--conditions=browser", "--conditions=development"]);
    expect(r).toEqual({ resolved: "solid-js/dist/solid.dev.js", dev: true, observe: true, ownedWrite: "throws" });
  });

  it("observe: production speed, diagnostics channel kept, no dev guards", () => {
    const r = probe(["--conditions=browser", "--conditions=observe"]);
    expect(r).toEqual({ resolved: "solid-js/dist/solid.observe.js", dev: false, observe: true, ownedWrite: "allowed" });
  });

  it("production: no DEV/OBSERVE objects and the owned-write guard is compiled out", () => {
    const r = probe(["--conditions=browser"]);
    expect(r).toEqual({ resolved: "solid-js/dist/solid.js", dev: false, observe: false, ownedWrite: "allowed" });
  });

  it("plain Node resolves the server build (a test runner without the plugin silently tests SSR code)", () => {
    expect(probe([]).resolved).toBe("solid-js/dist/server.js");
  });

  it("this Vitest client project runs the dev build", () => {
    expect(OBSERVE).toBeDefined();
  });
});

describe("09 · attribution: why did this run?", () => {
  it("an effect relaying one signal into another is reported as EFFECT_RELAY_TEAR", async () => {
    const off = attribution.enable();
    try {
      const { codes } = captureDiagnostics(() => {
        const r = createRoot((dispose) => {
          const [a, setA] = createSignal(1, { name: "a" });
          const [b, setB] = createSignal(0, { name: "b" });
          createEffect(
            () => a(),
            (v) => {
              setB(v * 2); // ❌ relay: derive with a memo instead
            },
          );
          const sum = createMemo(() => a() + b(), { name: "sum" });
          createEffect(
            () => sum(),
            () => {},
          );
          return { setA, dispose, sum };
        });
        flush();
        for (let i = 2; i < 6; i++) {
          r.setA(i);
          flush();
        }
        expect(subscriptions(r.sum)).toEqual(["a", "b"]); // devtools-style dependency view
        r.dispose();
      });
      expect(codes).toContain("EFFECT_RELAY_TEAR");
    } finally {
      off();
    }
  });
});

describe("09 · performance tracks and version pinning", () => {
  it("performance tracks are an opt-in adapter from @solidjs/web/performance-tracks", () => {
    expect(typeof enablePerformanceTracks).toBe("function");
  });

  it("installed RC versions match the exact pins (RC churn guard)", () => {
    const pkg = JSON.parse(readFileSync(join(trackRoot, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };
    for (const name of ["solid-js", "@solidjs/web", "@solidjs/signals"]) {
      const pinned = pkg.dependencies[name]!;
      expect(pinned).toMatch(/^\d+\.\d+\.\d+-rc\.\d+$/); // exact, never ^2.0.0-rc
      const installed = JSON.parse(readFileSync(join(trackRoot, "node_modules", name, "package.json"), "utf8")) as {
        version: string;
      };
      expect(installed.version).toBe(pinned);
    }
  });
});
