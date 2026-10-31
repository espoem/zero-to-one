# Security & Identity Architecture Curriculum & Technical Reference

> **Verified against Node 26.12.1, TypeScript 7.0.2 on 2026-10-30**

Welcome to the **Security & Identity Systems Architecture Complete Learning Track**. This curriculum delivers an exhaustive, zero-to-one engineering reference synthesized from primary specifications (NIST SP 800-series, FIPS 203/204/205, RFC 9106, RFC 5280, RFC 6749, RFC 7636, RFC 9449, RFC 8705, RFC 9068, RFC 9901, W3C WebAuthn Level 3, OWASP ASVS 5.0, OWASP Top 10:2025, Google Zanzibar), seminal computer security literature (Saltzer & Schroeder, Bell-LaPadula, Bruce Schneier, Cynthia Dwork), and battle-tested cloud-native infrastructure architectures (AWS IAM, HashiCorp Vault, SPIFFE/SPIRE, OpenFGA, Cedar, Sigstore).

Every concept is grounded in formal mathematical definitions, cryptographic state machines, binary packet/bitfield layouts, side-channel timing analysis, and deterministic, runnable test suites in [examples/](./examples/).

---

## 1. Certifications & Academic Standards

This curriculum provides 100% full coverage for both official industry certification and senior/staff technical interview loops:

### Official Certification: CompTIA Security+ (SY0-701)
- **Exam Code**: **SY0-701**
- **Vendor / Foundation**: CompTIA (Computing Technology Industry Association)
- **Official Exam Guide**: [CompTIA Security+ SY0-701 Exam Objectives](https://www.comptia.org/certifications/security)
- **Status**: **Active** (Launched November 7, 2023; current stable version).
- **Date Verified**: 2026-10-30 against official CompTIA SY0-701 objectives.
- **Target Specifications**: Modern systems security: NIST SP 800-series, FIPS 203/204 (Post-Quantum), OAuth 2.1, OIDC Core, WebAuthn Level 3, DPoP (RFC 9449), Zero Trust (NIST SP 800-207), OWASP Top 10:2025, ASVS 5.0, CVSS v4.0.
- **Format**: Up to 90 questions: Multiple-choice (single and multiple select), drag-and-drop, and Performance-Based Questions (PBQs).
- **Duration**: 90 minutes.
- **Passing Score**: 750 / 900 (scaled score, ~83.3%).
- **Coverage & Question Banks**:
  - **[exams/README.md](./exams/README.md)**: 100% full coverage matrix across all 5 CompTIA domains (1.0 General Security Concepts, 2.0 Threats/Vulnerabilities/Mitigations, 3.0 Security Architecture, 4.0 Security Operations, 5.0 Security Program Management and Oversight) with zero gaps.
  - **[exams/sy0-701.md](./exams/sy0-701.md)**: 75 original practice questions categorized by domain and difficulty (1–3), plus a full 90-minute 90-question mock examination with scoring rubrics and distractor analysis.

### Staff / Principal Security Systems Engineering Technical Interview Loop
- **Target Roles**: Staff / Principal Security Architect, Application Security Engineer, Cloud Identity & Access Management (IAM) Specialist, Cryptographic Systems Engineer.
- **Focus**: Deep-dive mechanical trade-offs: AEAD nonce reuse recovery, memory-hard KDF mechanics, Google Zanzibar ReBAC consistency (Zookies), OAuth 2.1 RTR family revocation, WebAuthn phishing resistance proofs, SSRF socket-level IP pinning, SLSA build provenance, CVSS/EPSS vulnerability triage, and Hybrid Post-Quantum Key Exchange (X25519MLKEM768).

---

## 2. Curriculum Syllabus & Topic Breakdown

The curriculum is structured into 14 self-contained, progressive modules:

### [Module 01 — Threat Modeling, Security Principles & Governance](./modules/01-threat-modeling-and-security-principles.md)
- **Concepts**: The CIA Triad and Parkerian Hexad, STRIDE taxonomy and DFD element mapping, Trust Boundaries, Saltzer-Schroeder principles (Least Privilege, Fail-Closed, Economy of Mechanism, Complete Mediation), Attack Trees, OWASP ASVS 5.0 verification levels, and OWASP Top 10:2025 preview.
- **Runnable Proof**: [`examples/01-threat-modeling-dfd.test.ts`](./examples/01-threat-modeling-dfd.test.ts)

### [Module 02 — Cryptographic Primitives for Software Engineers](./modules/02-crypto-primitives-for-engineers.md)
- **Concepts**: CSPRNG vs PRNG entropy, Cryptographic hash functions and length extension attacks, HMAC construction (RFC 2104), constant-time comparisons (`crypto.timingSafeEqual`), Authenticated Encryption with Associated Data (AEAD AES-GCM and ChaCha20-Poly1305), the AES-GCM Nonce-Reuse Catastrophe, Ed25519 and X25519 elliptic curves, HKDF (RFC 5869), and Envelope Encryption (DEK/KEK).
- **Runnable Proof**: [`examples/02-crypto-primitives.test.ts`](./examples/02-crypto-primitives.test.ts)

### [Module 03 — Passwords, Peppering & Secrets at Rest](./modules/03-passwords-and-secrets-at-rest.md)
- **Concepts**: Why general-purpose hashes fail for passwords, memory-hard KDFs: Argon2id (RFC 9106), scrypt, and bcrypt, the bcrypt 72-byte silent truncation vulnerability, salts vs KMS peppers, compromised credential checking via k-Anonymity (Have I Been Pwned), HashiCorp Vault dynamic secrets, and automated credential rotation.
- **Runnable Proof**: [`examples/03-passwords-and-secrets.test.ts`](./examples/03-passwords-and-secrets.test.ts)

### [Module 04 — Public Key Infrastructure, X.509 & Workload Identity](./modules/04-pki-x509-and-mtls.md)
- **Concepts**: X.509 ASN.1 data structure (RFC 5280), CA hierarchies and trust stores, critical extensions (SAN, BasicConstraints, KeyUsage, EKU), CA/Browser Forum SC-081 certificate lifespan compression (47 days in 2029), revocation mechanics (CRL, CRLite, OCSP Stapling), Certificate Transparency (CT logs, RFC 6962), ACME protocol automation (RFC 8555), and mutual TLS (mTLS) with SPIFFE/SPIRE workload identities.
- **Runnable Proof**: [`examples/04-pki-cert-validation.test.ts`](./examples/04-pki-cert-validation.test.ts)

### [Module 05 — Sessions, Cookies & Browser Security Architecture](./modules/05-sessions-cookies-and-browser-security.md)
- **Concepts**: Stateful server sessions vs client JWT sessions, session fixation, cookie security attributes (`HttpOnly`, `Secure`, `SameSite=Strict/Lax`), RFC 6265bis `__Host-` prefix rules, Cross-Site Request Forgery (CSRF) and Synchronizer Tokens, Cross-Origin Resource Sharing (CORS), Content Security Policy Level 3 nonces, Fetch Metadata (`Sec-Fetch-Site`), and the Backend-for-Frontend (BFF) pattern (draft-ietf-oauth-browser-based-apps).
- **Runnable Proof**: [`examples/05-session-and-cookie-security.test.ts`](./examples/05-session-and-cookie-security.test.ts)

### [Module 06 — Modern OAuth 2.1 Core](./modules/06-oauth-2-1-core.md)
- **Concepts**: The OAuth 2.1 consolidation: deprecation of Implicit and ROPC grants, Authorization Code Flow, Proof Key for Code Exchange (PKCE S256, RFC 7636), exact string matching for redirect URIs, Refresh Token Rotation (RTR) and automated family revocation upon reuse, and RFC 9700 mix-up attack defenses (`iss` parameter, RFC 9207).
- **Runnable Proof**: [`examples/06-oauth-pkce-flow.test.ts`](./examples/06-oauth-pkce-flow.test.ts)

### [Module 07 — OpenID Connect & Federated Identity Defense](./modules/07-oidc-and-federation.md)
- **Concepts**: OIDC Core architecture, ID Token vs Access Token distinction, OIDC Discovery (`/.well-known/openid-configuration`) and JWKS rotation, mathematical validation of the `at_hash` claim, the nOAuth unverified email account takeover exploit, federated session logout (Front-Channel vs Back-Channel Logout 1.0), and Token Exchange (RFC 8693).
- **Runnable Proof**: [`examples/07-oidc-id-token-validation.test.ts`](./examples/07-oidc-id-token-validation.test.ts)

### [Module 08 — Tokens, JOSE Suite & Sender-Constraining](./modules/08-tokens-jose-and-sender-constraining.md)
- **Concepts**: The JOSE family (JWS, JWE, JWK, JWA, JWT), parsing compact serialization, the `alg:none` catastrophe, RS256/HS256 Algorithm Confusion (Key Confusion), RFC 8725 JWT Best Current Practice, explicit token typing (`typ: "at+jwt"`, RFC 9068), Demonstrating Proof-of-Possession (DPoP, RFC 9449), mTLS-bound access tokens (RFC 8705), and Selective Disclosure JWTs (SD-JWT, draft-ietf-oauth-selective-disclosure-jwt).
- **Runnable Proof**: [`examples/08-jwt-vulnerabilities-and-dpop.test.ts`](./examples/08-jwt-vulnerabilities-and-dpop.test.ts)

### [Module 09 — Hardware-Backed MFA, WebAuthn & Passkeys](./modules/09-passkeys-webauthn-and-mfa.md)
- **Concepts**: WebAuthn Level 3 and FIDO2/CTAP2 architecture, Registration and Authentication ceremonies, the mathematical proof of phishing resistance via `clientDataJSON` origin binding, `authenticatorData` binary flags bitfield (UP, UV, BE, BS), sign counters and synced passkeys, WebAuthn PRF extension for client-side encryption, RFC 6238 TOTP math, and mitigating MFA push fatigue.
- **Runnable Proof**: [`examples/09-passkey-webauthn-math.test.ts`](./examples/09-passkey-webauthn-math.test.ts)

### [Module 10 — Authorization Models: RBAC, ABAC, ReBAC & Policy Engines](./modules/10-authorization-models.md)
- **Concepts**: The authorization evolution: DAC $\to$ MAC $\to$ RBAC $\to$ ABAC $\to$ ReBAC, Google Zanzibar architecture (relation tuples, userset rewrites), the New-Enemy Problem and Zookies (consistency tokens), OpenFGA, Cedar policy language semantics (forbid-overrides-permit, default-deny), and preventing Broken Object Level Authorization (BOLA/IDOR).
- **Runnable Proof**: [`examples/10-authorization-rebac-cedar.test.ts`](./examples/10-authorization-rebac-cedar.test.ts)

### [Module 11 — Web & API Vulnerability Classes](./modules/11-web-and-api-vulnerability-classes.md)
- **Concepts**: Server-Side Request Forgery (SSRF) and cloud IMDS exfiltration (`169.254.169.254`), DNS Rebinding and socket-level IP pinning, SQL, Command, and Template Injection, Insecure Deserialization and Java/Node gadget chains, OWASP A10:2025 Mishandling of Exceptional Conditions (fail-open bypasses), and Web Cache Deception (WCD).
- **Runnable Proof**: [`examples/11-vulnerability-ssrf-filter.test.ts`](./examples/11-vulnerability-ssrf-filter.test.ts)

### [Module 12 — Software Supply Chain & Dependency Security](./modules/12-supply-chain-and-dependency-security.md)
- **Concepts**: OWASP A03:2025 Software Supply Chain Failures, typosquatting and Dependency Confusion, case study: the XZ Utils backdoor (CVE-2024-3094), neutralizing malicious lifecycle scripts (`npm ci --ignore-scripts`), lockfile checksum integrity, SLSA Level 3 framework, Sigstore / Cosign provenance, and CycloneDX / SPDX Software Bill of Materials (SBOM).
- **Runnable Proof**: [`examples/12-supply-chain-lockfile-verify.test.ts`](./examples/12-supply-chain-lockfile-verify.test.ts)

### [Module 13 — Security Operations, Detection Engineering & Incident Handling](./modules/13-security-operations-and-detection.md)
- **Concepts**: Structured audit logging (OWASP A09:2025) and automated PII/credential redaction, detection engineering rules: Impossible Travel velocity anomalies and concurrent refresh token reuse, vulnerability prioritization: CVSS v4.0 vs EPSS vs SSVC decision trees, NIST SP 800-61r2/r3 incident response phases, and zero-downtime emergency credential rotation drills.
- **Runnable Proof**: [`examples/13-secops-audit-and-anomaly.test.ts`](./examples/13-secops-audit-and-anomaly.test.ts)

### [Module 14 — Expert Architecture: Post-Quantum, Protocol Verification & Zero Trust](./modules/14-expert-topics.md)
- **Concepts**: The Harvest Now, Decrypt Later (HNDL) threat, NIST Post-Quantum standards (FIPS 203 ML-KEM, FIPS 204 ML-DSA), Hybrid Post-Quantum Key Exchange (X25519MLKEM768, RFC 10024), formal cryptographic protocol verification (Tamarin Prover & ProVerif), Workload Identity Federation (CI-to-cloud without static keys), NIST SP 800-207 Zero Trust Architecture, Crypto-Shredding for GDPR Article 17 on immutable ledgers, and a Staff Security Architect capstone design.
- **Runnable Proof**: [`examples/14-envelope-encryption-and-crypto-shredding.test.ts`](./examples/14-envelope-encryption-and-crypto-shredding.test.ts)

### Prerequisites

- Understanding of web application architecture, HTTP protocol headers, and client-server communication models.
- Familiarity with basic mathematical concepts (modular arithmetic, bitwise XOR/AND operations, hashes).
- Node.js 26 and `npm` installed via `mise`.

### Out of Scope

- **Hardware Side-Channel Power Analysis / DPA**: Physical probing of silicon dies, electromagnetic emissions analysis, and acoustic cryptanalysis belong to hardware laboratory engineering.
- **Kernel-Level Exploit Development**: Ring 0 kernel shellcode execution, ROP chains in binary executables, and firmware bootkit development are owned by specialized systems security tracks.
- **Physical Facility Security**: CCTV placement, physical mantraps, biometric door access hardware, and badge reader mechanics.

---

## 3. Fast-Lookup Tools & References

- **[GLOSSARY.md](./GLOSSARY.md)**: Exhaustive bilingual English ↔ Czech terminology dictionary covering over 100 security, cryptographic, identity, and operational terms.
- **[CHEATSHEET.md](./CHEATSHEET.md)**: High-density quick-reference sheet for STRIDE tables, Argon2id parameters, X.509 fields, cookie flags, OAuth 2.1 PKCE formulas, WebAuthn bitfields, Zanzibar/Cedar syntax, and CLI tools.
- **[exams/README.md](./exams/README.md)**: Complete CompTIA Security+ (SY0-701) objective-to-module coverage matrix.
- **[exams/sy0-701.md](./exams/sy0-701.md)**: 75 original practice questions and full 90-question timed mock examination with scoring keys.

---

## 4. Running the Executable Proofs

All code examples in this track are written in modern TypeScript targeting Node.js 26.12.1 and TypeScript 7.0.2 with zero external binary or container requirements.

### Prerequisites & Installation
Ensure `mise` is installed on your local host:
```bash
# Enter the track directory
cd architecture/security-identity

# Install pinned toolchain via mise
mise install

# Install local development dependencies
mise exec -- npm install
```

### Running Test Suites
Run the entire suite of 14 deterministic security proof tests:
```bash
# Run all test suites
mise exec -- npm test

# Run a specific test module (e.g. DPoP & JWT hardening)
mise exec -- node --test examples/08-jwt-vulnerabilities-and-dpop.test.ts

# Run TypeScript static typecheck
mise exec -- npm run typecheck
```

### Diagram Verification
Validate that all Mermaid diagrams parse across both Mermaid 11 and 12:
```bash
cd ../..
node tools/mermaid-check/check.mjs architecture/security-identity
```
