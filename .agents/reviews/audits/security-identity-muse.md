# Challenger Audit: architecture/security-identity
Auditor: `opencode-go/muse-spark-1.3-contributor`
Target: `architecture/security-identity`
Date: 2026-10-31

---

# Adversarial Audit — `architecture/security-identity`

## P0 — Blocking: factual integrity / broken runnable contract

### P0-1 Fabricated / mis-cited RFC numbers
- `RFC 10017` does not define BFF. BFF is an Internet-Draft (`draft-ietf-oauth-browser-based-apps`).
- `RFC 10024` does not define `X25519MLKEM768`. Hybrid KEX is `draft-ietf-tls-hybrid-design` / FIPS 203 ML-KEM-768.
- `RFC 9901` is not SD-JWT (`draft-ietf-oauth-selective-disclosure-jwt`).
- `OAuth 2.1` is `draft-ietf-oauth-v2-1-*`, not an RFC.
- Replace with exact draft names and cite datatracker URLs with `(draft / in-progress)`.

### P0-2 README & exams/README link to non-existent example filenames
Actual filenames in `examples/`:
- `03-passwords-and-secrets.test.ts`
- `04-pki-cert-validation.test.ts`
- `05-session-and-cookie-security.test.ts`
- `06-oauth-pkce-flow.test.ts`
- `07-oidc-id-token-validation.test.ts`
- `09-webauthn-and-passkeys.test.ts`
- `11-ssrf-dns-rebinding-and-cache.test.ts`
- `12-supply-chain-security.test.ts`
- `13-secops-detection-and-logging.test.ts`
Fix the README links to match the actual file paths.

### P0-3 Anchor links in `sy0-701.md`
Slugs do not match headings. Add explicit `<a id="...">` targets or update slugs.

### P0-4 `exams/interview.md` vs `sy0-701.md`
`sy0-701.md` is present, but interview format is promised without dedicated `interview.md`. Either align README or add `interview.md`.

---

## P1 — Major correctness gaps

### P1-1 OWASP Top 10 & ASVS version deltas
Add explicit "Exam delta" callouts contrasting CompTIA Security+ (SY0-701) baseline against modern OWASP/ASVS guidelines.

### P1-2 WebAuthn ceremony precision
Clarify clientDataJSON hashing (`sha256(clientDataJSON)`), `userPresence` (UP) vs `userVerified` (UV) flags.

### P1-3 CABF 47-day certificate validity
Ballot SC-081 is a proposal; mark timeline as proposed.

### P1-4 DPoP `ath` normalization
Ensure `computeDPoPAth` reflects RFC 9449 normalization and tests negative replayed `jti` scenarios.

---

## P2 / P3 — Rigor & Polish

- Run `tools/mermaid-check`.
- Table pipe escaping verification.
- Glossary Czech terms verification.
