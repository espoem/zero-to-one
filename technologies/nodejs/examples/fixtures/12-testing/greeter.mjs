import { now } from './clock.mjs';
export const greet = (name) => `hello ${name} at ${now()}`;
export function classify(n) {
  if (n < 0) return 'negative';
  if (n === 0) return 'zero';
  return 'positive'; // the tests below never reach this line in the "partial" suite
}
