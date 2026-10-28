# 09: React Compiler & Memoization Lowering

## 1. Formal Foundations: The React Compiler Architecture

Historically, developers were forced to manually maintain referential equality and optimize re-renders using `useMemo`, `useCallback`, and `React.memo`. This manual process was error-prone, cluttered codebases, and frequently broke due to missed dependencies.

The **React Compiler** is an optimizing build-time compiler that transforms standard JavaScript and TypeScript React code into code that automatically memoizes values, computations, and JSX element trees.

### 1.1 High-Level Intermediate Representation (HIR)

The compiler parses component ASTs into a typed **High-Level Intermediate Representation (HIR)**—a control-flow graph (CFG) of basic blocks that models:
- Variable definitions and assignments.
- Control flow branching (`if`, `switch`, loops, ternary operators).
- Mutability and aliasing relationships.

### 1.2 Reactive Scope Inference

Using the CFG, the compiler analyzes variable lifetimes and identifies **Reactive Scopes**: contiguous instruction ranges where values are derived from component inputs (props, state, context).

---

## 2. Multi-Tier Progression: Memoization Cache Slot Lowering

The compiler rewrites each component function by inserting a dedicated cache array (conventionally referenced as `$`):

```typescript
// Conceptual lowering of a reactive scope:
function ProductList_Lowered($: any[], items: Product[], filterText: string) {
  let filteredItems: Product[];

  // Reactive Scope: Cache slot check
  if ($[0] !== items || $[1] !== filterText) {
    // Cache miss: execute computation
    filteredItems = items.filter(p => p.name.includes(filterText));
    $[0] = items;
    $[1] = filterText;
    $[2] = filteredItems;
  } else {
    // Cache hit: reuse memoized reference
    filteredItems = $[2];
  }

  return <Table rows={filteredItems} />;
}
```

### 2.1 The Rules of React as Hard Compiler Preconditions

The compiler can only safely optimize code that adheres to the **Rules of React**:
1. **Purity**: Component render functions must be pure functions of props and state. They must not mutate inputs or produce observable side effects.
2. **Immutable State**: State and props must never be mutated directly. In-place mutations (`props.items.push(x)`) prevent the compiler from detecting changes because `$[0] !== items` evaluates to `false` (identical reference), causing the compiler to emit stale cached data.
3. **No Ref Reads During Render**: Reading or writing `ref.current` during render creates nondeterministic behavior across concurrent passes.

### 2.2 Escape Hatch: `"use no memo"`

For legacy code or components intentionally breaking rules for debugging, the compiler supports an explicit escape directive:

```tsx
"use no memo"; // Tells React Compiler to skip optimization for this function/file
```

---

## 3. Executable Proofs & Edge Cases

The accompanying test suite [09-compiler-memoization-lowering.ts](../examples/09-compiler-memoization-lowering.ts) provides deterministic verification:
- **Cache Slot Lowering**: Proves that unchanged inputs skip recalculation and preserve element referential identity.
- **Dependency Change Invalidation**: Verifies that modified dependencies trigger cache misses and recalculate outputs.
- **Negative Proof of In-Place Mutation**: Demonstrates that mutating arrays in-place causes the compiler cache to drop updates, proving the mathematical necessity of copy-on-write immutability.
