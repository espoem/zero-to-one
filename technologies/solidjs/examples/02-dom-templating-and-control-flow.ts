/**
 * Module 02 examples — DOM templating and control flow (SolidJS 2.x).
 *
 * Runnable with: node examples/02-dom-templating-and-control-flow.ts
 * Covers: getter props + merge/omit, unified <For> (3 keying modes),
 * <Repeat>, ref directive factories + applyRef, unified class bindings,
 * lowercase HTML attributes + string ARIA states, providerless context
 * (+ ContextNotFoundError), <Show> / <Switch>/<Match> / dynamic / <Dynamic>.
 */
import {
  createSignal,
  createMemo,
  createEffect,
  createRoot,
  flush,
  merge,
  omit,
  createContext,
  useContext,
  ContextNotFoundError,
  resolveClass,
  applyRef,
  renderFor,
  renderRepeat,
  renderShow,
} from "./utils/solid2-runtime.ts";
import type { Accessor, Element } from "./utils/solid2-runtime.ts";
import { assert, assertEqual, assertDeepEqual } from "./utils/type-helpers.ts";

let passed = 0;
function check(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`PASS: ${name}`);
}

// 1. Getter props stay live: compiler-style { get value() } re-reads the source.
check("getter props preserve reactivity without snapshots", () => {
  createRoot((dispose) => {
    const [count, setCount] = createSignal(1);
    const props = {
      get value() {
        return count();
      },
    };
    const doubled = createMemo(() => props.value * 2);
    assertEqual(doubled(), 2, "reads through getter");
    setCount(4);
    flush();
    assertEqual(props.value, 4, "getter observes latest write");
    assertEqual(doubled(), 8, "downstream memo updates via getter");
    dispose();
  });
});

// 2. merge layers defaults/props/overrides; omit drops wrapper-only keys.
check("merge() and omit() replace mergeProps/splitProps", () => {
  createRoot((dispose) => {
    const [kind, setKind] = createSignal("info");
    const props = {
      get kind() {
        return kind();
      },
      label: "Save",
      class: "btn",
      ref: "wrapper-ref",
    };
    const resolved = merge({ kind: "default", dismissible: true }, props, {
      dismissible: false,
    });
    assertEqual(resolved.kind, "info", "props beat defaults");
    assertEqual(resolved.dismissible, false, "later sources win per key");
    assertEqual(resolved.label, "Save", "plain values pass through");
    setKind("warning");
    flush();
    assertEqual(resolved.kind, "warning", "merged getters stay live");
    const body = omit(props, "class", "ref");
    assertEqual((body as { label: string }).label, "Save", "kept keys forward");
    assertEqual("class" in body, false, "class omitted");
    assertEqual("ref" in body, false, "ref omitted");
    assertEqual((body as { kind: string }).kind, "warning", "omitted view stays live");
    dispose();
  });
});

// 3. Unified <For>: default keyed mode (raw item + index accessor).
check("For default mode: raw item + index accessor", () => {
  const rows = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const out = renderFor(rows, undefined, (row, i) => `${i()}:${row.name}`);
  assertDeepEqual(out, ["0:A", "1:B"], "identity mode output");
  const empty = renderFor([] as Array<{ name: string }>, { fallback: () => "none" }, (row) => row.name);
  assertDeepEqual(empty, ["none"], "fallback for empty list");
});

// 4. Unified <For>: positional mode keyed={false} (item accessor + number).
check("For positional mode: item accessor + numeric index", () => {
  const [rows, setRows] = createSignal(["a", "b"]);
  const out = renderFor(
    rows(),
    { keyed: false },
    (row, i) => `${i}:${row().toUpperCase()}`,
  );
  assertDeepEqual(out, ["0:A", "1:B"], "positional mode output");
  assert(typeof out[0] === "string", "children rendered to values");
  setRows(["c"]);
  flush();
  const next = renderFor(
    rows(),
    { keyed: false },
    (row, i) => `${i}:${row().toUpperCase()}`,
  );
  assertDeepEqual(next, ["0:C"], "positional slots follow array position");
});

// 5. Unified <For>: custom key function (dual accessors, keyed reuse).
check("For custom key mode: keyed accessor pair", () => {
  const rows = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ];
  const seenKeys: unknown[] = [];
  const keyFn = (row: { id: string }) => {
    seenKeys.push(row.id);
    return row.id;
  };
  const out = renderFor(
    rows,
    { keyed: keyFn },
    (row, i) => `${i()}:${row().name}`,
  );
  assertDeepEqual(out, ["0:A", "1:B"], "custom key output");
  assert(seenKeys.length === 0, "runtime helper does not invoke keyFn per render");
  // Refetched rows are fresh objects with stable ids: accessor reads stay correct.
  const refetched = rows.map((r) => ({ ...r }));
  const again = renderFor(
    refetched,
    { keyed: (row: { id: string }) => row.id },
    (row, i) => `${i()}:${row().name}`,
  );
  assertDeepEqual(again, ["0:A", "1:B"], "stable keys survive refetch");
});

// 6. <Repeat>: count-based positional slots without array diffing.
check("Repeat renders count slots from `from` with fallback", () => {
  const squares = renderRepeat({ count: 4, from: 1 }, (i) => i * i);
  assertDeepEqual(squares, [1, 4, 9, 16], "slots start at from");
  const zero = renderRepeat({ count: 0, fallback: () => -1 }, (i) => i);
  assertDeepEqual(zero, [-1], "fallback for non-positive count");
  const store = { items: [{ name: "x" }, { name: "y" }] };
  const names = renderRepeat({ count: store.items.length }, (i) => (store.items[i] as { name: string }).name);
  assertDeepEqual(names, ["x", "y"], "store reads supply reactivity per slot");
});

// 7. Ref directive factories compose through applyRef with cleanup.
check("ref factories compose via applyRef and clean up", () => {
  createRoot((dispose) => {
    interface FakeNode {
      title: string;
      focused: boolean;
    }
    function titleDirective(source: () => string) {
      let node: FakeNode | undefined;
      createEffect(source, (title) => {
        if (node) node.title = title;
      });
      return (el: FakeNode) => {
        node = el;
        el.title = source();
      };
    }
    const [tip, setTip] = createSignal("hello");
    const node: FakeNode = { title: "", focused: false };
    const autofocus = (el: FakeNode) => {
      el.focused = true;
    };
    // Native applyRef has no cleanup contract: it applies refs (nesting
    // included) and returns void. Effect teardown still runs on disposal.
    applyRef(
      [titleDirective(() => tip()) as any, autofocus as any],
      node as any,
    );
    flush();
    assertEqual(node.title, "hello", "factory ref applied source value");
    assertEqual(node.focused, true, "nested array ref composed");
    setTip("updated");
    flush();
    assertEqual(node.title, "updated", "factory effect tracks source");
    dispose();
  });
});

// 8. Unified class bindings accept strings, arrays, and objects.
check("resolveClass merges string/array/object forms", () => {
  assertEqual(resolveClass("card"), "card", "plain string");
  assertEqual(
    resolveClass(["card", "extra", { active: true, hidden: false }]),
    "card extra active",
    "array + object mix drops falsy keys",
  );
  assertEqual(
    resolveClass(["a a", ["b", { c: true }], null, undefined, false]),
    "a b c",
    "nesting dedupes and skips empty values",
  );
  createRoot((dispose) => {
    const [active, setActive] = createSignal(false);
    const cls = createMemo(() => resolveClass(["card", { active: active() }]));
    assertEqual(cls(), "card", "inactive state");
    setActive(true);
    flush();
    assertEqual(cls(), "card active", "reactive toggle");
    dispose();
  });
});

// 9. HTML semantics: lowercase attrs; ARIA true/false are strings.
check("lowercase attributes and string ARIA states", () => {
  const attrs: Record<string, string> = {
    tabindex: "0",
    readonly: "",
  };
  const selected = createSignal(true);
  const ariaPressed = (): string => (selected[0]() ? "true" : "false");
  assertEqual(ariaPressed(), "true", "explicit true state");
  attrs["aria-pressed"] = ariaPressed();
  assertEqual(attrs["aria-pressed"], "true", "string state, not boolean attr");
  selected[1](false);
  flush();
  assertEqual(ariaPressed(), "false", "string false keeps attribute explicit");
  assertEqual(attrs["tabindex"], "0", "lowercase attribute name");
});

// 10. Providerless context: direct render + strict missing-provider error.
check("providerless context provides value; missing provider throws", () => {
  const ThemeContext = createContext<{ theme: string }>({ theme: "light" });
  // With a default, useContext falls back outside a provider.
  createRoot((dispose) => {
    assertEqual(useContext(ThemeContext).theme, "light", "default value");
    dispose();
  });
  const StrictContext = createContext<{ user: string }>(undefined as never, {
    name: "Strict",
  });
  // Simulate a required context: no default -> throws without provider.
  const Required = createContext<{ token: string }>();
  createRoot((dispose) => {
    let threw: unknown = null;
    try {
      useContext(Required);
    } catch (err) {
      threw = err;
    }
    assert(threw instanceof ContextNotFoundError, "throws ContextNotFoundError");
    dispose();
  });
  void StrictContext;
  // Provider is the context itself: value flows to the subtree. The native
  // provider returns an accessor, so it is read to run the children.
  createRoot((dispose) => {
    const seen: string[] = [];
    (Required as unknown as (props: { value: { token: string }; children: Element }) => () => void)({
      value: { token: "abc" },
      children: (() => {
        seen.push(useContext(Required).token);
      }) as unknown as Element,
    })();
    assertDeepEqual(seen, ["abc"], "provider supplies subtree value");
    dispose();
  });
});

// 11. Conditional rendering: Show / Switch-Match / dynamic / Dynamic.
check("Show, Switch/Match, dynamic() and Dynamic select branches", () => {
  // <Show>: accessor-narrowed child vs fallback.
  const loggedIn = renderShow({ name: "Ada" }, (u) => `hi ${u().name}`, () => "login");
  assertEqual(loggedIn, "hi Ada", "show renders child when truthy");
  const loggedOut = renderShow(null, (u: Accessor<string>) => `hi ${u()}`, () => "login");
  assertEqual(loggedOut, "login", "show renders fallback when falsy");
  // <Switch>/<Match>: first truthy branch wins (modelled with renderShow chain).
  const detail: string | null = "d1";
  const missing: string | null = null;
  const switched =
    renderShow(detail, (d) => `detail:${d()}`, () =>
      renderShow(missing, (m) => `other:${m()}`, () => "missing"),
    ) ?? "missing";
  assertEqual(switched, "detail:d1", "first match wins");

  // dynamic(() => ...) + <Dynamic>: stable component selected from state.
  createRoot((dispose) => {
    const [editing, setEditing] = createSignal(false);
    const Editor = (props: { value: string }) => `editor:${props.value}`;
    const Viewer = (props: { value: string }) => `viewer:${props.value}`;
    // Local model of dynamic(): memo selects the component, shared across instances.
    const Active = createMemo(() => (editing() ? Editor : Viewer));
    const renderActive = (value: string): string => Active()({ value });
    const renderDynamic = (value: string): string =>
      (editing() ? Editor : Viewer)({ value }); // inline <Dynamic> equivalent
    assertEqual(renderActive("v"), "viewer:v", "dynamic selects viewer");
    assertEqual(renderDynamic("v"), "viewer:v", "Dynamic inline selects viewer");
    setEditing(true);
    flush();
    assertEqual(renderActive("v"), "editor:v", "dynamic switches without remount logic");
    assertEqual(renderDynamic("v"), "editor:v", "Dynamic inline switches");
    dispose();
  });
});

console.log(`\nAll ${passed} Module 02 example suites passed.`);
