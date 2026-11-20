import type { Ordering, TypedArray } from './core.ts';

export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function divide(a: number, b: number): number {
  return a / b;
}

export function mathMod(m: number, p: number): number {
  if (!Number.isInteger(m) || !Number.isInteger(p) || p < 1) {
    return Number.NaN;
  }
  return ((m % p) + p) % p;
}

export function modulo(a: number, b: number): number {
  return a % b;
}

export function negateNum(n: number): number {
  return -n;
}

export function inc(n: number): number {
  return n + 1;
}

export function dec(n: number): number {
  return n - 1;
}

export function clamp(value: number, lower: number, upper: number): number {
  const minBound = lower <= upper ? lower : upper;
  const maxBound = lower <= upper ? upper : lower;
  if (Number.isNaN(value)) return Number.NaN;
  return Math.min(Math.max(value, minBound), maxBound);
}

export function inRange(n: number, start: number, end?: number): boolean {
  const actualStart = end === undefined ? 0 : start;
  const actualEnd = end === undefined ? start : end;
  const low = Math.min(actualStart, actualEnd);
  const high = Math.max(actualStart, actualEnd);
  return n >= low && n < high;
}

export function round(n: number, precision = 0): number {
  if (precision === 0) return Math.round(n);
  const factor = Math.pow(10, precision);
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

export function ceil(n: number, precision = 0): number {
  if (precision === 0) return Math.ceil(n);
  const factor = Math.pow(10, precision);
  return Math.ceil(n * factor) / factor;
}

export function floor(n: number, precision = 0): number {
  if (precision === 0) return Math.floor(n);
  const factor = Math.pow(10, precision);
  return Math.floor(n * factor) / factor;
}

export function gt(a: number | string, b: number | string): boolean {
  return a > b;
}

export function gte(a: number | string, b: number | string): boolean {
  return a >= b;
}

export function lt(a: number | string, b: number | string): boolean {
  return a < b;
}

export function lte(a: number | string, b: number | string): boolean {
  return a <= b;
}

export function eq(a: unknown, b: unknown): boolean {
  return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

export function compare<T extends number | string>(a: T, b: T): Ordering {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function ascend<T, K extends number | string>(fn: (item: T) => K): (a: T, b: T) => Ordering {
  return (a: T, b: T): Ordering => {
    const ka = fn(a);
    const kb = fn(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  };
}

export function descend<T, K extends number | string>(
  fn: (item: T) => K,
): (a: T, b: T) => Ordering {
  return (a: T, b: T): Ordering => {
    const ka = fn(a);
    const kb = fn(b);
    return ka > kb ? -1 : ka < kb ? 1 : 0;
  };
}

export function not(value: unknown): boolean {
  return !value;
}

export function and<A, B>(a: A, b: B): A | B {
  return a && b;
}

export function or<A, B>(a: A, b: B): A | B {
  return a || b;
}

export function xorBool(a: boolean, b: boolean): boolean {
  return Boolean(a) !== Boolean(b);
}

export function defaultTo<T>(fallback: T, value: T | null | undefined): T {
  if (value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value))) {
    return fallback;
  }
  return value;
}

export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

export function isNull(value: unknown): value is null {
  return value === null;
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

export function isFiniteNum(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

export function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isSymbol(value: unknown): value is symbol {
  return typeof value === 'symbol';
}

export function isFunction(value: unknown): value is (...args: readonly unknown[]) => unknown {
  return typeof value === 'function';
}

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

export function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

export function isRegExp(value: unknown): value is RegExp {
  return value instanceof RegExp;
}

export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

export function isMap(value: unknown): value is Map<unknown, unknown> {
  return value instanceof Map;
}

export function isSet(value: unknown): value is Set<unknown> {
  return value instanceof Set;
}

export function isTypedArray(value: unknown): value is TypedArray {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    typeof (value as { readonly then?: unknown }).then === 'function'
  );
}

export function typeOf(value: unknown): string {
  if (value === null) return 'Null';
  if (value === undefined) return 'Undefined';
  return Object.prototype.toString.call(value).slice(8, -1);
}

export function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'symbol') return Number.NaN;
  return Number(value);
}

export function toStringSafe(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Object.is(value, -0)) return '-0';
  return String(value);
}

export function castArray<T>(value: T | readonly T[]): T[] {
  return Array.isArray(value) ? (value.slice() as T[]) : [value as T];
}
