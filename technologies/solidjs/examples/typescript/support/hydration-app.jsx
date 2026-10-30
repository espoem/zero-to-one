// Fixture for the hydration round-trip (Module 08). Compiled twice by
// hydration-server.mjs: once for SSR (hydratable) and once for the DOM (hydratable).
import { createSignal } from "solid-js";

export function App(props) {
  const [n, setN] = createSignal(props.start);
  return (
    <main>
      <button onClick={() => setN(n() + 1)}>count {n()}</button>
      <p>{props.label}</p>
    </main>
  );
}
