// Three classic nodenext + verbatimModuleSyntax errors.
import { version } from "./lib/user"; // TS2835: relative ESM imports need an extension
import { User } from "./lib/user.js"; // TS1484: a type must be imported with `import type`
import data from "./data.json"; // TS1543: JSON in ESM needs `with { type: "json" }`
export const out: [number, string, User | null] = [version, data.name, null];
