/**
 * Module 12 — Typing Solid 2.0 (release candidate, solid-js 2.0.0-rc.19).
 *
 * Type test only: `tsc -p examples/12-typing-ui-frameworks/solid` must pass.
 * Runtime semantics (run-once components, batching, ownership) belong to technologies/solidjs.
 * Solid 2.0 is a release candidate; these signatures are pinned to rc.19 and may change.
 */
import {
  action,
  createContext,
  createMemo,
  createSignal,
  createStore,
  For,
  merge,
  omit,
  Show,
  useContext,
  type Accessor,
  type Component,
  type FlowComponent,
  type ParentComponent,
  type Setter,
  type VoidComponent,
} from "solid-js";
import { dynamic, type ComponentProps, type JSX } from "@solidjs/web";
import { expectTypeOf } from "expect-type";

// ---------------------------------------------------------------------------
// 1. Signals: accessors and setters
// ---------------------------------------------------------------------------

const [count, setCount] = createSignal(0);
expectTypeOf(count()).toEqualTypeOf<number>();
expectTypeOf<typeof setCount>().toEqualTypeOf<Setter<number>>();
setCount(1);
setCount((c) => c + 1);
// @ts-expect-error — the setter is typed by the signal's T
setCount("one");

// Literal types widen like a `let` binding unless you annotate.
const [mode] = createSignal("light");
expectTypeOf(mode()).toEqualTypeOf<string>();
const [mode2] = createSignal<"light" | "dark">("light");
expectTypeOf(mode2()).toEqualTypeOf<"light" | "dark">();

// No initial value: T | undefined.
const [maybe] = createSignal<number>();
expectTypeOf(maybe()).toEqualTypeOf<number | undefined>();

// A function argument means "derived signal", so storing a function needs a wrapper.
const [handler, setHandler] = createSignal<{ fn: () => void }>({ fn: () => {} });
setHandler({ fn: () => console.log("x") });
expectTypeOf(handler().fn).toEqualTypeOf<() => void>();

// ---------------------------------------------------------------------------
// 2. Memos, including async memos (colorless async: the accessor is not a Promise)
// ---------------------------------------------------------------------------

const doubled = createMemo(() => count() * 2);
expectTypeOf(doubled()).toEqualTypeOf<number>();

const user = createMemo(async () => ({ id: count(), name: "Ada" }));
expectTypeOf(user()).toEqualTypeOf<{ id: number; name: string }>();

// ---------------------------------------------------------------------------
// 3. Stores: draft-first setter
// ---------------------------------------------------------------------------

interface Todo {
  id: number;
  title: string;
  done: boolean;
}
const [store, setStore] = createStore<{ todos: Todo[] }>({ todos: [] });
expectTypeOf(store.todos).toEqualTypeOf<Todo[]>();
setStore((draft) => {
  draft.todos.push({ id: 1, title: "write", done: false });
});
setStore((draft) => {
  // @ts-expect-error — `done` is boolean
  draft.todos[0]!.done = "yes";
});

// ---------------------------------------------------------------------------
// 4. Component types
// ---------------------------------------------------------------------------

export const Label: Component<{ text: string }> = (props) => <span>{props.text}</span>;
export const Card: ParentComponent<{ title: string }> = (props) => (
  <section>
    <h2>{props.title}</h2>
    {props.children}
  </section>
);
export const Divider: VoidComponent = () => <hr />;
export const Repeat2: FlowComponent<{}, () => JSX.Element> = (props) => (
  <>
    {props.children()}
    {props.children()}
  </>
);

export const okCard = (
  <Card title="t">
    <Label text="x" />
  </Card>
);
// @ts-expect-error — VoidComponent forbids children
export const badDivider = <Divider>child</Divider>;
// @ts-expect-error — FlowComponent requires its children
export const missingChildren = <Repeat2 />;

// Passing the accessor instead of its value is the most common Solid 2 type error.
// @ts-expect-error — `text` must be a string, not Accessor<string>
export const accessorAsProp = <Label text={mode} />;
export const valueAsProp = <Label text={mode()} />;

// ---------------------------------------------------------------------------
// 5. merge / omit: typed default props and forwarding
// ---------------------------------------------------------------------------

interface ButtonProps extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

export const Button: Component<ButtonProps> = (props) => {
  const merged = merge({ variant: "primary" as const }, props);
  expectTypeOf(merged.variant).toEqualTypeOf<"primary" | "ghost">();
  const rest = omit(merged, "variant");
  // @ts-expect-error — `variant` was omitted
  rest.variant;
  return <button {...rest} data-variant={merged.variant} />;
};

// ---------------------------------------------------------------------------
// 6. Control flow: <Show> narrows into an accessor; <For> callback shapes per keying mode
// ---------------------------------------------------------------------------

const [current] = createSignal<Todo | undefined>(undefined);
export const showTodo = (
  <Show when={current()} fallback={<p>none</p>}>
    {(todo) => {
      expectTypeOf(todo).toEqualTypeOf<Accessor<Todo>>();
      return <p>{todo().title}</p>;
    }}
  </Show>
);
export const showKeyed = (
  <Show when={current()} keyed>
    {(todo) => {
      expectTypeOf(todo).toEqualTypeOf<Todo>();
      return <p>{todo.title}</p>;
    }}
  </Show>
);

export const forDefault = (
  <For each={store.todos}>
    {(todo, index) => {
      expectTypeOf(todo).toEqualTypeOf<Todo>();
      expectTypeOf(index).toEqualTypeOf<Accessor<number>>();
      return <li>{todo.title}</li>;
    }}
  </For>
);
export const forUnkeyed = (
  <For each={store.todos} keyed={false}>
    {(todo, index) => {
      expectTypeOf(todo).toEqualTypeOf<Accessor<Todo>>();
      expectTypeOf(index).toEqualTypeOf<number>();
      return <li>{todo().title}</li>;
    }}
  </For>
);

// ---------------------------------------------------------------------------
// 7. Context: useContext returns T (a missing provider throws at runtime)
// ---------------------------------------------------------------------------

const ThemeContext = createContext<{ mode: "light" | "dark" }>();
export function ThemedLabel() {
  const theme = useContext(ThemeContext);
  expectTypeOf(theme).toEqualTypeOf<{ mode: "light" | "dark" }>();
  return <span>{theme.mode}</span>;
}
export const provided = (
  <ThemeContext value={{ mode: "dark" }}>
    <ThemedLabel />
  </ThemeContext>
);

// ---------------------------------------------------------------------------
// 8. Events and refs
// ---------------------------------------------------------------------------

export const clicker = (
  <button
    onClick={(e) => {
      // currentTarget is the element the handler is bound to.
      const target: HTMLButtonElement = e.currentTarget;
      const mouse: MouseEvent = e;
      target.blur();
      mouse.preventDefault();
    }}
    ref={(el) => {
      // (expect-type's deep equality is too expensive for DOM types; an assignment checks it.)
      const button: HTMLButtonElement = el;
      button.focus();
    }}
  />
);

// ---------------------------------------------------------------------------
// 9. dynamic(): ValidComponent and ComponentProps (`<Dynamic>` is deprecated in 2.0)
// ---------------------------------------------------------------------------

expectTypeOf<ComponentProps<typeof Label>>().toEqualTypeOf<{ text: string }>();
const [rich] = createSignal(false);
// dynamic() returns a Component whose props are those of the resolved component/tag.
const Field = dynamic(() => (rich() ? Label : Label));
export const field = <Field text="x" />;
// @ts-expect-error — Label requires `text`
export const fieldMissing = <Field />;
const Link = dynamic(() => "a" as const);
export const link = <Link href="/docs" />;

// ---------------------------------------------------------------------------
// 9b. Solid 2.0 removed the `on:` namespace for native events: a compile error
// ---------------------------------------------------------------------------

// @ts-expect-error — `on:click` is not an attribute in Solid 2.0's JSX types
export const nativeNs = <button on:click={() => {}} />;

// ---------------------------------------------------------------------------
// 10. Generator actions: the call signature is derived from the generator
// ---------------------------------------------------------------------------

const saveTodo = action(function* (title: string) {
  yield;
  return { id: 1, title };
});
expectTypeOf(saveTodo).toEqualTypeOf<(title: string) => Promise<{ id: number; title: string }>>();
// @ts-expect-error — the action takes a string
saveTodo(42);
