# Module 10: Advanced React with TypeScript — Props, Generics, Hooks, Types Deep Dive, & Patterns
**Weeks 24–26 | Total TypeScript Professional Course**

---

## Overview & Mental Model

While foundational React with TypeScript deals with basic component props and standard hooks, production React architectures demand advanced type engineering. Large applications must prevent invalid UI states at compile time, create reusable generic components, eliminate `null` checks across deeply nested context consumers, build polymorphic design system primitives, and type third-party library abstractions.

This module covers the complete curriculum of the **Advanced React with TypeScript** workshop:
1. **Advanced Props**: Mutually exclusive props via discriminated unions, clean destructuring, boolean discriminators, and `Record<string, never>` to forbid excess props.
2. **Generic Components & Type Helpers**: `Table<TRow>`, `Select<TOption>`, DRYing out component props with generic type helpers, and constraining type parameters.
3. **Advanced Hooks & State Management**: Tuple inference with `as const`, strongly typed React Context with safe-guard hooks, discriminated union state machines, and discriminated return tuples.
4. **React Types Deep Dive**: Dissecting `JSX.Element` vs `ReactElement` vs `ReactNode`, `JSX.IntrinsicElements`, `ElementType` vs `ComponentType`, and global JSX augmentation.
5. **Advanced Patterns & External Libraries**: The polymorphic `as` prop, fixing `React.forwardRef` generic erasure, strongly typed lazy loading, render props, and wrapping TanStack Query, React Hook Form, and React Select.

```
                   ┌─────────────────────────────────────────────────────────┐
                   │             Advanced React Type Architecture            │
                   └────────────────────────────┬────────────────────────────┘
                                                │
         ┌───────────────────┬──────────────────┴──────────────────┬───────────────────┐
         ▼                   ▼                                     ▼                   ▼
┌─────────────────┐ ┌─────────────────┐                   ┌─────────────────┐ ┌─────────────────┐
│ Discriminated   │ │ Generic Tables, │                   │ Safe Context,   │ │ Polymorphic Box │
│ Union Props     │ │ Selects, Lists  │                   │ State Machines, │ │ as="button",    │
│ (Mutually Excl) │ │ <Table<TRow> /> │                   │ Tuple as const  │ │ forwardRef fix  │
└─────────────────┘ └─────────────────┘                   └─────────────────┘ └─────────────────┘
```

### Type Testing Helpers

```typescript
export type Expect<T extends true> = T;
export type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends
  (<T>() => T extends Y ? 1 : 2) ? true : false;
```

---

## Lesson 10.1: Advanced Props with Discriminated Unions

### 10.1.1 Mutually Exclusive Props with Discriminated Unions

A common anti-pattern is making all conditional props optional: `title?: string; ariaLabel?: string`. This allows consumers to provide both or neither. Discriminated unions make invalid combinations impossible:

```tsx
import React from "react";

// Modal MUST have an accessible name: either a visible title OR an aria-label
type ModalHeaderProps =
  | {
      variant: "with-title";
      title: string;
      subtitle?: string;
    }
  | {
      variant: "custom-label";
      ariaLabel: string;
    };

// Intersect with shared props required across all variants
type ModalProps = ModalHeaderProps & {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export function Modal(props: ModalProps): React.JSX.Element | null {
  if (!props.isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={props.variant === "custom-label" ? props.ariaLabel : undefined}>
      {props.variant === "with-title" ? (
        <header>
          <h2>{props.title}</h2>
          {props.subtitle && <p>{props.subtitle}</p>}
        </header>
      ) : null}
      <div>{props.children}</div>
      <button onClick={props.onClose}>Close</button>
    </div>
  );
}
```

### 10.1.2 The Destructuring Gotcha

Destructuring a discriminated union before narrowing collapses type discrimination:

```tsx
// ❌ FAILS DISCRIMINATION:
// function BadModal({ variant, title, ariaLabel, ...rest }: ModalProps) {
//   if (variant === "with-title") {
//     console.log(title.toUpperCase()); // Compile error! 'title' might be undefined
//   }
// }

// ✅ BEST PRACTICE 1: Narrow the props object first, then access properties:
export function SafeModal(props: ModalProps): React.JSX.Element | null {
  if (props.variant === "with-title") {
    return <h2>{props.title}</h2>; // Strongly narrowed!
  }
  return <div aria-label={props.ariaLabel}>{props.children}</div>;
}

// ✅ BEST PRACTICE 2: Destructure inside branch or use helper function
```

### 10.1.3 Boolean Discriminators and `Record<string, never>`

Sometimes a component variant is toggled by a boolean prop. When `collapsible` is true, an `onToggle` callback is required; when false or omitted, `onToggle` must be forbidden:

```tsx
import React from "react";

// Using never or Record<string, never> to explicitly forbid props on a branch
type CollapsiblePanel = {
  collapsible: true;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
};

type StaticPanel = {
  collapsible?: false;
  isExpanded?: never;
  onToggle?: never;
};

export type PanelProps = (CollapsiblePanel | StaticPanel) & {
  title: string;
  children: React.ReactNode;
};

export function Panel(props: PanelProps): React.JSX.Element {
  if (props.collapsible) {
    return (
      <div>
        <button onClick={() => props.onToggle(!props.isExpanded)}>{props.title}</button>
        {props.isExpanded && <div>{props.children}</div>}
      </div>
    );
  }

  return (
    <div>
      <h3>{props.title}</h3>
      <div>{props.children}</div>
    </div>
  );
}
```

---

## Lesson 10.2: Generic React Components & Type Helpers

### 10.2.1 Generic Components: `Table<TRow>` and `Select<TOption>`

Components that manipulate collections must accept generic type parameters to preserve item types through callbacks and renderers:

```tsx
import React from "react";

export interface Column<TRow> {
  key: string;
  header: string;
  render: (row: TRow) => React.ReactNode;
}

export interface TableProps<TRow> {
  data: TRow[];
  columns: Column<TRow>[];
  onRowClick?: (row: TRow) => void;
  getRowId: (row: TRow) => string | number;
}

export function Table<TRow>({ data, columns, onRowClick, getRowId }: TableProps<TRow>): React.JSX.Element {
  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={getRowId(row)} onClick={() => onRowClick?.(row)}>
            {columns.map((col) => (
              <td key={col.key}>{col.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 10.2.2 Constraining Type Parameters and Explicit Type Arguments

Constrain type parameters when the component relies on specific properties (e.g. `id`), while allowing explicit type arguments in JSX when inference is ambiguous:

```tsx
interface BaseEntity {
  id: string | number;
}

export interface SelectProps<TOption extends BaseEntity> {
  options: TOption[];
  selectedId: TOption["id"] | null;
  onSelect: (option: TOption) => void;
  getLabel: (option: TOption) => string;
}

export function Select<TOption extends BaseEntity>({
  options,
  selectedId,
  onSelect,
  getLabel,
}: SelectProps<TOption>): React.JSX.Element {
  return (
    <select
      value={selectedId ?? ""}
      onChange={(e) => {
        const found = options.find((opt) => String(opt.id) === e.target.value);
        if (found) onSelect(found);
      }}
    >
      <option value="" disabled>Select an option...</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {getLabel(opt)}
        </option>
      ))}
    </select>
  );
}

// Usage with explicit type parameter in JSX:
interface User extends BaseEntity {
  id: string;
  name: string;
  role: "admin" | "member";
}

const users: User[] = [{ id: "u1", name: "Alice", role: "admin" }];

export const UserSelectExample = () => (
  <Select<User>
    options={users}
    selectedId="u1"
    onSelect={(u) => console.log(u.role)}
    getLabel={(u) => u.name}
  />
);
```

### 10.2.3 DRYing Out Prop Types with Generic Helpers

```typescript
// Generic helper to bind an entity to list and detail views
export type EntityViewProps<TEntity, TExtra = {}> = {
  entity: TEntity;
  onUpdate: (updated: TEntity) => void;
  onDelete: (id: TEntity extends { id: infer TId } ? TId : string) => void;
} & TExtra;
```

---

## Lesson 10.3: Advanced Hooks & State Management

### 10.3.1 Fixing Tuple Inference with `as const`

When creating custom hooks that return a tuple (like `useState`), TypeScript infers an array of unions `(T | Setter)[]` instead of a fixed tuple `[T, Setter]`. Fix this with `as const`:

```typescript
import { useState, useCallback } from "react";

export function useToggle(initialValue = false) {
  const [value, setValue] = useState(initialValue);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  // ❌ Without as const: inferred as (boolean | (() => void))[]
  // ✅ With as const: inferred as readonly [boolean, () => void, () => void, () => void]
  return [value, toggle, setTrue, setFalse] as const;
}

// Hover inspection:
const [isOpen, toggleOpen] = useToggle();
//     ^? const isOpen: boolean
//             ^? const toggleOpen: () => void
```

### 10.3.2 Strongly Typed Context with `createSafeContext`

`React.createContext<T | null>(null)` forces every consumer to write `const ctx = useContext(Ctx); if (!ctx) throw new Error(...)`. A safe context factory eliminates `| null` at compile time:

```tsx
import React, { createContext, useContext } from "react";

export function createSafeContext<TValue>(displayName: string) {
  const Context = createContext<TValue | null>(null);
  Context.displayName = displayName;

  function useSafeContext(): TValue {
    const value = useContext(Context);
    if (value === null) {
      throw new Error(`useSafeContext for ${displayName} must be used within its Provider`);
    }
    return value;
  }

  return [Context.Provider, useSafeContext] as const;
}

// Example usage:
interface AuthContextValue {
  user: { id: string; email: string };
  logout: () => void;
}

export const [AuthProvider, useAuth] = createSafeContext<AuthContextValue>("AuthContext");

function UserHeader(): React.JSX.Element {
  // Directly typed as AuthContextValue — NO null check needed!
  const { user, logout } = useAuth();
  //      ^? (property) user: { id: string; email: string; }
  return <button onClick={logout}>Sign out {user.email}</button>;
}
```

### 10.3.3 State Machines & Discriminated Tuples in Hooks

```typescript
// Discriminated union prevents invalid state combinations (e.g. data && isLoading)
export type AsyncState<TData, TError = Error> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: TData; error: null }
  | { status: "error"; data: null; error: TError };

// Discriminated return tuple from custom hook
export type AsyncHookResult<TData> =
  | ["loading", undefined, undefined]
  | ["success", TData, undefined]
  | ["error", undefined, Error];
```

---

## Lesson 10.4: React Types Deep Dive

### 10.4.1 `React.JSX.Element` vs `React.ReactElement` vs `React.ReactNode`

```tsx
import React from "react";

// 1. React.ReactNode: The widest renderable type
// Primitives (string, number, boolean, null, undefined) + ReactElement + Iterable
const renderItem = (node: React.ReactNode) => <div>{node}</div>;

// 2. React.ReactElement<Props, Type>: The object created by React.createElement()
// Must be an element node, NOT a primitive string or number.
const el: React.ReactElement = <span>Hello</span>;

// 3. React.JSX.Element: The global JSX factory return type
// In modern React, React.JSX.Element is an alias for React.ReactElement<any, any>
const jsxElem: React.JSX.Element = <div />;
```

### 10.4.2 `JSX.IntrinsicElements` and Element Types

`JSX.IntrinsicElements` is the dictionary defining all native HTML and SVG tags known to TypeScript:

```typescript
// Inspecting intrinsic tag props:
type DivProps = JSX.IntrinsicElements["div"];
type SvgProps = JSX.IntrinsicElements["svg"];

// React.ElementType accepts either a native tag string ("div") or a React component
type CustomRenderer = React.ElementType; // "div" | "span" | ComponentType<any>

// React.ComponentType<P> requires a React Function or Class component accepting props P
type PureComponent = React.ComponentType<{ title: string }>;
```

### 10.4.3 Augmenting Global JSX & CSS Custom Properties

```typescript
// Extending React's CSSProperties to allow CSS variables (--brand-color)
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number;
  }
}

// Now valid without type assertion:
const style: React.CSSProperties = {
  color: "var(--brand-color)",
  "--brand-color": "#0984e3",
};
```

---

## Lesson 10.5: Advanced Component Patterns & External Libraries

### 10.5.1 The Polymorphic `as` Prop Component

A polymorphic component can render as any HTML tag or custom component, inheriting that element's native props while preserving accessibility:

```tsx
import React from "react";

export type PolymorphicRef<C extends React.ElementType> =
  React.ComponentPropsWithRef<C>["ref"];

export type AsProp<C extends React.ElementType> = {
  as?: C;
};

export type PolymorphicComponentProps<C extends React.ElementType, Props = {}> =
  Props &
  AsProp<C> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof (Props & AsProp<C>)>;

export type PolymorphicComponentPropsWithRef<C extends React.ElementType, Props = {}> =
  PolymorphicComponentProps<C, Props> & { ref?: PolymorphicRef<C> };

// Concrete Box component:
export type BoxProps<C extends React.ElementType = "div"> =
  PolymorphicComponentPropsWithRef<C, { colorVariant?: "neutral" | "brand" }>;

export const Box = React.forwardRef(function Box<C extends React.ElementType = "div">(
  { as, colorVariant = "neutral", ...rest }: BoxProps<C>,
  ref: PolymorphicRef<C>
): React.JSX.Element {
  const Component = as || "div";
  return <Component ref={ref} className={`box-${colorVariant}`} {...rest} />;
}) as <C extends React.ElementType = "div">(props: BoxProps<C>) => React.JSX.Element;

// Usage:
export const Demo = () => (
  <>
    <Box as="button" onClick={(e) => console.log(e.clientX)}>Button Box</Box>
    <Box as="a" href="https://totaltypescript.com">Link Box</Box>
  </>
);
```

### 10.5.2 Fixing `React.forwardRef` Generic Erasure

By default, `React.forwardRef` erases generic type parameters from the component function. To preserve generics, use a type assertion wrapper or declaration merging:

```tsx
// Type helper to fix forwardRef generics
export function fixedForwardRef<T, P = {}>(
  render: (props: P, ref: React.Ref<T>) => React.ReactNode
): (props: P & React.RefAttributes<T>) => React.JSX.Element {
  return React.forwardRef(render as any) as any;
}

// Generic component using fixedForwardRef
interface ListProps<TItem> {
  items: TItem[];
  renderItem: (item: TItem) => React.ReactNode;
}

export const GenericList = fixedForwardRef(function GenericList<TItem>(
  props: ListProps<TItem>,
  ref: React.Ref<HTMLUListElement>
) {
  return (
    <ul ref={ref}>
      {props.items.map((item, index) => (
        <li key={index}>{props.renderItem(item)}</li>
      ))}
    </ul>
  );
});
```

### 10.5.3 Strongly Typed External Libraries

#### React Hook Form Wrapper

```tsx
import { useForm, UseFormProps, FieldValues, UseFormReturn } from "react-hook-form";

export function useTypedForm<TValues extends FieldValues>(
  options?: UseFormProps<TValues>
): UseFormReturn<TValues> {
  return useForm<TValues>(options);
}
```

#### TanStack Query Overloads

```typescript
import { useQuery, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";

export function useEntityQuery<TData, TError = Error>(
  key: string[],
  fetcher: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError, TData, string[]>, "queryKey" | "queryFn">
): UseQueryResult<TData, TError> {
  return useQuery({
    queryKey: key,
    queryFn: fetcher,
    ...options,
  });
}
```

---

## Anti-Patterns vs. Best Practices

### 1. Discriminated Props

```tsx
// ❌ ANTI-PATTERN: Optional props soup allows illegal states
interface BadDialogProps {
  hasFooter?: boolean;
  cancelText?: string;
  onCancel?: () => void;
}

// ✅ BEST PRACTICE: Discriminated union enforces cohesive properties
type GoodDialogProps =
  | { hasFooter: false }
  | { hasFooter: true; cancelText: string; onCancel: () => void };
```

### 2. Context Safety

```tsx
// ❌ ANTI-PATTERN: Casting or asserting context exists
const ctx = useContext(UserContext)!;

// ✅ BEST PRACTICE: Fail-fast custom safe hook
const ctx = useSafeUserContext();
```

### 3. Generic Component Fallbacks

```tsx
// ❌ ANTI-PATTERN: Using 'any' as generic default
function List<T = any>(props: { items: T[] }) { ... }

// ✅ BEST PRACTICE: Constrain to record or unknown with proper usage
function List<T extends { id: string }>(props: { items: T[] }) { ... }
```

### 4. Custom Hook Tuples

```typescript
// ❌ ANTI-PATTERN: Returning array without as const (causes union element inference)
function useValue() { return [value, setter]; }

// ✅ BEST PRACTICE: Return tuple with as const
function useValue() { return [value, setter] as const; }
```

---

## Hands-On Exercises

### Exercise 10.1: Type-Safe Polymorphic `ButtonOrLink` Component

#### Problem Statement
Build a polymorphic `<ButtonOrLink />` component:
1. When rendered with `href`, it renders as an `<a>` element and enforces valid anchor attributes.
2. When rendered without `href`, it renders as a `<button>` element with `type="button"` by default.
3. Forwards refs accurately to either `HTMLAnchorElement` or `HTMLButtonElement`.

#### Complete Solution & Explanation

```tsx
import React, { forwardRef } from "react";

type AnchorProps = React.ComponentPropsWithoutRef<"a"> & {
  href: string;
};

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  href?: never;
};

export type ButtonOrLinkProps = AnchorProps | ButtonProps;

export const ButtonOrLink = forwardRef<
  HTMLAnchorElement | HTMLButtonElement,
  ButtonOrLinkProps
>(function ButtonOrLink(props, ref) {
  if (typeof props.href === "string") {
    return (
      <a
        ref={ref as React.Ref<HTMLAnchorElement>}
        {...(props as AnchorProps)}
        className="action-link"
      />
    );
  }

  const { type = "button", ...buttonRest } = props as ButtonProps;
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type={type}
      {...buttonRest}
      className="action-btn"
    />
  );
});
```

---

### Exercise 10.2: Generic `DataTable<TRow, TKey>` with Type-Safe Sort & Columns

#### Problem Statement
Design a generic `DataTable<TRow>`:
1. `columns` accepts an array of `{ key: keyof TRow; header: string; sortable?: boolean }`.
2. `onSort` receives `(columnKey: keyof TRow, direction: "asc" | "desc") => void`.
3. Provide full hover type safety for cell keys.

#### Complete Solution & Explanation

```tsx
import React, { useState } from "react";

export interface ColumnConfig<TRow> {
  key: Extract<keyof TRow, string>;
  header: string;
  sortable?: boolean;
}

export interface DataTableProps<TRow extends { id: string | number }> {
  data: TRow[];
  columns: ColumnConfig<TRow>[];
  onSort?: (key: Extract<keyof TRow, string>, direction: "asc" | "desc") => void;
}

export function DataTable<TRow extends { id: string | number }>({
  data,
  columns,
  onSort,
}: DataTableProps<TRow>): React.JSX.Element {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleHeaderClick = (col: ColumnConfig<TRow>) => {
    if (!col.sortable) return;
    const nextDir = sortKey === col.key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(col.key);
    setSortDir(nextDir);
    onSort?.(col.key, nextDir);
  };

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={() => handleHeaderClick(col)}
              style={{ cursor: col.sortable ? "pointer" : "default" }}
            >
              {col.header} {sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : null}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={row.id}>
            {columns.map((col) => (
              <td key={col.key}>{String(row[col.key])}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

### Exercise 10.3: `createSafeContext` Factory with Strict Guard

#### Problem Statement
Implement a generic `createSafeContext<TValue>` helper:
1. Returns `[Provider, useSafeContext] as const`.
2. `useSafeContext()` throws an error with context name if called outside Provider.
3. Eliminates `| null` from returned context value.

#### Complete Solution & Explanation

```tsx
import React, { createContext, useContext, ReactNode } from "react";

export function createSafeContext<TValue>(contextName: string) {
  const Context = createContext<TValue | null>(null);
  Context.displayName = contextName;

  function Provider({ value, children }: { value: TValue; children: ReactNode }) {
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useSafeContext(): TValue {
    const value = useContext(Context);
    if (value === null) {
      throw new Error(`useSafeContext for ${contextName} must be wrapped inside its Provider`);
    }
    return value;
  }

  return [Provider, useSafeContext] as const;
}

// Verification:
interface ThemeState {
  mode: "light" | "dark";
  setMode: (mode: "light" | "dark") => void;
}

const [ThemeProvider, useTheme] = createSafeContext<ThemeState>("ThemeContext");

export function ThemeConsumer() {
  const { mode, setMode } = useTheme();
  //      ^? (property) mode: "light" | "dark"
  return <button onClick={() => setMode("dark")}>Mode: {mode}</button>;
}
```

---

### Exercise 10.4: Generic Form Controller wrapping `useForm`

#### Problem Statement
Build a `<FormController<TFormValues>>` component wrapping `react-hook-form`:
1. Accepts `schema` or default values generic on `TFormValues`.
2. Exposes a render function child receiving typed form methods (`register`, `formState`, `handleSubmit`).
3. Handles `onSubmit` with typed data.

#### Complete Solution & Explanation

```tsx
import React from "react";
import { useForm, UseFormProps, UseFormReturn, FieldValues, SubmitHandler } from "react-hook-form";

export interface FormControllerProps<TValues extends FieldValues> {
  formOptions?: UseFormProps<TValues>;
  onSubmit: SubmitHandler<TValues>;
  children: (methods: UseFormReturn<TValues>) => React.ReactNode;
}

export function FormController<TValues extends FieldValues>({
  formOptions,
  onSubmit,
  children,
}: FormControllerProps<TValues>): React.JSX.Element {
  const methods = useForm<TValues>(formOptions);

  return (
    <form onSubmit={methods.handleSubmit(onSubmit)}>
      {children(methods)}
    </form>
  );
}

// Usage Example
interface LoginFields {
  email: string;
  remember: boolean;
}

export const LoginForm = () => (
  <FormController<LoginFields>
    formOptions={{ defaultValues: { email: "", remember: false } }}
    onSubmit={(data) => console.log(data.email)}
  >
    {({ register }) => (
      <>
        <input {...register("email")} placeholder="Email" />
        <input type="checkbox" {...register("remember")} />
        <button type="submit">Sign In</button>
      </>
    )}
  </FormController>
);
```

---

## Module 10 Summary & Cheat Sheet

1. **Mutually Exclusive Props**: Use discriminated unions (`{ variant: "A", propA } | { variant: "B", propB }`) rather than optional props soup.
2. **Never Props**: Use `{ variant: "static"; onToggle?: never }` to strictly forbid variant-specific attributes.
3. **Generic Components**: Parameterize components with `<TRow>`, `<TOption>` to preserve types into renderers and callbacks.
4. **Tuple `as const`**: Always return `[state, dispatch] as const` from custom hooks to preserve tuple indexing.
5. **Safe Context Guard**: Wrap `createContext` with an assertion hook that throws when `value === null`.
6. **Polymorphic `as` Prop**: Use `React.ElementType` and `React.ComponentPropsWithRef<C>` to build type-safe adaptive UI primitives.
7. **Fix `forwardRef` Generics**: Use a wrapper casting `forwardRef` to a generic function signature.
