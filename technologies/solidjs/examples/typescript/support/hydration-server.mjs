// Server half of the hydration round-trip. Run with plain `node` (server build of
// @solidjs/web). Compiles the fixture with the real @solidjs/compiler for both targets,
// server-renders it, and prints { html, script } as JSON on stdout.
import { transform } from "@solidjs/compiler";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const props = JSON.parse(process.argv[2] ?? '{"start":1,"label":"server"}');
const src = readFileSync(new URL("./hydration-app.jsx", import.meta.url), "utf8");
const out = new URL("../.generated/", import.meta.url);
mkdirSync(out, { recursive: true });
for (const generate of ["ssr", "dom"]) {
  const { code } = transform(src, { generate, hydratable: true, filename: "hydration-app.jsx" });
  writeFileSync(new URL(`hydration-app.${generate}.mjs`, out), code);
}
const { App } = await import(new URL("hydration-app.ssr.mjs", out).href);
const web = await import("@solidjs/web");
const html = web.renderToString(() => web.createComponent(App, props));
console.log(JSON.stringify({ html, script: web.generateHydrationScript() }));
