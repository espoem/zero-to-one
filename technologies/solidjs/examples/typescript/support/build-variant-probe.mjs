// Prints which solid-js build Node resolved under the given --conditions and how it behaves.
// Run: node [--conditions=development|observe] examples/typescript/support/build-variant-probe.mjs
import * as solid from "solid-js";
const { createRoot, createSignal, OBSERVE, DEV } = solid;
let ownedWrite = "allowed";
try {
  createRoot((dispose) => {
    const [, set] = createSignal(0);
    try { set(1); } finally { dispose(); }
  });
} catch (e) {
  ownedWrite = String(e.message).includes("REACTIVE_WRITE_IN_OWNED_SCOPE") ? "throws" : "other-error";
}
console.log(JSON.stringify({
  resolved: import.meta.resolve("solid-js").split("node_modules/")[1],
  dev: DEV !== undefined,
  observe: OBSERVE !== undefined,
  ownedWrite,
}));
