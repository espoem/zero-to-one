/**
 * 08: React 19 TypeScript Patterns
 *
 * Demonstrates modern React 19 typing patterns:
 * - Function components and generic components taking `ref` directly as a prop (no `forwardRef` needed)
 * - Ref callback cleanup functions: `RefCallback<T>` returning `void | (() => void)`
 * - The `use()` API for reading Promises and Contexts (including conditional reads)
 * - `useActionState` for handling form actions and server action lifecycle states
 * - `useOptimistic` for instantaneous UI updates with rollback capability
 * - `useFormStatus` for checking parent form submission status
 * - Context objects as direct JSX Elements (`<ThemeContext value={...}>` without `.Provider`)
 * - Recursive `Serializable<T>` type helper enforcing React Server Component -> Client Component boundaries
 *
 * Type-checked via: `mise exec npm:typescript@latest -- tsc --noEmit -p tsconfig.json`
 */

import React, {
  use,
  useActionState,
  useOptimistic,
  createContext,
  type ReactNode,
  type Ref,
  type RefCallback,
  type ComponentProps,
  type JSX,
} from "react";
import { useFormStatus } from "react-dom";

import {
  type Expect,
  type Equal,
  type Extends,
  type Serializable,
} from "./utils/type-helpers.ts";

// ============================================================================
// 1. Ref as a Standard Prop (Elimination of forwardRef in React 19)
// ============================================================================

/**
 * In React 19, `ref` is passed directly in props just like any other prop!
 * `React.forwardRef` is no longer needed.
 */
export interface TextInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  ref?: Ref<HTMLInputElement>;
}

export function TextInput({ label, value, onChange, ref }: TextInputProps): JSX.Element {
  return (
    <div className="input-group">
      <label>{label}</label>
      <input
        ref={ref}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    </div>
  );
}

// Compile-time check: ComponentProps preserves `ref`
type TextInputPropsInferred = ComponentProps<typeof TextInput>;
type TestRefPropPreserved = Expect<
  Extends<TextInputPropsInferred, { ref?: Ref<HTMLInputElement> }>
>;
type TestRefTypeExact = Expect<
  Equal<TextInputPropsInferred["ref"], Ref<HTMLInputElement> | undefined>
>;

/**
 * Generic components now take `ref` effortlessly without losing generic type inference!
 * (In React 18, `forwardRef` stripped generic type arguments unless wrapped in `fixedForwardRef`).
 */
export interface DataGridProps<T> {
  items: readonly T[];
  renderRow: (item: T) => ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function DataGrid<T>({ items, renderRow, ref }: DataGridProps<T>): JSX.Element {
  return (
    <div ref={ref} className="data-grid">
      {items.map((item, idx) => (
        <div key={idx} className="grid-row">
          {renderRow(item)}
        </div>
      ))}
    </div>
  );
}

// Verification: Generic component usage with ref compiles cleanly
interface Product {
  id: string;
  name: string;
  price: number;
}

export const sampleGrid = (
  <DataGrid<Product>
    items={[{ id: "p1", name: "Laptop", price: 999 }]}
    renderRow={(product) => <span>{product.name}: ${product.price}</span>}
    ref={{ current: null }}
  />
);

// ============================================================================
// 2. Ref Callback Cleanup Functions (React 19)
// ============================================================================

/**
 * In React 19, Ref callbacks can return an optional cleanup function `() => void`.
 * React runs this cleanup function whenever the component unmounts or the ref element changes.
 */
export function useAutoResizeObserver(): RefCallback<HTMLTextAreaElement> {
  return (element) => {
    if (!element) return;

    // Attach external observer
    const observer = {
      disconnect: () => {},
    };

    // Return cleanup callback (Type: () => void)
    return () => {
      observer.disconnect();
    };
  };
}

// Compile-time check: RefCallback permits returning cleanup function `() => void`
type TestRefCallbackWithCleanup = Expect<
  Extends<(el: HTMLDivElement | null) => () => void, RefCallback<HTMLDivElement>>
>;
type TestRefCallbackVoid = Expect<
  Extends<(el: HTMLDivElement | null) => void, RefCallback<HTMLDivElement>>
>;

// ============================================================================
// 3. The `use()` API for Promises & Context
// ============================================================================

export interface UserDetails {
  id: string;
  username: string;
  email: string;
}

/**
 * React 19 `use(Promise)` unwraps promises directly during rendering.
 * Suspends the component until the promise resolves.
 */
export function UserCard({ userPromise }: { userPromise: Promise<UserDetails> }): JSX.Element {
  const user = use(userPromise);

  type TestUnwrappedUser = Expect<Equal<typeof user, UserDetails>>;

  return (
    <div className="user-card">
      <h3>{user.username}</h3>
      <p>{user.email}</p>
    </div>
  );
}

export type Theme = "light" | "dark" | "high-contrast";
export const ThemeContext = createContext<Theme>("light");

/**
 * In React 19, `use(Context)` can be called conditionally inside if-statements or loops,
 * unlike `useContext` which was subject to the strict Rules of Hooks!
 */
export function NavMenu({ overrideTheme }: { overrideTheme?: Theme }): JSX.Element {
  let theme: Theme;
  if (overrideTheme) {
    theme = overrideTheme;
  } else {
    // Conditional context read via `use()`!
    theme = use(ThemeContext);
  }

  return <div className={`nav-menu theme-${theme}`}>Navigation</div>;
}

// ============================================================================
// 4. Server Actions & `useActionState` (Replacing useFormState)
// ============================================================================

export interface CartState {
  itemCount: number;
  lastUpdated: number;
  error: string | null;
}

export async function addCartItemAction(
  prevState: CartState,
  formData: FormData
): Promise<CartState> {
  const itemId = formData.get("itemId");
  if (!itemId) {
    return { ...prevState, error: "Missing itemId" };
  }
  return {
    itemCount: prevState.itemCount + 1,
    lastUpdated: Date.now(),
    error: null,
  };
}

export function CartWidget(): JSX.Element {
  const [state, formAction, isPending] = useActionState(addCartItemAction, {
    itemCount: 0,
    lastUpdated: 0,
    error: null,
  });

  // Compile-time checks for `useActionState` return tuple
  type TestState = Expect<Equal<typeof state, CartState>>;
  type TestDispatch = Expect<Equal<typeof formAction, (payload: FormData) => void>>;
  type TestIsPending = Expect<Equal<typeof isPending, boolean>>;

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value="item_99" />
      <button type="submit" disabled={isPending}>
        {isPending ? "Adding..." : `Add to Cart (${state.itemCount})`}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}

// ============================================================================
// 5. Optimistic UI Updates with `useOptimistic`
// ============================================================================

export interface Comment {
  id: string;
  text: string;
  isOptimistic?: boolean;
}

export function CommentFeed({
  initialComments,
  onAddComment,
}: {
  initialComments: Comment[];
  onAddComment: (text: string) => Promise<void>;
}): JSX.Element {
  const [optimisticComments, addOptimisticComment] = useOptimistic(
    initialComments,
    (state: Comment[], newText: string): Comment[] => [
      ...state,
      { id: `temp-${Date.now()}`, text: newText, isOptimistic: true },
    ]
  );

  // Compile-time checks for `useOptimistic`
  type TestOptimisticState = Expect<Equal<typeof optimisticComments, Comment[]>>;
  type TestSetOptimistic = Expect<Equal<typeof addOptimisticComment, (optimisticValue: string) => void>>;

  return (
    <div className="comment-feed">
      <ul>
        {optimisticComments.map((c) => (
          <li key={c.id} className={c.isOptimistic ? "opacity-50" : ""}>
            {c.text} {c.isOptimistic && "(sending...)"}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={async () => {
          addOptimisticComment("Great post!");
          await onAddComment("Great post!");
        }}
      >
        Quick Comment
      </button>
    </div>
  );
}

// ============================================================================
// 6. Form Submission Status with `useFormStatus`
// ============================================================================

export function SubmitButton({ idleLabel, pendingLabel }: { idleLabel: string; pendingLabel: string }): JSX.Element {
  const status = useFormStatus();

  return (
    <button type="submit" disabled={status.pending}>
      {status.pending ? pendingLabel : idleLabel}
    </button>
  );
}

// ============================================================================
// 7. Context as a Direct JSX Element (React 19)
// ============================================================================

/**
 * In React 19, `<Context value={...}>` can be rendered directly as a JSX Element
 * without writing `<Context.Provider value={...}>`!
 */
export function AppThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ThemeContext value="dark">
      <div className="app-shell">{children}</div>
    </ThemeContext>
  );
}

// Backward compatibility: `<Context.Provider>` remains supported
export function LegacyAppThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  return (
    <ThemeContext.Provider value="light">
      <div className="app-shell">{children}</div>
    </ThemeContext.Provider>
  );
}

// ============================================================================
// 8. RSC -> Client Component Boundary Serialization (`Serializable<T>`)
// ============================================================================

/**
 * In React Server Components (RSC), props passed from Server Components
 * to Client Components ('use client') must be serializable over the wire via the
 * React Flight protocol.
 *
 * Supported:
 * - Primitives (string, number, boolean, null, undefined, bigint)
 * - Dates
 * - Arrays of serializable items
 * - Plain objects with serializable values
 *
 * Forbidden:
 * - Functions / event callbacks
 * - Symbols
 */

// 1. Valid RSC Props
export interface ValidClientProps {
  id: string;
  count: number;
  isActive: boolean;
  timestamp: Date;
  tags: string[];
  metadata: {
    author: string;
    views: bigint;
  };
}

type TestValidPropsSerializable = Expect<Equal<Serializable<ValidClientProps>, ValidClientProps>>;

// 2. Rejecting Functions
type FuncProp = {
  id: string;
  onClick: () => void;
};
// `onClick` evaluates to `never` because functions cannot cross the RSC boundary!
type TestFunctionRejected = Expect<Equal<Serializable<FuncProp>, { id: string; onClick: never }>>;

// 3. Rejecting Symbols
type SymbolProp = {
  token: symbol;
};
type TestSymbolRejected = Expect<Equal<Serializable<SymbolProp>, { token: never }>>;

// 4. Primitive validations
type TestStringSerializable = Expect<Equal<Serializable<string>, string>>;
type TestDateSerializable = Expect<Equal<Serializable<Date>, Date>>;
type TestBigIntSerializable = Expect<Equal<Serializable<bigint>, bigint>>;
type TestFunctionDirect = Expect<Equal<Serializable<() => void>, never>>;
type TestSymbolDirect = Expect<Equal<Serializable<symbol>, never>>;

/**
 * High-order type constraint ensuring that a Client Component prop interface
 * contains ONLY valid serializable types across the wire.
 */
export type EnforceRscBoundary<T> = Equal<Serializable<T>, T> extends true ? T : never;

type TestEnforceValid = Expect<Equal<EnforceRscBoundary<ValidClientProps>, ValidClientProps>>;
type TestEnforceInvalid = Expect<Equal<EnforceRscBoundary<FuncProp>, never>>;
