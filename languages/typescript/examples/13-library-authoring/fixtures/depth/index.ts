// Non-tail-recursive: each step wraps the recursive call in a spread, so depth grows per element.
type BuildNT<N extends number, A extends unknown[] = []> = A["length"] extends N ? A : [...BuildNT<N, [...A, 0]>];
// Tail-recursive: the recursive call is the whole branch, so TS evaluates it as a loop.
type BuildT<N extends number, A extends unknown[] = []> = A["length"] extends N ? A : BuildT<N, [...A, 0]>;

export type Ok47 = BuildNT<47>["length"];     // fine
export type Fail48 = BuildNT<48>["length"];   // TS2589 in 7.0.2
export type Ok999 = BuildT<999>["length"];    // fine
export type Fail1000 = BuildT<1000>["length"];// TS2589 in 7.0.2
