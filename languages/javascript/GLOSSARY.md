# JavaScript (ECMAScript) Glossary

Terms used in the `languages/javascript/` track. All definitions are in English; each term gives its canonical English name and an established Czech equivalent. Where Czech technical usage has not settled on a translation, the English term is kept in parentheses, as Czech developer literature does. Definitions follow ECMA-262 17th edition (ES2026), the ES2027 draft, the HTML Living Standard and V8 documentation.

Terms shared with the [root glossary](../../GLOSSARY.md) are reproduced verbatim in [§11](#11-shared-with-the-root-glossary).

---

## 1. Specification and process

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **ECMAScript** | **ECMAScript** | The general-purpose programming language standardised by Ecma International as ECMA-262; "JavaScript" is ECMAScript embedded in a host with host APIs. | ECMA-262 §1–§4 |
| **Edition** | **Vydání (edice)** | A yearly, frozen publication of ECMA-262 (ES2026 = 17th edition); edition = year − 2009. | ECMA-262 17th edition |
| **TC39** | **TC39 (technická komise 39)** | The Ecma technical committee that evolves ECMAScript through staged proposals. | TC39 process document |
| **Proposal Stage** | **Fáze návrhu** | The maturity level 0, 1, 2, 2.7, 3 or 4 of a TC39 proposal; Stage 4 means two compatible shipping implementations and inclusion in the next edition. | TC39 process document |
| **Host** | **Hostitelské prostředí (host)** | The environment embedding an engine (browser, Node.js, Deno) that defines host hooks, the event loop and I/O. | ECMA-262 §4.2 |
| **Host Hook** | **Hostitelský háček (host hook)** | A specification operation whose behaviour is delegated to the host, such as HostEnqueuePromiseJob or HostLoadImportedModule. | ECMA-262 §9.5, §16.2.1.10 |
| **Abstract Operation** | **Abstraktní operace** | A named algorithm in the specification (ToNumber, Call, GetIterator) that is not directly callable from JavaScript. | ECMA-262 §5.2 |
| **Completion Record** | **Záznam o dokončení (Completion Record)** | A specification value with `[[Type]]` (normal, break, continue, return, throw), `[[Value]]` and `[[Target]]` describing how a statement or operation finished. | ECMA-262 §6.2.4 |
| **Abrupt Completion** | **Náhlé dokončení** | A Completion Record whose type is not normal (an exception, return, break or continue). | ECMA-262 §6.2.4 |
| **Internal Slot** | **Vnitřní slot** | Specification-only state attached to an object, written `[[Name]]`, not accessible as a property (e.g. `[[Prototype]]`, `[[PromiseState]]`). | ECMA-262 §6.1.7.2 |
| **Internal Method** | **Vnitřní metoda** | A specification-level operation of an object, written `[[Get]]`, `[[Set]]`, `[[Call]]`, that defines its behaviour. | ECMA-262 §6.1.7.2 |
| **Early Error** | **Časná chyba (early error)** | An error detected statically that prevents the whole Script or Module from running. | ECMA-262 §5.2.4 |
| **Annex B** | **Příloha B** | The normative annex of legacy features required in web browsers, such as `__proto__` and HTML-like comments. | ECMA-262 Annex B |
| **test262** | **test262** | The official ECMAScript conformance test suite. | github.com/tc39/test262 |

## 2. Types, values and coercion

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Primitive Value** | **Primitivní hodnota** | A value of type Undefined, Null, Boolean, String, Symbol, Number or BigInt; immutable and compared by content. | ECMA-262 §6.1 |
| **Type Coercion** | **Implicitní převod typů (koerce)** | Automatic conversion of a value to another type by an operator, performed by abstract operations such as ToPrimitive and ToNumber. | ECMA-262 §7.1 |
| **Truthy / Falsy** | **Pravdivá / nepravdivá hodnota (truthy / falsy)** | Whether ToBoolean maps a value to true or false; the falsy values are `false`, `±0`, `0n`, `NaN`, `""`, `null`, `undefined` and `document.all`. | ECMA-262 §7.1.2 |
| **Strict Equality** | **Striktní rovnost** | The `===` comparison (IsStrictlyEqual): no coercion; NaN is unequal to itself and +0 equals −0. | ECMA-262 §7.2.14 |
| **Loose Equality** | **Volná rovnost** | The `==` comparison (IsLooselyEqual), which coerces operands of different types; it is not transitive. | ECMA-262 §7.2.13 |
| **SameValue / SameValueZero** | **SameValue / SameValueZero** | Equality algorithms without coercion where NaN equals NaN; SameValue distinguishes ±0 (`Object.is`), SameValueZero does not (`includes`, Map keys). | ECMA-262 §7.2.9–§7.2.10 |
| **IEEE 754 Double Precision** | **Dvojitá přesnost IEEE 754** | The 64-bit binary floating-point format used for every Number value, giving 53 bits of significand precision. | ECMA-262 §6.1.6.1, IEEE 754-2019 |
| **Safe Integer** | **Bezpečné celé číslo** | An integer n with \|n\| ≤ 2⁵³ − 1, exactly representable as a Number together with its neighbours. | ECMA-262 §21.1.2 |
| **BigInt** | **BigInt (celé číslo s libovolnou přesností)** | The primitive type of arbitrary-precision integers; it does not mix implicitly with Number in arithmetic. | ECMA-262 §6.1.6.2 |
| **Code Unit / Code Point** | **Kódová jednotka / kódový bod** | A 16-bit element of a String (UTF-16) versus a Unicode scalar value, which may need two code units (a surrogate pair). | ECMA-262 §6.1.4, Unicode Standard |
| **Well-Known Symbol** | **Známý symbol (well-known symbol)** | A built-in Symbol such as `Symbol.iterator` or `Symbol.toPrimitive` used as a protocol hook by the language. | ECMA-262 §6.1.5.1 |

## 3. Execution, scope and `this`

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Execution Context** | **Kontext provádění** | The specification device tracking the evaluation of code: its function, realm, script or module, and lexical, variable and private environments. | ECMA-262 §9.4 |
| **Call Stack** | **Zásobník volání** | The execution context stack; the running execution context is on top. | ECMA-262 §9.4 |
| **Environment Record** | **Záznam prostředí (Environment Record)** | The specification type binding identifiers to values for a scope; chained through `[[OuterEnv]]`. | ECMA-262 §9.1 |
| **Lexical Scope** | **Lexikální rozsah platnosti** | Name resolution determined by where code is written, not by where it is called from. | ECMA-262 §9.1 |
| **Hoisting** | **Vyzdvihování (hoisting)** | Informal name for declaration instantiation: bindings are created before a scope's code runs. | ECMA-262 §10.2.11, §16.1.7 |
| **Temporal Dead Zone (TDZ)** | **Časová mrtvá zóna (TDZ)** | The period between the creation of a `let`, `const` or `class` binding and its initialisation, during which access throws ReferenceError. | ECMA-262 §9.1.1.1 |
| **Strict Mode** | **Striktní režim** | A restricted language variant (always on in modules and classes) that turns silent failures into errors and changes `this` binding. | ECMA-262 §11.2.2, Annex C |
| **`this` Binding** | **Vazba `this`** | The value of `this` in a function, set at call time from the call form, or lexically for arrow functions. | ECMA-262 §10.2.1.2 |
| **Arrow Function** | **Šipková funkce** | A function with lexical `this`, `arguments` and `super`, which cannot be used as a constructor. | ECMA-262 §15.3 |
| **Bound Function** | **Vázaná funkce** | An exotic function object created by `bind` with a fixed `this` and leading arguments. | ECMA-262 §10.4.1 |
| **Direct / Indirect Eval** | **Přímé / nepřímé volání eval** | `eval(x)` called by name, which sees the caller's scope, versus any other form, which evaluates in the global scope. | ECMA-262 §19.2.1.1 |

## 4. Objects, prototypes and classes

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Property Descriptor** | **Deskriptor vlastnosti** | The record of a property's attributes: value/writable or get/set, plus enumerable and configurable. | ECMA-262 §6.2.6 |
| **Data / Accessor Property** | **Datová / přístupová vlastnost** | A property holding a value versus one defined by getter and setter functions. | ECMA-262 §6.1.7.1 |
| **Prototype** | **Prototyp** | The object referenced by an object's `[[Prototype]]` slot, from which it inherits properties. | ECMA-262 §6.1.7 |
| **Prototype Chain** | **Řetězec prototypů** | The sequence of objects followed by property lookup through `[[Prototype]]` links until `null`. | ECMA-262 §10.1.8 |
| **Prototypal Inheritance** | **Prototypová dědičnost** | Inheritance by delegation to a prototype object rather than by copying from a class. | ECMA-262 §4.3.1 |
| **Ordinary / Exotic Object** | **Běžný / exotický objekt** | An object using the default internal methods versus one overriding at least one (Array, Proxy, module namespace). | ECMA-262 §10 |
| **Class Field** | **Pole třídy** | A per-instance property declared in a class body and defined with `[[DefineOwnProperty]]` during construction. | ECMA-262 §15.7 |
| **Private Name** | **Soukromý název (private name)** | A `#name` element accessible only inside its class body and checked by brand; not a property. | ECMA-262 §6.2.10, §15.7 |
| **Brand Check** | **Kontrola značky (brand check)** | A test that an object has a specific internal slot or private element, used instead of prototype checks. | ECMA-262 §7.3, §15.7 |
| **Realm** | **Realm (sféra)** | A set of intrinsic objects with a global object and environment; iframes, `vm` contexts and workers each have one. | ECMA-262 §9.3 |
| **Structured Clone** | **Strukturovaný klon** | A deep copy produced by the HTML structured serialisation algorithm, used by `structuredClone` and `postMessage`. | HTML Living Standard §2.7 |

## 5. Iteration, promises and the event loop

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Iterable / Iterator** | **Iterovatelný objekt / iterátor** | An object with `[Symbol.iterator]()` versus the object it returns, with `next()` producing `{ value, done }`. | ECMA-262 §27.1 |
| **Generator** | **Generátor** | A function (`function*`) whose execution can be suspended at `yield` and resumed; its object is both an iterator and an iterable. | ECMA-262 §15.5, §27.5 |
| **Coroutine** | **Korutina** | A routine that can suspend and resume while keeping its local state; generators and async functions are coroutines. | Knuth (TAOCP Vol. 1) |
| **Promise** | **Promise (příslib)** | An object representing the eventual fulfilment or rejection of an asynchronous operation; it settles once. | ECMA-262 §27.2 |
| **Thenable** | **Thenable objekt** | Any object with a callable `then` method, which promise resolution adopts. | ECMA-262 §27.2.1.3 |
| **Job** | **Úloha (job)** | An abstract closure the host runs when no other ECMAScript code is running, such as a promise reaction. | ECMA-262 §9.5 |
| **Event Loop** | **Smyčka událostí** | The host mechanism that repeatedly selects a task, runs it, drains the microtask queue and updates the rendering. | HTML Living Standard §8.1.7 |
| **Task (Macrotask)** | **Úloha (makroúloha)** | A unit of work in an HTML task queue (timer, event dispatch, message), with ordering guaranteed only within its task source. | HTML Living Standard §8.1.7.1 |
| **Microtask** | **Mikroúloha** | A unit of work in the FIFO microtask queue (promise reactions, `queueMicrotask`), drained completely after each task. | HTML Living Standard §8.1.7.1 |
| **Unhandled Rejection** | **Neošetřené zamítnutí** | A rejected promise without a handler at the host's check point, reported through HostPromiseRejectionTracker. | ECMA-262 §27.2.1.9 |
| **Cancellation (AbortSignal)** | **Zrušení operace (AbortSignal)** | The platform protocol for cancelling asynchronous work through an `AbortController` and its signal. | DOM Standard §3 |
| **Backoff with Jitter** | **Exponenciální odstup s náhodným rozptylem** | A retry strategy whose delays grow exponentially and are randomised to avoid synchronised retries. | AWS Architecture Blog (2015) |

## 6. Modules

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **ES Module (ESM)** | **ES modul** | The standard module system with static `import`/`export`, linked before evaluation. | ECMA-262 §16.2 |
| **Module Record** | **Záznam modulu (Module Record)** | The specification structure for one module: environment, namespace, dependencies and evaluation status. | ECMA-262 §16.2.1.5 |
| **Live Binding** | **Živá vazba** | An import that reads the exporter's binding at access time rather than a copy. | ECMA-262 §9.1.1.5 |
| **Module Namespace Object** | **Objekt jmenného prostoru modulu** | The exotic object produced by `import * as ns`, with live, read-only properties and a null prototype. | ECMA-262 §10.4.6 |
| **Top-Level Await (TLA)** | **Await na nejvyšší úrovni** | `await` in a module body, which makes the module asynchronous for its dependents. | ECMA-262 §16.2.1.6 |
| **Circular Dependency** | **Cyklická závislost** | Modules importing each other; evaluation order then exposes TDZ bindings to whichever module runs first. | ECMA-262 §16.2.1.6.1.3.1 |
| **Import Attributes** | **Atributy importu** | `with { type: 'json' }` metadata on an import that the host must honour. | ECMA-262 §16.2.2 |
| **Conditional Exports** | **Podmíněné exporty** | Package `exports` entries chosen by active conditions such as `import`, `node` or `development`. | Node.js documentation, *Packages* |
| **Tree Shaking** | **Odstraňování nepoužitého kódu (tree shaking)** | Removal of unused exports by bundlers, enabled by the static structure of ESM. | Rollup documentation |

## 7. Metaprogramming and resources

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Metaprogramming** | **Metaprogramování** | Code that inspects or changes the behaviour of other code's operations. | ECMA-262 §28 |
| **Proxy** | **Proxy (zástupný objekt)** | An exotic object whose internal methods are delegated to handler traps. | ECMA-262 §10.5, §28.2 |
| **Trap** | **Past (trap)** | A handler method of a Proxy that intercepts one internal method. | ECMA-262 §28.2 |
| **Invariant (Proxy)** | **Invariant** | A constraint on a trap's result that guarantees consistency with the target (for example, non-configurable properties). | ECMA-262 §6.1.7.3 |
| **Reflection** | **Reflexe** | Inspecting and invoking a program's own structures at runtime; in JavaScript, through the `Reflect` object and descriptors. | ECMA-262 §28.1 |
| **Tagged Template** | **Označená šablona (tagged template)** | A template literal passed to a function that receives the literal parts and substitutions separately. | ECMA-262 §13.3.11 |
| **Weak Reference** | **Slabá reference** | A reference that does not prevent garbage collection of its target (`WeakRef`, `WeakMap` keys). | ECMA-262 §26.1 |
| **Ephemeron** | **Efemeron** | A key/value pair whose value is reachable only while the key is reachable; the semantics of `WeakMap` entries. | Hayes (OOPSLA 1997) |
| **Finalizer** | **Finalizér** | A callback run at some point after an object is collected (`FinalizationRegistry`); not guaranteed to run. | ECMA-262 §26.2 |
| **Decorator** | **Dekorátor** | A function applied to a class or class element at definition time; Stage 2.7, not yet standard. | TC39 proposal-decorators |
| **Explicit Resource Management** | **Explicitní správa prostředků** | Deterministic disposal of resources through `using`, `await using` and disposable stacks (ES2027). | TC39 proposal-explicit-resource-management |
| **Disposable** | **Uvolnitelný prostředek (disposable)** | An object with a `[Symbol.dispose]()` or `[Symbol.asyncDispose]()` method. | TC39 proposal-explicit-resource-management |

## 8. Binary data, concurrency and the memory model

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **ArrayBuffer** | **ArrayBuffer (bajtový buffer)** | A fixed-length or resizable raw byte buffer, read through typed arrays or a DataView. | ECMA-262 §25.1 |
| **Typed Array** | **Typované pole** | A view interpreting a buffer as elements of one numeric type in platform byte order. | ECMA-262 §23.2 |
| **Endianness** | **Pořadí bajtů (endianita)** | The byte order of multi-byte values: little-endian or big-endian. | IEEE 754, Cohen (1981) |
| **Detached Buffer** | **Odpojený buffer** | An ArrayBuffer whose memory was transferred away; its length is 0 and new views cannot be created. | ECMA-262 §25.1.3 |
| **Agent** | **Agent** | A thread of execution with its own execution context stack and event loop (main thread, worker). | ECMA-262 §9.6 |
| **Agent Cluster** | **Shluk agentů** | A set of agents that can share memory through SharedArrayBuffer. | ECMA-262 §9.7 |
| **Shared Memory** | **Sdílená paměť** | Memory accessible by several agents simultaneously (SharedArrayBuffer). | ECMA-262 §25.2 |
| **Memory Model** | **Paměťový model** | The rules determining which values reads of shared memory may observe in concurrent executions. | ECMA-262 §29 |
| **Happens-Before** | **Relace „nastane před“ (happens-before)** | The partial order of events built from program order and synchronises-with edges. | ECMA-262 §29.6.6, Lamport (1978) |
| **Data Race** | **Datový souběh (data race)** | Conflicting accesses to the same memory, at least one a write, not ordered by happens-before and not both atomic. | ECMA-262 §29.9 |
| **Sequential Consistency** | **Sekvenční konzistence** | The guarantee that execution behaves like an interleaving of all agents' operations in program order. | Lamport (1979), ECMA-262 §29.7.4 |
| **Atomic Operation** | **Atomická operace** | An indivisible memory operation (`Atomics.add`, `compareExchange`) with sequentially consistent ordering. | ECMA-262 §25.4 |
| **Compare-and-Swap (CAS)** | **Porovnej a zaměň (CAS)** | An atomic operation that writes a new value only if the current value equals an expected one. | Herlihy & Shavit (The Art of Multiprocessor Programming) |
| **Mutex** | **Mutex (vzájemné vyloučení)** | A lock guaranteeing that at most one agent executes a critical section at a time. | Dijkstra (1965) |
| **Cross-Origin Isolation** | **Izolace mezi původy** | The COOP/COEP state that browsers require before enabling SharedArrayBuffer. | HTML Living Standard |

## 9. Engines and performance

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Just-in-Time Compilation (JIT)** | **Překlad za běhu (JIT)** | Compilation of code to machine code during execution, guided by runtime feedback. | Aycock (2003) |
| **Bytecode Interpreter** | **Interpret bajtkódu** | The engine tier that executes compact bytecode (V8 Ignition) and collects type feedback. | V8 blog (2016) |
| **Hidden Class (Map, Shape)** | **Skrytá třída (map, shape)** | An engine-internal descriptor of an object's layout shared by objects with the same properties in the same order. | Chambers, Ungar & Lee (1989), V8 blog |
| **Inline Cache (IC)** | **Inline cache (IC)** | A per-site cache of observed hidden classes enabling fast property access; monomorphic, polymorphic or megamorphic. | Hölzle, Chambers & Ungar (1991) |
| **Deoptimization** | **Deoptimalizace** | Discarding optimised code when its speculative assumptions fail and resuming in the interpreter. | V8 documentation |
| **Elements Kind** | **Druh prvků (elements kind)** | V8's classification of array storage (Smi, double, generic; packed or holey). | V8 blog (2017) |
| **Generational Garbage Collection** | **Generační správa paměti (garbage collection)** | Collection that separates young and old objects, collecting young ones frequently. | Ungar (1984), Jones et al. (The Garbage Collection Handbook) |
| **Write Barrier** | **Zápisová bariéra** | Code run on pointer stores that records old-to-young references for the collector. | Jones et al. (The Garbage Collection Handbook) |

## 10. Security and correctness

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Prototype Pollution** | **Znečištění prototypu (prototype pollution)** | An attack that writes attacker-controlled properties to a shared prototype such as `Object.prototype`. | OWASP Prototype Pollution Prevention Cheat Sheet |
| **ReDoS** | **ReDoS (odepření služby regulárním výrazem)** | Denial of service by inputs that make a backtracking regular-expression engine take exponential time. | OWASP |
| **Catastrophic Backtracking** | **Katastrofický backtracking** | Exponential exploration of match alternatives caused by nested or overlapping quantifiers. | Friedl (Mastering Regular Expressions) |
| **Stable Sort** | **Stabilní řazení** | A sort that keeps the relative order of elements comparing equal; required for `Array.prototype.sort` since ES2019. | ECMA-262 §23.1.3.30, Knuth (TAOCP Vol. 3) |
| **Consistent Comparator** | **Konzistentní komparátor** | A comparison function defining a total preorder and returning consistent negative, zero or positive numbers. | ECMA-262 §23.1.3.30 |

## 11. Shared with the root glossary

These rows are copied verbatim from the [root glossary](../../GLOSSARY.md).

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Closure** | **Uzávěr (lexikální uzávěr)** | The combination of a function bundled together with references to its surrounding lexical environment, allowing access to outer scope variables. | Landin (The Mechanical Evaluation of Expressions) |
| **Immutability** | **Neměnnost (imutabilita)** | The property of a data structure or object whose state cannot be modified after instantiation. Modifications create a new instance. | Okasaki (Purely Functional Data Structures) |
| **Higher-Order Function** | **Funkce vyššího řádu** | A function that accepts one or more functions as arguments, returns a function, or both. | Abelson & Sussman (SICP) |
| **First-Class Citizen** | **Prvotřídní prvek (hodnota první třídy)** | An entity in a programming language (e.g., a function) that can be bound to variables, passed as arguments, and returned from other functions. | Strachey |
| **Pure Function** | **Čistá funkce** | A function whose return value depends exclusively on its input arguments, producing no observable side effects. | Church (Lambda Calculus), Functional Programming Standards |
| **Side Effect** | **Vedlejší účinek** | Any state mutation outside the local execution scope of a function (e.g., modifying global state, performing I/O, writing to disk or network). | IEEE Standard Glossary of Software Engineering Technology |
| **Strong vs. Weak Typing** | **Silné vs. slabé typování** | Strong typing strictly disallows unintended implicit type conversions between incompatible types; weak typing allows implicit type coercion (e.g., interpreting numbers as strings). | Cardelli & Wegner (On Understanding Types) |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
