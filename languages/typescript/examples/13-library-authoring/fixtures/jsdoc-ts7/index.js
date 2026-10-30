/** @enum {string} */
export const Color = { Red: "red", Blue: "blue" };
/** @param {Color} c */
export function paint(c) { return c; }
/** @type {function(string): number} */
export const len = (s) => s.length;
paint("green");
