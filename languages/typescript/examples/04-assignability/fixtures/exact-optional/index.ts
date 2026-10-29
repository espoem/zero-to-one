interface Prefs {
  theme?: "light" | "dark";
}
// Allowed: the property is absent.
export const a: Prefs = {};
// TS2375 under exactOptionalPropertyTypes: `undefined` is not "absent".
export const b: Prefs = { theme: undefined };
// Explicitly opt in when undefined is a meaningful value.
interface Prefs2 {
  theme?: "light" | "dark" | undefined;
}
export const c: Prefs2 = { theme: undefined };
