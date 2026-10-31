# Drafter/Auditor Audit: architecture/security-identity
Auditor: `opencode-go/deepseek-v4.1-flash`
Target: `architecture/security-identity`
Date: 2026-10-31

---

## P0 — wrong now

1. **Certificate lifespan schedule (SC-081)**:
   `modules/04-pki-x509-and-mtls.md`: The ballot schedule is 200 days (2026), 100 days (2027), 47 days (2029). Fix inconsistent claims.

2. **Broken `examples/` links in README**:
   Re-link to actual disk filenames:
   - `03-passwords-and-secrets.test.ts`
   - `04-pki-cert-validation.test.ts`
   - `05-session-and-cookie-security.test.ts`
   - `06-oauth-pkce-flow.test.ts`
   - `07-oidc-id-token-validation.test.ts`
   - `09-passkey-webauthn-math.test.ts`
   - `11-vulnerability-ssrf-filter.test.ts`
   - `13-secops-audit-and-anomaly.test.ts`

3. **Internal `Ref:` anchor links in `sy0-701.md`**:
   Regenerate all 71 anchor links from actual headings or add explicit `<a id="...">` targets.

---

## P1 — misleads

4. **NIST SP 800-61 Rev 3**:
   Update incident response lifecycle from r2 (2012) to r3 (2025).

5. **RBAC citation**:
   `modules/10-authorization-models.md`: Replace SP 800-145 (Cloud Computing) with ANSI/INCITS 359 (RBAC).

6. **Formal access control models**:
   Add formal Bell-LaPadula / Biba lattice definitions or clarify scope.

7. **BFF citation**:
   Cite BCP 212 / `draft-ietf-oauth-browser-based-apps` rather than finished RFC.

---

## P2 / P3 — Polish

- Title drift README vs module H1s.
- Table pipe escaping is clean.
- Mermaid syntax clean; run `tools/mermaid-check`.
