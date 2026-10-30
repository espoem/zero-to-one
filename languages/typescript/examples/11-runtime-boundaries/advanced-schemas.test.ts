/**
 * Module 11 (part 2) — async refinements, recursive schemas, codecs, JSON Schema export,
 * error functions and the cost of validation.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { expectTypeOf } from "expect-type";

test("an async refinement makes parse() throw; parseAsync() is required", async () => {
  const Username = z.string().refine(async (s) => s !== "taken", { error: "taken" });
  assert.throws(() => Username.parse("ada"), /parseAsync/);
  assert.equal(await Username.parseAsync("ada"), "ada");
  const r = await Username.safeParseAsync("taken");
  assert.equal(r.error?.issues[0]?.message, "taken");
});

// Recursive schema: a getter defers the reference until the property is read.
const Category = z.object({
  name: z.string(),
  get children() {
    return z.array(Category);
  },
});
type Category = z.infer<typeof Category>;

test("recursive schemas via getters infer a recursive type", () => {
  expectTypeOf<Category["children"][number]>().toEqualTypeOf<Category>();
  const tree = Category.parse({ name: "root", children: [{ name: "leaf", children: [] }] });
  assert.equal(tree.children[0]?.name, "leaf");
  assert.equal(Category.safeParse({ name: "root", children: [{ name: 1, children: [] }] }).success, false);
});

test("codecs are bidirectional: decode (wire -> domain) and encode (domain -> wire)", () => {
  const IsoDate = z.codec(z.iso.datetime(), z.date(), {
    decode: (s) => new Date(s),
    encode: (d) => d.toISOString(),
  });
  expectTypeOf<z.input<typeof IsoDate>>().toEqualTypeOf<string>();
  expectTypeOf<z.output<typeof IsoDate>>().toEqualTypeOf<Date>();
  const d = IsoDate.decode("2026-01-01T00:00:00.000Z");
  assert.ok(d instanceof Date);
  assert.equal(IsoDate.encode(d), "2026-01-01T00:00:00.000Z");
  assert.throws(() => IsoDate.decode("yesterday"));
});

test("z.toJSONSchema exports the contract for other languages and tools", () => {
  const Body = z.object({ id: z.uuid(), qty: z.number().int().optional() });
  const schema = z.toJSONSchema(Body) as { type: string; required: string[]; properties: Record<string, { type: string }> };
  assert.equal(schema.type, "object");
  assert.deepEqual(schema.required, ["id"]);
  assert.equal(schema.properties["qty"]?.type, "integer");
});

test("error functions receive the issue and can distinguish missing from wrong type", () => {
  const Name = z.string({ error: (issue) => (issue.input === undefined ? "required" : "must be text") });
  assert.equal(Name.safeParse(undefined).error?.issues[0]?.message, "required");
  assert.equal(Name.safeParse(42).error?.issues[0]?.message, "must be text");
});

test("discriminated unions report the failing member, plain unions report every member", () => {
  const A = z.object({ kind: z.literal("a"), n: z.number() });
  const B = z.object({ kind: z.literal("b"), s: z.string() });
  const plain = z.union([A, B]).safeParse({ kind: "a", n: "x" });
  const tagged = z.discriminatedUnion("kind", [A, B]).safeParse({ kind: "a", n: "x" });
  assert.equal(plain.success, false);
  assert.equal(tagged.success, false);
  // The tagged union dispatches on `kind` and reports only the "a" member's problem.
  assert.deepEqual(tagged.error?.issues.map((i) => i.path.join(".")), ["n"]);
  assert.equal(plain.error?.issues[0]?.code, "invalid_union");
});

test("parsing returns a new object: mutations of the input do not leak into the output", () => {
  const P = z.object({ tags: z.array(z.string()) });
  const input = { tags: ["a"] };
  const out = P.parse(input);
  input.tags.push("b");
  assert.deepEqual(out.tags, ["a"]);
});
