import { version } from "./lib/user.js"; // the extension of the *emitted* file
import type { User } from "./lib/user.js";
import data from "./data.json" with { type: "json" };
import { version as viaImportsMap } from "#lib/user.js"; // package.json "imports" (subpath import)
export const out: [number, string, number, User | null] = [version, data.name, viaImportsMap, null];
