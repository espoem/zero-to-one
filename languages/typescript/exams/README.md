# TypeScript: Certifications & Exam Coverage

Verified on 2026-10-29 against the official page <https://certificates.dev/typescript>.

## Exams

| Exam | Vendor | Status | Format | Targets | Notes |
|---|---|---|---|---|---|
| TypeScript Certification — Junior | certificates.dev (independent; no Microsoft certification for TypeScript exists) | Active | 50 multiple-choice questions, 40 min, proctored | TS version not stated | No coding phase |
| TypeScript Certification — Mid-Level | certificates.dev | Active | 40 multiple-choice + 2 coding challenges, 135 min (coding phase 105 min), proctored | Not stated | Pass rule on the page: "70% of the questions and both challenges" |
| TypeScript Certification — Senior | certificates.dev | Active | 40 multiple-choice + 2 coding challenges, 135 min (coding phase 105 min), proctored | Not stated | Same pass rule |

There is **no vendor (Microsoft) TypeScript certification**. certificates.dev is the only proctored, TypeScript-specific exam found; it publishes topic lists but **no domain weights**, so the bank weights domains equally. Where interviews matter more than certificates, the drills at the end of every module and the senior-frontend interview format apply.

> **Exam delta.** The exam pages do not state a TypeScript version. This track teaches TypeScript 7.0 (native compiler, new defaults, removed options). Expect the exam to use 5.x/6.x-era wording in places: e.g. answers mentioning `moduleResolution: "node"` or `baseUrl` as valid options, `strict` as opt-in, or `ts.createProgram` as the compiler API. Those were true before 7.0 ([Module 01](../modules/01-toolchain-and-compiler-model.md) §4–5 has the "Then vs now"). Answer exam questions in the version they ask about.

## Domain → module coverage matrix

Weights: not published by the vendor; the bank uses equal weights (5 questions per Mid/Senior domain). Junior topics are a subset of the Mid/Senior material; their questions are cross-listed.

| Level | Domain (official topic) | Weight | Modules | Examples | Bank questions | Status |
|---|---|---|---|---|---|---|
| Junior | TypeScript basics and compiler errors | n/p | 01, 02 | `01-toolchain`, `02-essential-types` | M-001, M-031..035 cross-listed | 🟡 (covered via Mid bank) |
| Junior | Types, annotations and inference | n/p | 02, 07 | `02-essential-types`, `07-generics` | M-001..005 | 🟡 (covered via Mid bank) |
| Junior | Arrays, tuples and literal types | n/p | 02, 05 | `02-essential-types`, `05-classes-mutability` | M-002, M-003, M-011, S-012, S-013 | 🟡 (covered via Mid bank) |
| Junior | Objects and interfaces | n/p | 04 | `04-assignability` | S-001..005 | 🟡 (covered via Mid bank) |
| Junior | Typing function parameters and return values | n/p | 02, 07 | `02-essential-types`, `07-generics` | M-004, M-006..010 | 🟡 (covered via Mid bank) |
| Junior | Narrowing | n/p | 03 | `03-unions-narrowing` | M-001..005 | 🟡 (covered via Mid bank) |
| Junior | Type space, escape hatches and config | n/p | 01, 04, 06 | `01-toolchain`, `04-assignability` | M-031..035, S-031 | 🟡 (covered via Mid bank) |
| Mid | Modeling states with unions and type guards | n/p | 03, 10 | `03-unions-narrowing`, `10-api-design` | M-001..M-005 | ✅ |
| Mid | Generics | n/p | 07 | `07-generics` | M-006..M-010 | ✅ |
| Mid | Utility types and type operators | n/p | 08 | `08-type-derivation` | M-011..M-015 | ✅ |
| Mid | Typed classes and decorators | n/p | 05, 10 | `05-classes-mutability`, `10-api-design` | M-016..M-020 | ✅ |
| Mid | Async code, iterators and errors | n/p | 02, 03 | `02-essential-types` | M-021..M-025 | ✅ |
| Mid | Resources, external data and the DOM | n/p | 10, 11, 12 | `10-api-design`, `11-runtime-boundaries`, `12-typing-ui-frameworks` | M-026..M-030 | ✅ |
| Mid | Modules and shipping in a real project | n/p | 01, 06 | `01-toolchain`, `06-modules-tsconfig` | M-031..M-035 | ✅ |
| Senior | How the type system works | n/p | 04, 07 | `04-assignability`, `07-generics` | S-001..S-005 | ✅ |
| Senior | Conditional and mapped types | n/p | 09 | `09-conditional-mapped` | S-006..S-010 | ✅ |
| Senior | Type-level programming | n/p | 08, 09 | `08-type-derivation`, `09-conditional-mapped` | S-011..S-015 | ✅ |
| Senior | Designing types others will use | n/p | 07, 10, 12 | `10-api-design`, `12-typing-ui-frameworks` | S-016..S-020 | ✅ |
| Senior | Authoring and shipping typed libraries | n/p | 06, 13 | `13-library-authoring` | S-021..S-025 | ✅ |
| Senior | Performance and the native compiler | n/p | 01, 13 | `01-toolchain`, `13-library-authoring` | S-026..S-030 | ✅ |
| Senior | Runtime validation and migration | n/p | 11, 13 | `11-runtime-boundaries` | S-031..S-035 | ✅ |
| Mid/Senior | Coding challenges (hands-on) | n/p | 09, 10, 11 | [`examples/exams/`](../examples/exams/) | H-001, H-002 | ✅ |

n/p = not published.

## Question bank

- [`certificates-dev-typescript.md`](./certificates-dev-typescript.md): 70 original questions (35 Mid, 35 Senior; ≥ 5 per domain), 2 hands-on challenges with verification tests, and a full mock exam (40 questions + 2 challenges, 135 min) with a scoring key.

All questions are original and written from the public topic list and the TypeScript documentation. No exam content was seen or used.
