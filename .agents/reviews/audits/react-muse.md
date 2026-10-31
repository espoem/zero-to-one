# Challenger Audit: technologies/react
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `technologies/react`
Date: 2026-10-31

---

# Adversarial Audit — `technologies/react`

## P0 — Blockers (correctness / security / spec violation)

### P0-1 — CVE patched-floor table has gaps and overstates certainty
- `modules/07-server-components-and-flight.md §7.2`: verify CVE-2026-44907 patch versions against primary advisory.
- Ensure version gates in tests and exam answers are grounded in verified changelogs.

### P0-2 — Untangled transitions vs entangled action scope
- `05 §3.4` (untangled transitions in React 19.3) vs `08 §1` (hung async action holds back transitions): provide clear truth table explaining how `currentEntangledLane` behaves for transitions vs async actions.

### P0-3 — `browser()` / `onBrowserBailout` API verification
- Verify `react-dom/browser` export and behavior; add negative test or mark `(unverified)`.

---

## P1 — Material factual / exam-validity errors

### P1-1 — Mermaid sequenceDiagram syntax
In `02 §6`: `BM->>M: ` (empty label after colon) causes parse errors in Mermaid 11/12. Fix to `BM->>M: "mutation phase"`.

### P1-2 — FragmentInstance method surface
Verify method names against React 19.3.1 source; drop unconfirmed names.

### P1-3 — Trusted Types proof
Mark jsdom limitations and point to browser/integration tests.

### P1-4 — Lane table & PR links
Verify PR numbers and lane bit positions.

### P1-5 — Commit order & insertion effects
In Q-RI-006, clarify timing of `useInsertionEffect` vs mutation effects and layout effects.

---

## P2 / P3 — Rigor & Polish

- Replace `&lt;` / `&gt;` in diagram labels with clean text or `#60;` / `#62;`.
- Update exam `Ref:` lines to include `#anchor`.
- Run `tools/mermaid-check`.
