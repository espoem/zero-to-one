# 01: Elements, JSX & Runtime Model

## 1. Formal Foundations & AST Desugaring

At its computational core, React represents user interfaces as pure, immutable descriptions of UI trees called **Elements**. An element is not an active DOM node, nor is it a component instance; it is a lightweight, serializable JavaScript object describing what should appear on screen.

### 1.1 The JSX Compilation Pipeline

JSX is not valid ECMAScript. Compilers (TypeScript, Babel, SWC) desugar JSX tags into runtime function calls. In the modern JSX runtime (`react/jsx-runtime`), the compiler emits `jsxDEV` in development or `jsx` / `jsxs` in production:

```tsx
// Source code:
const card = <div id="hero" className="banner"><span>Welcome</span></div>;

// Lowered output (react/jsx-runtime):
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";

const card = _jsx("div", {
  id: "hero",
  className: "banner",
  children: _jsx("span", { children: "Welcome" })
});
```

The key optimization of `jsxs` over `jsx` is that the compiler passes static multi-child elements as a pre-allocated array without dynamic arguments collection, eliminating runtime array allocations.

### 1.2 Memory Layout & Symbol Security Protection

Every React element has the following normalized internal shape:

```typescript
interface ReactElement<P = any, T extends string | JSXElementConstructor<any> = string> {
  $$typeof: symbol; // Symbol.for('react.transitional.element') or Symbol.for('react.element')
  type: T;
  key: string | null;
  props: P;
  ref: any;
}
```

The `$$typeof` property is critical to application security. In web applications that parse untrusted JSON from external APIs or databases, an attacker could attempt Cross-Site Scripting (XSS) by submitting a forged object:

```json
{
  "type": "div",
  "props": { "dangerouslySetInnerHTML": { "__html": "<img src=x onerror=alert('xss')>" } }
}
```

Because JSON specifications cannot serialize JavaScript `Symbol` primitives, any object originating from `JSON.parse` will lack a genuine `Symbol.for('react.element')` or `Symbol.for('react.transitional.element')`. During reconciliation, `React.isValidElement(node)` evaluates:

$$\text{isValidElement}(e) \iff e \neq \text{null} \land \text{typeof}(e) = \text{'object'} \land e.\$\$\text{typeof} = \text{Symbol.for}('react.transitional.element')$$

If an object lacks this exact symbol reference, React rejects it, terminating injection vulnerabilities before the DOM layer.

---

## 2. Multi-Tier Mechanics: Component Evaluation & Props Immutability

### 2.1 Function Components as Pure Evaluation Functions

When an element's `type` is a function (`typeof element.type === 'function'`), React does not execute the function immediately during element construction. Construction is instantaneous and $O(1)$. Execution is deferred to the **Render Phase** of the Reconciler:

```typescript
function UserBadge({ username }: { username: string }) {
  return <span>{username}</span>;
}

// Construction (does NOT execute UserBadge yet):
const element = React.createElement(UserBadge, { username: "Alice" });
```

### 2.2 Props Immutability Contract

In strict mode, React deep-freezes element `props` (`Object.freeze(element.props)`). Mutating props in-place violates the referential equality invariants required by the Reconciler and the React Compiler:

$$\Delta(\text{Component}) = \text{props}_{\text{new}} \neq \text{props}_{\text{old}}$$

Mutating an array or object on `props` directly leaves the reference identical ($\text{ref}_{\text{new}} \equiv \text{ref}_{\text{old}}$), causing memoized components and compiler scopes to silently skip DOM updates.

---

## 3. React 19 Modernization: Native `ref` in Props

Historically, `ref` was an ambient property stripped from `props` and passed through an indirection wrapper (`React.forwardRef`). In React 19, `forwardRef` is deprecated:
1. `ref` is passed directly as a standard property in `props.ref`.
2. Function components accept `ref` directly in their parameter types without higher-order component wrappers.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [01-elements-and-jsx-runtime.ts](../examples/01-elements-and-jsx-runtime.ts) provides deterministic verification:
- **Element Shape**: Proves `type`, `props`, and `key` binding.
- **Security Rejection**: Demonstrates the failure of forged JSON objects via `React.isValidElement(forged) === false`.
- **Native Ref Passing**: Confirms direct `props.ref` delivery in React 19.
- **Runtime Immutability**: Proves `TypeError` is thrown when attempting to mutate `props`.
