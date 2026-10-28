# 10: Resilience, Error Boundaries & Reset

## 1. Formal Foundations: Fault Containment in Component Trees

In distributed systems and software architectures, a crash in an auxiliary subsystem must never bring down the entire host system. In React applications, an unhandled runtime error inside a component's render or lifecycle methods will, by default, unmount the entire application root—rendering a blank screen to the user.

**Error Boundaries** provide declarative fault isolation: they are components that catch JavaScript errors anywhere in their child component tree, log those errors, and display a fallback UI instead of crashing the application.

---

## 2. Multi-Tier Progression: The Error Boundary Protocol

An Error Boundary is defined as a class component implementing one or both lifecycle methods:

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  // 1. Synchronous state derivation (Render Phase):
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // 2. Side-effect logging (Commit Phase):
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

### 2.1 Fault Isolation Semantics

Error boundaries confine errors to subtrees:

```
                  App
                   |
         +---------+---------+
         |                   |
    [Navbar]         [ErrorBoundary]
                             |
                   +---------+---------+
                   |                   |
             [HealthyWidget]    [CrashingWidget 💥]
```

When `CrashingWidget` throws an uncaught error:
1. React catches the error at `ErrorBoundary`.
2. The sibling `HealthyWidget` is unmounted within that boundary, replaced by the boundary's fallback.
3. The parent `App` and sibling `Navbar` remain completely mounted, functional, and interactive.

### 2.2 Boundary Recovery and Reset

To recover from a transient failure (such as a transient network timeout or user retry):
1. The boundary provides an `onReset` callback that clears `hasError: false`.
2. Alternatively, changing the `key` prop on `<ErrorBoundary key={retryId}>` forces React to unmount the failed boundary instance and mount a fresh instance with initial state.

---

## 3. What Error Boundaries Do NOT Catch

Error boundaries do NOT catch errors in:
- Event handlers (e.g. `onClick={() => { throw new Error(); }}`): Event handlers do not happen during render; use standard `try/catch`.
- Asynchronous code (e.g. `setTimeout` or `requestAnimationFrame`).
- Server-side rendering (handled by server error routing).
- Errors thrown inside the Error Boundary component itself (they bubble to the next parent boundary).

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [10-error-boundaries-and-resilience.ts](../examples/10-error-boundaries-and-resilience.ts) provides deterministic verification:
- **Error Containment**: Proves that thrown render errors are captured by boundaries and render fallback markup.
- **Subtree Isolation**: Demonstrates that siblings outside the boundary remain mounted and intact when a leaf crashes.
- **Boundary Reset**: Verifies successful state restoration and re-rendering after fault recovery.
- **Negative Proof of Unprotected Trees**: Shows that uncaught render exceptions unmount the root application tree.
