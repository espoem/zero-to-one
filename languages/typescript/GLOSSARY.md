# TypeScript & Modern JavaScript Glossary / Slovník pojmů

Tento slovník definuje standardní odborné termíny používané v osnově `languages/typescript/`. Termíny vycházejí z oficiální specifikace TypeScriptu, standardu ECMA-262 (ECMAScript) a obecné teorie typů (Benjamin C. Pierce: *Types and Programming Languages*).

---

## 1. Type System Foundations / Základy typového systému

| English Term | Český ekvivalent | Definice a kontext | Oficiální reference |
| :--- | :--- | :--- | :--- |
| **Type World vs. Value World** | **Typový prostor vs. prostor hodnot** | Dvě oddělené roviny v TypeScriptu: *Type World* existuje pouze během kompilace a při transpilaci do JavaScriptu je zcela vymazán (*type erasure*); *Value World* představuje reálná runtime data a kód. | TypeScript Handbook |
| **Structural Typing (Duck Typing)** | **Strukturální typování** | Typový systém posuzující kompatibilitu dvou typů výhradně na základě jejich tvaru, vlastností a metod, nikoliv podle jejich deklarovaného názvu či hierarchie dědičnosti. | TS Handbook (Type Compatibility), Pierce (TAPL) |
| **Type Erasure** | **Vymazání typů** | Proces kompilace TypeScriptu, při kterém jsou veškeré typové anotace, rozhraní, aliasy a type asserty odstraněny, takže výsledný JavaScript obsahuje pouze spustitelný kód. | TypeScript Design Goals |
| **Type Annotation** | **Typová anotace** | Explicitní zápis za dvojtečkou (`: T`) přikazující kompilátoru, jakého typu musí proměnná, parametr nebo návratová hodnota být. Může způsobit rozšíření (*widening*) literálu na obecnější typ. | TS Handbook (Everyday Types) |
| **Type Inference** | **Typová inference (odvozování typů)** | Schopnost kompilátoru automaticky určit nejpřesnější typ výrazu bez nutnosti explicitní ruční anotace programátorem. | TS Handbook (Type Inference) |
| **Type Widening** | **Rozšíření typu (zobecnění)** | Mechanismus, při kterém kompilátor odvodí z konkrétní literálové hodnoty (např. `'admin'`, `42`) její širší bázový primitivní typ (`string`, `number`), pokud není explicitně zmrazen (`as const`). | TS Handbook |
| **Type Narrowing** | **Zúžení typu (zpřesnění)** | Proces, při kterém kompilátor na základě toku řízení (*Control-Flow Analysis*) zužuje širší typ (např. unii `string \| number`) na konkrétnější podtyp. | TS Handbook (Narrowing) |
| **Control-Flow Analysis (CFA)** | **Analýza toku řízení** | Statická analýza kódu, kterou kompilátor provádí na větvích podmínek (`if`, `switch`, `throw`, ternární operátory) za účelem vyhodnocení dosažitelnosti kódu a zúžení typů. | TypeScript Compiler Architecture |
| **Exhaustiveness Checking** | **Kontrola úplnosti (vyčerpání variant)** | Technika ověřující, že všechny možné stavy unie byly v kódu obslouženy; neobsloužený zbytek je přiřazen do typu `never`, což způsobí chybu kompilace při přidání nové varianty. | TS Handbook (Narrowing / The never type) |

---

## 2. Types & Combinators / Typy a typové kombinátory

| English Term | Český ekvivalent | Definice a kontext | Oficiální reference |
| :--- | :--- | :--- | :--- |
| **Union Type (`A \| B`)** | **Typ sjednocení (unijní typ)** | Typ reprezentující hodnotu, která může být libovolného z uvedených typů (matematické sjednocení množin platných hodnot). | TS Handbook (Everyday Types) |
| **Intersection Type (`A & B`)** | **Typ průniku (průnikový typ)** | Typ reprezentující hodnotu, která současně splňuje požadavky všech zadaných typů (slučuje jejich vlastnosti). | TS Handbook (Everyday Types) |
| **Discriminated Union** | **Rozlišená (diskriminovaná) unie / tagované sjednocení** | Unie objektových typů, z nichž každý obsahuje společnou vlastnost s unikátní literálovou hodnotou (*discriminant / tag*), umožňující bezpečné větvení a zúžení. | TS Handbook (Narrowing), Pierce (TAPL) |
| **Discriminant (Tag)** | **Diskriminant (značka)** | Literálová vlastnost sdílená všemi členy diskriminované unie, podle které kompilátor jednoznačně identifikuje konkrétní variantu. | TS Handbook |
| **Tuple** | **N-tice (uspořádaná n-tice / tuple)** | Pole s pevně definovaným počtem prvků a známým typem na každém konkrétním indexu. | TS Handbook |
| **Literal Type** | **Literálový typ** | Typ reprezentující přesně jednu konkrétní hodnotu (např. `'success'`, `200`, `true`), nikoliv obecnou doménu hodnot. | TS Handbook |
| **Index Access Type (`T[K]`)** | **Indexovaný přístupový typ** | Typový operátor sloužící k vytažení typu konkrétní vlastnosti `K` z typu `T` (analogicky jako přístup k vlastnosti objektu za běhu). | TS Handbook (Indexed Access Types) |
| **Index Signature (`[key: string]: V`)** | **Indexová signatura** | Deklarace v objektovém typu definující, že objekt může mít dynamické klíče daného typu se zadaným typem hodnot. | TS Handbook (Object Types) |
| **Excess Property Checks** | **Kontrola nadbytečných vlastností** | Zpřísněná kontrola kompilátoru u čerstvých objektových literálů přiřazovaných do cílového typu, která zakazuje vlastnosti nedeklarované v cílovém typu. | TS Handbook (Object Types) |

---

## 3. Advanced Type-Level Mechanics / Pokročilé typové mechanismy

| English Term | Český ekvivalent | Definice a kontext | Oficiální reference |
| :--- | :--- | :--- | :--- |
| **Generics (Parametric Polymorphism)** | **Generika (parametrický polymorfismus)** | Schopnost psát komponenty, funkce a rozhraní pracující s proměnnými typy (*type parameters*), což umožňuje znovupoužitelnost se zachováním typové bezpečnosti. | TS Handbook (Generics), Pierce (TAPL) |
| **Type Parameter Constraint (`T extends U`)** | **Omezení typového parametru** | Pravidlo omezující typový parametr `T` tak, aby musel být podtypem typu `U`. | TS Handbook (Generics) |
| **Const Type Parameters (`<const T>`)** | **Literálové typové parametry** | Vlastnost představená v TS 5.0, která při volání generické funkce automaticky odvodí nejužší možný literálový typ argumentu bez nutnosti psát `as const`. | TypeScript 5.0 Release Notes |
| **Conditional Types (`T extends U ? X : Y`)** | **Podmíněné typy** | Typový výraz volící jeden ze dvou výsledných typů na základě testu splnění vztahu podtypu (`extends`). | TS Handbook (Conditional Types) |
| **Distributive Conditional Types** | **Distributivní podmíněné typy** | Chování podmíněných typů, kdy se při aplikaci na nahou typovou proměnnou unie vyhodnocuje podmínka pro každý prvek unie samostatně a výsledky se opět sjednotí. | TS Handbook (Conditional Types) |
| **`infer` Keyword** | **Klíčové slovo `infer`** | Deklarace typové proměnné v podmíněném typu sloužící k pattern-matchingu a dedukci vnitřního typu (např. návratové hodnoty funkce). | TS Handbook (Conditional Types) |
| **Mapped Types (`{ [K in Keys]: ... }`)** | **Mapované typy** | Konstrukce umožňující vytvořit nový objektový typ iterací přes unii klíčů a transformací jejich vlastností a typů. | TS Handbook (Mapped Types) |
| **Key Remapping (`as`)** | **Pemapování klíčů (klíčové slovo `as`)** | Technika v mapovaných typech umožňující filtrovat nebo měnit názvy vlastností (často pomocí template literálů). | TypeScript 4.1 Release Notes |
| **Template Literal Types** | **Šablonové literálové typy** | Typy umožňující skládat a manipulovat s řetězcovými literály pomocí syntaxe šablonových řetězců (včetně permutací unií). | TS Handbook (Template Literal Types) |
| **Branded Types (Nominal Flavoring)** | **Značkované (brandované) typy** | Technika simulace nominálního typování ve strukturálním typovém systému přidáním fiktivní unikátní vlastnosti (pomocí `unique symbol`), zabraňující záměně primitiv (např. `UserId` vs `OrderId`). | TypeScript FAQ / Total TypeScript |
| **Type Predicate (`x is T`)** | **Typový predikát (uživatelský type guard)** | Návratový typ funkce říkající kompilátoru, že pokud funkce vrátí `true`, má být argument `x` v dané větvi zúžen na typ `T`. | TS Handbook (Narrowing) |
| **Assertion Function (`asserts x is T`)** | **Asertivní funkce** | Funkce, která pokud nevyhodí výjimku, garantuje pro zbytek aktuálního bloku kódu, že výraz `x` je typu `T`. | TypeScript 3.7 Release Notes |

---

## 4. Subtyping Variance / Variabilita podtypování

| English Term | Český ekvivalent | Definice a kontext | Oficiální reference |
| :--- | :--- | :--- | :--- |
| **Covariance** | **Kovariance** | Vztah, kdy komplexní typ zachovává směr uspořádání podtypů (pokud $A \le B$, pak $F(A) \le F(B)$). Typické pro návratové hodnoty funkcí a čtecí kolekce. | Pierce (TAPL), Cardelli |
| **Contravariance** | **Kontravariance** | Vztah, kdy komplexní typ obrací směr uspořádání podtypů (pokud $A \le B$, pak $F(B) \le F(A)$). Typické pro parametry funkcí při zapnutém `--strictFunctionTypes`. | Pierce (TAPL), TS Handbook |
| **Invariance** | **Invariance** | Vztah, kdy $F(A) \le F(B)$ platí právě tehdy, když $A = B$. Typické pro mutabilní datové struktury (čtení i zápis). | Pierce (TAPL) |
| **Bivariance** | **Bivariance** | Vztah, kdy $F(A) \le F(B)$ platí, pokud $A \le B$ nebo $B \le A$. Výchozí u parametrů metod v TypeScriptu kvůli kompatibilitě s poli v JavaScriptu. | TypeScript FAQ |

---

## 5. Operators, Directives & Pragmas / Operátory, direktivy a pragmata

| English Term | Český ekvivalent | Definice a kontext | Oficiální reference |
| :--- | :--- | :--- | :--- |
| **`satisfies` Operator** | **Operátor `satisfies`** | Operátor ověřující, že výraz vyhovuje určitému typu, aniž by došlo k rozšíření (*wideningu*) jeho odvozeného typu na daný typ. | TypeScript 4.9 Release Notes |
| **`as const` Assertion** | **Konstantní tvrzení (`as const`)** | Typové tvrzení instruující kompilátor, aby odvodil nejužší možné literálové typy a označil všechny vlastnosti a vnořená pole jako `readonly`. | TypeScript 3.4 Release Notes |
| **Non-Null Assertion (`!`)** | **Operátor nenulovosti (non-null assertion)** | Postfixový operátor `!` tvrdící kompilátoru, že hodnota v daném místě není `null` ani `undefined`. | TS Handbook |
| **`@ts-expect-error`** | **Direktiva `@ts-expect-error`** | Komentářová direktiva potlačující následující chybu kompilátoru za podmínky, že na daném řádku skutečně k chybě dochází (pokud k chybě nedojde, TS zahlásí varování). | TypeScript 3.9 Release Notes |
| **`@ts-ignore`** | **Direktiva `@ts-ignore`** | Komentářová direktiva bezpodmínečně ignorující jakoukoli chybu na následujícím řádku. | TS Handbook |
| **Explicit Resource Management (`using`)** | **Explicitní správa prostředků (`using`)** | Syntaxe založená na TC39 standardu pro deterministický úklid prostředků při opuštění bloku kódu voláním metody `[Symbol.dispose]()`. | TypeScript 5.2 Release Notes / TC39 |
