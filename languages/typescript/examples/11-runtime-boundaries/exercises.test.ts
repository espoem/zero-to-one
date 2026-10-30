/**
 * Module 11 — reference solutions for the module's exercises.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { expectTypeOf } from "expect-type";

// Exercise 1: checkout with a discriminated payment union and a cross-field rule.
export const Checkout = z
  .object({
    email: z.email(),
    company: z.object({ name: z.string().min(1), vatId: z.string().regex(/^[A-Z]{2}\d{8,12}$/).optional() }).optional(),
    payment: z.discriminatedUnion("method", [
      z.object({ method: z.literal("card"), token: z.string().min(1) }),
      z.object({ method: z.literal("bank"), iban: z.string().min(15) }),
      z.object({ method: z.literal("invoice"), dueDays: z.coerce.number().int().default(14) }),
    ]),
  })
  .superRefine((v, ctx) => {
    if (v.payment.method === "invoice" && !v.company?.vatId) {
      ctx.addIssue({ code: "custom", message: "invoice requires a company VAT id", path: ["company", "vatId"] });
    }
  });
export type CheckoutForm = z.input<typeof Checkout>; // what the form holds
export type CheckoutCommand = z.output<typeof Checkout>; // what the service receives

test("exercise 1: input vs output types and the cross-field rule", () => {
  type InvoiceIn = Extract<CheckoutForm["payment"], { method: "invoice" }>;
  type InvoiceOut = Extract<CheckoutCommand["payment"], { method: "invoice" }>;
  expectTypeOf<InvoiceIn["dueDays"]>().toEqualTypeOf<unknown>(); // coerced and defaulted
  expectTypeOf<InvoiceOut["dueDays"]>().toEqualTypeOf<number>();

  const bad = Checkout.safeParse({ email: "a@example.com", payment: { method: "invoice" } });
  assert.deepEqual(bad.error?.issues.map((i) => i.path.join(".")), ["company.vatId"]);
  const ok = Checkout.parse({
    email: "a@example.com",
    company: { name: "ACME", vatId: "CZ12345678" },
    payment: { method: "invoice", dueDays: "30" },
  });
  assert.deepEqual(ok.payment, { method: "invoice", dueDays: 30 });
});

// Exercise 2: parse URLSearchParams with any Standard Schema.
export async function parseSearchParams<S extends StandardSchemaV1>(
  schema: S,
  params: URLSearchParams,
): Promise<StandardSchemaV1.InferOutput<S>> {
  const raw: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    raw[key] = all.length > 1 ? all : (all[0] ?? "");
  }
  let result = schema["~standard"].validate(raw);
  if (result instanceof Promise) result = await result;
  if (result.issues) throw new Error(result.issues.map((i) => i.message).join("; "));
  return result.value;
}

test("exercise 2: repeated keys become arrays; numbers are coerced by the schema", async () => {
  const Search = z.object({
    q: z.string(),
    page: z.coerce.number().int().min(1).default(1),
    tag: z.union([z.string(), z.array(z.string())]).optional(),
  });
  const out = await parseSearchParams(Search, new URLSearchParams("q=ts&page=2&tag=a&tag=b"));
  expectTypeOf(out.page).toEqualTypeOf<number>();
  assert.deepEqual(out, { q: "ts", page: 2, tag: ["a", "b"] });
  await assert.rejects(parseSearchParams(Search, new URLSearchParams("page=0")));
});

// Exercise 3: Zod 3 `.default()` before a transform, migrated to Zod 4.
test("exercise 3: .prefault reproduces Zod 3 default-then-transform behaviour", () => {
  const zod4Default = z.string().transform((s) => s.length).default(0); // output value, short-circuits
  const zod3Equivalent = z.string().transform((s) => s.length).prefault("abc"); // input value, transformed
  assert.equal(zod4Default.parse(undefined), 0);
  assert.equal(zod3Equivalent.parse(undefined), 3);
});
