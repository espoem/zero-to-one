/**
 * Module 10 — Solid 1.x vs 2.0, executed side by side.
 *
 * `solid-js-1` is an npm alias of solid-js@1.9.17 (the current 1.x `latest`), installed
 * ONLY for this comparison. Its core module imports nothing from `solid-js`, so the two
 * runtimes do not share state. Never do this in an app (see "Multiple Solid instances").
 */
import { describe, it, expect } from "vitest";
import * as v1 from "solid-js-1";
import * as v2 from "solid-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("10 · Then vs now, proved on both runtimes", () => {
  it("versions under test", () => {
    const v = (p: string) => (JSON.parse(readFileSync(join(process.cwd(), "node_modules", p, "package.json"), "utf8")) as { version: string }).version;
    expect(v("solid-js-1")).toBe("1.9.17");
    expect(v("solid-js")).toBe("2.0.0-rc.19");
  });

  it("read-after-write: 1.x is synchronous, 2.0 returns the committed value until flush", () => {
    const [a1, setA1] = v1.createSignal(0);
    setA1(1);
    expect(a1()).toBe(1);

    const [a2, setA2] = v2.createSignal(0);
    setA2(1);
    expect(a2()).toBe(0);
    v2.flush();
    expect(a2()).toBe(1);
  });

  it("batching: 1.x needs batch() to coalesce; 2.0 coalesces by default", () => {
    let runs1 = 0;
    const dispose1 = v1.createRoot((dispose) => {
      const [x, setX] = v1.createSignal(0);
      const [y, setY] = v1.createSignal(0);
      v1.createComputed(() => (runs1++, x() + y()));
      setX(1); // un-batched: re-runs immediately
      setY(1);
      v1.batch(() => {
        setX(2);
        setY(2);
      });
      return dispose;
    });
    expect(runs1).toBe(1 + 2 + 1);
    dispose1();

    let runs2 = 0;
    const r = v2.createRoot((dispose) => {
      const [x, setX] = v2.createSignal(0);
      const [y, setY] = v2.createSignal(0);
      v2.createMemo(() => (runs2++, x() + y()));
      return { setX, setY, dispose };
    });
    r.setX(1);
    r.setY(1);
    v2.flush();
    expect(runs2).toBe(1 + 1);
    r.dispose();
    expect("batch" in v2).toBe(false);
  });

  it("writes in a computation: allowed in 1.x (createComputed write-back), a dev error in 2.0", () => {
    const out = v1.createRoot((dispose) => {
      const [src, setSrc] = v1.createSignal(1);
      const [copy, setCopy] = v1.createSignal(0);
      v1.createComputed(() => setCopy(src() * 2)); // the 1.x write-back idiom
      setSrc(2);
      const value = copy();
      dispose();
      return value;
    });
    expect(out).toBe(4);
    expect(() =>
      v2.createRoot((dispose) => {
        const [, setCopy] = v2.createSignal(0);
        try {
          setCopy(1);
        } finally {
          dispose();
        }
      }),
    ).toThrow(/REACTIVE_WRITE_IN_OWNED_SCOPE/);
    expect("createComputed" in v2).toBe(false);
  });

  it("effects: 1.x single function tracks its whole body; 2.0 requires compute + apply", () => {
    const seen1: number[] = [];
    const r1 = v1.createRoot((dispose) => {
      const [n, setN] = v1.createSignal(0);
      v1.createRenderEffect(() => seen1.push(n()));
      return { setN, dispose };
    });
    r1.setN(1);
    expect(seen1).toEqual([0, 1]);
    r1.dispose();

    expect(() =>
      v2.createRoot((dispose) => {
        try {
          (v2.createEffect as unknown as (f: () => void) => void)(() => {});
        } finally {
          dispose();
        }
      }),
    ).toThrow(/MISSING_EFFECT_FN/);
  });

  it("nested roots: detached in 1.x, owned by the parent in 2.0", () => {
    const log1: string[] = [];
    const d1 = v1.createRoot((dispose) => {
      v1.createRoot(() => v1.onCleanup(() => log1.push("inner")));
      return dispose;
    });
    d1();
    expect(log1).toEqual([]); // 1.x: the inner root outlived its creator

    const log2: string[] = [];
    const d2 = v2.createRoot((dispose) => {
      v2.createRoot(() => v2.onCleanup(() => log2.push("inner")));
      return dispose;
    });
    d2();
    expect(log2).toEqual(["inner"]);
  });

  it("removed and renamed exports", () => {
    for (const gone of ["createResource", "onMount", "createSelector", "Suspense", "ErrorBoundary", "Index", "mergeProps", "splitProps", "startTransition", "useTransition", "on", "batch"]) {
      expect(gone in v1, `${gone} existed in 1.9`).toBe(true);
      expect(gone in v2, `${gone} must not exist in 2.0`).toBe(false);
    }
    for (const added of ["flush", "onSettled", "createProjection", "Loading", "Errored", "Reveal", "Repeat", "merge", "omit", "action", "createOptimistic", "createOptimisticStore", "isPending", "latest", "refresh", "affects", "until", "createStore", "snapshot", "deep", "reconcile"]) {
      expect(added in v2, `${added} must exist in 2.0`).toBe(true);
    }
  });
});
