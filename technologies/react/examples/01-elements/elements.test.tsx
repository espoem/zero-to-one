// @vitest-environment jsdom
/**
 * Module 01 — Elements, JSX & the render model.
 * Every assertion runs against the real react@19.3 / react-dom@19.3 builds (development mode,
 * because Vitest sets NODE_ENV=test).
 */
import { describe, expect, test, vi } from "vitest";
import {
  Children,
  StrictMode,
  cloneElement,
  createElement,
  isValidElement,
  useState,
  type ReactElement,
  type Ref,
} from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "react";
import { transformWithOxc } from "vite";

const ELEMENT = Symbol.for("react.transitional.element");
// $$typeof is deliberately absent from @types/react: it is an implementation detail.
const tag = (el: unknown) => (el as { $$typeof: symbol }).$$typeof;

function mount(node: ReactElement) {
  const container = document.createElement("div");
  const root = createRoot(container);
  act(() => root.render(node));
  return { container, root };
}

describe("JSX lowering (automatic runtime)", () => {
  test("JSX compiles to jsx/jsxs calls with key as a separate argument", async () => {
    const { code } = await transformWithOxc(
      `const a = <ul key="k" id="x"><li/>{items}</ul>; const b = <p>one</p>;`,
      "a.tsx",
      { jsx: { runtime: "automatic", development: false } },
    );
    // Multiple static children → jsxs (children array is known to be static, no key warning).
    expect(code).toMatch(/jsxs\)?\("ul", \{\s*id: "x",\s*children: \[/);
    // The key is NOT inside props; it is the third positional argument.
    expect(code).toMatch(/\}, "k"\)/);
    // A single child → jsx, children is the value itself, not an array.
    expect(code).toMatch(/jsx\)?\("p", \{ children: "one" \}\)/);
  });

  test("a key after a spread falls back to createElement (the classic runtime)", async () => {
    const { code } = await transformWithOxc(`const b = <p {...rest} key="z" />;`, "b.tsx", {
      jsx: { runtime: "automatic", development: false },
    });
    expect(code).toContain("createElement");
  });

  test("jsx() and createElement() produce structurally identical elements", () => {
    const viaJsx = jsxs("div", { id: "a", children: ["x", "y"] }, "k");
    const viaCreate = createElement("div", { id: "a", key: "k" }, "x", "y");
    expect(tag(viaJsx)).toBe(ELEMENT);
    expect(tag(viaCreate)).toBe(ELEMENT);
    expect(viaJsx.key).toBe("k");
    expect(viaCreate.key).toBe("k");
    expect(viaJsx.props).toEqual(viaCreate.props);
  });
});

describe("element shape and $$typeof", () => {
  test("an element is a plain description: type, key, props", () => {
    const el = <section className="card">hello</section>;
    expect(el.type).toBe("section");
    expect(el.key).toBeNull();
    expect(el.props).toEqual({ className: "card", children: "hello" });
    expect(tag(el)).toBe(ELEMENT);
    expect(isValidElement(el)).toBe(true);
  });

  test("keys are coerced to strings and never appear in props", () => {
    const el = createElement("li", { key: 7, id: "x" });
    expect(el.key).toBe("7");
    // DEV installs a warning getter for props.key; reading it yields undefined.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((el.props as { key?: unknown }).key).toBeUndefined();
    expect(spy.mock.calls.flat().join(" ")).toMatch(/`key` is not a prop/);
    spy.mockRestore();
  });

  test("NEGATIVE: an element forged from JSON is not a valid element (no Symbol survives JSON)", () => {
    const forged = JSON.parse(
      JSON.stringify({
        $$typeof: "react.transitional.element",
        type: "img",
        key: null,
        props: { src: "x", onError: "alert(1)" },
      }),
    );
    expect(isValidElement(forged)).toBe(false);
  });

  test("NEGATIVE: rendering a forged element throws instead of creating DOM", () => {
    const forged = JSON.parse('{"$$typeof":"react.transitional.element","type":"script","props":{}}');
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderToStaticMarkup(<div>{forged}</div>)).toThrow(/Objects are not valid as a React child/);
    spy.mockRestore();
  });

  test("NEGATIVE: the legacy Symbol.for('react.element') is rejected by React 19", () => {
    const legacy = { $$typeof: Symbol.for("react.element"), type: "b", key: null, ref: null, props: {} };
    expect(isValidElement(legacy)).toBe(false);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // On the client the reconciler recognises the old symbol and names the problem explicitly.
    const root = createRoot(document.createElement("div"));
    expect(() => act(() => root.render(<div>{legacy as unknown as ReactElement}</div>))).toThrow(
      /A React Element from an older version of React was rendered/,
    );
    spy.mockRestore();
  });

  test("javascript: URLs are replaced with a throwing stub (React 19)", () => {
    const html = renderToStaticMarkup(<a href={"javascript:alert(1)"}>x</a>);
    expect(html).toContain("React has blocked a javascript: URL as a security precaution");
    expect(html).not.toContain("alert(1)");
  });

  test("text children are escaped, never parsed as HTML", () => {
    const html = renderToStaticMarkup(<p>{"<img src=x onerror=alert(1)>"}</p>);
    expect(html).toBe("<p>&lt;img src=x onerror=alert(1)&gt;</p>");
  });
});

describe("props immutability (development build)", () => {
  test("element and props are frozen in DEV", () => {
    const el = <span data-n={1} />;
    expect(Object.isFrozen(el)).toBe(true);
    expect(Object.isFrozen(el.props)).toBe(true);
    expect(() => {
      (el.props as Record<string, unknown>)["data-n"] = 2;
    }).toThrow(TypeError);
  });

  test("cloneElement creates a new element; the original is untouched", () => {
    const el = <a href="/a">x</a>;
    const clone = cloneElement(el, { href: "/b" });
    expect(clone).not.toBe(el);
    expect(el.props.href).toBe("/a");
    expect(clone.props.href).toBe("/b");
  });
});

describe("creating an element does not render it", () => {
  test("the component function runs only when React renders the element", () => {
    const Comp = vi.fn(() => <b>hi</b>);
    const el = <Comp />;
    expect(Comp).not.toHaveBeenCalled();
    const { container } = mount(el);
    expect(Comp).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe("<b>hi</b>");
  });

  test("calling a component as a function is not rendering it (hooks belong to the caller)", () => {
    function Counter() {
      const [n] = useState(0);
      return <i>{n}</i>;
    }
    // Calling outside a render: there is no current dispatcher, so the hook call fails.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => (Counter as () => ReactElement)()).toThrow();
    spy.mockRestore();
  });
});

describe("purity and StrictMode", () => {
  test("StrictMode double-invokes component bodies in DEV to expose impurity", () => {
    let calls = 0;
    function Impure() {
      calls++; // side effect during render — exactly what StrictMode is designed to surface
      return <span />;
    }
    mount(
      <StrictMode>
        <Impure />
      </StrictMode>,
    );
    expect(calls).toBe(2);
  });

  test("NEGATIVE: mutating a module-level array during render duplicates output under StrictMode", () => {
    const log: string[] = [];
    function Bad() {
      log.push("row");
      return <ul>{log.map((r, i) => <li key={i}>{r}</li>)}</ul>;
    }
    const { container } = mount(
      <StrictMode>
        <Bad />
      </StrictMode>,
    );
    expect(log.length).toBe(2);
    expect(container.querySelectorAll("li").length).toBe(2);
  });
});

describe("ref is a regular prop in React 19", () => {
  test("ref is readable from props and element.ref access is deprecated", () => {
    const r = { current: null };
    const el = <div ref={r} />;
    expect(el.props.ref).toBe(r);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    void (el as unknown as { ref: unknown }).ref;
    expect(spy.mock.calls.flat().join(" ")).toMatch(/Accessing element\.ref was removed in React 19/);
    spy.mockRestore();
  });

  test("a function component receives ref as a prop without forwardRef", () => {
    function Input({ ref, label }: { ref?: Ref<HTMLInputElement>; label: string }) {
      return <input aria-label={label} ref={ref} />;
    }
    const r: { current: HTMLInputElement | null } = { current: null };
    const { container } = mount(<Input ref={r} label="name" />);
    expect(r.current).toBe(container.querySelector("input"));
  });
});

describe("children are opaque data", () => {
  test("Children.toArray assigns keys and flattens", () => {
    const arr = Children.toArray([<b key="a" />, [<i key="b" />], null, "t"]);
    expect(arr.map((c) => (isValidElement(c) ? c.key : c))).toEqual([".$a", ".1:$b", "t"]);
  });

  test("booleans, null and undefined render nothing; 0 renders '0'", () => {
    const n = 0;
    expect(renderToStaticMarkup(<p>{false}{null}{undefined}{true}</p>)).toBe("<p></p>");
    expect(renderToStaticMarkup(<p>{n && <b>x</b>}</p>)).toBe("<p>0</p>");
  });
});
