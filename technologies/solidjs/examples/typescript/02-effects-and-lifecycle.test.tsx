/**
 * Module 02 — Effects, lifecycle and invariants (real solid-js rc.19 dev build).
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  createSignal,
  createMemo,
  createEffect,
  createRenderEffect,
  createTrackedEffect,
  createReaction,
  createRoot,
  createStore,
  flush,
  onCleanup,
  onSettled,
  onFlush,
  untrack,
  resetErrorHalt,
} from "solid-js";
import { render } from "@solidjs/testing-library";
import { captureDiagnostics, tick } from "./support/diagnostics.ts";

afterEach(() => resetErrorHalt());

describe("02 · split effects: compute tracks, apply acts", () => {
  it("createEffect: compute runs at creation, apply runs at the flush; cleanup precedes the next apply", () => {
    const log: string[] = [];
    const { setCount, dispose } = createRoot((dispose) => {
      const [count, setCount] = createSignal(0);
      createEffect(
        () => {
          log.push(`compute ${count()}`);
          return count();
        },
        (value, prev) => {
          log.push(`apply ${value} (prev ${prev})`);
          return () => log.push(`cleanup ${value}`);
        },
      );
      return { setCount, dispose };
    });
    expect(log).toEqual(["compute 0"]); // apply has not run yet
    flush();
    expect(log).toEqual(["compute 0", "apply 0 (prev undefined)"]);
    setCount(1);
    flush();
    expect(log.slice(2)).toEqual(["compute 1", "cleanup 0", "apply 1 (prev 0)"]);
    dispose();
    expect(log.at(-1)).toBe("cleanup 1");
  });

  it("createRenderEffect applies synchronously at creation (render phase)", () => {
    const log: string[] = [];
    const dispose = createRoot((dispose) => {
      const [title] = createSignal("a");
      createRenderEffect(
        () => title(),
        (v) => {
          log.push(`render ${v}`);
        },
      );
      createEffect(
        () => title(),
        (v) => {
          log.push(`user ${v}`);
        },
      );
      return dispose;
    });
    expect(log).toEqual(["render a"]);
    flush();
    expect(log).toEqual(["render a", "user a"]);
    dispose();
  });

  it("reads in the apply half are not tracked", () => {
    let applies = 0;
    const { setUntrackedSource, dispose } = createRoot((dispose) => {
      const [tracked] = createSignal(0);
      const [untrackedSource, setUntrackedSource] = createSignal(0);
      createEffect(
        () => tracked(),
        () => {
          applies++;
          untrackedSource(); // read in apply: no subscription
        },
      );
      return { setUntrackedSource, dispose };
    });
    flush();
    setUntrackedSource(1);
    flush();
    expect(applies).toBe(1);
    dispose();
  });

  it("effects never compare: an equal compute result still re-runs apply and cleanup", () => {
    const log: string[] = [];
    const { setStatus, dispose } = createRoot((dispose) => {
      const [status, setStatus] = createSignal("active");
      createEffect(
        () => status() !== "off", // stays true for "active" → "busy"
        (on) => {
          log.push(`start ${on}`);
          return () => log.push("stop");
        },
      );
      return { setStatus, dispose };
    });
    flush();
    setStatus("busy");
    flush();
    expect(log).toEqual(["start true", "stop", "start true"]); // torn down and restarted
    dispose();
  });

  it("…a memo in front adds the equality cut-off", () => {
    const log: string[] = [];
    const { setStatus, dispose } = createRoot((dispose) => {
      const [status, setStatus] = createSignal("active");
      const on = createMemo(() => status() !== "off");
      createEffect(
        () => on(),
        (v) => {
          log.push(`start ${v}`);
          return () => log.push("stop");
        },
      );
      return { setStatus, dispose };
    });
    flush();
    setStatus("busy");
    flush();
    expect(log).toEqual(["start true"]);
    dispose();
  });

  it("defer: true skips the initial apply", () => {
    const log: number[] = [];
    const { setCount, dispose } = createRoot((dispose) => {
      const [count, setCount] = createSignal(0);
      createEffect(
        () => count(),
        (v) => {
          log.push(v);
        },
        { defer: true },
      );
      return { setCount, dispose };
    });
    flush();
    expect(log).toEqual([]);
    setCount(1);
    flush();
    expect(log).toEqual([1]);
    dispose();
  });

  it("compute receives prev; a default parameter seeds the first run", () => {
    const seen: number[] = [];
    const { setX, dispose } = createRoot((dispose) => {
      const [x, setX] = createSignal(1);
      createEffect<number>(
        (prev = 100) => {
          seen.push(prev);
          return x();
        },
        () => {},
      );
      return { setX, dispose };
    });
    setX(2);
    flush();
    expect(seen).toEqual([100, 1]);
    dispose();
  });

  it("the error arm catches compute-phase errors (EffectBundle)", () => {
    const log: string[] = [];
    const { setX, dispose } = createRoot((dispose) => {
      const [x, setX] = createSignal(0);
      createEffect(
        () => {
          if (x() > 0) throw new Error("boom");
          return x();
        },
        {
          effect: (v) => {
            log.push(`ok ${v}`);
          },
          error: (err) => {
            log.push(`error ${(err as Error).message}`);
          },
        },
      );
      return { setX, dispose };
    });
    flush();
    setX(1);
    flush();
    expect(log).toEqual(["ok 0", "error boom"]);
    dispose();
  });

  it("writes in the apply half are legal and land in the same flush continuation", () => {
    const { mirror, setSource, dispose } = createRoot((dispose) => {
      const [source, setSource] = createSignal(1);
      const [mirror, setMirror] = createSignal(0);
      createEffect(
        () => source(),
        (v) => {
          setMirror(v * 2); // apply half is an unowned, writable scope
        },
      );
      return { mirror, setSource, dispose };
    });
    flush();
    expect(mirror()).toBe(2);
    setSource(5);
    flush();
    expect(mirror()).toBe(10);
    dispose();
  });
});

describe("02 · specialised effects", () => {
  it("createReaction fires once per arm", () => {
    const log: string[] = [];
    const { setX, rearm, dispose } = createRoot((dispose) => {
      const [x, setX] = createSignal(0);
      const track = createReaction(() => {
        log.push("changed");
      });
      const rearm = () => track(() => x());
      rearm();
      return { setX, rearm, dispose };
    });
    setX(1);
    flush();
    setX(2);
    flush(); // not armed any more
    expect(log).toEqual(["changed"]);
    rearm();
    setX(3);
    flush();
    expect(log).toEqual(["changed", "changed"]);
    dispose();
  });

  it("createTrackedEffect (deprecated, migration aid) tracks inside its single callback", () => {
    const log: string[] = [];
    const { setX, dispose } = createRoot((dispose) => {
      const [x, setX] = createSignal(0);
      createTrackedEffect(() => {
        log.push(`run ${x()}`);
        return () => {
          log.push("cleanup");
        };
      });
      return { setX, dispose };
    });
    flush();
    setX(1);
    flush();
    expect(log).toEqual(["run 0", "cleanup", "run 1"]);
    dispose();
  });
});

describe("02 · lifecycle: onSettled, onCleanup, onFlush", () => {
  it("onSettled runs after the first settle; its returned cleanup runs on disposal", () => {
    const log: string[] = [];
    const dispose = createRoot((dispose) => {
      onSettled(() => {
        log.push("settled");
        return () => log.push("teardown");
      });
      log.push("body");
      return dispose;
    });
    expect(log).toEqual(["body"]);
    flush();
    expect(log).toEqual(["body", "settled"]);
    dispose();
    expect(log).toEqual(["body", "settled", "teardown"]);
  });

  it("onSettled may write (it is an effect-phase scope)", () => {
    const { ready, dispose } = createRoot((dispose) => {
      const [ready, setReady] = createSignal(false);
      onSettled(() => {
        setReady(true);
      });
      return { ready, dispose };
    });
    flush();
    expect(ready()).toBe(true);
    dispose();
  });

  it("negative: onCleanup inside onSettled is CLEANUP_IN_FORBIDDEN_SCOPE", () => {
    let thrown: unknown;
    const dispose = createRoot((dispose) => {
      onSettled(() => {
        try {
          onCleanup(() => {});
        } catch (e) {
          thrown = e;
        }
      });
      return dispose;
    });
    flush();
    expect(String(thrown)).toMatch(/CLEANUP_IN_FORBIDDEN_SCOPE/);
    dispose();
  });

  it("negative: primitives cannot be created inside onSettled (PRIMITIVE_IN_FORBIDDEN_SCOPE)", () => {
    let thrown: unknown;
    const dispose = createRoot((dispose) => {
      onSettled(() => {
        try {
          createMemo(() => 1);
        } catch (e) {
          thrown = e;
        }
      });
      return dispose;
    });
    flush();
    expect(String(thrown)).toMatch(/PRIMITIVE_IN_FORBIDDEN_SCOPE/);
    dispose();
  });

  it("onFlush runs after the scheduled flush, as its own update; in an owned scope it warns", async () => {
    const log: string[] = [];
    // from an "event handler" (no owner):
    const [n, setN] = createSignal(0);
    const [open, setOpen] = createSignal(true);
    setN(1);
    onFlush(() => {
      log.push(`onFlush sees n=${n()}`);
      setOpen(false); // its own update, after the frame's inline writes
    });
    expect(log).toEqual([]);
    await tick(3);
    expect(log).toEqual(["onFlush sees n=1"]);
    expect(open()).toBe(false);

    const { codes } = captureDiagnostics(() =>
      createRoot((dispose) => {
        onFlush(() => {});
        dispose();
      }),
    );
    expect(codes).toContain("ON_FLUSH_IN_OWNED_SCOPE");
  });
});

describe("02 · invariants and diagnostics (negative tests)", () => {
  it("single-argument createEffect is MISSING_EFFECT_FN", () => {
    expect(() =>
      createRoot((dispose) => {
        try {
          (createEffect as unknown as (fn: () => void) => void)(() => {});
        } finally {
          dispose();
        }
      }),
    ).toThrow(/MISSING_EFFECT_FN/);
  });

  it("flush() inside an effect callback is FLUSH_IN_EFFECT_CALLBACK", () => {
    let outcome = "no-error";
    const { codes } = captureDiagnostics(() => {
      const dispose = createRoot((dispose) => {
        const [x] = createSignal(0);
        createEffect(
          () => x(),
          () => {
            try {
              flush();
            } catch (e) {
              outcome = String(e);
            }
          },
        );
        return dispose;
      });
      flush();
      dispose();
    });
    expect(codes.includes("FLUSH_IN_EFFECT_CALLBACK") || /FLUSH_IN_EFFECT_CALLBACK/.test(outcome)).toBe(true);
  });

  it("effects created with no owner warn NO_OWNER_EFFECT", () => {
    const { codes } = captureDiagnostics(() => {
      const [x] = createSignal(0);
      createEffect(
        () => x(),
        () => {},
      );
    });
    expect(codes).toContain("NO_OWNER_EFFECT");
  });

  it("onCleanup with no owner warns NO_OWNER_CLEANUP (and never runs)", () => {
    const { codes } = captureDiagnostics(() => onCleanup(() => {}));
    expect(codes).toContain("NO_OWNER_CLEANUP");
  });

  it("a top-level reactive read in a component body warns STRICT_READ_UNTRACKED", () => {
    function Title(props: { title: string }) {
      const t = props.title; // ❌ read once, at setup
      return <h1>{t}</h1>;
    }
    const { codes } = captureDiagnostics(() => {
      const [title] = createSignal("hello");
      const r = render(() => <Title title={title()} />);
      r.unmount();
    });
    expect(codes).toContain("STRICT_READ_UNTRACKED");
  });

  it("untrack marks an intentional one-time read (no warning)", () => {
    function Title(props: { title: string }) {
      const t = untrack(() => props.title);
      return <h1>{t}</h1>;
    }
    const { codes } = captureDiagnostics(() => {
      const [title] = createSignal("hello");
      const r = render(() => <Title title={title()} />);
      r.unmount();
    });
    expect(codes).not.toContain("STRICT_READ_UNTRACKED");
  });

  it("reading a store proxy in the apply half warns; extract values in compute instead", () => {
    const bad = captureDiagnostics(() => {
      const dispose = createRoot((dispose) => {
        const [store] = createStore({ user: { name: "Ada" } });
        createEffect(
          () => store.user,
          (user) => {
            void user.name; // ❌ untracked proxy read
          },
        );
        return dispose;
      });
      flush();
      dispose();
    });
    expect(bad.codes).toContain("STRICT_READ_UNTRACKED");

    const good = captureDiagnostics(() => {
      const dispose = createRoot((dispose) => {
        const [store] = createStore({ user: { name: "Ada" } });
        createEffect(
          () => ({ name: store.user.name }), // ✅ plain values
          (v) => {
            void v.name;
          },
        );
        return dispose;
      });
      flush();
      dispose();
    });
    expect(good.codes).not.toContain("STRICT_READ_UNTRACKED");
  });
});
