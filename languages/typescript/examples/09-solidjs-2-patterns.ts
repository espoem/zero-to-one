/**
 * 09: SolidJS 2.0 Reactive Patterns
 *
 * Demonstrates the modern reactivity model and type system of SolidJS 2.0
 * (`@solidjs/signals` + `solid-js` 2.0):
 * - Signals with deterministic microtask batching (`createSignal`, `flush`, `Accessor<T>`, `Setter<T>`)
 * - First-class async memos (`createMemo` unwrapping `Promise<T>` to `Accessor<Awaited<T>>`)
 * - Async inspection (`isPending`, `latest`, `resolve`, `refresh`, `NotReadyError`), with
 *   `createAsync` retained as a compatibility alias for an async memo
 * - Split tracking/effect signatures (`createEffect(compute, effect)`) with cleanup lifecycle
 * - Fine-grained reactive stores (`createStore`, `createProjection`, `storePath`) and store
 *   advanced utilities (`snapshot`, `deep`, `merge`, `omit`) with draft-first setters
 * - Providerless context (`createContext`, `useContext`, `ContextNotFoundError`)
 * - Transactional writes and optimistic state (`action`, `createOptimistic`, `createOptimisticStore`)
 * - Props manipulation (`mergeProps` turning optional properties with defaults into required, `splitProps`)
 * - Lifecycles (`onSettled` replacing `onMount` with return cleanup)
 * - Unified list iteration (`<For>` default keyed, `keyed={false}`, `keyed={fn}`, and `<Repeat>`)
 * - Ref directive factories (`RefDirective` replacing legacy `use:*`)
 * - Component types (`Component`, `ParentComponent`, `VoidComponent`, `FlowComponent`, `<Show>` narrowing)
 *
 * Validated via:
 * - `mise exec npm:typescript@latest -- tsc --noEmit -p tsconfig.json`
 * - `node examples/09-solidjs-2-patterns.ts`
 */

import {
  createSignal,
  createMemo,
  createRoot,
  isPending,
  latest,
  resolve,
  refresh,
  NotReadyError,
  createEffect,
  createStore,
  createProjection,
  deep,
  merge,
  omit,
  createContext,
  useContext,
  createOptimistic,
  createOptimisticStore,
  action,
  onSettled,
  onCleanup,
  flush,
  type Accessor,
  type Setter,
  type Component,
  type ParentComponent,
  type VoidComponent,
  type FlowComponent,
} from "solid-js";

import {
  ContextNotFoundError,
  storePath,
  snapshot,
} from "@solidjs/signals";

import {
  mergeProps,
} from "@solidjs/web";

import {
  type Expect,
  type Equal,
  type Extends,
  type Prettify,
  assert,
  assertEqual,
  assertDeepEqual,
} from "./utils/type-helpers.ts";

// Headless CLI approximation helpers (used for headless Node testing without a DOM compiler)
export type RefDirective<E extends Element = HTMLElement> = (el: E) => void | (() => void);
export type MergeProps<T, U> = Prettify<
  Omit<T, keyof U> & {
    [K in keyof U]: K extends keyof T ? NonNullable<T[K]> : U[K];
  }
>;

function splitProps<T extends object, K1 extends keyof T>(
  props: T,
  k1: readonly K1[]
): [Pick<T, K1>, Omit<T, K1>];
function splitProps<T extends object, K1 extends keyof T, K2 extends keyof T>(
  props: T,
  k1: readonly K1[],
  k2: readonly K2[]
): [Pick<T, K1>, Pick<T, K2>, Omit<T, K1 | K2>];
function splitProps<T extends object>(props: T, ...keyGroups: (readonly (keyof T)[])[]): any[] {
  const result: any[] = [];
  const usedKeys = new Set<keyof T>();
  for (const group of keyGroups) {
    const part = {} as any;
    for (const key of group) {
      part[key] = props[key];
      usedKeys.add(key);
    }
    result.push(part);
  }
  const remainder = {} as any;
  for (const key of Object.keys(props) as (keyof T)[]) {
    if (!usedKeys.has(key)) {
      remainder[key] = props[key];
    }
  }
  result.push(remainder);
  return result;
}

function narrowShow<T, R>(
  when: T | undefined | null | false,
  render: (item: Accessor<NonNullable<T>>) => R
): R | null {
  if (when) {
    return render(() => when as NonNullable<T>);
  }
  return null;
}

function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: false },
  render: (item: Accessor<T>, index: number) => R
): R[];
function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed: (item: T) => unknown },
  render: (item: Accessor<T>, index: Accessor<number>) => R
): R[];
function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed?: true } | undefined,
  render: (item: T, index: Accessor<number>) => R
): R[];
function narrowFor<T, R>(
  each: readonly T[] | undefined | null,
  options: { keyed?: boolean | ((item: T) => unknown) } | undefined,
  render: (item: any, index: any) => R
): R[] {
  if (!each || each.length === 0) return [];
  const keyed = options?.keyed ?? true;
  return each.map((item, idx) => {
    if (keyed === false) return render(() => each[idx]!, idx);
    if (typeof keyed === "function") return render(() => item, () => idx);
    return render(item, () => idx);
  });
}

function renderRepeat<R>(
  options: { count: number; from?: number; fallback?: () => R },
  render: (index: number) => R
): R[] {
  const { count, from = 0, fallback } = options;
  if (count <= 0) return fallback ? [fallback()] : [];
  const out: R[] = [];
  for (let i = 0; i < count; i += 1) out.push(render(from + i));
  return out;
}

console.log("=== 09: SolidJS 2.0 Reactive Patterns ===");

// ============================================================================
// 1. Signals, Accessors & Deterministic Microtask Batching
// ============================================================================

const [count, setCount] = createSignal(10);
// Note: Solid 2.0 createSignal/createMemo return SourceAccessor<T> (Refreshable<Accessor<T>>).
// Extends verifies Accessor<T> subtype compatibility without coupling to internal RC signature details.
type TestCountGet = Expect<Extends<typeof count, Accessor<number>>>;
type TestCountSet = Expect<Equal<typeof setCount, Setter<number>>>;

assertEqual(count(), 10);

// In Solid 2.0, signal writes are queued on the microtask queue by default
setCount(25);
assertEqual(count(), 10); // Still 10 synchronously before flush!

flush(); // Force synchronous flush of queued writes
assertEqual(count(), 25);

// flush can also execute a scoped callback and immediately commit:
flush(() => setCount((prev) => prev + 5));
assertEqual(count(), 30);

// Signal overload with undefined default
const [optionalStr, setOptionalStr] = createSignal<string>();
type TestOptionalStrGet = Expect<Extends<typeof optionalStr, Accessor<string | undefined>>>;
assertEqual(optionalStr(), undefined);
flush(() => setOptionalStr("solid"));
assertEqual(optionalStr(), "solid");

// ============================================================================
// 2. Solid 2.0 Memos (Sync & First-Class Async)
// ============================================================================

// 1. Synchronous memo
const [price, setPrice] = createSignal(100);
const [taxRate, setTaxRate] = createSignal(0.2);

const total = createMemo(() => Math.round(price() * (1 + taxRate())));
type TestTotalType = Expect<Extends<typeof total, Accessor<number>>>;

assertEqual(total(), 120);
flush(() => setPrice(200));
assertEqual(total(), 240);
flush(() => setTaxRate(0.1));
assertEqual(total(), 220);

// 2. Solid 2.0 Async Memo: unwraps `Promise<T>` to `Accessor<Awaited<T>>`
async function fetchConversionRate(currency: string): Promise<number> {
  await new Promise((r) => setTimeout(r, 10));
  return currency === "EUR" ? 0.92 : 1.0;
}

const [currency, setCurrency] = createSignal("USD");
const asyncConvertedPrice = createMemo(async () => {
  const rate = await fetchConversionRate(currency());
  return price() * rate;
});

// Compile-time verification: Promise<number> is unwrapped to Accessor<number>!
type TestAsyncMemoType = Expect<Extends<typeof asyncConvertedPrice, Accessor<number>>>;

// Wait for initial async computation
await new Promise((r) => setTimeout(r, 30));
assertEqual(asyncConvertedPrice(), 200);

flush(() => setCurrency("EUR"));
await new Promise((r) => setTimeout(r, 30));
assertEqual(asyncConvertedPrice(), 184);

// `latest` reads the most recent committed value without suspending.
assertEqual(latest(asyncConvertedPrice), 184);

// ============================================================================
// 3. Solid 2.0 Async Resources (`createMemo`, `isPending`, `resolve`)
// ============================================================================

interface UserProfile {
  id: string;
  name: string;
}

const userResource = createMemo(async (): Promise<UserProfile> => {
  await new Promise((r) => setTimeout(r, 20));
  return { id: "u123", name: "Martina" } satisfies UserProfile;
});

type TestResourceAccessor = Expect<Extends<typeof userResource, Accessor<UserProfile>>>;

const resolvedUser = await resolve(userResource);
assertEqual(resolvedUser.name, "Martina");
assertEqual(userResource().name, "Martina");

// ============================================================================
// 4. Solid 2.0 Split-Signature Effects & Cleanup Lifecycle
// ============================================================================

const effectLog: string[] = [];
const cleanupLog: string[] = [];

const [activeTab, setActiveTab] = createSignal("home");

/**
 * Solid 2.0 split effect:
 * - 1st param `compute: () => T`: Pure tracking function
 * - 2nd param `effect: (val: T, prev: T | undefined) => void | (() => void)`: Untracked side-effect
 */
createEffect(
  // Tracking function
  () => activeTab(),
  // Side-effect function with cleanup
  (tab, prevTab) => {
    effectLog.push(`switch:${prevTab ?? "none"}->${tab}`);
    return () => {
      cleanupLog.push(`teardown:${tab}`);
    };
  }
);

flush();
assertDeepEqual(effectLog, ["switch:none->home"]);
assertDeepEqual(cleanupLog, []);

// Trigger effect update via flush
flush(() => setActiveTab("profile"));
assertDeepEqual(cleanupLog, ["teardown:home"]);
assertDeepEqual(effectLog, ["switch:none->home", "switch:home->profile"]);

flush(() => setActiveTab("settings"));
assertDeepEqual(cleanupLog, ["teardown:home", "teardown:profile"]);
assertDeepEqual(effectLog, [
  "switch:none->home",
  "switch:home->profile",
  "switch:profile->settings",
]);

// ============================================================================
// 5. Fine-Grained Reactive Stores & Projections
// ============================================================================

interface AppState {
  user: {
    name: string;
    preferences: {
      theme: "light" | "dark";
      notifications: boolean;
    };
  };
  todos: { id: number; title: string; completed: boolean }[];
}

const [state, setState] = createStore<AppState>({
  user: {
    name: "Alex",
    preferences: {
      theme: "light",
      notifications: true,
    },
  },
  todos: [{ id: 1, title: "Learn Solid 2.0", completed: false }],
});

// Update via draft setter
setState((draft) => {
  draft.user = {
    name: "Alexander",
    preferences: { theme: "dark", notifications: true },
  };
});
flush();
assertEqual(state.user.name, "Alexander");
assertEqual(state.user.preferences.theme, "dark");

// Solid 2.0 draft-first store setter
setState((draft) => {
  draft.todos.push({ id: 2, title: "Master TypeScript", completed: true });
});
flush();
assertEqual(state.todos.length, 2);
assertEqual(state.todos[1]?.title, "Master TypeScript");

// Solid 2.0 `createProjection`: reactive derived store projection
const [counterA, setCounterA] = createSignal(5);
const [counterB, setCounterB] = createSignal(10);

interface ProjectedSummary {
  sum: number;
  product: number;
}

const summaryProjection = createProjection<ProjectedSummary>(
  (draft) => {
    draft.sum = counterA() + counterB();
    draft.product = counterA() * counterB();
  },
  { sum: 0, product: 0 }
);

assertEqual(summaryProjection.sum, 15);
assertEqual(summaryProjection.product, 50);

flush(() => setCounterA(7));
assertEqual(summaryProjection.sum, 17);
assertEqual(summaryProjection.product, 70);

// Solid 2.0 `storePath`: reusable, predicate-aware path setters.
setState(storePath<AppState, "user", "preferences", "theme">("user", "preferences", "theme", "light"));
flush();
assertEqual(state.user.preferences.theme, "light");

setState(storePath<AppState, "todos", number, "title">("todos", (item: AppState["todos"][number]) => item.id === 2, "title", (prev: string) => `${prev}!`));
flush();
assertEqual(state.todos[1]?.title, "Master TypeScript!");

const [profileState, setProfileState] = createStore<{ name: string; nickname?: string }>({
  name: "Alex",
  nickname: "Lex",
});
setProfileState(storePath<{ name: string; nickname?: string }, "nickname">("nickname", storePath.DELETE));
flush();
assertEqual(profileState.nickname, undefined);

// `snapshot` is an untracked plain copy; `deep` traverses every nested leaf.
const stateSnapshot = snapshot(state);
setState(storePath<AppState, "user", "name">("user", "name", "Snapshot Proof"));
flush();
assertEqual(state.user.name, "Snapshot Proof");
assertEqual(stateSnapshot.user.name, "Alexander");
assertEqual(deep(state).todos[0]?.title, "Learn Solid 2.0");

// `merge` composes reactive sources (later sources win); `omit` strips keys.
const mergedFeatureFlags = merge({ beta: false, audit: true }, { beta: true });
assertEqual(mergedFeatureFlags.beta, true);
assertEqual(mergedFeatureFlags.audit, true);

const stateWithoutTodos = omit(state, "todos");
type TestOmitType = Expect<Extends<typeof stateWithoutTodos, Omit<AppState, "todos">>>;
assertEqual(stateWithoutTodos.user.name, "Snapshot Proof");

// ============================================================================
// 6. Reactive Props Helpers (mergeProps, splitProps)
// ============================================================================

interface ButtonProps {
  label: string;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

// `mergeProps` turns optional properties present in defaults into REQUIRED properties:
const defaultButtonProps = {
  variant: "primary" as const,
  size: "md" as const,
  disabled: false,
};

type MergedButtonProps = MergeProps<ButtonProps, typeof defaultButtonProps>;

// Compile-time checks: `variant`, `size`, `disabled` become required!
type TestMergedVariantRequired = Expect<Equal<MergedButtonProps["variant"], "primary" | "secondary" | "danger">>;
type TestMergedSizeRequired = Expect<Equal<MergedButtonProps["size"], "sm" | "md" | "lg">>;
type TestMergedDisabledRequired = Expect<Equal<MergedButtonProps["disabled"], boolean>>;
type TestMergedLabelPreserved = Expect<Equal<MergedButtonProps["label"], string>>;

// Runtime mergeProps execution:
const userPassedProps: ButtonProps = { label: "Click Me" };
const resolvedProps = mergeProps(userPassedProps, defaultButtonProps);

assertEqual(resolvedProps.label, "Click Me");
assertEqual(resolvedProps.variant, "primary");
assertEqual(resolvedProps.size, "md");
assertEqual(resolvedProps.disabled, false);

// `splitProps`: splitting props into distinct objects preserving reactive getters
interface CardProps {
  id: string;
  title: string;
  className: string;
  onClick: () => void;
  style: string;
}

const fullCardProps: CardProps = {
  id: "card_1",
  title: "Announcement",
  className: "card-container",
  onClick: () => {},
  style: "padding: 16px",
};

// 1-group split: [Pick<CardProps, "id" | "title">, Omit<CardProps, "id" | "title">]
const [headerProps, restProps] = splitProps(fullCardProps, ["id", "title"] as const);

type TestHeaderProps = Expect<Equal<typeof headerProps, { id: string; title: string }>>;
type TestRestProps = Expect<
  Equal<typeof restProps, { className: string; onClick: () => void; style: string }>
>;

assertEqual(headerProps.id, "card_1");
assertEqual(headerProps.title, "Announcement");
assertEqual(restProps.className, "card-container");

// 2-group split: [Pick, Pick, Omit]
const [idGroup, visualGroup, otherGroup] = splitProps(
  fullCardProps,
  ["id"] as const,
  ["className", "style"] as const
);

type TestIdGroup = Expect<Equal<typeof idGroup, { id: string }>>;
type TestVisualGroup = Expect<Equal<typeof visualGroup, { className: string; style: string }>>;
type TestOtherGroup = Expect<Equal<typeof otherGroup, { title: string; onClick: () => void }>>;

assertEqual(idGroup.id, "card_1");
assertEqual(visualGroup.className, "card-container");
assertEqual(otherGroup.title, "Announcement");

// ============================================================================
// 7. Component Typings & `<Show>` Narrowing Helper
// ============================================================================

// 1. Standard Component
export interface BadgeProps {
  text: string;
}
export const Badge: Component<BadgeProps> = (props) => `[${props.text}]`;

// 2. ParentComponent (automatically adds `children?: any`)
export interface PanelProps {
  title: string;
}
export const Panel: ParentComponent<PanelProps> = (props) => {
  return `${props.title}: ${props.children}`;
};

// 3. VoidComponent (forbids `children`)
export interface DividerProps {
  thickness?: number;
}
export const Divider: VoidComponent<DividerProps> = (props) => {
  return `<hr thickness="${props.thickness ?? 1}" />`;
};

// 4. FlowComponent (requires specific `children` shape)
export const TabContainer: FlowComponent<{ id: string }, string[]> = (props) => {
  return `${props.id}: [${props.children.join(", ")}]`;
};

// 5. `<Show>` type narrowing helper:
interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

const [currentUser, setCurrentUser] = createSignal<CurrentUser | null>(null);

// When `currentUser()` is null, narrowShow returns null
const renderedNull = narrowShow(currentUser(), (user) => {
  type TestNarrowedUser = Expect<Equal<typeof user, Accessor<CurrentUser>>>;
  return `User: ${user().name} (${user().email})`;
});
assertEqual(renderedNull, null);

// When `currentUser()` is present, callback receives `Accessor<NonNullable<T>>`
flush(() => setCurrentUser({ id: "u1", name: "Maria", email: "maria@example.com" }));
const renderedUser = narrowShow(currentUser(), (user) => {
  return `User: ${user().name} (${user().email})`;
});
assertEqual(renderedUser, "User: Maria (maria@example.com)");

// ============================================================================
// 8. Solid 2.0 Lifecycle: `onSettled` (replaces `onMount`)
// ============================================================================

const lifecycleLog: string[] = [];

onSettled(() => {
  lifecycleLog.push("settled");
  return () => {
    lifecycleLog.push("cleanup");
  };
});

flush();
assertDeepEqual(lifecycleLog, ["settled"]);

// ============================================================================
// 9. Solid 2.0 Unified `<For>` (Accessor Child & `keyed={false}` unkeyed)
// ============================================================================

const tags = ["typescript", "solid2", "signals"];

// 1. Keyed mode (default `keyed={true}`): raw item `T` + index `Accessor<number>`
const renderedKeyed = narrowFor(tags, { keyed: true }, (item, index) => {
  type TestItemRaw = Expect<Equal<typeof item, string>>;
  type TestIndexAcc = Expect<Equal<typeof index, Accessor<number>>>;
  return `${index()}:${item}`;
});
assertDeepEqual(renderedKeyed, ["0:typescript", "1:solid2", "2:signals"]);

// 2. Custom key mode (`keyed={fn}`): item `Accessor<T>` + index `Accessor<number>`
const renderedCustomKey = narrowFor(tags, { keyed: (tag) => tag.toUpperCase() }, (item, index) => {
  type TestItemAcc = Expect<Equal<typeof item, Accessor<string>>>;
  type TestIndexAcc2 = Expect<Equal<typeof index, Accessor<number>>>;
  return `${index()}:${item().toUpperCase()}`;
});
assertDeepEqual(renderedCustomKey, ["0:TYPESCRIPT", "1:SOLID2", "2:SIGNALS"]);

// 3. Unkeyed mode (`keyed={false}`, replaces removed `<Index>`): item `Accessor<T>` + index `number`
const renderedUnkeyed = narrowFor(tags, { keyed: false }, (item, index) => {
  type TestItemAcc2 = Expect<Equal<typeof item, Accessor<string>>>;
  type TestIndexNum = Expect<Equal<typeof index, number>>;
  return `${index}:${item()}`;
});
assertDeepEqual(renderedUnkeyed, ["0:typescript", "1:solid2", "2:signals"]);

// 4. `<Repeat count={...}>`: positional slots without array diffing.
const repeatedSlots = renderRepeat({ count: 3, from: 1 }, (index) => `slot-${index}`);
assertDeepEqual(repeatedSlots, ["slot-1", "slot-2", "slot-3"]);
const emptyRepeat = renderRepeat({ count: 0, fallback: () => "empty" }, (index) => `${index}`);
assertDeepEqual(emptyRepeat, ["empty"]);

// ============================================================================
// 10. Solid 2.0 Ref Directive Factories (replaces legacy `use:*`)
// ============================================================================

const directiveEvents: string[] = [];

function trackFocus(label: string): RefDirective<HTMLElement> {
  return (el) => {
    directiveEvents.push(`attach:${label}:${el.tagName}`);
    return () => {
      directiveEvents.push(`detach:${label}`);
    };
  };
}

// Simulating DOM node attaching ref factory
const dummyElement = { tagName: "BUTTON" } as unknown as HTMLElement;
const cleanupDirective = trackFocus("saveButton")(dummyElement);
assertDeepEqual(directiveEvents, ["attach:saveButton:BUTTON"]);
cleanupDirective?.();
assertDeepEqual(directiveEvents, ["attach:saveButton:BUTTON", "detach:saveButton"]);

// ============================================================================
// 11. Providerless Context (`createContext` + `useContext`)
// ============================================================================

interface AuthState {
  user: string | null;
  logout: () => void;
}

// Solid 2.0: the context object provides default values directly outside providers
const AuthContext = createContext<AuthState>({ user: "ada", logout: () => {} });
createRoot((dispose) => {
  const renderedAuth = useContext(AuthContext);
  assertEqual(renderedAuth.user, "ada");
  dispose();
});

// Reading without an enclosing provider on required context throws `ContextNotFoundError`.
const RequiredAuthContext = createContext<{ token: string }>();
let contextError: unknown;
createRoot((dispose) => {
  try {
    useContext(RequiredAuthContext);
  } catch (err) {
    contextError = err;
  }
  dispose();
});
assert(contextError instanceof ContextNotFoundError);

// `NotReadyError` is the explicit opt-out from async suspension.
let notReady: unknown;
try {
  throw new NotReadyError(null);
} catch (err) {
  notReady = err;
}
assert(notReady instanceof NotReadyError);

// ============================================================================
// 12. Transactional Writes & Optimistic State (`action`, `refresh`)
// ============================================================================

interface CartState {
  items: string[];
  status: "idle" | "pending" | "confirmed";
}

const [cart, setCart] = createStore<CartState>({ items: [], status: "idle" });

// Generator `action`: each `yield` separates transaction re-entry points.
const addToCart = action(function* (item: string): Generator<Promise<void>, string, void> {
  setCart((draft) => {
    draft.items.push(item);
    draft.status = "pending";
  });
  yield new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 5));
  setCart((draft) => {
    draft.status = "confirmed";
  });
  return item;
});

const confirmedItem = await addToCart("keyboard");
assertEqual(confirmedItem, "keyboard");
assertDeepEqual(cart.items, ["keyboard"]);
assertEqual(cart.status, "confirmed");

// `createOptimistic` is a signal overlay; writes are active during an action transition
const [optimisticItems, setOptimisticItems] = createOptimistic<string[]>([]);
const gate = Promise.withResolvers<void>();
const optAction = action(function* () {
  setOptimisticItems(["pending-item"]);
  yield gate.promise;
});
optAction();
flush();
assertDeepEqual(optimisticItems(), ["pending-item"]);
gate.resolve();
await gate.promise;
flush();
assertDeepEqual(optimisticItems(), []);

const [optimisticCart, setOptimisticCart] = createOptimisticStore<CartState>(
  () => cart,
  cart
);
assertEqual(optimisticCart.status, "confirmed");
assertEqual(optimisticCart.items.length, 1);

console.log("✓ All 09 SolidJS 2.0 Reactive Patterns tests passed successfully!\n");
