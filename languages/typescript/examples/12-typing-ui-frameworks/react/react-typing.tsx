/**
 * Module 12 — Typing React 19 components, hooks, events and refs.
 *
 * This file is a *type test*: `tsc -p examples/12-typing-ui-frameworks/react` must pass.
 * Every `// @ts-expect-error` is a negative test: if the line stops being an error,
 * tsc reports TS2578 ("Unused '@ts-expect-error' directive") and the test fails.
 */
import {
  createContext,
  use,
  useActionState,
  useContext,
  useOptimistic,
  useReducer,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type ElementType,
  type FormEvent,
  type JSX,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { expectTypeOf } from "expect-type";

// ---------------------------------------------------------------------------
// 1. Component signatures and what a component may return
// ---------------------------------------------------------------------------

interface GreetingProps {
  name: string;
  children?: ReactNode;
}

// Direct typing of props; no React.FC needed.
export function Greeting({ name, children }: GreetingProps) {
  return (
    <p>
      Hello {name}
      {children}
    </p>
  );
}

// A component may return any ReactNode: strings, numbers, null, arrays.
export const Count = ({ n }: { n: number }) => n;
export const Fragmented = () => ["a", "b"];

const element = <Greeting name="Ada" />;
expectTypeOf(element).toEqualTypeOf<JSX.Element>();
expectTypeOf<JSX.Element>().toExtend<ReactElement>();
expectTypeOf<ReactElement>().toExtend<ReactNode>();
expectTypeOf<string>().toExtend<ReactNode>();
expectTypeOf<string>().not.toExtend<JSX.Element>();

// @ts-expect-error — required prop `name` is missing
export const missingName = <Greeting />;

// ---------------------------------------------------------------------------
// 2. Inheriting and overriding intrinsic element props
// ---------------------------------------------------------------------------

type ButtonProps = Omit<ComponentProps<"button">, "onClick"> & {
  variant: "primary" | "ghost";
  // Narrower than the DOM handler: we only pass the id.
  onClick: (id: string) => void;
};

export function Button({ variant, onClick, ...rest }: ButtonProps) {
  return <button {...rest} data-variant={variant} onClick={() => onClick(rest.id ?? "")} />;
}

export const okButton = <Button variant="ghost" onClick={(id) => id.toUpperCase()} type="submit" />;
// @ts-expect-error — "danger" is not a variant
export const badVariant = <Button variant="danger" onClick={() => {}} />;
// @ts-expect-error — an unknown attribute on a typed component is rejected
export const badAttr = <Button variant="primary" onClick={() => {}} hrefx="/" />;

// ComponentProps<'input'> includes `ref` in React 19; ComponentPropsWithoutRef strips it.
expectTypeOf<ComponentProps<"input">>().toHaveProperty("ref");
expectTypeOf<ComponentPropsWithoutRef<"input">>().not.toHaveProperty("ref");

// ---------------------------------------------------------------------------
// 3. Discriminated-union props and the destructuring trap
// ---------------------------------------------------------------------------

type ModalProps =
  | { variant: "alert"; onConfirm: () => void }
  | { variant: "prompt"; onSubmit: (value: string) => void; defaultValue?: string };

export function Modal(props: ModalProps) {
  // Narrow on the props object (or on a destructured discriminant used *with* the object).
  if (props.variant === "prompt") {
    expectTypeOf(props.onSubmit).toEqualTypeOf<(value: string) => void>();
    return <input defaultValue={props.defaultValue} onBlur={(e) => props.onSubmit(e.currentTarget.value)} />;
  }
  return <button onClick={props.onConfirm}>OK</button>;
}

export const alertModal = <Modal variant="alert" onConfirm={() => {}} />;
// @ts-expect-error — `onSubmit` does not exist on the "alert" member
export const mixedModal = <Modal variant="alert" onConfirm={() => {}} onSubmit={() => {}} />;

// ---------------------------------------------------------------------------
// 4. Generic components and explicit type arguments in JSX
// ---------------------------------------------------------------------------

interface TableProps<TRow> {
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  renderRow: (row: TRow) => ReactNode;
}

export function Table<TRow>({ rows, rowKey, renderRow }: TableProps<TRow>) {
  return (
    <ul>
      {rows.map((row) => (
        <li key={rowKey(row)}>{renderRow(row)}</li>
      ))}
    </ul>
  );
}

interface User {
  id: string;
  name: string;
}
const users: User[] = [{ id: "1", name: "Ada" }];

// TRow is inferred from `rows`; the callbacks are contextually typed.
export const inferred = <Table rows={users} rowKey={(u) => u.id} renderRow={(u) => u.name} />;
// Explicit type argument in JSX.
export const explicit = <Table<User> rows={users} rowKey={(u) => u.id} renderRow={(u) => u.name} />;
// @ts-expect-error — `email` does not exist on User
export const wrongField = <Table rows={users} rowKey={(u) => u.email} renderRow={(u) => u.name} />;

// ---------------------------------------------------------------------------
// 5. Polymorphic `as` prop
// ---------------------------------------------------------------------------

type PolymorphicProps<E extends ElementType, Own = {}> = Own & { as?: E } & Omit<
    ComponentProps<E>,
    keyof Own | "as"
  >;

export function Text<E extends ElementType = "span">({ as, ...rest }: PolymorphicProps<E, { tone?: "muted" }>) {
  const Tag: ElementType = as ?? "span";
  return <Tag {...rest} />;
}

export const asLink = <Text as="a" href="/docs" tone="muted" />;
export const asLabel = <Text as="label" htmlFor="email" />;
// @ts-expect-error — `href` is not a <span> attribute
export const spanWithHref = <Text href="/docs" />;

// ---------------------------------------------------------------------------
// 6. Hooks: useState, useRef overloads, useReducer
// ---------------------------------------------------------------------------

export function HookTypes() {
  const [count, setCount] = useState(0);
  expectTypeOf(count).toEqualTypeOf<number>();
  setCount((c) => c + 1);
  // @ts-expect-error — string is not assignable to SetStateAction<number>
  setCount("1");

  const [maybeUser] = useState<User | null>(null);
  expectTypeOf(maybeUser).toEqualTypeOf<User | null>();

  const [nothing] = useState();
  expectTypeOf(nothing).toEqualTypeOf<undefined>();

  // DOM ref: pass `null`, get RefObject<T | null>. In React 19 `.current` is always writable.
  const inputRef = useRef<HTMLInputElement>(null);
  expectTypeOf(inputRef).toEqualTypeOf<RefObject<HTMLInputElement | null>>();

  // Mutable instance value.
  const timer = useRef<number | undefined>(undefined);
  timer.current = 42;

  // @ts-expect-error — React 19 requires an argument to useRef
  useRef<number>();

  return <input ref={inputRef} />;
}

type CartAction =
  | { type: "add"; sku: string; qty: number }
  | { type: "remove"; sku: string }
  | { type: "clear" };

interface CartState {
  readonly lines: Readonly<Record<string, number>>;
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add":
      return { lines: { ...state.lines, [action.sku]: (state.lines[action.sku] ?? 0) + action.qty } };
    case "remove": {
      const { [action.sku]: _removed, ...rest } = state.lines;
      return { lines: rest };
    }
    case "clear":
      return { lines: {} };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

export function Cart() {
  const [state, dispatch] = useReducer(cartReducer, { lines: {} });
  dispatch({ type: "add", sku: "A1", qty: 1 });
  // @ts-expect-error — `qty` is required for "add"
  dispatch({ type: "add", sku: "A1" });
  // @ts-expect-error — "empty" is not an action type
  dispatch({ type: "empty" });
  return <pre>{JSON.stringify(state)}</pre>;
}

// ---------------------------------------------------------------------------
// 7. Events
// ---------------------------------------------------------------------------

export function SearchBox({ onSearch }: { onSearch: (q: string) => void }) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    // currentTarget is the element the handler is attached to: typed.
    expectTypeOf(e.currentTarget).toEqualTypeOf<EventTarget & HTMLInputElement>();
    onSearch(e.currentTarget.value);
  };
  const onSubmit = (e: FormEvent<HTMLFormElement>) => e.preventDefault();
  return (
    <form onSubmit={onSubmit}>
      <input onChange={onChange} />
      {/* @ts-expect-error — a ChangeEvent<HTMLInputElement> handler cannot go on a <select> */}
      <select onChange={onChange} />
    </form>
  );
}

// ---------------------------------------------------------------------------
// 8. Refs as props (React 19) and ref-callback cleanup
// ---------------------------------------------------------------------------

export function TextInput({ ref, ...rest }: ComponentProps<"input"> & { ref?: Ref<HTMLInputElement> }) {
  return <input ref={ref} {...rest} />;
}

export function RefCallbacks() {
  let node: HTMLDivElement | null = null;
  return (
    <>
      <TextInput ref={useRef<HTMLInputElement>(null)} />
      {/* A ref callback may return a cleanup function. */}
      <div
        ref={(el) => {
          node = el;
          return () => {
            node = null;
          };
        }}
      />
      {/* @ts-expect-error — implicit return of the assignment is not a cleanup function */}
      <div ref={(el) => (node = el)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// 9. Context: default-less context with a safe accessor
// ---------------------------------------------------------------------------

export function createSafeContext<T>(displayName: string) {
  const Ctx = createContext<T | null>(null);
  Ctx.displayName = displayName;
  function useSafe(): T {
    const value = useContext(Ctx);
    if (value === null) throw new Error(`${displayName} is missing its provider`);
    return value;
  }
  return [Ctx, useSafe] as const;
}

const [ThemeContext, useTheme] = createSafeContext<{ mode: "light" | "dark" }>("Theme");

export function ThemedRoot({ children }: { children: ReactNode }) {
  // React 19: the context object itself is the provider.
  return <ThemeContext value={{ mode: "dark" }}>{children}</ThemeContext>;
}

export function ThemedLabel() {
  const theme = useTheme();
  expectTypeOf(theme.mode).toEqualTypeOf<"light" | "dark">();
  return <span>{theme.mode}</span>;
}

// ---------------------------------------------------------------------------
// 10. use(), actions and optimistic state — signatures only
// ---------------------------------------------------------------------------

export function UserName({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise);
  expectTypeOf(user).toEqualTypeOf<User>();
  const theme = use(ThemeContext);
  expectTypeOf(theme).toEqualTypeOf<{ mode: "light" | "dark" } | null>();
  return <b>{user.name}</b>;
}

type SaveState =
  | { status: "idle" }
  | { status: "saved"; id: string }
  | { status: "error"; message: string };

async function saveTodo(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const title = formData.get("title");
  if (typeof title !== "string" || title.length === 0) return { status: "error", message: "title required" };
  return { status: "saved", id: title };
}

export function TodoForm() {
  const [state, formAction, isPending] = useActionState(saveTodo, { status: "idle" });
  expectTypeOf(state).toEqualTypeOf<SaveState>();
  expectTypeOf(formAction).toEqualTypeOf<(payload: FormData) => void>();
  expectTypeOf(isPending).toEqualTypeOf<boolean>();

  const [optimistic, addOptimistic] = useOptimistic(["draft"], (list: string[], item: string) => [...list, item]);
  addOptimistic("next");
  // @ts-expect-error — the optimistic action payload is a string
  addOptimistic(1);

  return (
    <form action={formAction}>
      <input name="title" />
      {state.status === "error" && <p>{state.message}</p>}
      <ul>{optimistic.map((t) => <li key={t}>{t}</li>)}</ul>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 11. A type-level "serializable" constraint for server-function arguments
// ---------------------------------------------------------------------------

type Serializable =
  | string
  | number
  | boolean
  | null
  | undefined
  | bigint
  | Date
  | FormData
  | readonly Serializable[]
  | { readonly [key: string]: Serializable };

function serverFunction<Args extends Serializable[], R extends Serializable>(fn: (...args: Args) => Promise<R>) {
  return fn;
}

export const ok = serverFunction(async (id: string, at: Date) => ({ id, at }));
// @ts-expect-error — a function argument cannot cross the network boundary
export const notOk = serverFunction(async (cb: () => void) => String(cb));

// ---------------------------------------------------------------------------
// 12. Augmenting React's JSX: custom elements and CSS custom properties
// ---------------------------------------------------------------------------

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "my-rating": { value: number; max?: number; children?: never };
    }
  }
  interface CSSProperties {
    [customProperty: `--${string}`]: string | number;
  }
}

export const rating = <my-rating value={4} max={5} />;
// @ts-expect-error — `value` must be a number
export const badRating = <my-rating value="4" />;
export const styled = <div style={{ "--accent": "tomato", color: "var(--accent)" }} />;
