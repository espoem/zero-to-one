/**
 * Module 01: Elements, JSX & Runtime Model
 *
 * Verifies React element creation, $$typeof symbol security boundaries,
 * props immutability, and JSX runtime lowering semantics.
 */

import assert from "node:assert/strict";
import React from "react";

console.log("=== React 19 Module 01: Elements, JSX & Runtime Model ===");

// 1. Element Representation & $$typeof Symbol Verification
{
  const element = React.createElement("div", { id: "test-node", className: "primary" }, "Hello React 19");

  assert.equal(element.type, "div", "Element type should match tag name");
  assert.equal(element.props.id, "test-node", "Element props should preserve assigned id");
  assert.equal(element.props.className, "primary", "Element props should preserve assigned className");
  assert.equal((element.props as any).children, "Hello React 19", "Children should be placed on props.children");

  // React 19 uses Symbol.for('react.transitional.element') or Symbol.for('react.element')
  const symbolKey = Symbol.keyFor((element as any).$$typeof);
  assert.ok(
    symbolKey === "react.transitional.element" || symbolKey === "react.element",
    `$$typeof must be a known React element symbol, got: ${symbolKey}`
  );

  console.log("✓ Element creation and symbol security verified.");
}

// 2. Negative Proof: Untrusted JSON Injection Rejection
// An attacker sending an object resembling a React element via JSON cannot forge
// the $$typeof property because JSON cannot serialize Symbol values.
{
  const forgedElement = JSON.parse(
    JSON.stringify({
      $$typeof: "react.element", // String representation, not a true Symbol
      type: "script",
      props: { dangerouslySetInnerHTML: { __html: "alert('xss')" } },
      key: null,
      ref: null,
    })
  );

  assert.notEqual(
    typeof forgedElement.$$typeof,
    "symbol",
    "JSON.parse cannot recreate a true Symbol for $$typeof"
  );
  assert.equal(
    React.isValidElement(forgedElement),
    false,
    "React.isValidElement must reject untrusted JSON objects without Symbol $$typeof"
  );

  console.log("✓ Negative proof: Untrusted JSON injection successfully rejected.");
}

// 3. React 19 `ref` as a Regular Prop
// In React 19, `ref` is no longer a special reserved property stripped from props;
// it is accessible directly as props.ref.
{
  const refCallback = (_el: HTMLDivElement | null) => {};
  const elementWithRef = React.createElement("div", { ref: refCallback, title: "Card" });

  assert.equal(elementWithRef.props.ref, refCallback, "React 19 passes ref directly via props");
  console.log("✓ React 19 native ref-in-props contract verified.");
}

// 4. Props Immutability (Freeze Check)
{
  const element = React.createElement("span", { count: 42 });

  assert.throws(
    () => {
      // mutating frozen props must fail at runtime
      (element.props as any).count = 43;
    },
    { name: "TypeError" },
    "Mutating element.props must throw TypeError in strict mode"
  );

  console.log("✓ Props immutability verified.");
}

console.log("All 01 Elements & JSX Runtime tests passed successfully!\n");
