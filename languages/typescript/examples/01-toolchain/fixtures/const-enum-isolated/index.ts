// A per-file transpiler cannot inline Flag.A from another file.
import { Flag } from "./lib.js";
export const f = Flag.A;
