/**
 * Module 03 — Components, props and DOM templating (real compiler + runtime).
 */
import { describe, it, expect, afterEach } from "vitest";
import { createSignal, createEffect, flush, merge, omit, onSettled, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import { render, cleanup } from "@solidjs/testing-library";
import { transform } from "@solidjs/compiler";
import { captureDiagnostics } from "./support/diagnostics.ts";

afterEach(() => cleanup());

describe("03 · components run once", () => {
  it("the body runs once; only the binding updates", () => {
    let bodyRuns = 0;
    const [count, setCount] = createSignal(0);
    function Counter(props: { value: number }) {
      bodyRuns++;
      return <span>{props.value}</span>;
    }
    const { container } = render(() => <Counter value={count()} />);
    setCount(1);
    flush();
    setCount(2);
    flush();
    expect(container.textContent).toBe("2");
    expect(bodyRuns).toBe(1);
  });

  it("the compiler lowers JSX to a cloned template + fine-grained bindings", () => {
    const { code } = transform(
      `export function C(props) { return <button class={{ on: props.on }} title={props.t}>Hi {props.n}</button>; }`,
      { generate: "dom", filename: "c.jsx", dev: false },
    );
    expect(code).toContain("_$template(`<button>Hi "); // static HTML parsed once, cloned per instance
    expect(code).toMatch(/_\$insert\(_el\$, \(\) => \{\s*return props\.n;/); // text hole → insert binding (a getter)
    expect(code).toContain("_$effect("); // one grouped effect for the element's dynamic attributes
    expect(code).toContain('classList.toggle("on"');
  });
});

describe("03 · props are values, read lazily", () => {
  it("passing the accessor instead of the value hands the child a function (the #1 bug)", () => {
    const [count] = createSignal(7);
    let received: unknown;
    function Child(props: { value: unknown }) {
      return <span>{untrack(() => ((received = props.value), typeof props.value))}</span>;
    }
    render(() => <Child value={count} />); // ❌ should be count()
    expect(typeof received).toBe("function");
  });

  it("destructuring freezes the value and warns STRICT_READ_UNTRACKED", () => {
    const [name, setName] = createSignal("Ada");
    function Bad({ name }: { name: string }) {
      return <b>{name}</b>;
    }
    function Good(props: { name: string }) {
      return <i>{props.name}</i>;
    }
    const { codes } = captureDiagnostics(() => {
      const { container } = render(() => (
        <>
          <Bad name={name()} />
          <Good name={name()} />
        </>
      ));
      setName("Grace");
      flush();
      expect(container.querySelector("b")!.textContent).toBe("Ada"); // frozen
      expect(container.querySelector("i")!.textContent).toBe("Grace"); // live
    });
    expect(codes).toContain("STRICT_READ_UNTRACKED");
  });

  it("merge supplies defaults reactively; undefined overrides instead of skipping", () => {
    const [size, setSize] = createSignal<string | undefined>("lg");
    function Button(props: { size?: string | undefined }) {
      const p = merge({ size: "md" }, props);
      return <button data-size={p.size ?? "none"} />;
    }
    const { container } = render(() => <Button size={size()} />);
    const btn = container.querySelector("button")!;
    expect(btn.dataset.size).toBe("lg");
    setSize(undefined);
    flush();
    expect(btn.dataset.size).toBe("none"); // NOT "md": undefined is a real value
  });

  it("omit forwards the rest while keeping it reactive", () => {
    const [title, setTitle] = createSignal("a");
    function Field(props: { label: string } & JSX.InputHTMLAttributes<HTMLInputElement>) {
      const rest = omit(props, "label");
      return (
        <label>
          {props.label}
          <input {...rest} />
        </label>
      );
    }
    const { container } = render(() => <Field label="Name" title={title()} />);
    const input = container.querySelector("input")!;
    expect(input.getAttribute("title")).toBe("a");
    expect(input.hasAttribute("label")).toBe(false);
    setTitle("b");
    flush();
    expect(input.getAttribute("title")).toBe("b");
  });

  it("a getter prop is the opt-in way to forward something lazily", () => {
    const [n, setN] = createSignal(1);
    function Lazy(props: { get: () => number }) {
      return <span>{props.get()}</span>;
    }
    const { container } = render(() => <Lazy get={() => n() * 2} />);
    setN(2);
    flush();
    expect(container.textContent).toBe("4");
  });
});

describe("03 · attributes, class, style", () => {
  it("class object/array forms toggle classes", () => {
    const [active, setActive] = createSignal(false);
    const { container } = render(() => <div class={["card", { active: active() }]} />);
    const div = container.firstElementChild!;
    expect(div.className).toBe("card");
    setActive(true);
    flush();
    expect(div.classList.contains("active")).toBe(true);
  });

  it("boolean attributes are presence/absence; built-ins are lowercase", () => {
    const [muted, setMuted] = createSignal(true);
    const { container } = render(() => (
      <div>
        <button disabled={muted()} tabindex="0" aria-pressed="true" />
      </div>
    ));
    const btn = container.querySelector("button")!;
    expect(btn.hasAttribute("disabled")).toBe(true);
    expect(btn.getAttribute("tabindex")).toBe("0");
    setMuted(false);
    flush();
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("style accepts an object of CSS properties", () => {
    const [w, setW] = createSignal(10);
    const { container } = render(() => <div style={{ width: `${w()}px`, "--gap": "4px" }} />);
    const div = container.firstElementChild as HTMLElement;
    expect(div.style.width).toBe("10px");
    setW(20);
    flush();
    expect(div.style.width).toBe("20px");
    expect(div.style.getPropertyValue("--gap")).toBe("4px");
  });

  it("removed namespaces are compile errors that name the replacement", () => {
    for (const [jsx, hint] of [
      ["<div on:click={f} />", "onClick"],
      ["<div use:tip={1} />", "ref={tip"],
      ["<div classList={{ a: true }} />", "class"],
      ['<div attr:x="1" />', "Attributes are the default"],
    ] as const) {
      expect(() => transform(`const f = () => {}; export const x = ${jsx};`, { generate: "dom", filename: "x.jsx" })).toThrow(
        hint,
      );
    }
  });

  it("a function on a lowercase on* attribute is not a handler (LOWERCASE_EVENT_ATTRIBUTE)", () => {
    const { codes } = captureDiagnostics(() => {
      const handler = () => {};
      // @ts-expect-error — the JSX types do not declare lowercase on* names
      render(() => <button onclick={handler} />);
    });
    expect(codes).toContain("LOWERCASE_EVENT_ATTRIBUTE");
  });
});

describe("03 · events", () => {
  it("delegated handlers work and are installed on the render root", () => {
    let clicks = 0;
    const { container } = render(() => <button onClick={() => clicks++}>+</button>);
    container.querySelector("button")!.click();
    expect(clicks).toBe(1);
  });

  it("the handler expression binds once: onClick={cond() ? a : b} never re-evaluates", () => {
    const log: string[] = [];
    const [admin, setAdmin] = createSignal(false);
    const a = (_e?: MouseEvent) => log.push("admin");
    const b = (_e?: MouseEvent) => log.push("user");
    const { container } = render(() => (
      <div>
        <button id="bad" onClick={admin() ? a : b} />
        <button id="good" onClick={(e) => (admin() ? a : b)(e)} />
      </div>
    ));
    setAdmin(true);
    flush();
    container.querySelector<HTMLButtonElement>("#bad")!.click();
    container.querySelector<HTMLButtonElement>("#good")!.click();
    expect(log).toEqual(["user", "admin"]); // the bad one is stuck on its mount-time choice
  });

  it("bound handler tuple [fn, data] passes data without a closure per row", () => {
    const removed: number[] = [];
    const remove = (id: number, _e: MouseEvent) => removed.push(id);
    const { container } = render(() => (
      <ul>
        {[1, 2, 3].map((id) => (
          <li>
            <button onClick={[remove, id]}>x</button>
          </li>
        ))}
      </ul>
    ));
    container.querySelectorAll("button")[1]!.click();
    expect(removed).toEqual([2]);
  });

  it("native listener options go through a ref callback", () => {
    const order: string[] = [];
    const on =
      (type: string, handler: () => void, options?: AddEventListenerOptions) =>
      (el: HTMLElement) =>
        el.addEventListener(type, handler, options);
    const { container } = render(() => (
      <div ref={on("click", () => order.push("capture"), { capture: true })}>
        <button onClick={() => order.push("target")}>go</button>
      </div>
    ));
    container.querySelector("button")!.click();
    expect(order).toEqual(["capture", "target"]);
  });
});

describe("03 · refs and directives", () => {
  it("a ref runs before the element is attached; onSettled runs after", () => {
    const seen: string[] = [];
    function Measure() {
      onSettled(() => {
        seen.push(`settled connected=${el.isConnected}`);
      });
      let el!: HTMLDivElement;
      return (
        <div
          ref={(node) => {
            el = node;
            seen.push(`ref connected=${node.isConnected}`);
          }}
        />
      );
    }
    render(() => <Measure />);
    flush();
    expect(seen).toEqual(["ref connected=false", "settled connected=true"]);
  });

  it("a bare variable is assigned for a single ref but never inside an array", () => {
    let single: HTMLParagraphElement | undefined;
    let inArray: HTMLElement | undefined;
    let viaCallback: HTMLElement | undefined;
    render(() => (
      <div>
        <p ref={single} />
        {/* type-checks (the variable is typed as an element), yet is never assigned at runtime */}
        <span ref={[inArray, (el: HTMLElement) => (viaCallback = el)]} />
      </div>
    ));
    expect(single).toBeInstanceOf(HTMLParagraphElement);
    expect(inArray).toBeUndefined();
    expect(viaCallback).toBeInstanceOf(HTMLSpanElement);
  });

  it("two-phase directive factory: owned setup, unowned apply", () => {
    function title(source: () => string) {
      let el: HTMLElement | undefined;
      createEffect(source, (value) => {
        if (el) el.title = value; // setup phase (owned): primitives only
      });
      return (node: HTMLElement) => {
        el = node; // apply phase (unowned): DOM writes only
        el.title = untrack(source);
      };
    }
    const [t, setT] = createSignal("first");
    const { container } = render(() => <button ref={title(() => t())} />);
    const btn = container.querySelector("button")!;
    expect(btn.title).toBe("first");
    setT("second");
    flush();
    expect(btn.title).toBe("second");
  });
});

describe("03 · form inputs", () => {
  it("draft pattern: the binding always mirrors the box, so re-runs are harmless", () => {
    const committed: string[] = [];
    const [highlight, setHighlight] = createSignal(false);
    function NameField(props: { name: string; onCommit: (v: string) => void }) {
      const [draft, setDraft] = createSignal(untrack(() => props.name));
      return (
        <input
          class={{ hl: highlight() }}
          value={draft()}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onChange={() => props.onCommit(draft())}
        />
      );
    }
    const { container } = render(() => <NameField name="Ada" onCommit={(v) => committed.push(v)} />);
    const input = container.querySelector("input")!;
    input.value = "Ada L";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flush();
    setHighlight(true); // another attribute in the same template changes
    flush();
    expect(input.value).toBe("Ada L"); // typing survived
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(committed).toEqual(["Ada L"]);
  });

  it("negative: binding the committed value loses uncommitted typing (UNCOMMITTED_INPUT_OVERWRITTEN)", () => {
    const [name] = createSignal("Ada");
    const [highlight, setHighlight] = createSignal(false);
    const { codes } = captureDiagnostics(() => {
      const { container } = render(() => <input class={{ hl: highlight() }} value={name()} />);
      const input = container.querySelector("input")!;
      input.value = "Ada L"; // the user typed; nothing committed it
      input.dispatchEvent(new Event("input", { bubbles: true }));
      setHighlight(true); // unrelated attribute in the same template
      flush();
      expect(input.value).toBe("Ada"); // typing erased
    });
    expect(codes).toContain("UNCOMMITTED_INPUT_OVERWRITTEN");
  });

  it("rejecting input: write the filtered value back to the element yourself", () => {
    const [digits, setDigits] = createSignal("12");
    const { container } = render(() => (
      <input
        value={digits()}
        onInput={(e) => {
          const next = e.currentTarget.value.replace(/\D/g, "");
          e.currentTarget.value = next; // an unchanged signal would not revert the DOM
          setDigits(next);
        }}
      />
    ));
    const input = container.querySelector("input")!;
    input.value = "12x";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flush();
    expect(input.value).toBe("12");
    expect(digits()).toBe("12");
  });
});
