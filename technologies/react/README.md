# React 19 & Modern React Architecture

A complete, production-grade learning track and reference implementation covering **React 19**, the **React Compiler**, **Concurrent Mode & Fiber Architecture**, **React Server Components (RSC)**, and **Server Actions**.

This curriculum adheres strictly to the repository standards in [AGENTS.md](../../AGENTS.md):
1. **Academic Grounding**: Rooted in formal semantics, React Fiber specifications, algebraic scheduling lanes, and primary RFCs.
2. **Continuous Multi-Tier Progression**: Seamlessly transitions from JSX compilation primitives to concurrent scheduling, streaming wire protocols, and production resilience.
3. **Executable Proofs**: Accompanied by deterministic test suites verifying edge cases, negative compilation and runtime rejections, hydration error boundaries, and optimistic rollbacks.
4. **Bilingual Terminology Discipline**: Aligned with the repository [GLOSSARY.md](GLOSSARY.md) with canonical English and professional Czech mappings.
5. **Tooling Isolation**: Pinned locally with Node 24 and TypeScript 7.0.2 via `.mise.toml`.

---

## Curriculum Syllabus & Module Breakdown

| Module | Title | Core Focus Areas | Verified Examples |
| :--- | :--- | :--- | :--- |
| **01** | [Elements, JSX & Runtime Model](modules/01-elements-jsx-and-render-model.md) | JSX lowering (`jsxDEV`/`jsxs`), `$$typeof` symbol protection, immutable element trees, element vs. component instance. | `01-elements-and-jsx-runtime.ts` |
| **02** | [Fiber Reconciler & Tree Mutation](modules/02-fiber-reconciler-and-commit.md) | Persistent fiber nodes, child/sibling/return pointers, double-buffering via `alternate`, stable keying, list reconciliation. | `02-fiber-reconciliation-and-keys.ts` |
| **03** | [Hooks, State & Closure Mechanics](modules/03-hooks-closure-contracts.md) | Hook linked list structure, dispatchers, functional updaters, stale closure prevention, batching rules. | `03-hooks-closure-contracts.ts` |
| **04** | [Effects, Refs & React 19 Cleanup](modules/04-effects-and-ref-cleanup.md) | Direct `ref` prop, callback ref cleanup return semantics, effect lifecycle timing (`useLayoutEffect` vs `useEffect`), unmounting order. | `04-effects-and-ref-cleanup.ts` |
| **05** | [Concurrent Rendering & Priority Lanes](modules/05-concurrent-lanes-and-transitions.md) | 31-bit Lane bitmask algebra, time-slicing (5ms yields), `startTransition`, non-blocking interrupts, preventing UI tearing. | `05-concurrent-lanes-and-transitions.ts` |
| **06** | [Suspense, Streaming & Hydration](modules/06-suspense-and-streaming-ssr.md) | Thrown promises unrolled via `use()`, selective streaming HTML, hydration boundary mismatch recovery, progressive hydration. | `06-suspense-and-streaming-ssr.ts` |
| **07** | [React Server Components & Flight](modules/07-rsc-and-flight-protocol.md) | Zero-bundle server execution, `"use client"` vs `"use server"`, Flight wire protocol serialization, client reference slots. | `07-rsc-and-flight-protocol.ts` |
| **08** | [Server Actions & Optimistic UI](modules/08-actions-and-optimistic-updates.md) | Progressive enhancement `<form action>`, `useActionState`, `useFormStatus`, `useOptimistic` speculative state and rollback on error. | `08-actions-and-optimistic-updates.ts` |
| **09** | [React Compiler & Memoization Lowering](modules/09-compiler-memoization-lowering.md) | High-Level Intermediate Representation (HIR), reactive scopes, automatic memo cache slots, rules of React, `"use no memo"`. | `09-compiler-memoization-lowering.ts` |
| **10** | [Resilience, Error Boundaries & Reset](modules/10-error-boundaries-and-resilience.md) | Error boundary class contracts, `getDerivedStateFromError`, `componentDidCatch`, resetting state on navigation/keys, logging digests. | `10-error-boundaries-and-resilience.ts` |

---

## Verification & Execution

Ensure dependencies and toolchains are active via `mise`:

```bash
# Verify local toolchain
mise run -- tsc --version # TypeScript 7.0.2

# Run full deterministic test suite
npm test

# Run isolated type check
npm run typecheck
```
