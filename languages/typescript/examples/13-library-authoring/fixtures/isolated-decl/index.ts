// Under isolatedDeclarations every export needs a type that can be emitted without inference.
export function add(a: number, b: number) {
  return a + b;
}
export const config = { retries: 3 };
