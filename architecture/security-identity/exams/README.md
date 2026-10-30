# Security & Identity Architecture Certification & Examination Matrix

This document provides a comprehensive mapping of the **CompTIA Security+ (SY0-701)** certification domains and the **Staff / Principal Security Systems Engineering Technical Interview Loop** against the curriculum modules and executable verification test suites in [`architecture/security-identity`](../).

---

## 1. Exam Metadata: CompTIA Security+ (SY0-701)

| Specification Field | Official Specification Details |
| :--- | :--- |
| **Exam Code** | **SY0-701** |
| **Vendor / Foundation** | CompTIA (Computing Technology Industry Association) |
| **Launch Date** | November 7, 2023 (Active; current stable version) |
| **Official Exam Guide** | [CompTIA Security+ SY0-701 Exam Objectives](https://www.comptia.org/certifications/security) |
| **Target Product / Spec** | Modern security engineering: NIST SP 800-series, FIPS 203/204 (Post-Quantum), OAuth 2.1, OIDC Core, WebAuthn Level 3, RFC 9449 (DPoP), NIST SP 800-207 (Zero Trust), OWASP Top 10:2025, ASVS 5.0, CVSS v4.0. |
| **Format** | Maximum 90 questions: Multiple choice (single and multiple response), drag-and-drop, and Performance-Based Questions (PBQs). |
| **Duration** | 90 minutes |
| **Passing Score** | 750 / 900 (scaled score) |
| **Preparation Bank** | [`exams/sy0-701.md`](./sy0-701.md) (75 original questions + 90-question full mock exam with scoring key) |

---

## 2. Examination Domain Coverage Matrix

The CompTIA Security+ SY0-701 certification partitions cybersecurity into five core domains:

| Domain ID | Domain Description | Official Weight | Curriculum Modules | Executable Test Proofs | Coverage Status |
| :---: | :--- | :---: | :--- | :--- | :---: |
| **1.0** | **General Security Concepts** | **12%** | Modules 01, 02, 03, 10 | `examples/01-threat-modeling-dfd.test.ts`<br/>`examples/02-crypto-primitives.test.ts`<br/>`examples/03-password-peppering-argon2id.test.ts`<br/>`examples/10-authorization-rebac-cedar.test.ts` | ✅ Full |
| **2.0** | **Threats, Vulnerabilities, and Mitigations** | **22%** | Modules 01, 05, 08, 11, 12 | `examples/01-threat-modeling-dfd.test.ts`<br/>`examples/05-session-cookie-browser.test.ts`<br/>`examples/08-jwt-vulnerabilities-and-dpop.test.ts`<br/>`examples/11-ssrf-dns-rebinding-cache-deception.test.ts`<br/>`examples/12-supply-chain-lockfile-verify.test.ts` | ✅ Full |
| **3.0** | **Security Architecture** | **18%** | Modules 04, 05, 06, 09, 10, 14 | `examples/04-x509-pki-mtls.test.ts`<br/>`examples/05-session-cookie-browser.test.ts`<br/>`examples/06-oauth2-pkce-rtr.test.ts`<br/>`examples/09-webauthn-totp.test.ts`<br/>`examples/10-authorization-rebac-cedar.test.ts`<br/>`examples/14-envelope-encryption-and-crypto-shredding.test.ts` | ✅ Full |
| **4.0** | **Security Operations** | **28%** | Modules 02, 03, 04, 07, 08, 13 | `examples/02-crypto-primitives.test.ts`<br/>`examples/04-x509-pki-mtls.test.ts`<br/>`examples/07-oidc-validation-and-noauth.test.ts`<br/>`examples/08-jwt-vulnerabilities-and-dpop.test.ts`<br/>`examples/13-secops-detection-signals.test.ts` | ✅ Full |
| **5.0** | **Security Program Management and Oversight** | **20%** | Modules 01, 12, 13, 14 | `examples/01-threat-modeling-dfd.test.ts`<br/>`examples/12-supply-chain-lockfile-verify.test.ts`<br/>`examples/13-secops-detection-signals.test.ts`<br/>`examples/14-envelope-encryption-and-crypto-shredding.test.ts` | ✅ Full |

---

## 3. Detailed Objective-to-Module Mapping

### Domain 1.0: General Security Concepts (12%)
- **1.1 Security Controls & Principles**: CIA Triad, Non-Repudiation, Defense in Depth, Principle of Least Privilege, Zero Trust Architecture $\implies$ [Module 01](../modules/01-threat-modeling-and-security-principles.md) & [`01-threat-modeling-dfd.test.ts`](../examples/01-threat-modeling-dfd.test.ts).
- **1.2 Cryptographic Concepts & Mathematics**: Symmetric vs asymmetric ciphers, hashing, collision resistance, HKDF, CSPRNG vs PRNG $\implies$ [Module 02](../modules/02-crypto-primitives-for-engineers.md) & [`02-crypto-primitives.test.ts`](../examples/02-crypto-primitives.test.ts).
- **1.3 Authentication & Password Storage**: Salt, pepper, memory-hard KDFs (Argon2id, scrypt, bcrypt), k-Anonymity compromised password checks $\implies$ [Module 03](../modules/03-passwords-and-secrets-at-rest.md) & [`03-password-peppering-argon2id.test.ts`](../examples/03-password-peppering-argon2id.test.ts).
- **1.4 Access Control Models**: DAC, MAC, RBAC, ABAC, ReBAC, Cedar policy evaluation engine $\implies$ [Module 10](../modules/10-authorization-models.md) & [`10-authorization-rebac-cedar.test.ts`](../examples/10-authorization-rebac-cedar.test.ts).

### Domain 2.0: Threats, Vulnerabilities, and Mitigations (22%)
- **2.1 Threat Actors & Vectors**: STRIDE threat categorization, Attack Trees, Data Flow Diagrams $\implies$ [Module 01](../modules/01-threat-modeling-and-security-principles.md).
- **2.2 Application Vulnerabilities**: OWASP Top 10:2025, SSRF, DNS Rebinding, Web Cache Deception, Insecure Deserialization $\implies$ [Module 11](../modules/11-web-and-api-vulnerability-classes.md) & [`11-ssrf-dns-rebinding-cache-deception.test.ts`](../examples/11-ssrf-dns-rebinding-cache-deception.test.ts).
- **2.3 Browser & Client Attacks**: XSS, CSRF, Clickjacking, Session Hijacking, SameSite cookie bypass, CSP Level 3 $\implies$ [Module 05](../modules/05-sessions-cookies-and-browser-security.md) & [`05-session-cookie-browser.test.ts`](../examples/05-session-cookie-browser.test.ts).
- **2.4 Token & API Exploits**: Algorithm Confusion (RS256 vs HS256), `alg:none`, token replay, sender-constraining (DPoP, mTLS) $\implies$ [Module 08](../modules/08-tokens-jose-and-sender-constraining.md) & [`08-jwt-vulnerabilities-and-dpop.test.ts`](../examples/08-jwt-vulnerabilities-and-dpop.test.ts).
- **2.5 Supply Chain Attacks**: Dependency Confusion, Typosquatting, compromised build scripts, XZ Utils backdoor, SLSA L3, CycloneDX SBOM $\implies$ [Module 12](../modules/12-supply-chain-and-dependency-security.md) & [`12-supply-chain-lockfile-verify.test.ts`](../examples/12-supply-chain-lockfile-verify.test.ts).

### Domain 3.0: Security Architecture (18%)
- **3.1 PKI & Certificate Architecture**: X.509 RFC 5280, CA hierarchies, SAN, BasicConstraints, ACME, CRLite, OCSP Stapling, CT logs $\implies$ [Module 04](../modules/04-pki-x509-and-mtls.md) & [`04-x509-pki-mtls.test.ts`](../examples/04-x509-pki-mtls.test.ts).
- **3.2 Zero Trust & Mutual TLS**: NIST SP 800-207, continuous evaluation, SPIFFE IDs, service-to-service mTLS $\implies$ [Module 04](../modules/04-pki-x509-and-mtls.md), [Module 14](../modules/14-expert-topics.md).
- **3.3 Modern Authentication Architecture**: OAuth 2.1 authorization code flow, PKCE S256, Refresh Token Rotation, BFF architecture $\implies$ [Module 06](../modules/06-oauth-2-1-core.md) & [`06-oauth2-pkce-rtr.test.ts`](../examples/06-oauth2-pkce-rtr.test.ts).
- **3.4 Hardware-Backed MFA & Passkeys**: FIDO2/WebAuthn Level 3, public-key ceremonies, user presence vs user verification, TOTP RFC 6238 $\implies$ [Module 09](../modules/09-passkeys-webauthn-and-mfa.md) & [`09-webauthn-totp.test.ts`](../examples/09-webauthn-totp.test.ts).
- **3.5 Data Protection & Crypto-Shredding**: Envelope encryption (DEK/KEK), KMS integration, GDPR Right to be Forgotten via key destruction $\implies$ [Module 14](../modules/14-expert-topics.md) & [`14-envelope-encryption-and-crypto-shredding.test.ts`](../examples/14-envelope-encryption-and-crypto-shredding.test.ts).

### Domain 4.0: Security Operations (28%)
- **4.1 Secure Protocol Implementation**: AEAD authenticated encryption, nonce uniqueness, constant-time comparisons $\implies$ [Module 02](../modules/02-crypto-primitives-for-engineers.md).
- **4.2 Identity Federation Operations**: OIDC Core, ID Token validation, JWKS caching and rotation, `at_hash`, nOAuth mitigation $\implies$ [Module 07](../modules/07-oidc-and-federation.md) & [`07-oidc-validation-and-noauth.test.ts`](../examples/07-oidc-validation-and-noauth.test.ts).
- **4.3 Token Lifecycle & Sender Constraining**: DPoP proof validation (RFC 9449), mTLS certificate binding (RFC 8705), family revocation $\implies$ [Module 08](../modules/08-tokens-jose-and-sender-constraining.md).
- **4.4 Detection Engineering & Audit Logging**: Structured audit logging, PII and token redaction, impossible travel anomaly detection $\implies$ [Module 13](../modules/13-security-operations-and-detection.md) & [`13-secops-detection-signals.test.ts`](../examples/13-secops-detection-signals.test.ts).
- **4.5 Vulnerability Triage & Incident Response**: CVSS v4.0 scoring, EPSS exploitation probability, SSVC decision trees, NIST SP 800-61r2 $\implies$ [Module 13](../modules/13-security-operations-and-detection.md).

### Domain 5.0: Security Program Management and Oversight (20%)
- **5.1 Threat Modeling & Governance**: STRIDE methodology, DFD boundary crossing rules, OWASP ASVS 5.0 compliance verification $\implies$ [Module 01](../modules/01-threat-modeling-and-security-principles.md).
- **5.2 Supply Chain Governance**: Software Bill of Materials (SBOM), SLSA Framework, provenance verification, lockfile auditing $\implies$ [Module 12](../modules/12-supply-chain-and-dependency-security.md).
- **5.3 Compliance, Privacy & Cryptographic Lifecycle**: GDPR Article 17 crypto-shredding, Post-Quantum migration roadmap (FIPS 203/204), emergency credential rotation drills $\implies$ [Module 13](../modules/13-security-operations-and-detection.md), [Module 14](../modules/14-expert-topics.md).

---

## 4. Staff / Principal Security Systems Interview Loop

For senior and staff engineers preparing for hyperscaler and fintech systems security design loops, the curriculum maps directly to the standard technical evaluation rounds:

| Interview Round | Evaluated Topics | Curriculum Modules |
| :--- | :--- | :--- |
| **System Security Design** | Zero Trust Architecture, Service Mesh mTLS, Workload Identity (SPIFFE/OIDC), Threat Modeling (STRIDE) | Modules 01, 04, 10, 14 |
| **Cryptographic Engineering** | AEAD, Nonce reuse recovery, KDFs, Envelope Encryption, Hybrid Post-Quantum KEX, Side-channel resistance | Modules 02, 03, 14 |
| **Identity & Authentication Architecture** | OAuth 2.1, OIDC federation, DPoP sender constraining, WebAuthn Level 3 Passkeys, Token lifecycle | Modules 05, 06, 07, 08, 09 |
| **Application Security & Vulnerability Economics** | SSRF mitigation, Insecure Deserialization, Supply chain defense (SLSA/SBOM), CVSS/EPSS prioritization | Modules 11, 12, 13 |
