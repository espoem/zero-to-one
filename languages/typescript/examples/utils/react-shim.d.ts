/**
 * React Minimal Ambient Shim (Updated for React 19)
 *
 * Provides ambient type definitions for React 19 and JSX to allow zero-dependency
 * typechecking with standard TypeScript (`tsc --noEmit`) without requiring `@types/react`.
 */

declare namespace JSX {
  interface Element {
    type: any;
    props: any;
    key: any;
  }
  interface IntrinsicElements {
    [elemName: string]: any;
    div: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      style?: Record<string, string | number>;
      ref?: import("react").Ref<any>;
      onClick?: (event: any) => void;
      [attr: string]: any;
    };
    button: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      type?: "button" | "submit" | "reset";
      disabled?: boolean;
      ref?: import("react").Ref<any>;
      onClick?: (event: any) => void;
      [attr: string]: any;
    };
    a: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      href?: string;
      target?: string;
      rel?: string;
      ref?: import("react").Ref<any>;
      onClick?: (event: any) => void;
      [attr: string]: any;
    };
    span: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      ref?: import("react").Ref<any>;
      [attr: string]: any;
    };
    p: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      ref?: import("react").Ref<any>;
      [attr: string]: any;
    };
    ul: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      ref?: import("react").Ref<any>;
      [attr: string]: any;
    };
    li: {
      id?: string;
      className?: string;
      children?: import("react").ReactNode;
      key?: string | number;
      ref?: import("react").Ref<any>;
      [attr: string]: any;
    };
    input: {
      id?: string;
      className?: string;
      type?: string;
      name?: string;
      value?: string | number;
      placeholder?: string;
      disabled?: boolean;
      ref?: import("react").Ref<any>;
      onChange?: (event: any) => void;
      [attr: string]: any;
    };
    select: {
      id?: string;
      className?: string;
      name?: string;
      value?: string | number;
      disabled?: boolean;
      children?: import("react").ReactNode;
      ref?: import("react").Ref<any>;
      onChange?: (event: any) => void;
      [attr: string]: any;
    };
    option: {
      value?: string | number;
      children?: import("react").ReactNode;
      [attr: string]: any;
    };
    form: {
      id?: string;
      className?: string;
      action?: string | ((formData: FormData) => void | Promise<void>);
      onSubmit?: (event: any) => void;
      children?: import("react").ReactNode;
      ref?: import("react").Ref<any>;
      [attr: string]: any;
    };
  }
}

declare module "react" {
  export type ReactNode =
    | string
    | number
    | boolean
    | null
    | undefined
    | JSX.Element
    | Iterable<ReactNode>;

  export type ComponentType<P = {}> = (props: P) => JSX.Element | null;

  export type ElementType =
    | keyof JSX.IntrinsicElements
    | ComponentType<any>;

  export type ComponentProps<T extends ElementType> =
    T extends keyof JSX.IntrinsicElements
      ? JSX.IntrinsicElements[T]
      : T extends ComponentType<infer P>
      ? P
      : Record<string, any>;

  export type ComponentPropsWithoutRef<T extends ElementType> = ComponentProps<T>;
  export type ComponentPropsWithRef<T extends ElementType> = ComponentProps<T>;

  /**
   * React 19 Ref Callback:
   * Returns `void` or a cleanup function `() => void`!
   */
  export type RefCallback<T> = (instance: T | null) => void | (() => void);

  export type Ref<T> =
    | { current: T | null }
    | RefCallback<T>
    | null;

  export interface RefObject<T> {
    current: T | null;
  }

  export interface RefAttributes<T> {
    ref?: Ref<T>;
  }

  export function forwardRef<T, P = {}>(
    render: (props: P, ref: Ref<T>) => JSX.Element | null
  ): (props: P & RefAttributes<T>) => JSX.Element | null;

  /**
   * React 19 Context:
   * Callable directly as a JSX Element (`<Context value={...}>`) without `.Provider`!
   */
  export interface Context<T> {
    (props: { value: T; children?: ReactNode }): JSX.Element | null;
    Provider: (props: { value: T; children?: ReactNode }) => JSX.Element | null;
    Consumer: (props: { children: (value: T) => ReactNode }) => JSX.Element | null;
    displayName?: string;
  }

  export function createContext<T>(defaultValue: T): Context<T>;

  /**
   * React 19 `use<T>`:
   * Unwraps Promises or reads Context values inside render or custom hooks.
   */
  export function use<T>(usable: PromiseLike<T> | Context<T>): T;

  /**
   * React 19 `useActionState`:
   * Manages action state with pending status, replacing `useFormState`.
   */
  export function useActionState<State, Payload = FormData>(
    action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
    initialState: Awaited<State>,
    permalink?: string
  ): [state: Awaited<State>, dispatch: (payload: Payload) => void, isPending: boolean];

  /**
   * React 19 `useOptimistic`:
   * Provides optimistic UI updates while an async action is in flight.
   */
  export function useOptimistic<State, Value = State>(
    passthrough: State,
    reducer?: (state: State, optimisticValue: Value) => State
  ): [State, (optimisticValue: Value) => void];

  /**
   * React 19 `useFormStatus`:
   * Exposes parent <form> submission status to nested components.
   */
  export type FormStatus =
    | {
        pending: true;
        data: FormData;
        method: string;
        action: string | ((formData: FormData) => void | Promise<void>);
      }
    | {
        pending: false;
        data: null;
        method: null;
        action: null;
      };

  export function useFormStatus(): FormStatus;

  /**
   * Recursive Serializable helper enforcing React Server Component -> Client Component
   * serialization boundaries (rejects functions and symbols, permits primitives, arrays,
   * plain objects, and Dates).
   */
  export type JsonPrimitive = string | number | boolean | null | undefined | bigint;

  export type Serializable<T> = T extends (...args: any[]) => any
    ? never
    : T extends symbol
    ? never
    : T extends JsonPrimitive | Date
    ? T
    : T extends (infer U)[]
    ? Serializable<U>[]
    : T extends readonly (infer U)[]
    ? readonly Serializable<U>[]
    : T extends object
    ? { [K in keyof T]: Serializable<T[K]> }
    : never;

  export function useState<T>(initial: T | (() => T)): [T, (val: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly any[]): void;
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T;
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T;
  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T = unknown>(): { current: T | undefined };
  export function createElement(type: any, props?: any, ...children: any[]): JSX.Element;

  const React: {
    useState: typeof useState;
    useEffect: typeof useEffect;
    useCallback: typeof useCallback;
    useMemo: typeof useMemo;
    useRef: typeof useRef;
    forwardRef: typeof forwardRef;
    createContext: typeof createContext;
    use: typeof use;
    useActionState: typeof useActionState;
    useOptimistic: typeof useOptimistic;
    useFormStatus: typeof useFormStatus;
    createElement: typeof createElement;
  };

  export default React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
