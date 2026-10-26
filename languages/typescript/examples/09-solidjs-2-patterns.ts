/**
 * 09: SolidJS 2.0 Reactive Patterns
 *
 * Demonstrates the modern reactivity model and type system of SolidJS 2.0
 * (`@solidjs/signals` + `solid-js` 2.0):
 * - Signals (`createSignal`, `Accessor<T>`, `Setter<T>`)
 * - First-class async memos (`createMemo` unwrapping `Promise<T>` to `Accessor<Awaited<T>>`)
 * - Async resources (`createAsync`, `isPending`, `resolve`)
 * - Split tracking/effect signatures (`createEffect(compute, effect)`) with cleanup lifecycle
 * - Fine-grained reactive stores (`createStore`, `produce`) & derived projections (`createProjection`)
 * - Props manipulation (`mergeProps` turning optional properties with defaults into required, `splitProps`)
 * - Component types (`Component`, `ParentComponent`, `VoidComponent`, `FlowComponent`) and `<Show>` narrowing
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
  resolve,
  createEffect,
  createRenderEffect,
  createStore,
  produce,
  createProjection,
  mergeProps,
  splitProps,
  narrowShow,
  type Accessor,
  type Setter,
  type Signal,
  type Component,
  type ParentComponent,
  type VoidComponent,
  type FlowComponent,
  type MergeProps,
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
// 1. Signals & Accessors
// ============================================================================

const [count, setCount] = createSignal(10);
type TestCountGet = Expect<Equal<typeof count, Accessor<number>>>;
type TestCountSet = Expect<Equal<typeof setCount, Setter<number>>>;

assertEqual(count(), 10);
setCount(25);
assertEqual(count(), 25);
setCount((prev) => prev + 5);
assertEqual(count(), 30);

// Signal overload with undefined default
const [optionalStr, setOptionalStr] = createSignal<string>();
type TestOptionalStrGet = Expect<Equal<typeof optionalStr, Accessor<string | undefined>>>;
assertEqual(optionalStr(), undefined);
setOptionalStr("solid");
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
setPrice(200);
assertEqual(total(), 240);
setTaxRate(0.1);
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

setCurrency("EUR");
await new Promise((r) => setTimeout(r, 30));
assertEqual(asyncConvertedPrice(), 184);

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

// Trigger effect update
setActiveTab("profile");
assertDeepEqual(cleanupLog, ["teardown:home"]);
assertDeepEqual(effectLog, ["switch:none->home", "switch:home->profile"]);

setActiveTab("settings");
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

// Update via `produce` mutator
setState(
  produce((draft) => {
    draft.todos.push({ id: 2, title: "Master TypeScript", completed: true });
  })
);
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

setCounterA(7);
assertEqual(summaryProjection.sum, 17);
assertEqual(summaryProjection.product, 70);

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
setCurrentUser({ id: "u1", name: "Maria", email: "maria@example.com" });
const renderedUser = narrowShow(currentUser(), (user) => {
  return `User: ${user().name} (${user().email})`;
});
assertEqual(renderedUser, "User: Maria (maria@example.com)");

console.log("✓ All 09 SolidJS 2.0 Reactive Patterns tests passed successfully!\n");
