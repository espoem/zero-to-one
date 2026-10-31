# Exams and Interview Coverage: JavaScript (ECMAScript 2026)

## Is there an official JavaScript certification?

**No vendor-neutral, authoritative certification exists for the JavaScript language**, verified 2026-10-28. TC39 and Ecma International do not certify developers, and the OpenJS Foundation's Node.js certifications, which covered JavaScript fundamentals as a prerequisite domain, are retired.

| Exam | Code | Vendor | Status (verified) | Format | Authority |
|---|---|---|---|---|---|
| OpenJS Node.js Application Developer | JSNAD | OpenJS Foundation / Linux Foundation | **Retired 2025-09-30** (<https://training.linuxfoundation.org/jsnad-cert-inactive/>); no successor named | was performance-based, Node-focused | was the most credible JS-adjacent cert; see the Node.js track for history |
| OpenJS Node.js Services Developer | JSNSD | OpenJS Foundation / Linux Foundation | **Inactive** (<https://training.linuxfoundation.org/jsnsd-cert-inactive/>) | — | — |
| JSA™ Certified Associate JavaScript Programmer | **JSA-41-01** | JS Institute (OpenEDG) | Active; sold via the OpenEDG voucher store and Pearson VUE (<https://ums.edube.org/products/jsa-exam>, <https://www.pearsonvue.com/us/en/jsinstitute.html>) | 40 items, 60 minutes, Pearson VUE test centre or OnVUE; voucher US$325; passing score not published on the pages checked; targeted ECMAScript version not stated ("Exam Version" field blank) | Low: a commercial associate-level exam; recruiters report no widely accepted JS certification authority (InfoWorld, 2026-04-27) |
| JSE™ Certified Entry-Level JavaScript Programmer | **JSE-40-01** | JS Institute (OpenEDG) | Active; sold on the OpenEDG store with TestNow delivery (<https://ums.edube.org/products/jse-40-01>) | entry level; item count, duration and price **(unverified: the official page could not be fetched during authoring)** | Low; below this track's level |
| W3Schools JavaScript Developer Certificate, CIW JavaScript Specialist, freeCodeCamp JavaScript Algorithms and Data Structures, Certificates.dev Senior JavaScript Developer, Mimo | — | various | active per InfoWorld (2026-04-27) | mostly unproctored online tests or course completions | Low; not used as targets |

**Decision.** Following AGENTS.md's priority order (official certification → recognised third-party exam → recognised interview format), this track targets:

1. **Primary: the senior JavaScript technical interview** (knowledge questions, output prediction, live-coding of async and closure utilities), banked in [interview.md](interview.md) with a full mock (Mock A).
2. **Secondary: JSA-41-01**, the only active proctored JavaScript-core exam found. Its four published sections are mapped below and practised with a 40-item, 60-minute mock (Mock B in [interview.md](interview.md)) assembled from the same bank. No separate JSA bank is written, because its objectives are a subset of this track at a lower level; the shortfall is recorded in the review file.

> **Exam delta (JSA-41-01).** The exam does not state which ECMAScript edition it targets, and its sections (classless objects, classes, built-in objects, advanced functions) predate ES2022–ES2027 features. Expect it to test ES2015–ES2020 era behaviour. Everything this track teaches about classes, objects and functions still applies; Temporal, `using`, iterator helpers, ES2026 built-ins and decorators are beyond its scope.

## Domains and weights

### Interview format (primary)

There is no official weighting. The weights below are this track's estimate of how often each area appears in senior frontend/full-stack JavaScript interviews (output prediction around the event loop and `this`, async utilities, closures, prototypes, modules), cross-checked against the "Interview hot topics" in the track's research dossier.

| # | Domain / objectives | Weight | Modules | Examples | Bank questions | Status |
|---|---|---|---|---|---|---|
| D1 | Types and coercion: 8 types, `typeof`, ToPrimitive and hints, `==` vs `===` vs SameValue(Zero), IEEE 754, BigInt, strings as UTF-16 | 8% | [02](../modules/02-types-values-coercion.md), [01](../modules/01-reading-the-spec.md) | `02-…test.js`, `01-…test.js` | 001–006 | ✅ |
| D2 | Execution contexts, scope, hoisting/TDZ, closures and leaks, `this` rules, `bind`, strict mode, `eval` | 12% | [03](../modules/03-execution-contexts-scope-closures.md) | `03-…test.js` | 007–014, H4 (071) | ✅ |
| D3 | Objects, descriptors, `[[Get]]`/`[[Set]]`, prototypes, `new`/`instanceof`, classes, private names, exotic objects, copying | 16% | [04](../modules/04-objects-prototypes-classes.md) | `04-…test.js` | 015–022, 074–078, H5 (072) | ✅ |
| D4 | Iteration protocols, generators, helpers, async iteration | 8% | [05](../modules/05-iterators-generators.md) | `05-…test.js` | 023–027 | ✅ |
| D5 | Agents, realms, jobs, promise tick accounting, unhandled rejections, HTML event loop and rendering steps | 14% | [06](../modules/06-agents-realms-job-queue.md) | `06-…test.js`, `06-event-loop-model.js` | 028–036, H3 (070), H6 (073) | ✅ |
| D6 | Promises, combinators, async/await semantics, cancellation, concurrency limiting, retry/backoff | 14% | [07](../modules/07-async-in-depth.md) | `07-…test.js`, `07-async-utils.ts` | 037–045, H1 (068), H2 (069) | ✅ |
| D7 | ESM semantics, live bindings, cycles, TLA, import attributes, `exports` conditions | 8% | [08](../modules/08-modules.md) | `08-modules.test.js`, `fixtures/08-modules/` | 046–050 | ✅ |
| D8 | Proxy/Reflect, weak references, decorators (Stage 2.7), binary data, `structuredClone`, shared memory and the memory model | 8% | [09](../modules/09-metaprogramming.md), [11](../modules/11-binary-data-memory-model.md) | `09-…test.js`, `11-…test.js` | 051–056 | ✅ |
| D9 | ES2024–ES2027: Temporal, explicit resource management, ES2026 built-ins, engine support vs editions | 6% | [10](../modules/10-resource-management-temporal.md), [01](../modules/01-reading-the-spec.md), [13](../modules/13-correctness-security-pitfalls.md) | `10-…test.js`, `01-…test.js` | 057–061 | ✅ |
| D10 | V8 shapes/ICs/deopts, prototype pollution, ReDoS, JSON precision, sorting | 10% | [12](../modules/12-engine-internals-v8.md), [13](../modules/13-correctness-security-pitfalls.md) | `12-…test.js`, `13-…test.js` | 062–067 | ✅ |
| H | Live coding: `Promise.all`, concurrency pool, debounce, `bind`, deep clone, batched signal | (spans D2, D3, D5, D6) | 03, 04, 06, 07 | `exam-hands-on.test.js` (verification), `exam-solutions.js` | 068–073 | ✅ |

### JSA-41-01 (secondary)

Section names and weights from the official voucher page (<https://ums.edube.org/products/jsa-exam>, checked 2026-10-28). The detailed objective lists behind each section were not available on the pages fetched, so the mapping is by section.

| JSA section | Weight | Modules | Bank questions (Mock B) | Status |
|---|---|---|---|---|
| Classless Objects (object literals, properties, descriptors, prototypes without classes, copying, JSON) | 25% | [04](../modules/04-objects-prototypes-classes.md) §1–§3, §6; [09](../modules/09-metaprogramming.md); [13](../modules/13-correctness-security-pitfalls.md) §1 | 015, 016, 019, 021, 051–054, 062, 064 | ✅ |
| Classes and Class-Based Approach (class syntax, inheritance, `super`, static and private members, getters/setters) | 23% | [04](../modules/04-objects-prototypes-classes.md) §4; [03](../modules/03-execution-contexts-scope-closures.md) §5 | 017, 018, 020, 022, 074, 075, 076, 077, 078 | ✅ 8 dedicated class questions in bank (017, 018, 022, 074–078) |
| Built-in Objects (Number, String, Math, Date, Array methods, Map/Set, JSON, RegExp, errors) | 27% | [02](../modules/02-types-values-coercion.md), [05](../modules/05-iterators-generators.md) §3, [10](../modules/10-resource-management-temporal.md), [11](../modules/11-binary-data-memory-model.md), [13](../modules/13-correctness-security-pitfalls.md) | 002, 004, 006, 026, 038, 057–060, 066, 067 | ✅ |
| Advanced Functions (closures, `this`, call/apply/bind, higher-order functions, generators, async functions, recursion) | 25% | [03](../modules/03-execution-contexts-scope-closures.md), [05](../modules/05-iterators-generators.md), [07](../modules/07-async-in-depth.md) | 007–009, 011, 013, 024, 025, 029, 041, 042 | ✅ |

## Syllabus completeness against ECMA-262 2026

| ECMA-262 area | Covered in | Notes |
|---|---|---|
| §5 notation, §6 types, §7 abstract operations | 01, 02 | |
| §8–§9 syntax-directed operations, environments, realms, jobs, agents | 01, 03, 06 | |
| §10 ordinary and exotic objects | 04, 09 | |
| §11–§15 source text, expressions, statements, functions, classes | 01–05, 07 | |
| §16 scripts and modules | 08 | |
| §17 error handling and language extensions | 01 | |
| §18–§28 standard library | 02, 04, 05, 07, 09, 10, 11, 13 | `Intl` (ECMA-402) is **out of scope** beyond formatting examples: it is a separate standard; the CSS and framework tracks use it at their layer |
| §29 memory model | 11 | |
| Annex B | 01, 03, 04, 13 | legacy features covered only where they cause bugs (`__proto__`, HTML-like comments, sloppy block functions) |
| HTML event loop (WHATWG) | 06 | owned by this track; style/layout/paint internals are owned by `languages/css` |
| DOM, `fetch`, Web APIs | **out of scope** | host APIs, not the language; `AbortController` is covered because async cancellation depends on it |
| Node.js loader, libuv, `process.nextTick`, streams | **out of scope** | owned by `technologies/nodejs`, cross-linked |
| Type systems | **out of scope** | owned by `languages/typescript`, cross-linked |
