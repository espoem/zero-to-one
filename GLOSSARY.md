# Zero-to-One: Core Computer Science & Engineering Glossary

A standardized index of core computer science, software architecture, and algorithm concepts used across the `zero-to-one` learning tracks.

All definitions and prose are in English; terms provide their canonical English name and established Czech equivalent. Concepts adhere to authoritative definitions from academic literature (Cormen et al. [CLRS], Knuth [TAOCP]), official specifications (ISO/IEC, IEEE, ECMA, W3C), and foundational treatises.

---

## 1. Programming Paradigms & Foundations

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Pure Function** | **Čistá funkce** | A function whose return value depends exclusively on its input arguments, producing no observable side effects. | Church (Lambda Calculus), Functional Programming Standards |
| **Side Effect** | **Vedlejší účinek** | Any state mutation outside the local execution scope of a function (e.g., modifying global state, performing I/O, writing to disk or network). | IEEE Standard Glossary of Software Engineering Technology |
| **Referential Transparency** | **Referenční transparentnost** | An expression property where any call can be substituted with its resulting value without altering the behavior of the program. | Strachey (Fundamental Concepts in Programming Languages) |
| **Immutability** | **Neměnnost (imutabilita)** | The property of a data structure or object whose state cannot be modified after instantiation. Modifications create a new instance. | Okasaki (Purely Functional Data Structures) |
| **Idempotence / Idempotency** | **Idempotence** | The property of an operation where multiple identical executions yield the exact same system state as a single execution (`f(f(x)) = f(x)`). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
| **Type System** | **Typový systém** | A tractable syntactic method for proving the absence of certain program behaviors by classifying expressions according to the kinds of values they compute. | Pierce (Types and Programming Languages - TAPL) |
| **Static vs. Dynamic Typing** | **Statické vs. dynamické typování** | Static typing verifies and enforces type constraints at compile time; dynamic typing validates types during runtime execution. | Pierce (TAPL), ISO/IEC 2382 |
| **Strong vs. Weak Typing** | **Silné vs. slabé typování** | Strong typing strictly disallows unintended implicit type conversions between incompatible types; weak typing allows implicit type coercion (e.g., interpreting numbers as strings). | Cardelli & Wegner (On Understanding Types) |
| **Structural vs. Nominal Typing** | **Strukturální vs. nominální typování** | In structural typing, type compatibility is determined by shape and members; in nominal typing, compatibility requires explicit declarations and type names. | Pierce (TAPL) |
| **First-Class Citizen** | **Prvotřídní prvek (hodnota první třídy)** | An entity in a programming language (e.g., a function) that can be bound to variables, passed as arguments, and returned from other functions. | Strachey |
| **Higher-Order Function** | **Funkce vyššího řádu** | A function that accepts one or more functions as arguments, returns a function, or both. | Abelson & Sussman (SICP) |
| **Closure** | **Uzávěr (lexikální uzávěr)** | The combination of a function bundled together with references to its surrounding lexical environment, allowing access to outer scope variables. | Landin (The Mechanical Evaluation of Expressions) |

---

## 2. Algorithms & Computational Complexity

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Time Complexity** | **Časová složitost** | An asymptotic measure quantifying the amount of time an algorithm takes as a function of the input length `n`. | Cormen, Leiserson, Rivest, Stein (CLRS) |
| **Space Complexity** | **Paměťová složitost** | An asymptotic measure quantifying the memory storage an algorithm consumes relative to the input length `n`. | CLRS |
| **Big-O Notation** | **Asymptotická notace O** | A mathematical notation describing the asymptotic upper bound of a function's growth rate (`f(n) ∈ O(g(n))`). | Knuth (Big Omicron and big Omega and big Theta) |
| **Amortized Analysis** | **Amortizovaná analýza** | A method of analyzing the average execution cost of operations over a sequence of operations in the worst case (e.g., dynamic array growth). | Tarjan (Amortized Computational Complexity) |
| **Divide and Conquer** | **Rozděl a panuj** | An algorithmic paradigm that breaks a problem down into smaller subproblems of the same type, solves them recursively, and combines results. | CLRS |
| **Dynamic Programming** | **Dynamické programování** | An optimization technique that solves complex problems by combining solutions to overlapping subproblems using memoization or tabulation. | Bellman (Dynamic Programming) |
| **Greedy Algorithm** | **Hladový algoritmus** | An algorithm that makes the locally optimal choice at each step with the goal of finding a global optimum. | CLRS |

---

## 3. Architecture & Distributed Systems

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CAP Theorem** | **CAP teorém (Brewerův teorém)** | A fundamental theorem stating that a distributed data store can simultaneously provide at most two of three guarantees: Consistency, Availability, and Partition Tolerance. | Brewer, Gilbert & Lynch |
| **Eventual Consistency** | **Konečná konzistence** | A consistency model where, in the absence of new updates, all replicas eventually converge to the same value. | Vogels (Eventually Consistent) |
| **ACID** | **ACID (Atomicity, Consistency, Isolation, Durability)** | A suite of four standard properties guaranteeing that database transactions are processed reliably. | Haerder & Reuter |
| **BASE** | **BASE (Basically Available, Soft state, Eventual consistency)** | An architectural model prioritizing high availability over immediate consistency in distributed environments. | Pritchett |
| **Separation of Concerns (SoC)** | **Oddělení odpovědností / zájmů** | A design principle for separating a computer program into distinct sections, where each section addresses a separate concern. | Dijkstra (On the Role of Scientific Thought) |
| **Single Responsibility Principle (SRP)** | **Princip jedné odpovědnosti** | An object-oriented and modular principle stating that a module should have one, and only one, reason to change. | Martin (Clean Architecture / SOLID) |
| **Dependency Inversion Principle (DIP)** | **Princip inverze závislostí** | A structural principle stating that high-level modules should not depend on low-level modules; both should depend on abstractions. | Martin (SOLID) |

---

## 4. Databases, Storage Engines & Concurrency Control

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Multi-Version Concurrency Control (MVCC)** | **Víceverzně řízené souběžné zpracování (MVCC)** | A concurrency control method where mutations generate new physical record versions instead of modifying data in place, allowing readers and writers to execute concurrently without mutual blocking. | Bernstein, Hadzilacos, Goodman (Concurrency Control & Recovery) |
| **Write-Ahead Logging (WAL)** | **Zápis do předstihového deníku (WAL)** | A durability protocol requiring state modifications to be flushed to non-volatile sequential log storage before the corresponding dirty page blocks are written to heap storage. | Mohan et al. (ARIES Recovery Algorithm) |
| **Serializable Snapshot Isolation (SSI)** | **Sériovatelná izolace přes snímky (SSI)** | An optimistic concurrency isolation mechanism providing strict serializability by tracking dynamic read-write anti-dependencies (si-edges) without blocking concurrent read or write transactions. | Cahill, Röhm, Fekete (Serializable Isolation for Snapshot Databases) |
| **Two-Phase Locking (2PL)** | **Dvoufázové zamykání (2PL)** | A pessimistic concurrency control algorithm ensuring serializability by dividing lock handling into an expanding growing phase and a contracting shrinking phase. | Eswaran, Gray, Lorie, Traiger (The Notions of Consistency and Predicate Locks) |
| **Cost-Based Optimizer (CBO)** | **Nákladový optimalizátor dotazů** | An execution planning engine estimating disk I/O, memory bandwidth, and CPU cycles for candidate relational algebra trees to select the cheapest execution plan. | Selinger et al. (Access Path Selection in a Relational Database Management System) |
| **B-Tree (Balanced Tree)** | **B-strom (vyvážený vyhledávací strom)** | A self-balancing search tree data structure maintaining sorted keys with logarithmic search, insertion, and deletion times, optimized for disk block page access. | Bayer & McCreight (Organization and Maintenance of Large Ordered Indices) |
| **Point-In-Time Recovery (PITR)** | **Obnova k určitému časovému bodu (PITR)** | A disaster recovery mechanism that restores a base snapshot and continuously rolls forward sequential write-ahead logs up to an exact timestamp or transaction boundary. | Database Systems Architecture |

---

## 5. Reactive Systems, Compilers & UI Runtime Mechanics

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Fine-Grained Reactivity** | **Jemnozrnná reaktivita** | A state management model where atomic state cells connect directly to dependent computations and bindings without intermediate virtual DOM diffing. | Reactive Programming Literature |
| **Glitch Freedom** | **Absence zákmitů (glitch freedom)** | The formal guarantee that derived computations in a reactive graph never observe transient or inconsistent combinations of old and new inputs during state propagation. | Reactive Graph Semantics |
| **Reconciliation** | **Usmiřování (reconciliation)** | The algorithmic process of comparing two virtual UI tree descriptions to determine the minimal sequence of mutations required to update the target host environment. | UI Systems Architecture |
| **Time Slicing** | **Časové dělení (time slicing)** | An execution technique dividing long-running rendering or computational tasks into discrete time quanta (e.g. 5ms), yielding execution to avoid blocking input events. | Cooperative Multitasking Standards |
| **Hydration** | **Hydratace** | The process where a client runtime attaches reactive state, event listeners, and data structures to server-rendered markup without destroying or recreating the existing DOM tree. | Web Architecture Specifications |
| **Zero-Runtime Compilation** | **Kompilace s nulovým během** | A build-time architecture where code representations (such as style objects or JSX) are evaluated and extracted statically ahead of time, leaving zero runtime overhead in production bundles. | Compiler Engineering Standards |
