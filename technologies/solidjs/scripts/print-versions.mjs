// Prints the installed versions of every pinned package (used for the README "Verified against" line).
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
console.log(`node ${process.versions.node}`);
for (const name of names.sort()) {
  // Read node_modules/<name>/package.json directly: not every package exports ./package.json.
  const manifest = JSON.parse(readFileSync(new URL(`../node_modules/${name}/package.json`, import.meta.url), "utf8"));
  console.log(`${name} ${manifest.version}`);
}
