# 05: Concurrent Rendering & Priority Lanes

## 1. Formal Foundations: Priority Lanes & Algebraic Scheduling

Concurrent React replaces coarse priority numbers with **Lanes**—a 31-bit priority bitmask encoding update urgency, batch membership, and scheduling constraints.

### 1.1 The Priority Bitmask Model

React allocates updates into specific bit lanes:

```
0b0000000000000000000000000000001 (Bit 0: SyncLane - discrete user clicks)
0b0000000000000000000000000000100 (Bit 2: InputContinuousLane - dragging, scrolling)
0b0000000000000000000000010000000 (Bit 7: DefaultLane - normal state dispatches)
0b0000000000000000000001000000000 (Bit 9: TransitionLane1 - non-urgent background render)
0b0100000000000000000000000000000 (Bit 30: IdleLane - off-screen speculative work)
```

### 1.2 Bitwise Algebraic Scheduling

React uses bitwise operators for high-performance scheduling:
- **Merging Lanes**: $L_{\text{merged}} = L_A \lor L_B$
- **Removing Processed Lanes**: $L_{\text{remaining}} = L_{\text{all}} \land \neg L_{\text{completed}}$
- **Selecting Highest Priority Lane**: React uses two's complement least-significant-bit isolation:

$$\text{HighestPriority}(L) = L \land (-L)$$

Because lower bit indices correspond to higher urgency, isolating the lowest set bit returns the most urgent pending lane in a single CPU instruction ($O(1)$).

---

## 2. Multi-Tier Progression: Time-Slicing, Transitions & Interruption

### 2.1 The 5ms Yield Loop

During a concurrent render pass (`workLoopConcurrent`), React processes fibers iteratively. After each fiber completes, React evaluates:

$$\text{shouldYieldToHost}() \iff \text{currentTime} - \text{startTime} \ge 5\text{ms}$$

If 5ms have elapsed, React yields control to the browser event loop via `MessageChannel`, allowing browser paints, input events, and animations to run smoothly.

### 2.2 Preemption & Re-Render Restart

If an urgent update (e.g. `SyncLane` from a mouse click) is enqueued while React is rendering a low-priority `TransitionLane`:
1. The scheduler halts the background render pass.
2. React immediately executes the synchronous render pass for the click and commits it to screen.
3. React evaluates whether the committed state invalidated the assumptions of the background render. If invalidated, React **discards** the incomplete workInProgress tree and restarts rendering the transition from root.

---

## 3. Tearing Prevention & Consistency

**Tearing** occurs when an external mutable data store is read by different components at different points during an interruptible render, causing parts of the UI to reflect state $v_1$ while other parts reflect state $v_2$.

React prevents tearing by:
1. Enforcing immutable state transitions for React state.
2. Requiring external stores to use `useSyncExternalStore`, which forces synchronous evaluation or restarts concurrent renders if an external store mutates mid-pass.

---

## 4. Executable Proofs & Edge Cases

The accompanying test suite [05-concurrent-lanes-and-transitions.ts](../examples/05-concurrent-lanes-and-transitions.ts) provides deterministic verification:
- **Lane Bitwise Algebra**: Proves that `lanes & -lanes` correctly extracts `SyncLane` when both `SyncLane` and `TransitionLane` are pending.
- **Time-Sliced Preemption**: Demonstrates an urgent click interrupting a background transition, committing the urgent view, and restarting the background transition.
- **Tearing Prevention**: Proves that snapshot isolation guarantees UI consistency across components.
