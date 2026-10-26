# Zero-to-One: Core Computer Science & Engineering Glossary

A standardized, bilingual (English ↔ Czech) index of core computer science, software architecture, and algorithm concepts used across the `zero-to-one` learning tracks.

Terms follow established definitions from standard academic literature (Cormen et al. [CLRS], Knuth [TAOCP]), official specification bodies (ISO/IEC, IEEE, ECMA, W3C), and authoritative engineering treatises.

---

## 1. Programming Paradigms & Foundations / Programovací paradigmata a základy

| English Term | Český ekvivalent | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Pure Function** | **Čistá funkce** | Funkce, jejíž návratová hodnota závisí výhradně na předaných argumentech a její volání nemá žádné pozorovatelné vedlejší účinky (*side effects*). | Church (Lambda Calculus), Functional Programming Standards |
| **Side Effect** | **Vedlejší účinek** | Jakákoli modifikace stavu mimo lokální kontext funkce (např. mutace globální proměnné, I/O operace, zápis do disku či sítě). | IEEE Standard Glossary of Software Engineering Technology |
| **Referential Transparency** | **Referenční transparentnost** | Vlastnost výrazu, který lze kdekoli v programu nahradit jeho výslednou hodnotou, aniž by se změnilo chování celého programu. | Strachey (Fundamental Concepts in Programming Languages) |
| **Immutability** | **Neměnnost (imutalibilita)** | Vlastnost datové struktury nebo objektu, jehož stav po vytvoření nelze modifikovat. Změna stavu vytváří instanci novou. | Okasaki (Purely Functional Data Structures) |
| **Idempotence / Idempotency** | **Idempotence** | Vlastnost operace, jejíž opakované volání se stejnými parametry má stejný výsledný stav systému jako volání jediné ($f(f(x)) = f(x)$). | ISO/IEC 2382, RFC 9110 (HTTP Semantics) |
| **Type System** | **Typový systém** | Traktovatelná syntaktická metoda pro dokazování nepřítomnosti určitých tříd chování programu klasifikací výrazů podle druhů hodnot, které počítají. | Pierce (Types and Programming Languages - TAPL) |
| **Static vs. Dynamic Typing** | **Statické vs. dynamické typování** | Statické typování ověřuje a vynucuje typová pravidla v době kompilace (*compile-time*); dynamické typování provádí typovou kontrolu za běhu programu (*runtime*). | Pierce (TAPL), ISO/IEC 2382 |
| **Strong vs. Weak Typing** | **Silné vs. slabé typování** | Silné typování zabraňuje nepovoleným implicitním konverzím mezi nekompatibilními typy; slabé typování umožňuje implicitní přetypování (např. interpretaci čísla jako řetězce). | Cardelli & Wegner (On Understanding Types) |
| **Structural vs. Nominal Typing** | **Strukturální vs. nominální typování** | U strukturálního typování závisí kompatibilita typů na jejich tvaru a členech (*shape*); u nominálního typování na explicitním názvu a deklaraci typu. | Pierce (TAPL) |
| **First-Class Citizen** | **Prvotřídní prvek (hodnota první třídy)** | Entita jazyka (např. funkce), kterou lze uložit do proměnné, předat jako argument funkci a vrátit jako návratovou hodnotu. | Strachey |
| **Higher-Order Function** | **Funkce vyššího řádu** | Funkce, která přijímá jednu či více funkcí jako argumenty, nebo vrací funkci jako svůj výsledek. | Abelson & Sussman (SICP) |
| **Closure** | **Uzávěr (lexikální uzávěr)** | Kombinace funkce a lexikálního prostředí, ve kterém byla tato funkce deklarována, umožňující funkci přistupovat k proměnným z vnějšího oboru platnosti. | Landin (The Mechanical Evaluation of Expressions) |

---

## 2. Algorithms & Computational Complexity / Algoritmy a výpočetní složitost

| English Term | Český ekvivalent | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Time Complexity** | **Časová složitost** | Asymptotická míra vyjadřující závislost doby běhu algoritmu na velikosti vstupních dat $n$. | Cormen, Leiserson, Rivest, Stein (CLRS) |
| **Space Complexity** | **Paměťová složitost** | Asymptotická míra vyjadřující množství paměti, které algoritmus potřebuje v závislosti na velikosti vstupu $n$. | CLRS |
| **Big-O Notation** | **Asymptotická notace $\mathcal{O}$** | Matematická notace popisující horní mez asymptotického růstu funkce ($f(n) \in \mathcal{O}(g(n))$). | Knuth (Big Omicron and big Omega and big Theta) |
| **Amortized Analysis** | **Amortizovaná analýza** | Metoda analýzy průměrné časové složitosti posloupnosti operací v nejhorším případě (např. dynamické pole). | Tarjan (Amortized Computational Complexity) |
| **Divide and Conquer** | **Rozděl a panuj** | Algoritmické paradigma rozdělující problém na menší podproblémy stejného typu, jejichž nezávislá řešení jsou následně sloučena. | CLRS |
| **Dynamic Programming** | **Dynamické programování** | Metoda řešení optimalizačních problémů rozkladem na překrývající se podproblémy (*overlapping subproblems*) a ukládáním mezivýsledků (*memoization* / *tabulation*). | Bellman (Dynamic Programming) |
| **Greedy Algorithm** | **Hladový algoritmus** | Algoritmus volící v každém kroku lokálně optimální variantu s předpokladem dosažení globálního optima. | CLRS |

---

## 3. Architecture & Distributed Systems / Architektura a distribuované systémy

| English Term | Český ekvivalent | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CAP Theorem** | **CAP teorém (Brewerův teorém)** | Věta dokazující, že distribuované datové úložiště může současně garantovat nanejvýš dvě ze tří vlastností: Konzistenci (*Consistency*), Dostupnost (*Availability*) a Odolnost vůči rozdělení sítě (*Partition Tolerance*). | Brewer, Gilbert & Lynch |
| **Eventual Consistency** | **Konečná konzistence** | Model konzistence, kde při absenci nových aktualizací dosáhnou všechny repliky v systému časem identického stavu. | Vogels (Eventually Consistent) |
| **ACID** | **ACID (Atomicity, Consistency, Isolation, Durability)** | Sada čtyř vlastností garantujících spolehlivé provádění databázových transakcí (Atomicita, Konzistence, Izolace, Trvalost). | Haerder & Reuter |
| **BASE** | **BASE (Basically Available, Soft state, Eventual consistency)** | Architektonický model odolný vůči výpadkům, preferující dostupnost před okamžitou striktní konzistencí. | Pritchett |
| **Separation of Concerns (SoC)** | **Oddělení odpovědností / zájmů** | Princip navrhování software rozdělením programu do odlišných sekcí, z nichž každá řeší právě jeden izolovaný zájem. | Dijkstra (On the Role of Scientific Thought) |
| **Single Responsibility Principle (SRP)** | **Princip jedné odpovědnosti** | Třída nebo modul by měly mít pouze jeden jediný důvod ke změně (*only one reason to change*). | Martin (Clean Architecture / SOLID) |
| **Dependency Inversion Principle (DIP)** | **Princip inverze závislostí** | Moduly vyšší úrovně by neměly záviset na modulech nižší úrovně; obojí by mělo záviset na abstrakcích. | Martin (SOLID) |
