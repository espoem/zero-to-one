/**
 * Module 05 — Classes, mutability and TS-only syntax (under erasableSyntaxOnly).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { expectTypeOf } from "expect-type";

test("object properties widen; as const keeps literals and adds readonly", () => {
  const cfg = { mode: "dark", sizes: [1, 2] };
  expectTypeOf(cfg).toEqualTypeOf<{ mode: string; sizes: number[] }>();
  const frozen = { mode: "dark", sizes: [1, 2] } as const;
  expectTypeOf(frozen).toEqualTypeOf<{ readonly mode: "dark"; readonly sizes: readonly [1, 2] }>();
  // as const is compile-time only: the object is still mutable at runtime
  (frozen as { mode: string }).mode = "light";
  assert.equal(frozen.mode, "light");
});

test("readonly arrays: mutable is assignable to readonly, not the reverse", () => {
  const xs: number[] = [3, 1, 2];
  const ro: readonly number[] = xs;
  // @ts-expect-error — readonly number[] is not assignable to number[]
  const back: number[] = ro;
  void back;
  // toSorted returns a new array and is available on readonly arrays (es2023 lib)
  assert.deepEqual(ro.toSorted(), [1, 2, 3]);
});

test("the as-const object pattern replaces enums (erasable, structural)", () => {
  const Status = { Pending: "pending", Active: "active" } as const;
  type Status = (typeof Status)[keyof typeof Status];
  expectTypeOf<Status>().toEqualTypeOf<"pending" | "active">();
  const set = (s: Status) => s;
  assert.equal(set("active"), "active"); // raw literals accepted, unlike string enums
  assert.equal(set(Status.Pending), "pending");
  // @ts-expect-error — not a member
  set("archived");
});

class Account {
  #balance = 0; // ECMAScript private: enforced at runtime
  private audit: string[] = []; // TS private: erased, still reachable at runtime
  deposit(n: number): this {
    this.#balance += n;
    this.audit.push(`+${n}`);
    return this;
  }
  get balance(): number {
    return this.#balance;
  }
  static isAccount(x: object): x is Account {
    return #balance in x;
  }
}

test("#private is a runtime guarantee; `private` is only a type-check", () => {
  const a = new Account().deposit(5).deposit(2);
  assert.equal(a.balance, 7);
  // @ts-expect-error — private member
  void a.audit;
  assert.deepEqual((a as unknown as { audit: string[] }).audit, ["+5", "+2"]);
  assert.equal(Object.keys(a).includes("#balance"), false);
  // `#x in obj` is an ergonomic brand check, usable only inside the class body:
  assert.equal(Account.isAccount(a), true);
  assert.equal(Account.isAccount({ balance: 7 }), false); // same shape, not an Account
});

class Shape {
  describe(): string {
    return "shape";
  }
}
class Circle extends Shape {
  override describe(): string {
    return "circle";
  }
}

test("override is required under noImplicitOverride and checked against the base", () => {
  assert.equal(new Circle().describe(), "circle");
  class Bad extends Shape {
    // @ts-expect-error — TS4113: no `describ` in the base class to override
    override describ(): string {
      return "typo";
    }
  }
  void Bad;
});

abstract class Repo<T extends { id: string }> {
  protected items = new Map<string, T>();
  abstract validate(item: T): boolean;
  save(item: T): this {
    if (!this.validate(item)) throw new Error("invalid");
    this.items.set(item.id, item);
    return this; // polymorphic `this`: subclasses keep their own type in chains
  }
}
class UserRepo extends Repo<{ id: string; name: string }> {
  validate(u: { id: string; name: string }): boolean {
    return u.name.length > 0;
  }
  count(): number {
    return this.items.size;
  }
}

test("abstract classes and polymorphic this", () => {
  // @ts-expect-error — cannot instantiate an abstract class
  new Repo();
  const n = new UserRepo().save({ id: "1", name: "Ada" }).count(); // `count` exists: save returned UserRepo
  assert.equal(n, 1);
  assert.throws(() => new UserRepo().save({ id: "2", name: "" }), /invalid/);
});

test("an explicit `this` parameter is erased and checked at call sites", () => {
  function shout(this: { name: string }): string {
    return this.name.toUpperCase();
  }
  assert.equal(shout.call({ name: "ada" }), "ADA");
  assert.throws(() => {
    // @ts-expect-error — the `this` context of type void is not assignable
    shout();
  }, TypeError); // and at runtime `this` is undefined in strict mode

});
