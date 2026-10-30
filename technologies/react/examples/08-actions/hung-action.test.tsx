// @vitest-environment jsdom
/**
 * Module 08 — a never-settling async action. Kept in its own file because the hung action
 * scope is process-global state inside react-dom and would poison every later test.
 */
import { expect, test } from "vitest";
import { act, startTransition, useOptimistic, useState } from "react";
import { createRoot } from "react-dom/client";

test("NEGATIVE: a hung async action keeps optimistic state AND holds back every later transition", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  let addOptimistic!: (t: string) => void;
  let setOther!: (v: string) => void;
  function App() {
    const [todos] = useState(["a"]);
    const [optimistic, add] = useOptimistic(todos, (cur: string[], t: string) => [...cur, `${t} (saving)`]);
    const [other, so] = useState("old");
    addOptimistic = add;
    setOther = so;
    return (
      <p>
        {optimistic.join(",")}|{other}
      </p>
    );
  }
  await act(async () => root.render(<App />));
  await act(async () =>
    startTransition(async () => {
      addOptimistic("b");
      await new Promise(() => {}); // the request never settles (no timeout)
    }),
  );
  expect(container.textContent).toBe("a,b (saving)|old"); // the optimistic lie stays
  // A completely unrelated transition is entangled with the pending action scope (19.3.1):
  await act(async () => startTransition(() => setOther("new")));
  expect(container.textContent).toBe("a,b (saving)|old");
  // Urgent (non-transition) updates still go through.
  await act(async () => setOther("urgent"));
  expect(container.textContent).toBe("a,b (saving)|urgent");
});
