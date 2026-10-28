# Brief: Security & identity (`architecture/security-identity`)

| | |
|---|---|
| Phase | 1 |
| Kind | NEW track: create from scratch |
| Primary (author) | **Opus · claude.ai** |
| Drafter (on request) | pi · DeepSeek |
| Challenger | pi · Muse Spark 1.3 |
| Verifier | Antigravity |
| Final gate | Opus (claude.ai session) |
| Branch / worktree | `track/security-identity` · `../zto-security-identity` |
| Depends on | none (can start now) |
| Research dossier | `.agents/research/G-foundations.md` |

## 0. Read before starting (binding)
1. `AGENTS.md`: the contract. If it conflicts with this brief, AGENTS.md wins; log the conflict in your review file.
2. `.agents/OWNERSHIP.md`: what you own vs only cross-link.
3. `.agents/REVIEW.md`: the checklist your work is judged against.
4. Your global/agent instructions still apply where they do not conflict.

## 1. Owner decisions and track-specific instructions
- Foundation track. OAuth 2.1 is still a draft: teach RFC 6749 + RFC 9700 (Security BCP) as the normative base, and OAuth 2.1 as a "Then vs now" consolidation.
- Questions must never include working exploit payloads against third-party systems. Labs attack only local, intentionally vulnerable fixtures.
- Teach the **latest stable** versions. Add **Then vs now** comparisons wherever practice changed (AGENTS.md § Version Currency).
- Pin **all** tooling via mise (`.mise.toml` + `mise.lock`): node 26 for JS/TS, plus every CLI and runtime the examples need.

## 2. Ownership
**You own (full treatment):**
- Crypto primitives, password hashing, KDFs, AEAD, signatures
- PKI/X.509 validation, mTLS identity, cert lifecycle
- OAuth 2.1, OIDC, PKCE, DPoP, JWT pitfalls, sessions/cookies, WebAuthn/passkeys
- Authorization models (RBAC/ABAC/ReBAC, Zanzibar, Cedar, OpenFGA)
- OWASP Top 10:2025, ASVS 5.0, API Top 10, threat modelling (STRIDE), secrets management
- Cache poisoning/deception attacks

**Cross-link only (do not re-explain):**
- Node-specific security (permission model, prototype pollution, `vm` is not a sandbox, ReDoS) → owned by `technologies/nodejs`
- Python-specific security (pickle, framework security) → owned by `languages/python`
- SQL injection mechanics, row-level security → owned by `technologies/postgres`
- TLS on the wire (handshake, RTTs, SNI/ALPN/ECH, PQ size impact), QUIC → owned by `architecture/networking`
- CI/CD pipelines, SBOM, signing (cosign), SLSA provenance, OIDC-to-cloud from CI → owned by `technologies/gitlab-ci`

## 3. Research dossier (verified 2026-10-27/28; re-verify before use)

#### Security & identity — `architecture/security-identity`

- **Current stable version(s)**
  - **OWASP Top 10:2025** https://top10.owasp.org/2025/ . The RC was announced 2025-11-06 at Global AppSec; the site doesn't state a final-release date (exact final date unverified). Categories:
    - A01 Broken Access Control (now includes SSRF)
    - A02 Security Misconfiguration
    - A03 Software Supply Chain Failures (new)
    - A04 Cryptographic Failures
    - A05 Injection
    - A06 Insecure Design
    - A07 Authentication Failures
    - A08 Software or Data Integrity Failures
    - A09 Security Logging & Alerting Failures
    - A10 Mishandling of Exceptional Conditions (new)
    - Changes vs 2021: https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know
  - **OWASP ASVS 5.0.0** (published 2025-05-30), with 17 chapters starting at V1 Encoding & Sanitization. https://asvs.owasp.org/ (the full chapter list is in the downloads; not enumerated here).
  - **OWASP API Security Top 10 2023** is still the current edition; no 2025/2026 edition was found. https://owasp.org/API-Security/ (no newer edition: verified only by absence in search).
  - **OAuth**:
    - **OAuth 2.1**: draft-ietf-oauth-v2-1-16 (2026-09-03), WG Document and not yet at the IESG.
    - **RFC 9700** OAuth 2.0 Security BCP (Jan 2025, BCP 240) https://www.rfc-editor.org/rfc/rfc9700.html
    - **RFC 10017 / BCP 212** OAuth for Browser-Based Apps (Aug 2026).
    - **RFC 9728** Protected Resource Metadata (Apr 2025).
    - **RFC 9901** SD-JWT (Nov 2025).
    - **rfc8725bis** JWT BCP in the RFC Editor queue.
    - Established RFCs:
      - Core OAuth: 6749/6750, PKCE 7636, device grant 8628, token exchange 8693.
      - Server and client metadata: AS metadata 8414, DCR 7591, introspection 7662, revocation 7009.
      - JWT access tokens: profile 9068.
      - Advanced request features: PAR 9126, JAR 9101, RAR 9396, Resource Indicators 8707, `iss` parameter 9207.
      - Sender-constrained tokens: DPoP **9449**, mTLS-bound tokens 8705.
      - JOSE: JWS 7515, JWE 7516, JWK 7517, JWA 7518, JWT 7519.
  - **FAPI 2.0** Security Profile and Attacker Model are Final (2025). Final conformance tests are available. https://openid.net/fapi2-0-final-conformance-tests-available/ (exact approval date unverified; recalled as Feb 2025).
  - **OpenID Connect Core 1.0** (errata set 2; also ISO/IEC 26131:2024 (unverified)).
  - **WebAuthn Level 3**: W3C Recommendation, 2026-08-25. It adds Related Origin Requests (`/.well-known/webauthn`), JSON serialization, conditional create, BE/BS backup flags, the Signals API, `getClientCapabilities()` and PRF. https://fidoalliance.org/webauthn-level-3-is-now-a-w3c-recommendation/
  - **TLS/PKI**: RFC 9846 (TLS 1.3), RFC 5280 (X.509), RFC 9525 (service identity), RFC 6962/9162 (CT). SC-081 lifetimes and LE 6-day/IP certs are as in the networking section.
  - **Password hashing**: RFC 9106 (Argon2). Node has `crypto.argon2()`/`argon2Sync()` built in (version added unverified; present in Node 26 docs https://nodejs.org/api/crypto.html). Node `node:crypto` supports **ML-KEM-512/768/1024** (`crypto.encapsulate/decapsulate`) and **ML-DSA-44/65/87**, backed by OpenSSL 3.5.
  - **Libraries** (npm registry, 2026-10-28):
    - `jose` **6.2.13**
    - `oauth4webapi` **3.8.8**
    - `oidc-provider` **9.13.1**
    - `@cedar-policy/cedar-wasm` **4.14.0**
  - **Servers**:
    - **Keycloak 26.8.1** (2026-10-13) https://github.com/keycloak/keycloak/releases
    - **Dex v2.46.1** (2026-10-21) https://github.com/dexidp/dex/releases
    - **OpenFGA v1.22.0** (2026-10-06) https://github.com/openfga/openfga/releases
  - **Browser cookies**: Google ended Privacy Sandbox and kept third-party cookies in Chrome (Oct 2025, per press: https://www.cookieyes.com/knowledge-base/cookies-101/is-google-ending-privacy-sandbox.md ; exact details unverified). CHIPS (`Partitioned` attribute) is still relevant for embedded/iframe contexts, and Safari/Firefox partition by default. Per-browser support matrix (unverified); check caniuse when writing.
- **Authoritative syllabi used**
  - OWASP:
    - Top 10:2025, ASVS 5.0 (map each module to ASVS chapters), API Security Top 10 2023.
    - Cheat Sheet Series (Password Storage, Session Management, OAuth2, JWT for Java/Node, CSRF, SSRF).
    - SAMM for program context.
  - IETF OAuth WG documents list (https://datatracker.ietf.org/wg/oauth/documents/) and https://oauth.net/2.1/
  - OpenID specs (Core, Discovery, Back-Channel Logout, FAPI 2.0).
  - Crypto texts:
    - Dan Boneh & Victor Shoup, *A Graduate Course in Applied Cryptography* (free).
    - Jean-Philippe Aumasson, *Serious Cryptography* 2nd ed. (2024).
    - David Wong, *Real-World Cryptography*.
  - Threat modeling:
    - Adam Shostack, *Threat Modeling: Designing for Security* and *Threats: What Every Engineer Should Learn from Star Wars*.
    - Threat Modeling Manifesto.
    - Microsoft STRIDE docs.
  - Zanzibar paper (Pang et al., USENIX ATC 2019), the OpenFGA docs and the Cedar paper/docs (https://docs.cedarpolicy.com).
  - Certifications, used only as coverage checklists:
    - **CompTIA Security+ SY0-701** is current. SY0-801 is announced, but its launch date and objectives were not verifiable from CompTIA (https://www.diontraining.com/blogs/news/comptia-security-sy0-801-what-we-know-about-the-new-exam), so its domain weightings are (unverified).
    - ISC2 CSSLP/CISSP domains are optional extra reading. Neither is needed for this track.
- **Proposed modules**
  1. **01-threat-modeling-and-security-principles**
     - CIA plus authenticity/non-repudiation.
     - Trust boundaries and data-flow diagrams.
     - STRIDE per element.
     - Attack trees; DREAD's flaws.
     - Least privilege, defense in depth, secure defaults.
     - Security requirements via ASVS 5.0 levels.
     - Mapping OWASP Top 10:2025 to design decisions.
  2. **02-crypto-primitives-for-engineers**
     - Randomness: CSPRNG vs `Math.random`.
     - Hashing: SHA-2/SHA-3/BLAKE2/3; length extension (why HMAC, not `H(key||msg)`).
     - MACs and constant-time comparison (`crypto.timingSafeEqual`).
     - Symmetric encryption:
       - AEAD: AES-GCM and ChaCha20-Poly1305.
       - Nonce-reuse catastrophe; AES-GCM-SIV.
       - Encrypt-then-MAC history.
     - Asymmetric primitives:
       - Signatures: Ed25519 vs ECDSA nonce issues vs RSA-PSS.
       - Key exchange: X25519.
     - KDFs: HKDF.
     - Envelope encryption.
  3. **03-passwords-and-secrets-at-rest**
     - Password hashing: argon2id (RFC 9106; OWASP params m=19 MiB, t=2, p=1 as the minimum (verify against the current cheat sheet)), scrypt, bcrypt's 72-byte limit, pepper vs salt.
     - Credential stuffing and breached-password checks (k-anonymity HIBP).
     - Secrets management:
       - Vault/OpenBao, cloud KMS and SOPS.
       - Rotation and dynamic secrets.
       - `.env` leakage and secret scanning.
     - Key hierarchy (KEK/DEK).
  4. **04-pki-x509-and-mtls**
     - X.509 structure: SAN, EKU, basicConstraints and name constraints.
     - Path building and validation (RFC 5280).
     - Revocation: CRL, OCSP decline and CRLite. CT logs.
     - ACME (RFC 8555), SC-081 lifetimes and LE 6-day certs.
     - Private CAs (step-ca); mTLS for service identity; SPIFFE/SPIRE IDs.
     - Cert pinning (why not).
     - PQ certificates/ML-DSA (status).
  5. **05-sessions-cookies-and-browser-security**
     - Server sessions vs tokens; session fixation and rotation on login.
     - Cookie attributes: `Secure`, `HttpOnly`, `SameSite` Lax/Strict/None, `__Host-` prefix, CHIPS `Partitioned`.
     - CSRF tokens vs SameSite; CORS (what it is NOT).
     - CSP (nonces/strict-dynamic) and Trusted Types.
     - Clickjacking; Fetch Metadata headers.
     - Storing tokens in the browser and the BFF pattern (RFC 10017).
  6. **06-oauth-2-1-core**
     - Roles and grant types (code+PKCE, client credentials, device, refresh).
     - What 2.1 removes (implicit, ROPC) and exact redirect-URI matching.
     - `state`/`nonce`/PKCE: what each defends.
     - Refresh token rotation and reuse detection.
     - Scopes vs audience (RFC 8707).
     - RFC 9700 attacker model: mix-up (the `iss` param, RFC 9207), code injection and open redirectors.
  7. **07-oidc-and-federation**
     - ID token vs access token.
     - Discovery/JWKS; `aud`/`azp`/`nonce`/`at_hash` validation.
     - UserInfo.
     - Logout: front- vs back-channel (and why it's hard).
     - SAML as a contrast.
     - Account linking pitfalls (email_verified); multi-tenant `iss` validation (the Entra "nOAuth" class of bug).
     - Token exchange (RFC 8693) for delegation.
  8. **08-tokens-jose-and-sender-constraining**
     - JWS/JWE/JWK structure; `alg:none` and RS/HS confusion; `kid`/`jku`/`x5u` injection.
     - Algorithm allowlists; JWT BCP (rfc8725bis) and explicit `typ` (`at+jwt`, RFC 9068).
     - Clock skew and token lifetimes.
     - Opaque tokens + introspection vs JWT, and the revocation trade-off.
     - DPoP (RFC 9449) proofs, nonces and `ath`; mTLS-bound tokens (RFC 8705).
     - Hardening flows: PAR/JAR, FAPI 2.0 baseline.
     - SD-JWT (RFC 9901) orientation.
  9. **09-passkeys-webauthn-and-mfa**
     - Ceremonies: registration and authentication.
     - RP ID and origin binding (phishing resistance); challenge/replay; sign counter (and why synced passkeys use 0).
     - Attestation (usually `none`) and AAGUID; BE/BS flags.
     - Level 3 features: conditional UI/create, related origins and the Signals API.
     - Recovery flows as the weakest link.
     - Other factors: TOTP (RFC 6238) and push-fatigue attacks.
  10. **10-authorization-models**
      - Models: ACL → RBAC → ABAC → ReBAC.
      - Zanzibar: tuples, userset rewrites, the new-enemy problem and zookies/consistency tokens.
      - OpenFGA modeling.
      - Cedar: policy language, forbid-overrides-permit, schema validation and formal analysis.
      - Policy enforcement points: PEP/PDP/PIP placement.
      - BOLA/IDOR prevention (API1:2023) and multi-tenant isolation (row-level security cross-link to SQL).
  11. **11-web-and-api-vulnerability-classes**
      - Injection families (SQL, NoSQL, command, template, LDAP) and parameterization.
      - XSS types.
      - SSRF (now A01): cloud metadata, DNS rebinding and allowlist pitfalls.
      - Deserialization; path traversal.
      - Mass assignment (API3 BOPLA); rate limiting and resource consumption (API4).
      - Business-logic flaws.
      - A10:2025 exceptional conditions: fail-open error handling.
  12. **12-supply-chain-and-dependency-security**
      - Dependency confusion and typosquatting.
      - Lockfiles and `npm ci`; install scripts.
      - Provenance and trusted publishing (npm); SBOM, signing and SLSA levels (summary only, owned by gitlab-ci).
      - Malicious-package incident case studies (Shai-Hulud npm worm, Sept 2025 (unverified naming/date); xz-utils 2024).
      - Renovate/Dependabot policy; SCA vs SAST vs DAST.
  13. **13-security-operations-and-detection**
      - Security logging (A09): what to log, and never logging tokens or secrets.
      - Audit trails and tamper evidence.
      - Anomaly signals: impossible travel and refresh-token reuse.
      - Incident response basics; key/secret rotation drills.
      - Vulnerability disclosure, CVSS 4.0 vs EPSS and SSVC triage.
      - Pentest/ASVS acceptance.
  14. **14-expert-topics**
      - Post-quantum migration: hybrid KEX (RFC 10024), ML-DSA certs and harvest-now-decrypt-later.
      - Formal verification of protocols (Tamarin/ProVerif orientation).
      - Workload identity federation (OIDC tokens from CI to cloud, cross-link).
      - Zero-trust architecture (NIST SP 800-207).
      - Privacy engineering (data minimization, GDPR as an EU engineer).
      - Designing an auth system end-to-end (interview capstone).
- **Gotchas & production failure modes**
  1. **JWT validation flaws**:
     - `alg` taken from the header: `none`, or HS256 with the RSA public key as HMAC secret.
     - `aud` not checked, so a token minted for service A is accepted by service B.
     - The ID token is accepted as an access token.
  2. **`kid`/`jku` injection**: the library fetches a JWKS URL from the token header (SSRF plus key substitution). Pin the JWKS URI from AS metadata only.
  3. **JWKS caching**: no cache means you DoS the IdP. An infinite cache means key rotation breaks. You need a cooldown refetch on unknown `kid` (as in `jose` `createRemoteJWKSet`).
  4. **Redirect URI**: prefix or wildcard matching enables code theft via open redirectors. OAuth 2.1 mandates exact string matching (except the loopback port).
  5. **Missing `state`/PKCE/`iss` check**: login CSRF and mix-up attacks in multi-AS clients (RFC 9700 §4.4, RFC 9207).
  6. **Refresh tokens in localStorage**: XSS gives persistent account takeover. Use the BFF or token-mediating backend, or sender-constrain with DPoP. Rotation plus reuse detection revokes the whole family.
  7. **Multi-tenant IdP `iss`**: accepting any tenant's tokens (the `common` endpoint) or trusting unverified `email` claims leads to account takeover ("nOAuth"-class).
  8. **AES-GCM nonce reuse** with a random 96-bit nonce past about 2^32 messages per key, or a counter reset after restart, enables forgery and plaintext XOR leak. Rotate keys or use XChaCha/GCM-SIV.
  9. **Non-constant-time comparison** of HMAC signatures or API keys (`===`) enables a timing oracle. Use `timingSafeEqual` (the lengths must match first).
  10. **bcrypt truncates at 72 bytes**, so pre-hashing with an unpadded hex/base64 of a fast hash changes the semantics. Argon2id params too low (default libs), or too high, which DoSes login under credential stuffing.
  11. **SameSite=Lax default isn't CSRF-complete**: GET with side effects, same-site subdomain takeover and the 2-minute Lax+POST Chrome exception (verify it is still present). Cookie tossing from sibling subdomains is defeated by the `__Host-` prefix.
  12. **CORS misconfiguration**: reflecting `Origin` with `Access-Control-Allow-Credentials: true`; a `null` origin allowed.
  13. **Session fixation**: session ID not rotated on login or privilege change. Logout doesn't revoke server state (stateless JWT, so logout is impossible without a denylist).
  14. **mTLS cert expiry outages**: internal CAs with 1-year certs and no automated rotation. Long-lived trust stores missing a new intermediate. SC-081 makes automation mandatory by 2027–2029.
  15. **Clock skew** between nodes breaks `nbf`/`exp`, DPoP `iat` and TOTP. NTP drift on VMs.
  16. **IDOR/BOLA**: authZ checked at the route level but not object ownership. The #1 API risk (API1:2023) and part of A01:2025.
  17. **SSRF to cloud metadata** (169.254.169.254) via URL fetchers, webhooks and PDF renderers. A DNS-rebinding bypass of allowlists (validate-then-resolve TOCTOU).
  18. **Secrets in logs and errors**: Authorization headers in access logs, stack traces with connection strings (A09/A10). Error paths that fail open (catch → `return true`).
  19. **Zanzibar new-enemy problem**: an ACL removal is propagated after content is added, so the removed user sees new content. You need consistency tokens or `HIGHER_CONSISTENCY` reads in OpenFGA.
  20. **Passkey RP ID mismatch** across subdomains/apps leads to registration on the wrong RP ID, which is unrecoverable. Use a stable registrable domain and the related-origins file for multi-brand setups.
- **Interview hot topics**
  - Design login for an SPA + API + mobile app: code+PKCE, BFF vs public client, refresh rotation, logout.
  - OAuth vs OIDC; access vs ID vs refresh tokens; what PKCE actually prevents.
  - JWT vs opaque tokens and the revocation trade-off; validation checklist (alg allowlist, iss, aud, exp, typ).
  - Sessions and cookies: SameSite, CSRF defenses, XSS impact; where to store tokens in browsers.
  - Hashing vs encryption vs MAC vs signature; why argon2id; salting vs peppering.
  - TLS/mTLS and PKI chain validation; cert rotation at scale.
  - RBAC vs ABAC vs ReBAC; model Google-Docs sharing in Zanzibar/OpenFGA.
  - OWASP Top 10:2025 walk-through with real examples (BOLA, SSRF, injection, supply chain).
  - Passkeys: why they are phishing-resistant; synced vs device-bound; recovery.
  - Threat-model a feature live with STRIDE (e.g., file upload, webhook receiver).
  - Secrets management and key rotation; envelope encryption with KMS.
  - DPoP/mTLS sender-constrained tokens and when bearer tokens are fine.
- **Executable-proof strategy** (`.mise.toml`: `node = "26"`, pnpm; Docker via OrbStack/colima for servers; Vitest)
  - **Crypto** (pure `node:crypto`/WebCrypto, fully deterministic with fixed keys and RFC test vectors):
    - AEAD round-trip, plus tamper → auth-tag failure (negative test).
    - Deterministic **GCM nonce-reuse demo**: recover XOR of plaintexts.
    - HMAC vs naive `sha256(key||msg)` with a length-extension demo (a small TS SHA-256 state-continuation helper).
    - `timingSafeEqual` length behaviour.
    - HKDF vectors from RFC 5869; Ed25519 vectors from RFC 8032; Argon2id vectors from RFC 9106 §5 via `crypto.argon2Sync`.
    - ML-KEM-768 encapsulate/decapsulate round-trip; ML-DSA sign/verify.
  - **PKI**: a fixture script generates a root → intermediate → leaf chain with `openssl` (OpenSSL 3.5+/4.0 pinned; macOS LibreSSL must be rejected by a preflight test) or with `@peculiar/x509` (version to pin at authoring time).
    - Tests validate with `node:tls`/`X509Certificate.verify` and `checkHost`.
    - Negative cases: expired, wrong EKU, missing intermediate, name-constraint violation, SAN mismatch.
    - mTLS server with `requestCert`/`rejectUnauthorized` and client-cert identity extraction.
  - **JOSE** (`jose` 6.2.13):
    - Sign/verify/encrypt.
    - Negative tests: `alg:none`, HS/RS confusion, wrong `aud`/`iss`, expired with clock tolerance, `typ` mismatch, unknown `kid` → JWKS refetch cooldown (local JWKS HTTP server).
  - **OAuth/OIDC**:
    - Primary: **`oidc-provider` 9.13.1** in-process (no Docker; deterministic clock via `@sinonjs/fake-timers` or Vitest fake timers) with the **`oauth4webapi` 3.8.8** client.
    - Tests cover:
      - Code+PKCE happy path and exact redirect-URI rejection.
      - `state` mismatch; PKCE verifier mismatch; mix-up via the `iss` param.
      - Refresh rotation and reuse detection.
      - DPoP-bound tokens (proof with wrong `htu`/`htm`/`ath` → rejected).
      - PAR; client credentials; introspection/revocation.
      - Back-channel logout token validation.
  - **Real-IdP parity**: an optional **Keycloak 26.8.1** container (`quay.io/keycloak/keycloak:26.8.1`, realm imported from JSON) or **Dex v2.46.1** via testcontainers-node. Mark this suite `@docker` and skip it if Docker is absent.
  - **Cookies/CSRF/CORS**: `node:http` app tests with `fetch` asserting `Set-Cookie` attributes, `__Host-` rules, CORS preflight responses and the credentialed-wildcard rejection. Browser-enforced behaviour (SameSite, CHIPS) needs **Playwright** with Chromium/Firefox/WebKit (version to pin at authoring time) on `localhost` vs `127.0.0.1` vs custom `/etc/hosts`-free hostnames (`*.localhost`), and is kept in an opt-in e2e suite.
  - **WebAuthn**:
    - Library: `@simplewebauthn/server` (version to pin at authoring time).
    - Recorded attestation/assertion fixtures.
    - Negative tests: wrong origin, wrong RP ID hash, replayed challenge, UV flag missing when required.
    - Live ceremonies: Playwright + Chromium **virtual authenticator** (CDP `WebAuthn.addVirtualAuthenticator`). Safari/iCloud Keychain sync cannot be automated, so document it manually.
  - **AuthZ**:
    - OpenFGA v1.22.0 container (or in-memory datastore) plus `@openfga/sdk`. Model tests via the `fga model test` CLI YAML (CLI version to pin at authoring time).
    - Cedar via `@cedar-policy/cedar-wasm` 4.14.0: policy evaluation and schema-validation negatives.
    - A hand-rolled RBAC/ABAC evaluator for contrast.
  - **Vulnerability labs**: deliberately vulnerable mini-Express/`node:http` apps (SQLi via PGlite or better-sqlite3, SSRF with a fake metadata server on loopback, IDOR, mass assignment, XXE-free JSON). Each has a **failing exploit test** that passes against the fixed version (red/green pairs).
  - **Supply chain**: a local registry (Verdaccio container, version to pin at authoring time) demonstrating dependency confusion and `npm ci --ignore-scripts`. Provenance verification (`npm audit signatures`) needs the network, so make it opt-in.
  - **Cannot prove locally**: real passkey sync, CT log inclusion, public ACME issuance (fallback: **Pebble**, the Let's Encrypt test ACME server, in Docker), cloud KMS (fallback: a local Vault/OpenBao dev server, or SOPS with age keys), and FAPI conformance (fallback: link the OIDF conformance suite and run it manually).
- **Overlaps / dedupe**
  - Cloud IAM (AWS IAM policies, GCP/Azure RBAC, workload identity federation configuration) is owned by **architecture/cloud-foundations**. This track teaches the generic models and OIDC token exchange and only cross-links.
  - SBOM, artifact signing (Sigstore/cosign), SLSA provenance, CI secret handling and OIDC-to-cloud from pipelines are owned by **technologies/gitlab-ci**. Module 12 gives the concept map plus cross-link only.
  - Kubernetes RBAC, ServiceAccount tokens and NetworkPolicy belong to **technologies/kubernetes**.
  - Container isolation (namespaces, seccomp, rootless, image scanning) belongs to **technologies/containers**.
  - Cloudflare Access/Zero Trust, WAF and edge mTLS belong to **technologies/cloudflare**.
  - Node-specific security (permission model `--permission`, prototype pollution, `vm` is not a sandbox, ReDoS) goes to the **Node.js track**. Python (pickle, Django/FastAPI security) goes to the **Python track**.
  - SQL injection mechanics plus row-level security go to the **SQL track** (this track keeps the vulnerability-class overview).
  - Redis ACL/AUTH and TLS go to the **Redis track**.
  - TLS-on-the-wire (handshake RTTs, ECH, QUIC TLS) is owned by **architecture/networking**. This track owns crypto primitives, X.509 validation, mTLS identity and cert lifecycle.
  - HTTP caching/CDN security (cache poisoning, cache deception) is split: the mechanism lives in networking module 13, and the attack lives here in module 11 with a cross-link.

## 4. Re-verify list
These claims were marked unverified during research. Confirm or correct each one against a primary source before teaching it:
- **OWASP Top 10:2025** https://top10.owasp.org/2025/ . The RC was announced 2025-11-06 at Global AppSec; the site doesn't state a final-release date (exact final date unverified). Categories:
- **FAPI 2.0** Security Profile and Attacker Model are Final (2025). Final conformance tests are available. https://openid.net/fapi2-0-final-conformance-tests-available/ (exact approval date unverified; recalled as Feb 2025).
- **OpenID Connect Core 1.0** (errata set 2; also ISO/IEC 26131:2024 (unverified)).
- **Password hashing**: RFC 9106 (Argon2). Node has `crypto.argon2()`/`argon2Sync()` built in (version added unverified; present in Node 26 docs https://nodejs.org/api/crypto.html). Node `node:crypto` supports **ML-KEM-512/768/1024** (`crypto.encapsulate/decapsulate`) and **ML-DSA-44/65/87**, backed by OpenSSL 3.5.
- **Browser cookies**: Google ended Privacy Sandbox and kept third-party cookies in Chrome (Oct 2025, per press: https://www.cookieyes.com/knowledge-base/cookies-101/is-google-ending-privacy-sandbox.md ; exact details unverified). CHIPS (`Partitioned` attribute) is still relevant for embedded/iframe contexts, and Safari/Firefox partition by default. Per-browser support matrix (unverified); check caniuse when writing.
- **CompTIA Security+ SY0-701** is current. SY0-801 is announced, but its launch date and objectives were not verifiable from CompTIA (https://www.diontraining.com/blogs/news/comptia-security-sy0-801-what-we-know-about-the-new-exam), so its domain weightings are (unverified).
- Malicious-package incident case studies (Shai-Hulud npm worm, Sept 2025 (unverified naming/date); xz-utils 2024).
- 7. **Multi-tenant IdP `iss`**: accepting any tenant's tokens (the `common` endpoint) or trusting unverified `email` claims leads to account takeover ("nOAuth"-class).

## 5. Certifications & exams
Follow AGENTS.md § Certification and Exam Coverage exactly. Minimum deliverables:
1. **README "Certifications & Exams" section.** Start from the exams named in the dossier above ("Authoritative syllabi used"). Re-verify each exam's code, status, guide version/date, targeted product version and domain weights on the official page. Where no certification exists, say so and use the recognised interview format.
2. **`exams/README.md` coverage matrix.** Rows are domain/objective, weight, modules, examples, status. No ❌ at hand-off.
3. **`exams/<exam-code>.md` question banks.**
   - At least 5 questions per domain and at least 60 per certification, weighted like the official domains.
   - The real exam's question types, plus hands-on tasks with verification scripts for performance-based exams.
   - Difficulty tags. Answers with explanations, why each distractor is wrong, and module + official-doc refs.
   - One full mock exam with a scoring key.
4. **Exam-delta callouts** where the exam's product version differs from the track's.
5. **Original questions only.** No braindump content.

## 6. Code languages
Per AGENTS.md § Code Example Languages:
- **Primary:** pseudocode (where algorithms or protocols are described) + TypeScript (or the track's own language, for language tracks).
- **Secondary:** Python, Rust or Nim only where it teaches something. Each language lives in `examples/<lang>/` with its own mise-pinned toolchain and native test runner, and `test` runs them all.

## 7. Workflow and definition of done
1. **Primary (Opus)** works on branch `track/security-identity` and sets this track's row in `.agents/STATUS.md` to 🟦.
2. **Verify versions first.** Check every version in the dossier against its primary source today. Record the results in the README's `Verified against …` line. Resolve every item in the re-verify list below.
3. Build in stages: README syllabus + exam matrix → modules one by one, each with its examples/tests → glossary → cheatsheet → question banks → mock exam. Delegate bulk drafting (question-bank drafts, glossary candidates, cheatsheet tables) to the **Drafter**, then correct and integrate it yourself.
4. Before each commit: run `mise exec -- npm test` and `npm run typecheck` (or the equivalents), and `test:integration` if present. Commit with Conventional Commits scoped `(security-identity)`.
5. Self-check against `.agents/REVIEW.md`. Then set STATUS to 🟨 and write the hand-off at the top of `.agents/reviews/security-identity.md`:
   - what was done;
   - what was not done, and why;
   - every claim you are least sure of.
6. The **Challenger** attacks it and the **Verifier** checks it independently. Both record findings in `.agents/reviews/security-identity.md` (prompts in `.agents/KICKOFF.md`). The primary resolves the findings (🟧), Opus runs the final gate (🟪), and the owner merges (✅).
