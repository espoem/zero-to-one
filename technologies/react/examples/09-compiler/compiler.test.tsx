// @vitest-environment jsdom
/**
 * Module 09 — React Compiler 1.0. Compiles fixtures with babel-plugin-react-compiler@1.0.0,
 * runs compiled vs uncompiled components in react-dom@19.3.1, and lints with
 * eslint-plugin-react-hooks@7.1.1.
 */
import { afterEach, describe, expect, test } from "vitest";
import { act, type ComponentType } from "react";
import { createRoot, type Root } from "react-dom/client";
import { cacheSlots, compile, lint, load } from "./compile.ts";

let roots: Root[] = [];
afterEach(() => {
  for (const r of roots) act(() => r.unmount());
  roots = [];
});

describe("what the compiler emits", () => {
  test("a component gets a memo cache (_c(n)) and guarded blocks per reactive scope", () => {
    const { code, events } = compile(`
      export function List({ items, onPick }) {
        const sorted = [...items].sort();
        return <ul>{sorted.map((i) => <li key={i} onClick={() => onPick(i)}>{i}</li>)}</ul>;
      }`);
    expect(events.map((e) => e.kind)).toEqual(["CompileSuccess"]);
    expect(code).toContain('import { c as _c } from "react/compiler-runtime"');
    expect(cacheSlots(code)).toEqual([7]);
    // Each scope: compare inputs with cached slots, recompute or reuse.
    expect(code).toContain("if ($[0] !== items || $[1] !== onPick) {");
    expect(code).toContain("if ($[3] !== onPick) {"); // nested scope: the map callback
    expect(code).toMatch(/\$\[\d+\] = items;/);
  });

  test("the smallest case: one input, one cached JSX value (2 slots)", () => {
    const { code } = compile(`export function A({ x }) { return <div>{[x]}</div>; }`);
    expect(code).toContain("const $ = _c(2);");
    expect(code).toContain("if ($[0] !== x) {");
    expect(code).toContain("t1 = $[1];");
  });

  test("existing useMemo is kept and its deps are checked against the inferred ones", () => {
    const { code, events } = compile(`
      import { useMemo } from "react";
      export function A({ x }) { const v = useMemo(() => [x], [x]); return <B v={v} />; }`);
    expect(events.map((e) => e.kind)).toEqual(["CompileSuccess"]);
    expect(code).toContain("_c(");
  });

  test('"use no memo" opts a component out', () => {
    const { code, events } = compile(`export function A({ x }) { "use no memo"; return <div>{[x]}</div>; }`);
    expect(events[0]!.kind).toBe("CompileSkip");
    expect(code).not.toContain("_c(");
  });

  test('compilationMode "annotation" compiles only functions marked "use memo"', () => {
    const { code } = compile(
      `export function A({ x }) { return <i>{[x]}</i>; }
       export function B({ x }) { "use memo"; return <b>{[x]}</b>; }`,
      { compilationMode: "annotation" },
    );
    expect(cacheSlots(code)).toEqual([2]); // only B
  });

  test('target "18" imports the runtime from react-compiler-runtime (for React 17/18 apps)', () => {
    const { code } = compile(`export function A({ x }) { return <div>{[x]}</div>; }`, { target: "18" });
    expect(code).toContain('from "react-compiler-runtime"');
  });
});

describe("bail-outs: code that breaks the Rules of React is left uncompiled", () => {
  test("reading a ref during render → CompileError (Refs), output unchanged", () => {
    const { code, events } = compile(`
      import { useRef } from "react";
      export function A() { const r = useRef(0); return <div>{r.current}</div>; }`);
    expect(events).toContainEqual(expect.objectContaining({ kind: "CompileError", category: "Refs" }));
    expect(code).not.toContain("_c(");
  });

  test("a conditional hook → CompileError (Hooks)", () => {
    const { code, events } = compile(`
      import { useState } from "react";
      export function A({ c }) { if (c) { useState(0); } return <div />; }`);
    expect(events).toContainEqual(expect.objectContaining({ kind: "CompileError", category: "Hooks" }));
    expect(code).not.toContain("_c(");
  });

  test("NEGATIVE: not every violation is detected — mutating props via a method call still compiles", () => {
    // The compiler cannot know that .push mutates a value it does not own. The memoised
    // JSX is keyed on the array reference, which does not change, so updates can be lost.
    const { events } = compile(`export function A(props) { props.items.push(1); return <div>{props.items}</div>; }`);
    expect(events.map((e) => e.kind)).toEqual(["CompileSuccess"]);
    expect(lint(`export function A(props) { props.items.push(1); return <div>{props.items}</div>; }`)).toEqual([]);
  });
});

describe("runtime effect: compiled components skip re-rendering stable subtrees", () => {
  const source = `
    import { useState } from "react";
    export const childRenders = { count: 0 };
    function Expensive({ items }) {
      childRenders.count++;
      return <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>;
    }
    export function Page({ items }) {
      const [n, setN] = useState(0);
      const visible = items.filter((i) => i !== "hidden");
      return (
        <section>
          <button onClick={() => setN(n + 1)}>{n}</button>
          <Expensive items={visible} />
        </section>
      );
    }`;
  type Mod = { Page: ComponentType<{ items: string[] }>; childRenders: { count: number } };

  async function clicks(mod: Mod) {
    const container = document.createElement("div");
    const root = createRoot(container);
    roots.push(root);
    const items = ["a", "b", "hidden"];
    await act(async () => root.render(<mod.Page items={items} />));
    for (let i = 0; i < 3; i++) await act(async () => container.querySelector("button")!.click());
    return { renders: mod.childRenders.count, text: container.textContent };
  }

  test("uncompiled: every click re-renders the expensive child (new array each render)", async () => {
    const mod = await load<Mod>("page", source, false);
    expect(await clicks(mod)).toEqual({ renders: 4, text: "3ab" });
  });

  test("compiled: the filtered array and the child element are cached → child renders once", async () => {
    const mod = await load<Mod>("page", source, true);
    expect(await clicks(mod)).toEqual({ renders: 1, text: "3ab" });
  });
});

describe("eslint-plugin-react-hooks 7 (compiler-powered rules in the recommended preset)", () => {
  test("refs: reading ref.current during render", () => {
    expect(lint(`import {useRef} from "react"; export function A(){ const r = useRef(0); return <div>{r.current}</div>; }`)).toContain(
      "react-hooks/refs",
    );
  });
  test("set-state-in-effect: deriving state in an effect", () => {
    expect(
      lint(`import {useState,useEffect} from "react";
        export function A({a,b}){ const [f,setF] = useState(""); useEffect(() => { setF(a + b); }, [a, b]); return <p>{f}</p>; }`),
    ).toContain("react-hooks/set-state-in-effect");
  });
  test("static-components: defining a component during render", () => {
    expect(lint(`export function A(){ function B(){ return <i/>; } return <B/>; }`)).toContain("react-hooks/static-components");
  });
  test("purity: Math.random() in render", () => {
    expect(lint(`export function A(){ return <p>{Math.random()}</p>; }`)).toContain("react-hooks/purity");
  });
  test("exhaustive-deps still reports missing dependencies", () => {
    expect(lint(`import {useEffect} from "react"; export function A({id}){ useEffect(() => { console.log(id); }, []); return null; }`)).toContain(
      "react-hooks/exhaustive-deps",
    );
  });
  test("clean code produces no reports", () => {
    expect(lint(`export function A({ items }) { const s = [...items].sort(); return <ul>{s.map((i) => <li key={i}>{i}</li>)}</ul>; }`)).toEqual([]);
  });
});
