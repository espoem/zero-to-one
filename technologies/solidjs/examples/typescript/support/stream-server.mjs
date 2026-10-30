// Streams a hydratable SSR render of a fixture with one slow <Loading> boundary and
// prints the chunks as a JSON array. Run with plain `node` (server build).
import { transform } from "@solidjs/compiler";
import { mkdirSync, writeFileSync } from "node:fs";

const src = `import { createMemo, Loading } from "solid-js";
export function App() {
  const data = createMemo(async () => { await new Promise((r) => setTimeout(r, 60)); return { n: 42 }; });
  return <main><h1>shell</h1><Loading fallback={<i>wait</i>}><b>{data().n}</b></Loading></main>;
}`;
const out = new URL("../.generated/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(new URL("stream-app.ssr.mjs", out), transform(src, { generate: "ssr", hydratable: true, filename: "stream-app.jsx" }).code);
const { App } = await import(new URL("stream-app.ssr.mjs", out).href);
const web = await import("@solidjs/web");
const chunks = [];
await new Promise((end) => web.renderToStream(() => web.createComponent(App, {})).pipe({ write: (c) => chunks.push(c), end }));
console.log(JSON.stringify(chunks));
