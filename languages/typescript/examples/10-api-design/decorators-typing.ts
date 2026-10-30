/**
 * Module 10 — Typing TC39 (standard) decorators. Type-checked only (`npm run typecheck`):
 * Node 26 does not execute decorator syntax, and its type stripping rejects it.
 */
import { expectTypeOf } from "expect-type";

/** A method decorator typed against the method it decorates. */
export function logged<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => R,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => R>,
): (this: This, ...args: Args) => R {
  const name = String(context.name);
  return function (this: This, ...args: Args): R {
    console.log(`→ ${name}`);
    return target.call(this, ...args);
  };
}

/** A decorator restricted to methods that return a Promise. */
export function retry<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => Promise<R>,
  _context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Promise<R>>,
) {
  return async function (this: This, ...args: Args): Promise<R> {
    try {
      return await target.call(this, ...args);
    } catch {
      return target.call(this, ...args);
    }
  };
}

/** A field decorator: the initializer is typed by the field type. */
export function clamp(min: number, max: number) {
  return function (_value: undefined, _context: ClassFieldDecoratorContext<unknown, number>) {
    return (initial: number) => Math.min(max, Math.max(min, initial));
  };
}

export class Service {
  @clamp(0, 10) retries = 99;

  @logged
  greet(name: string): string {
    return `hi ${name}`;
  }

  @retry
  async load(id: number): Promise<string> {
    return String(id);
  }

  // @ts-expect-error — `retry` only applies to methods returning a Promise
  @retry
  sync(): string {
    return "x";
  }
}

expectTypeOf<Service["greet"]>().toEqualTypeOf<(name: string) => string>();
