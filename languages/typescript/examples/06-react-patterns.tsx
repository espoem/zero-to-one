/**
 * 06: React TypeScript Patterns
 *
 * Demonstrates modern, type-safe React patterns curated by Total TypeScript:
 * - Discriminated union component props (Modal, Button)
 * - Generic components with inferred item/row types (DataTable, Select)
 * - Custom hooks returning `as const` tuples & discriminated union states (useToggle, useAsyncData)
 * - Polymorphic `as` prop component (Box) with HTML attribute forwarding
 * - Fixed `forwardRef` preserving generic type arguments
 *
 * Ambient React definitions supplied by official `@types/react`.
 * Validated via: `tsc --noEmit`
 */

import React, {
  useState,
  useCallback,
  forwardRef,
  type ReactNode,
  type ElementType,
  type ComponentPropsWithoutRef,
  type Ref,
  type RefAttributes,
  type JSX,
} from "react";

import {
  type Expect,
  type Equal,
  type StrictOmit,
} from "./utils/type-helpers.ts";

// ============================================================================
// 1. Discriminated Union Props
// ============================================================================

/**
 * ModalProps: If isDismissable is true, onClose is REQUIRED.
 * If isDismissable is false, onClose is forbidden (never / undefined).
 */
export type ModalProps = {
  title: string;
  children: ReactNode;
} & (
  | {
      isDismissable: true;
      onClose: () => void;
    }
  | {
      isDismissable?: false;
      onClose?: never;
    }
);

export function Modal(props: ModalProps): JSX.Element {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <h2>{props.title}</h2>
        {props.isDismissable && (
          <button type="button" onClick={props.onClose}>
            Close
          </button>
        )}
        <div className="modal-body">{props.children}</div>
      </div>
    </div>
  );
}

// Compile-time checks for Modal usage
export const validDismissableModal = (
  <Modal title="Confirm" isDismissable={true} onClose={() => {}}>
    Are you sure?
  </Modal>
);

export const validStaticModal = (
  <Modal title="Alert" isDismissable={false}>
    Cannot close this.
  </Modal>
);

/**
 * Discriminated Button Props:
 * Renders an <a> tag when href is provided, or a <button> when onClick is provided.
 */
export type ButtonProps =
  | ({ variant?: "primary" | "secondary"; as: "button"; onClick?: () => void; type?: "button" | "submit" })
  | ({ variant?: "primary" | "secondary"; as: "a"; href: string; target?: string });

export function Button(props: ButtonProps & { children: ReactNode }): JSX.Element {
  if (props.as === "a") {
    return (
      <a href={props.href} target={props.target} className={`btn btn-${props.variant ?? "primary"}`}>
        {props.children}
      </a>
    );
  }
  return (
    <button type={props.type ?? "button"} onClick={props.onClick} className={`btn btn-${props.variant ?? "primary"}`}>
      {props.children}
    </button>
  );
}

export const validLinkButton = (
  <Button as="a" href="https://totaltypescript.com">
    Visit Course
  </Button>
);

export const validActionButton = (
  <Button as="button" onClick={() => alert("clicked!")}>
    Click Me
  </Button>
);

// ============================================================================
// 2. Generic Components
// ============================================================================

export interface Column<TRow> {
  key: keyof TRow & string;
  header: string;
  render?: (row: TRow) => ReactNode;
}

export interface DataTableProps<TRow extends { id: string | number }> {
  data: readonly TRow[];
  columns: readonly Column<TRow>[];
  onRowClick?: (row: TRow) => void;
}

/**
 * Generic DataTable component where column renderers and click handlers
 * are strictly typed against the shape of each row.
 */
export function DataTable<TRow extends { id: string | number }>(
  props: DataTableProps<TRow>
): JSX.Element {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {props.columns.map((col) => (
              <th key={col.key}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.data.map((row) => (
            <tr key={row.id} onClick={() => props.onRowClick?.(row)}>
              {props.columns.map((col) => (
                <td key={col.key}>
                  {col.render ? col.render(row) : String(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Example usage verifying inference
interface UserRow {
  id: number;
  name: string;
  role: "admin" | "member";
}

const usersList: UserRow[] = [
  { id: 1, name: "Alice", role: "admin" },
  { id: 2, name: "Bob", role: "member" },
];

export const userTable = (
  <DataTable
    data={usersList}
    columns={[
      { key: "name", header: "User Name" },
      { key: "role", header: "User Role", render: (u) => <strong>{u.role.toUpperCase()}</strong> },
    ]}
    onRowClick={(user) => {
      // Inferred as UserRow
      void user.id;
    }}
  />
);

/**
 * Generic Select component
 */
export interface SelectProps<TOption> {
  options: readonly TOption[];
  value: TOption;
  onChange: (value: TOption) => void;
  getLabel: (option: TOption) => string;
  getValue: (option: TOption) => string | number;
}

export function Select<TOption>(props: SelectProps<TOption>): JSX.Element {
  return (
    <select
      value={props.getValue(props.value)}
      onChange={(e) => {
        const found = props.options.find((opt) => String(props.getValue(opt)) === e.target.value);
        if (found) props.onChange(found);
      }}
    >
      {props.options.map((opt) => (
        <option key={props.getValue(opt)} value={props.getValue(opt)}>
          {props.getLabel(opt)}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// 3. Custom Hooks (`as const` tuples & discriminated union states)
// ============================================================================

/**
 * useToggle returns a tuple with `as const` so consumers get [boolean, () => void, ...]
 * instead of (boolean | (() => void))[]
 */
export function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue((v) => !v), []);
  const setDirect = useCallback((v: boolean) => setValue(v), []);

  return [value, toggle, setDirect] as const;
}

type ToggleTuple = ReturnType<typeof useToggle>;
type TestToggleTuple = Expect<Equal<ToggleTuple, readonly [boolean, () => void, (v: boolean) => void]>>;

/**
 * useAsyncData returns a discriminated union state
 */
export type AsyncState<TData, TError = Error> =
  | { status: "idle"; data: null; error: null }
  | { status: "loading"; data: null; error: null }
  | { status: "success"; data: TData; error: null }
  | { status: "error"; data: null; error: TError };

export function useAsyncData<TData, TError = Error>() {
  const [state, setState] = useState<AsyncState<TData, TError>>({
    status: "idle",
    data: null,
    error: null,
  });

  const run = useCallback(async (promise: Promise<TData>) => {
    setState({ status: "loading", data: null, error: null });
    try {
      const data = await promise;
      setState({ status: "success", data, error: null });
    } catch (err) {
      setState({ status: "error", data: null, error: err as TError });
    }
  }, []);

  return [state, run] as const;
}

// ============================================================================
// 4. Polymorphic `as` Prop Component (Box)
// ============================================================================

type AsProp<TAs extends ElementType> = {
  as?: TAs;
};

export type PolymorphicProps<
  TAs extends ElementType,
  Props = {}
> = Props &
  AsProp<TAs> &
  StrictOmit<ComponentPropsWithoutRef<TAs>, keyof Props | "as">;

/**
 * Box component dynamically changes its root HTML tag while type-checking
 * the corresponding HTML attributes.
 */
export function Box<TAs extends ElementType = "div">({
  as,
  children,
  ...restProps
}: PolymorphicProps<TAs, { customPadding?: number }>): JSX.Element {
  const Component: ElementType = as || "div";
  return <Component {...(restProps as any)}>{children}</Component>;
}

// Compile-time checks for Box polymorphic usage
export const divBox = <Box as="div" id="main" className="container">Content</Box>;
export const anchorBox = <Box as="a" href="https://example.com" target="_blank">Link</Box>;
export const buttonBox = <Box as="button" type="submit" disabled={false}>Submit</Box>;

// ============================================================================
// 5. Fixed forwardRef Preserving Generics (React 18 vs React 19)
// ============================================================================

/**
 * React 18: `React.forwardRef` inherently stripped generic type parameters:
 * `const List = forwardRef(<T,>(props: ListProps<T>, ref: Ref<HTMLUListElement>) => ...)`
 * turned `List` into an unparameterized component!
 *
 * Total TypeScript React 18 solution: `fixedForwardRef`.
 * Note: React 19 natively supports generic `ref` props directly on function components,
 * eliminating the need for `forwardRef` entirely (see Module 12).
 */
export type FixedForwardRef = <TRef, TProps = {}>(
  render: (props: TProps, ref: Ref<TRef>) => JSX.Element | null
) => (props: TProps & RefAttributes<TRef>) => JSX.Element | null;

export const fixedForwardRef: FixedForwardRef = forwardRef as any;

export interface GenericListProps<TItem> {
  items: readonly TItem[];
  renderItem: (item: TItem) => ReactNode;
}

export const GenericList = fixedForwardRef(function GenericListRender<TItem>(
  props: GenericListProps<TItem>,
  ref: Ref<any>
) {
  return (
    <ul ref={ref}>
      {props.items.map((item, idx) => (
        <li key={idx}>{props.renderItem(item)}</li>
      ))}
    </ul>
  );
});

// GenericList usage verifying type safety
export const listElement = (
  <GenericList
    items={["apple", "banana", "cherry"]}
    renderItem={(fruit) => {
      // Inferred as string
      return <span>{fruit.toUpperCase()}</span>;
    }}
  />
);
