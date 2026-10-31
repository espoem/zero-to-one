# Drafter/Auditor Audit: architecture/networking
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `architecture/networking`
Date: 2026-10-31

---

## P0 — wrong now

1. **CUBIC $K$ formula in prose and cheatsheet**:
   `modules/07-congestion-control.md:112`, Q4 at line 310, and `CHEATSHEET.md:184` state $K = \sqrt[3]{W_{\max} \cdot \beta / C}$.
   RFC 9438 §4.2 defines $K = \sqrt[3]{W_{\max} \cdot (1 - \beta) / C}$. Fix prose and cheatsheet to match the test implementation.

2. **CUBIC $\beta$ value in cheatsheet**:
   `CHEATSHEET.md:185` says $\beta = 0.2$. Module 07 and RFC 9438 set $\beta_{\text{cubic}} = 0.7$. Fix to 0.7.

3. **Question bank `Ref:` anchor links**:
   All 75 anchor links in `exams/n10-009.md` link to unnumbered legacy slugs instead of the numbered heading slugs. Retarget them so every link resolves.

---

## P1 — misleads

4. **Exam coverage mapping**:
   Ensure objectives tested in question bank (BPDU Guard, RSS, `mtr`) are explicitly taught or noted.

5. **Wireless scope**:
   List IEEE 802.11ax/be in `## Out of Scope` with reasons per AGENTS.md.

6. **Mock exam question count**:
   Align README claims with the actual 30-question sampled mock drill.

7. **ISN RFC citation**:
   RFC 6528 was absorbed and obsoleted by RFC 9293 §3.4.1.

8. **Linux SYN queue architecture**:
   Clarify modern Linux $\ge 4.10$ single-queue `somaxconn` model.

---

## P2 / P3 — Polish

- SVCB type code is 64, HTTPS is 65.
- Run `tools/mermaid-check`.
- Table pipes verified clean.
