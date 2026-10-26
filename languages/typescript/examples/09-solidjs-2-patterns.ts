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
  createAsync,
  isPending,
  latest,
  resolve,
  refresh,
  NotReadyError,
  ContextNotFoundError,
  createEffect,
  createRenderEffect,
  createStore,
  createProjection,
  storePath,
  snapshot,
  deep,
  merge,
  omit,
  createContext,
  useContext,
  createOptimistic,
  createOptimisticStore,
  action,
  mergeProps,
  splitProps,
  narrowShow,
  narrowFor,
  renderRepeat,
  onSettled,
  onCleanup,
  flush,
  Loading,
  Errored,
  type Accessor,
  type Setter,
  type Signal,
  type Component,
  type ParentComponent,
  type VoidComponent,
  type FlowComponent,
  type MergeProps,
  type RefDirective,
} from "./utils/solid2-shim.ts";

import {
  type Expect,
  type Equal,
  type NotEqual,
  type Extends,
  assert,
  assertEqual,
  assertDeepEqual,
} from "./utils/type-helpers.ts";

console.log("=== 09: SolidJS 2.0 Reactive Patterns ===");

// ============================================================================
// 1. Signals, Accessors & Deterministic Microtask Batching
// ============================================================================

const [count, setCount] = createSignal(10);
type TestCountGet = Expect<Equal<typeof count, Accessor<number>>>;
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
type TestOptionalStrGet = Expect<Equal<typeof optionalStr, Accessor<string | undefined>>>;
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
type TestTotalType = Expect<Equal<typeof total, Accessor<number>>>;

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
type TestAsyncMemoType = Expect<Equal<typeof asyncConvertedPrice, Accessor<number>>>;

// Wait for initial async computation
await new Promise((r) => setTimeout(r, 30));
assertEqual(asyncConvertedPrice(), 200);

flush(() => setCurrency("EUR"));
await new Promise((r) => setTimeout(r, 30));
assertEqual(asyncConvertedPrice(), 184);

// `latest` reads the most recent committed value without suspending.
assertEqual(latest(asyncConvertedPrice), 184);

// ============================================================================
// 3. Solid 2.0 Async Resources (`createAsync`, `isPending`, `resolve`)
// ============================================================================

interface UserProfile {
  id: string;
  name: string;
}

const userResource = createAsync(async () => {
  await new Promise((r) => setTimeout(r, 20));
  return { id: "u123", name: "Martina" } satisfies UserProfile;
});

type TestResourceAccessor = Expect<Equal<typeof userResource, Accessor<UserProfile>>>;

// Checking isPending status before and after resolution
assertEqual(isPending(userResource), true);

const resolvedUser = await resolve(userResource);
assertEqual(resolvedUser.name, "Martina");
assertEqual(isPending(userResource), false);
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

// Update via key and value
setState("user", {
  name: "Alexander",
  preferences: { theme: "dark", notifications: true },
});
assertEqual(state.user.name, "Alexander");
assertEqual(state.user.preferences.theme, "dark");

// Solid 2.0 draft-first store setter
setState((draft) => {
  draft.todos.push({ id: 2, title: "Master TypeScript", completed: true });
});
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
setState(storePath<AppState>("user", "preferences", "theme", "light"));
assertEqual(state.user.preferences.theme, "light");

setState(storePath<AppState>("todos", (item: AppState["todos"][number]) => item.id === 2, "title", (prev: string) => `${prev}!`));
assertEqual(state.todos[1]?.title, "Master TypeScript!");

const [profileState, setProfileState] = createStore<{ name: string; nickname?: string }>({
  name: "Alex",
  nickname: "Lex",
});
setProfileState(storePath("nickname", storePath.DELETE));
assertEqual(profileState.nickname, undefined);

// `snapshot` is an untracked plain copy; `deep` traverses every nested leaf.
const stateSnapshot = snapshot(state);
setState(storePath<AppState>("user", "name", "Snapshot Proof"));
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

// Solid 2.0: the context object is the provider component itself — no `.Provider`.
const AuthContext = createContext<AuthState>({ name: "AuthContext" });

const renderedAuth = AuthContext({
  value: { user: "ada", logout: () => {} },
  children: () => useContext(AuthContext),
});
assertEqual(renderedAuth.user, "ada");

// Reading without an enclosing provider throws `ContextNotFoundError`.
let contextError: unknown;
try {
  useContext(AuthContext);
} catch (err) {
  contextError = err;
}
assert(contextError instanceof ContextNotFoundError);

// `NotReadyError` is the explicit opt-out from async suspension.
let notReady: unknown;
try {
  throw new NotReadyError();
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
  setCart("items", (items) => [...items, item]);
  setCart("status", "pending");
  yield new Promise<void>((resolveDelay) => setTimeout(resolveDelay, 5));
  setCart("status", "confirmed");
  return item;
});

const confirmedItem = await addToCart("keyboard");
assertEqual(confirmedItem, "keyboard");
assertDeepEqual(cart.items, ["keyboard"]);
assertEqual(cart.status, "confirmed");

// `createOptimistic` is a signal overlay; `createOptimisticStore` is a store overlay.
const [optimisticItems, setOptimisticItems] = createOptimistic<string[]>([]);
flush(() => setOptimisticItems(["pending-item"]));
assertDeepEqual(optimisticItems(), ["pending-item"]);

const [optimisticCart, setOptimisticCart] = createOptimisticStore<{ count: number }>(
  { count: 0 },
  { count: 0 }
);
setOptimisticCart("count", 5);
assertEqual(optimisticCart.count, 5);
await refresh(optimisticCart);
assertEqual(optimisticCart.count, 5);

console.log("✓ All 09 SolidJS 2.0 Reactive Patterns tests passed successfully!\n");
