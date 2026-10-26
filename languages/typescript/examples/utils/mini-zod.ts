/**
 * Mini-Zod Engine
 *
 * A self-contained, fully typed schema validation library replicating the
 * core architectural concepts of Zod v3. Demonstrates TypeScript's input/output
 * phantom types, recursive schema parsing, discriminated union inference,
 * and refinement/transform mechanics with zero external dependencies.
 */

import type { Prettify } from "./type-helpers.ts";

export interface ZodIssue {
  path: (string | number)[];
  message: string;
}

export class ZodError extends Error {
  public issues: ZodIssue[];

  constructor(issues: ZodIssue[]) {
    super(issues.map((i) => `[${i.path.join(".") || "root"}]: ${i.message}`).join("; "));
    this.name = "ZodError";
    this.issues = issues;
  }
}

export type SafeParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError };

/**
 * Base abstract class representing any Zod schema.
 * Employs phantom type properties (_output and _input) to track input and output
 * types across transforms, defaults, and optional modifiers.
 */
export abstract class ZodType<TOutput = any, TInput = TOutput> {
  declare readonly _output: TOutput;
  declare readonly _input: TInput;

  abstract _parse(input: unknown, path: (string | number)[]): TOutput;

  parse(data: unknown): TOutput {
    return this._parse(data, []);
  }

  safeParse(data: unknown): SafeParseResult<TOutput> {
    try {
      const dataParsed = this.parse(data);
      return { success: true, data: dataParsed };
    } catch (err) {
      if (err instanceof ZodError) {
        return { success: false, error: err };
      }
      return {
        success: false,
        error: new ZodError([{ path: [], message: (err as Error).message }]),
      };
    }
  }

  optional(): ZodOptional<TOutput, TInput> {
    return new ZodOptional(this);
  }

  nullable(): ZodNullable<TOutput, TInput> {
    return new ZodNullable(this);
  }

  default(defaultValue: TOutput | (() => TOutput)): ZodDefault<TOutput, TInput> {
    return new ZodDefault(this, defaultValue);
  }

  refine(predicate: (val: TOutput) => boolean, message = "Invalid value"): ZodRefinement<TOutput, TInput> {
    return new ZodRefinement(this, predicate, message);
  }

  transform<TNewOutput>(fn: (val: TOutput) => TNewOutput): ZodTransform<TOutput, TInput, TNewOutput> {
    return new ZodTransform(this, fn);
  }
}

// ============================================================================
// Combinators: Optional, Nullable, Default, Refine, Transform
// ============================================================================

export class ZodOptional<TOutput, TInput> extends ZodType<
  TOutput | undefined,
  TInput | undefined
> {
  readonly inner: ZodType<TOutput, TInput>;

  constructor(inner: ZodType<TOutput, TInput>) {
    super();
    this.inner = inner;
  }

  _parse(input: unknown, path: (string | number)[]): TOutput | undefined {
    if (input === undefined) return undefined;
    return this.inner._parse(input, path);
  }
}

export class ZodNullable<TOutput, TInput> extends ZodType<
  TOutput | null,
  TInput | null
> {
  readonly inner: ZodType<TOutput, TInput>;

  constructor(inner: ZodType<TOutput, TInput>) {
    super();
    this.inner = inner;
  }

  _parse(input: unknown, path: (string | number)[]): TOutput | null {
    if (input === null) return null;
    return this.inner._parse(input, path);
  }
}

export class ZodDefault<TOutput, TInput> extends ZodType<
  TOutput,
  TInput | undefined
> {
  readonly inner: ZodType<TOutput, TInput>;
  readonly defaultValue: TOutput | (() => TOutput);

  constructor(
    inner: ZodType<TOutput, TInput>,
    defaultValue: TOutput | (() => TOutput)
  ) {
    super();
    this.inner = inner;
    this.defaultValue = defaultValue;
  }

  _parse(input: unknown, path: (string | number)[]): TOutput {
    if (input === undefined) {
      return typeof this.defaultValue === "function"
        ? (this.defaultValue as () => TOutput)()
        : this.defaultValue;
    }
    return this.inner._parse(input, path);
  }
}

export class ZodRefinement<TOutput, TInput> extends ZodType<
  TOutput,
  TInput
> {
  readonly inner: ZodType<TOutput, TInput>;
  readonly predicate: (val: TOutput) => boolean;
  readonly message: string;

  constructor(
    inner: ZodType<TOutput, TInput>,
    predicate: (val: TOutput) => boolean,
    message: string
  ) {
    super();
    this.inner = inner;
    this.predicate = predicate;
    this.message = message;
  }

  _parse(input: unknown, path: (string | number)[]): TOutput {
    const value = this.inner._parse(input, path);
    if (!this.predicate(value)) {
      throw new ZodError([{ path, message: this.message }]);
    }
    return value;
  }
}

export class ZodTransform<TInnerOutput, TInnerInput, TNewOutput> extends ZodType<
  TNewOutput,
  TInnerInput
> {
  readonly inner: ZodType<TInnerOutput, TInnerInput>;
  readonly transformFn: (val: TInnerOutput) => TNewOutput;

  constructor(
    inner: ZodType<TInnerOutput, TInnerInput>,
    transformFn: (val: TInnerOutput) => TNewOutput
  ) {
    super();
    this.inner = inner;
    this.transformFn = transformFn;
  }

  _parse(input: unknown, path: (string | number)[]): TNewOutput {
    const value = this.inner._parse(input, path);
    return this.transformFn(value);
  }
}

// ============================================================================
// Primitive & Concrete Type Schemas
// ============================================================================

export class ZodString extends ZodType<string, string> {
  _parse(input: unknown, path: (string | number)[]): string {
    if (typeof input !== "string") {
      throw new ZodError([{ path, message: `Expected string, received ${typeof input}` }]);
    }
    return input;
  }

  min(length: number, message = `String must contain at least ${length} character(s)`): ZodRefinement<string, string> {
    return this.refine((val) => val.length >= length, message);
  }

  email(message = "Invalid email format"): ZodRefinement<string, string> {
    return this.refine((val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), message);
  }
}

export class ZodNumber extends ZodType<number, number> {
  _parse(input: unknown, path: (string | number)[]): number {
    if (typeof input !== "number" || Number.isNaN(input)) {
      throw new ZodError([{ path, message: `Expected number, received ${typeof input}` }]);
    }
    return input;
  }

  min(minVal: number, message = `Number must be greater than or equal to ${minVal}`): ZodRefinement<number, number> {
    return this.refine((val) => val >= minVal, message);
  }

  positive(message = "Number must be positive"): ZodRefinement<number, number> {
    return this.refine((val) => val > 0, message);
  }
}

export class ZodBoolean extends ZodType<boolean, boolean> {
  _parse(input: unknown, path: (string | number)[]): boolean {
    if (typeof input !== "boolean") {
      throw new ZodError([{ path, message: `Expected boolean, received ${typeof input}` }]);
    }
    return input;
  }
}

export class ZodLiteral<TLiteral extends string | number | boolean> extends ZodType<TLiteral, TLiteral> {
  readonly value: TLiteral;

  constructor(value: TLiteral) {
    super();
    this.value = value;
  }

  _parse(input: unknown, path: (string | number)[]): TLiteral {
    if (input !== this.value) {
      throw new ZodError([
        {
          path,
          message: `Expected literal ${JSON.stringify(this.value)}, received ${JSON.stringify(input)}`,
        },
      ]);
    }
    return input as TLiteral;
  }
}

export class ZodEnum<TValues extends readonly [string, ...string[]]> extends ZodType<TValues[number], TValues[number]> {
  readonly values: TValues;

  constructor(values: TValues) {
    super();
    this.values = values;
  }

  _parse(input: unknown, path: (string | number)[]): TValues[number] {
    if (typeof input !== "string" || !this.values.includes(input as any)) {
      throw new ZodError([
        {
          path,
          message: `Expected one of [${this.values.map((v) => `"${v}"`).join(", ")}], received ${JSON.stringify(input)}`,
        },
      ]);
    }
    return input as TValues[number];
  }
}

export class ZodArray<TElement extends ZodType<any, any>> extends ZodType<
  Array<TElement["_output"]>,
  Array<TElement["_input"]>
> {
  readonly elementSchema: TElement;

  constructor(elementSchema: TElement) {
    super();
    this.elementSchema = elementSchema;
  }

  _parse(input: unknown, path: (string | number)[]): Array<TElement["_output"]> {
    if (!Array.isArray(input)) {
      throw new ZodError([{ path, message: `Expected array, received ${typeof input}` }]);
    }
    return input.map((item, index) => this.elementSchema._parse(item, [...path, index]));
  }
}

// ============================================================================
// Object Schema & Inference Types
// ============================================================================

export type ZodRawShape = Record<string, ZodType<any, any>>;

type OptionalKeys<T extends ZodRawShape, TypeField extends "_input" | "_output"> = {
  [K in keyof T]: undefined extends T[K][TypeField] ? K : never;
}[keyof T];

type RequiredKeys<T extends ZodRawShape, TypeField extends "_input" | "_output"> = {
  [K in keyof T]: undefined extends T[K][TypeField] ? never : K;
}[keyof T];

export type ObjectShapeType<T extends ZodRawShape, TypeField extends "_input" | "_output"> = Prettify<
  { [K in RequiredKeys<T, TypeField>]: T[K][TypeField] } & {
    [K in OptionalKeys<T, TypeField>]?: T[K][TypeField];
  }
>;

export class ZodObject<TShape extends ZodRawShape> extends ZodType<
  ObjectShapeType<TShape, "_output">,
  ObjectShapeType<TShape, "_input">
> {
  readonly shape: TShape;

  constructor(shape: TShape) {
    super();
    this.shape = shape;
  }

  _parse(input: unknown, path: (string | number)[]): ObjectShapeType<TShape, "_output"> {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new ZodError([{ path, message: `Expected object, received ${typeof input}` }]);
    }

    const result: Record<string, any> = {};
    const inputObj = input as Record<string, unknown>;

    for (const key of Object.keys(this.shape)) {
      const fieldSchema = this.shape[key]!;
      const val = inputObj[key];
      result[key] = fieldSchema._parse(val, [...path, key]);
    }

    return result as ObjectShapeType<TShape, "_output">;
  }
}

// ============================================================================
// Union & Discriminated Union
// ============================================================================

export class ZodUnion<
  TOptions extends readonly [ZodType<any, any>, ...ZodType<any, any>[]]
> extends ZodType<TOptions[number]["_output"], TOptions[number]["_input"]> {
  readonly options: TOptions;

  constructor(options: TOptions) {
    super();
    this.options = options;
  }

  _parse(input: unknown, path: (string | number)[]): TOptions[number]["_output"] {
    const errors: ZodIssue[] = [];
    for (const option of this.options) {
      try {
        return option._parse(input, path);
      } catch (err) {
        if (err instanceof ZodError) {
          errors.push(...err.issues);
        }
      }
    }
    throw new ZodError([
      {
        path,
        message: `Value did not match any of the union schemas:\n${errors.map((e) => `  - ${e.message}`).join("\n")}`,
      },
    ]);
  }
}

export class ZodDiscriminatedUnion<
  TDiscriminator extends string,
  TOptions extends readonly [ZodObject<any>, ...ZodObject<any>[]]
> extends ZodType<TOptions[number]["_output"], TOptions[number]["_input"]> {
  readonly discriminator: TDiscriminator;
  readonly options: TOptions;

  constructor(discriminator: TDiscriminator, options: TOptions) {
    super();
    this.discriminator = discriminator;
    this.options = options;
  }

  _parse(input: unknown, path: (string | number)[]): TOptions[number]["_output"] {
    if (typeof input !== "object" || input === null) {
      throw new ZodError([{ path, message: `Expected object, received ${typeof input}` }]);
    }
    const discriminatorValue = (input as Record<string, unknown>)[this.discriminator];

    for (const option of this.options) {
      const fieldSchema = option.shape[this.discriminator];
      if (fieldSchema instanceof ZodLiteral && fieldSchema.value === discriminatorValue) {
        return option._parse(input, path);
      }
    }

    throw new ZodError([
      {
        path: [...path, this.discriminator],
        message: `Invalid discriminator value: ${JSON.stringify(discriminatorValue)}`,
      },
    ]);
  }
}

// ============================================================================
// Public z API & Type Inferences
// ============================================================================

export type infer<T extends { _output: any }> = T["_output"];
export type TypeOf<T extends { _output: any }> = T["_output"];
export type input<T extends { _input: any }> = T["_input"];
export type output<T extends { _output: any }> = T["_output"];

export const z = {
  string: () => new ZodString(),
  number: () => new ZodNumber(),
  boolean: () => new ZodBoolean(),
  literal: <TLit extends string | number | boolean>(val: TLit) => new ZodLiteral(val),
  enum: <TValues extends readonly [string, ...string[]]>(values: TValues) => new ZodEnum(values),
  array: <TElement extends ZodType<any, any>>(schema: TElement) => new ZodArray(schema),
  object: <TShape extends ZodRawShape>(shape: TShape) => new ZodObject(shape),
  union: <TOptions extends readonly [ZodType<any, any>, ...ZodType<any, any>[]]>(options: TOptions) =>
    new ZodUnion(options),
  discriminatedUnion: <
    TDiscriminator extends string,
    TOptions extends readonly [ZodObject<any>, ...ZodObject<any>[]]
  >(
    discriminator: TDiscriminator,
    options: TOptions
  ) => new ZodDiscriminatedUnion(discriminator, options),
};

export default z;
