// @vitest-environment jsdom
/**
 * Module 02 — Fiber reconciler & commit. Real react-dom@19.3.1 in jsdom.
 * Tests that touch fiber fields use ../_shared/internals.ts (private, version-pinned).
 */
import { afterEach, describe, expect, test, vi } from "vitest";
import fc from "fast-check";
import { Fragment, StrictMode, act, memo, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WorkTag, fiberOf, fiberRootOf, type Fiber } from "../_shared/internals.ts";
import { lisLength, reconcileKeyed } from "./keyed-diff.ts";

let roots: Root[] = [];
function mount(node: ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  act(() => root.render(node));
  return { container, root, rerender: (n: ReactNode) => act(() => root.render(n)) };
}
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
  document.body.innerHTML = "";
});

describe("the fiber tree is a linked structure: child / sibling / return", () => {
  function App() {
    return (
      <main>
        <h1>t</h1>
        <p>x</p>
      </main>
    );
  }

  test("pointers and work tags of a real fiber", () => {
    const { container } = mount(<App />);
    const main = fiberOf(container.querySelector("main")!);
    expect(main.tag).toBe(WorkTag.HostComponent);
    expect(main.type).toBe("main");
    const h1 = main.child!;
    expect(h1.type).toBe("h1");
    expect(h1.sibling!.type).toBe("p");
    expect(h1.sibling!.sibling).toBeNull();
    expect(h1.return).toBe(main);
    expect(h1.sibling!.index).toBe(1);
    // main's parent is the App function-component fiber, whose parent is the HostRoot.
    expect(main.return!.tag).toBe(WorkTag.FunctionComponent);
    expect(main.return!.type).toBe(App);
    expect(main.return!.return!.tag).toBe(WorkTag.HostRoot);
    // A function component has no host instance.
    expect(main.return!.stateNode).toBeNull();
    // A host fiber's stateNode IS the DOM node.
    expect(main.stateNode).toBe(container.querySelector("main"));
  });

  test("double buffering: FiberRoot.current alternates between exactly two HostRoot fibers", () => {
    const { container, rerender } = mount(<App />);
    const fiberRoot = fiberRootOf(container);
    const seen = new Set<Fiber>();
    let previous = fiberRoot.current;
    seen.add(previous);
    for (let i = 0; i < 4; i++) {
      rerender(<App key="same" />);
      const now = fiberRoot.current;
      expect(now).not.toBe(previous); // the work-in-progress tree became current
      expect(now.alternate).toBe(previous); // and the old current is its alternate
      seen.add(now);
      previous = now;
    }
    expect(seen.size).toBe(2);
  });
});

describe("identity = position + type + key", () => {
  function Counter({ label }: { label: string }) {
    const [n, setN] = useState(0);
    return (
      <button onClick={() => setN(n + 1)}>
        {label}:{n}
      </button>
    );
  }
  const click = (c: Element) => act(() => (c.querySelector("button") as HTMLButtonElement).click());

  test("same type at the same position keeps state across renders", () => {
    const { container, rerender } = mount(<Counter label="a" />);
    click(container);
    rerender(<Counter label="b" />);
    expect(container.textContent).toBe("b:1");
  });

  test("changing the element type at a position destroys state (div → section)", () => {
    const { container, rerender } = mount(
      <div>
        <Counter label="a" />
      </div>,
    );
    click(container);
    rerender(
      <section>
        <Counter label="a" />
      </section>,
    );
    expect(container.textContent).toBe("a:0");
  });

  test("changing the key resets state (the idiomatic reset)", () => {
    const { container, rerender } = mount(<Counter key="u1" label="a" />);
    click(container);
    rerender(<Counter key="u2" label="a" />);
    expect(container.textContent).toBe("a:0");
  });

  test("NEGATIVE: a component defined inside render is a new type every render → remount", () => {
    function Parent({ tick }: { tick: number }) {
      // Deliberate anti-pattern: a new component type on every render.
      const Inner = () => <Counter label={`t${tick}`} />;
      return <Inner />;
    }
    const { container, rerender } = mount(<Parent tick={0} />);
    click(container);
    expect(container.textContent).toBe("t0:1");
    rerender(<Parent tick={1} />);
    expect(container.textContent).toBe("t1:0"); // state lost
  });

  test("conditional rendering in different branches is still the same position", () => {
    function Toggle({ on }: { on: boolean }) {
      return on ? <Counter label="on" /> : <Counter label="off" />;
    }
    const { container, rerender } = mount(<Toggle on />);
    click(container);
    rerender(<Toggle on={false} />);
    expect(container.textContent).toBe("off:1"); // same type, same slot → state kept
  });
});

describe("keys in lists", () => {
  function Row({ name }: { name: string }) {
    return (
      <li>
        {name} <input defaultValue="" aria-label={name} />
      </li>
    );
  }
  function List({ names, byIndex }: { names: string[]; byIndex?: boolean }) {
    return (
      <ul>
        {names.map((n, i) => (
          <Row key={byIndex ? i : n} name={n} />
        ))}
      </ul>
    );
  }
  const typeInto = (c: Element, label: string, v: string) => {
    (c.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement).value = v;
  };
  const inputOf = (c: Element, label: string) =>
    (c.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement).value;

  test("stable keys: prepending keeps each input's text on its own row and reuses DOM nodes", () => {
    const { container, rerender } = mount(<List names={["ann", "bob"]} />);
    const annLi = container.querySelectorAll("li")[0];
    typeInto(container, "ann", "typed-by-ann");
    rerender(<List names={["zed", "ann", "bob"]} />);
    expect(inputOf(container, "ann")).toBe("typed-by-ann");
    expect(container.querySelectorAll("li")[1]).toBe(annLi); // same DOM node, moved
  });

  test("NEGATIVE: index keys: prepending moves state onto the wrong row", () => {
    const { container, rerender } = mount(<List names={["ann", "bob"]} byIndex />);
    typeInto(container, "ann", "typed-by-ann");
    rerender(<List names={["zed", "ann", "bob"]} byIndex />);
    // Slot 0 kept its DOM <input>, but slot 0 is now "zed".
    expect(inputOf(container, "zed")).toBe("typed-by-ann");
    expect(inputOf(container, "ann")).toBe("");
  });

  test("NEGATIVE: duplicate keys warn in DEV", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mount(<List names={["dup", "dup"]} />);
    expect(spy.mock.calls.flat().join(" ")).toMatch(/Encountered two children with the same key/);
    spy.mockRestore();
  });

  test("NEGATIVE: missing keys in a dynamic array warn in DEV", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mount(
      <ul>
        {["a", "b"].map((x) => (
          // Deliberately missing key.
          <li>{x}</li>
        ))}
      </ul>,
    );
    expect(spy.mock.calls.flat().join(" ")).toMatch(/Each child in a list should have a unique "key" prop/);
    spy.mockRestore();
  });
});

describe("the two-pass keyed diff (model in keyed-diff.ts) vs the real reconciler", () => {
  function KeyList({ keys }: { keys: string[] }) {
    return (
      <ul>
        {keys.map((k) => (
          <li key={k}>{k}</li>
        ))}
      </ul>
    );
  }

  /** Count DOM placements (insertBefore/appendChild) performed by one commit. */
  function placementsDuring(fn: () => void): string[] {
    const placed: string[] = [];
    const ib = Node.prototype.insertBefore;
    const ac = Node.prototype.appendChild;
    Node.prototype.insertBefore = function <T extends Node>(this: Node, n: T, ref: Node | null): T {
      placed.push(n.textContent ?? "");
      return ib.call(this, n, ref) as T;
    };
    Node.prototype.appendChild = function <T extends Node>(this: Node, n: T): T {
      placed.push(n.textContent ?? "");
      return ac.call(this, n) as T;
    };
    try {
      fn();
    } finally {
      Node.prototype.insertBefore = ib;
      Node.prototype.appendChild = ac;
    }
    return placed;
  }

  test("moving the LAST item to the front costs n−1 moves; moving the FIRST to the end costs 1", () => {
    const { rerender } = mount(<KeyList keys={["a", "b", "c", "d", "e"]} />);
    const lastToFront = placementsDuring(() => rerender(<KeyList keys={["e", "a", "b", "c", "d"]} />));
    expect(lastToFront.sort()).toEqual(["a", "b", "c", "d"]);
    const firstToEnd = placementsDuring(() => rerender(<KeyList keys={["a", "b", "c", "d", "e"]} />));
    expect(firstToEnd).toEqual(["e"]);

    // The model predicts exactly these moves.
    expect(reconcileKeyed(["a", "b", "c", "d", "e"], ["e", "a", "b", "c", "d"]).ops.map((o) => o.key)).toEqual([
      "a", "b", "c", "d",
    ]);
    expect(reconcileKeyed(["e", "a", "b", "c", "d"], ["a", "b", "c", "d", "e"]).ops).toEqual([
      { kind: "move", key: "e", index: 4 },
    ]);
  });

  const keyLists = fc
    .uniqueArray(fc.constantFrom(..."abcdefghij".split("")), { maxLength: 8 })
    .chain((old) =>
      fc.tuple(fc.constant(old), fc.uniqueArray(fc.constantFrom(..."abcdefghijkl".split("")), { maxLength: 8 })),
    );

  test("property: model's moves + inserts equal the real number of DOM placements", () => {
    fc.assert(
      fc.property(keyLists, ([oldKeys, newKeys]) => {
        const { rerender, root } = mount(<KeyList keys={oldKeys} />);
        const placed = placementsDuring(() => rerender(<KeyList keys={newKeys} />));
        const predicted = reconcileKeyed(oldKeys, newKeys).ops.filter((o) => o.kind !== "delete");
        act(() => root.unmount());
        roots = roots.filter((r) => r !== root);
        // A fresh <ul> mount appends once for the list itself only on first render; on update
        // the <ul> already exists, so every placement is a child placement.
        return placed.length === predicted.length;
      }),
      { numRuns: 150 },
    );
  });

  test("property: unmoved keys keep their relative order (correctness invariant)", () => {
    fc.assert(
      fc.property(keyLists, ([oldKeys, newKeys]) => {
        const { stayed } = reconcileKeyed(oldKeys, newKeys);
        const oldIdx = stayed.map((k) => oldKeys.indexOf(k));
        return oldIdx.every((v, i) => i === 0 || oldIdx[i - 1]! < v);
      }),
    );
  });

  test("property: React's heuristic never beats the LIS lower bound (it is not minimal)", () => {
    fc.assert(
      fc.property(keyLists, ([oldKeys, newKeys]) => {
        const common = newKeys.filter((k) => oldKeys.includes(k));
        const minMoves = common.length - lisLength(common.map((k) => oldKeys.indexOf(k)));
        const moves = reconcileKeyed(oldKeys, newKeys).ops.filter((o) => o.kind === "move").length;
        return moves >= minMoves;
      }),
    );
  });
});

describe("bailouts: when React skips re-rendering a subtree", () => {
  test("same element reference (children-as-props) is not re-rendered when the parent updates", () => {
    const childRenders = vi.fn();
    function Child() {
      childRenders();
      return <i>child</i>;
    }
    function Parent({ children }: { children: ReactNode }) {
      const [n, setN] = useState(0);
      return (
        <div>
          <button onClick={() => setN(n + 1)}>{n}</button>
          {children}
        </div>
      );
    }
    const { container } = mount(
      <Parent>
        <Child />
      </Parent>,
    );
    expect(childRenders).toHaveBeenCalledTimes(1);
    act(() => container.querySelector("button")!.click());
    expect(container.querySelector("button")!.textContent).toBe("1");
    expect(childRenders).toHaveBeenCalledTimes(1); // bailed out
  });

  test("an element created inside the updating component IS re-rendered (new props object)", () => {
    const childRenders = vi.fn();
    function Child() {
      childRenders();
      return <i>child</i>;
    }
    function Parent() {
      const [n, setN] = useState(0);
      return (
        <div>
          <button onClick={() => setN(n + 1)}>{n}</button>
          <Child />
        </div>
      );
    }
    const { container } = mount(<Parent />);
    act(() => container.querySelector("button")!.click());
    expect(childRenders).toHaveBeenCalledTimes(2);
  });

  test("memo bails out on shallow-equal props, and is defeated by a fresh object prop", () => {
    const renders = vi.fn();
    const Pure = memo(function Pure(_: { style: { color: string }; n: number }) {
      renders();
      return null;
    });
    const stable = { color: "red" };
    function Parent({ inline, n }: { inline: boolean; n: number }) {
      return <Pure n={n} style={inline ? { color: "red" } : stable} />;
    }
    const { rerender } = mount(<Parent inline={false} n={1} />);
    rerender(<Parent inline={false} n={1} />);
    expect(renders).toHaveBeenCalledTimes(1); // shallow-equal → skipped
    rerender(<Parent inline n={1} />);
    rerender(<Parent inline n={1} />);
    expect(renders).toHaveBeenCalledTimes(3); // NEGATIVE: new object each time → always re-renders
  });

  test("Fragments do not create host nodes and a keyed Fragment is a single identity", () => {
    const { container } = mount(
      <dl>
        {[1, 2].map((n) => (
          <Fragment key={n}>
            <dt>{n}</dt>
            <dd>v{n}</dd>
          </Fragment>
        ))}
      </dl>,
    );
    expect(container.innerHTML).toBe("<dl><dt>1</dt><dd>v1</dd><dt>2</dt><dd>v2</dd></dl>");
    const dt = fiberOf(container.querySelector("dt")!);
    expect(dt.return!.tag).toBe(WorkTag.Fragment);
    expect(dt.return!.key).toBe("1");
  });
});

describe("source-level behaviours (ReactChildFiber.placeChild, commitRoot)", () => {
  test("StrictMode re-runs effects for INSERTED children (PlacementDEV) but not for MOVED ones (Placement)", () => {
    const log: string[] = [];
    function Row({ id }: { id: string }) {
      useEffect(() => {
        log.push(`mount ${id}`);
        return () => void log.push(`unmount ${id}`);
      }, [id]);
      return <li>{id}</li>;
    }
    function List({ ids }: { ids: string[] }) {
      return (
        <ul>
          {ids.map((id) => (
            <Row key={id} id={id} />
          ))}
        </ul>
      );
    }
    const { rerender } = mount(
      <StrictMode>
        <List ids={["a", "b"]} />
      </StrictMode>,
    );
    log.length = 0;
    // "b" moves (Placement only); "c" is inserted (Placement | PlacementDEV).
    rerender(
      <StrictMode>
        <List ids={["b", "a", "c"]} />
      </StrictMode>,
    );
    expect(log).toEqual(["mount c", "unmount c", "mount c"]);
  });

  test("commit is atomic: a layout effect sees every sibling's DOM already updated", () => {
    const seen: string[] = [];
    function Reader() {
      useLayoutEffect(() => {
        seen.push(document.getElementById("later-sibling")!.textContent!);
      });
      return null;
    }
    function App({ v }: { v: string }) {
      return (
        <>
          <Reader />
          <p id="later-sibling">{v}</p>
        </>
      );
    }
    const { rerender } = mount(<App v="one" />);
    rerender(<App v="two" />);
    // Reader comes BEFORE the <p> in the tree, yet its layout effect already sees "two":
    // the whole mutation phase finishes before any layout effect runs.
    expect(seen).toEqual(["one", "two"]);
  });

  test("NEGATIVE: a memo comparator that ignores a prop freezes the UI on that prop", () => {
    const Price = memo(
      function Price({ amount, currency }: { amount: number; currency: string }) {
        return (
          <b>
            {amount} {currency}
          </b>
        );
      },
      (prev, next) => prev.amount === next.amount, // forgot currency
    );
    const { container, rerender } = mount(<Price amount={10} currency="EUR" />);
    rerender(<Price amount={10} currency="CZK" />);
    expect(container.textContent).toBe("10 EUR"); // stale: wrong currency on screen
  });

  test("NEGATIVE: mutating an object prop in place is invisible to memo (same reference)", () => {
    const List = memo(function List({ items }: { items: string[] }) {
      return <i>{items.join(",")}</i>;
    });
    const items = ["a"];
    const { container, rerender } = mount(<List items={items} />);
    items.push("b");
    rerender(<List items={items} />);
    expect(container.textContent).toBe("a");
  });
});

describe("commit flags (version-specific internals)", () => {
  test("a fiber's lanes are cleared after commit (no pending work)", () => {
    const { container } = mount(<p>x</p>);
    const p = fiberOf(container.querySelector("p")!);
    expect(p.lanes).toBe(0);
    expect(p.childLanes).toBe(0);
  });
});
