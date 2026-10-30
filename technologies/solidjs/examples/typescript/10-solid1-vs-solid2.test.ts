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

describe("10 · props and stores, then vs now", () => {
  it("defaults: mergeProps (1.x) skips undefined, merge (2.0) lets it override", () => {
    expect(v1.mergeProps({ size: "md" }, { size: undefined }).size).toBe("md");
    expect(v2.merge({ size: "md" }, { size: undefined }).size).toBeUndefined();
  });

  it("splitProps (1.x) vs omit (2.0)", () => {
    const props = { a: 1, b: 2, c: 3 };
    const [local, rest] = v1.splitProps(props, ["a"]);
    expect(local).toEqual({ a: 1 });
    expect(rest).toEqual({ b: 2, c: 3 });
    const rest2 = v2.omit(props, "a");
    expect("a" in rest2).toBe(false);
    expect(rest2.b).toBe(2);
  });

  // Note: solid-js@1.9's `solid-js/store` entry imports the bare specifier "solid-js",
  // which resolves to 2.0 in this project, so 1.x stores cannot be loaded side by side.
  // Store then-vs-now is covered in modules 05 and 10 as prose plus the 2.0-side tests.
  it("2.0 store updates are draft-first and staged until flush", () => {
    const [s2, set2] = v2.createStore({ user: { name: "A" }, todos: [{ done: false }, { done: true }] });
    set2((d) => {
      d.user.name = "B";
      for (const t of d.todos) if (!t.done) t.done = true;
    });
    expect(s2.user.name).toBe("A");
    v2.flush();
    expect(s2.user.name).toBe("B");
    expect(s2.todos.every((t) => t.done)).toBe(true);
    expect("unwrap" in v2).toBe(false);
  });

  it("selection: createSelector (1.x) and a projection (2.0) both notify only the two affected keys", () => {
    let runs1 = 0;
    const r1 = v1.createRoot((dispose) => {
      const [sel, setSel] = v1.createSignal(0);
      const isSelected = v1.createSelector(sel);
      for (let i = 0; i < 100; i++) v1.createComputed(() => (runs1++, isSelected(i)));
      return { setSel, dispose };
    });
    runs1 = 0;
    r1.setSel(50);
    expect(runs1).toBe(2);
    r1.dispose();

    let runs2 = 0;
    const r2 = v2.createRoot((dispose) => {
      const [sel, setSel] = v2.createSignal(0);
      const selected = v2.createProjection<Record<number, boolean>>((d) => {
        for (const k of Object.keys(d)) delete d[Number(k)];
        d[sel()] = true;
      }, {});
      for (let i = 0; i < 100; i++) v2.createMemo(() => (runs2++, selected[i] === true));
      return { setSel, dispose };
    });
    runs2 = 0;
    r2.setSel(50);
    v2.flush();
    expect(runs2).toBe(2);
    r2.dispose();
  });

  it("async: createResource exposes loading/undefined (1.x); 2.0 has no createResource", async () => {
    let resolve!: (v: string) => void;
    const r = v1.createRoot((dispose) => {
      const [data] = v1.createResource(() => new Promise<string>((res) => (resolve = res)));
      return { data, dispose };
    });
    expect(r.data.loading).toBe(true);
    expect(r.data()).toBeUndefined(); // the `T | undefined` loading hole
    resolve("x");
    await new Promise((res) => setTimeout(res, 0));
    expect(r.data()).toBe("x");
    r.dispose();
    expect("createResource" in v2).toBe(false);
  });
});
