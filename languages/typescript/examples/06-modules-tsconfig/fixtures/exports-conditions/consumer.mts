// ESM importer: resolves "zto-self" (package self-reference) with conditions types -> import.
import { flavor } from "zto-self";
import { pub } from "zto-self/public";
// Not listed in "exports": unreachable even though the file exists (TS2307).
import { internal } from "zto-self/src/internal.js";
export const a: "esm" = flavor;
export const b: 1 = pub; // with --customConditions source, the "source" branch wins: pub is 2
export { internal };
