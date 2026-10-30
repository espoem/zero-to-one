# Security & Identity Architecture Bilingual Terminology Glossary

This glossary provides authoritative English ↔ Czech definitions of core computer security principles, cryptographic algorithms, public key infrastructure, identity protocols, web security mechanisms, and zero-trust primitives. All explanations and definitions are written in English, pairing canonical English terminology with established Czech technical equivalents.

---

## 1. Threat Modeling, Security Principles & Governance

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **CIA Triad** | **Triáda CIA (Důvěrnost, Integrita, Dostupnost)** | The foundational information security model defining Confidentiality (preventing unauthorized disclosure), Integrity (preventing unauthorized modification), and Availability (ensuring timely, reliable access). | ISO/IEC 27000 |
| **Parkerian Hexad** | **Parkerova hexáda** | An expansion of the CIA triad formulated by Donn Parker adding Possession/Control, Authenticity, and Utility to capture nuanced asset loss states. | Information Security Principles |
| **STRIDE Methodology** | **Metodika STRIDE** | Threat modeling taxonomy developed by Praerit Garg and Loren Kohnfelder at Microsoft categorizing threats into: Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege. | Microsoft Security Engineering |
| **Data Flow Diagram (DFD)** | **Diagram datových toků (DFD)** | Graphical modeling technique tracing processes, data stores, external entities, and data flows, across which Trust Boundaries are overlaid to systematically identify security threats. | OWASP Threat Modeling |
| **Trust Boundary** | **Hranice důvěry** | A perimeter separating entities with differing privilege levels and trust classifications; crossing a trust boundary mandates explicit cryptographic authentication and authorization. | NIST SP 800-207 |
| **Principle of Least Privilege (PoLP)** | **Princip nejmenších privilegií** | Security design rule mandating that every principal (user, service, process) must be granted only the minimum permissions strictly required to execute its authorized task. | Saltzer & Schroeder (1975) |
| **Fail-Closed (Fail-Safe Defaults)** | **Bezpečné selhání (uzavření přístupu při chybě)** | Architectural principle requiring that in the event of an unhandled exception, syntax failure, or timeout, security gates must deny access rather than permit it. | OWASP ASVS 5.0 |
| **Defense in Depth** | **Hloubková ochrana** | Layered security architecture ensuring that the failure or compromise of any single defensive barrier (e.g. firewall) is backed by redundant controls (e.g. mTLS, RBAC, WAF). | NSA Security Guidelines |
| **Zero Trust Architecture (ZTA)** | **Architektura nulové důvěry (Zero Trust)** | Security paradigm eliminating implicit trust based on network topology ("never trust, always verify"); every access request is dynamically authenticated, authorized, and encrypted. | NIST SP 800-207 |
| **Application Security Verification Standard (ASVS)** | **Standard pro ověřování bezpečnosti aplikací (ASVS)** | An open OWASP framework defining technical application security controls across three increasing rigor levels: Level 1 (opportunistic), Level 2 (standard commercial), and Level 3 (critical). | OWASP ASVS 5.0 |

---

## 2. Cryptographic Foundations, Ciphers & Randomness

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Cryptographically Secure PRNG (CSPRNG)** | **Kryptograficky bezpečný pseudonáhodný generátor (CSPRNG)** | A random number generator seeded with physical hardware entropy that satisfies the Next-Bit Test: no polynomial-time algorithm can predict the $(k+1)$-th bit with probability $>0.5$. | RFC 4086 |
| **Cryptographic Hash Function** | **Kryptografická hašovací funkce** | A deterministic one-way algorithm mapping arbitrary-length bitstrings to fixed-size digests exhibiting pre-image, second pre-image, and collision resistance. | NIST FIPS 180-4 |
| **Length Extension Attack** | **Útok prodloužením délky zprávy** | An exploit targeting Merkle-Damgård constructed hash functions (MD5, SHA-1, SHA-256) where an attacker knowing $H(\text{secret} \mathbin{\Vert} m)$ can append padding and arbitrary text $m'$ to compute $H(\text{secret} \mathbin{\Vert} m \mathbin{\Vert} \text{pad} \mathbin{\Vert} m')$ without knowing the secret. | Cryptographic Analysis |
| **Hash-Based Message Authentication Code (HMAC)** | **Hašovací autentizační kód zprávy (HMAC)** | A cryptographic construction ($\text{HMAC}(K, m) = H((K \oplus \text{opad}) \mathbin{\Vert} H((K \oplus \text{ipad}) \mathbin{\Vert} m))$) that guarantees authenticity and integrity while neutralizing length extension attacks. | RFC 2104 |
| **Constant-Time Comparison** | **Porovnání v konstantním čase** | An implementation technique executing algorithmic comparisons in identical CPU clock cycles regardless of byte match positions, eliminating side-channel timing leaks. | Cryptographic Engineering |
| **Authenticated Encryption with Associated Data (AEAD)** | **Autentizované šifrování s přidruženými daty (AEAD)** | A symmetric cipher mode (e.g. AES-GCM, ChaCha20-Poly1305) that simultaneously provides confidentiality for ciphertext and cryptographic integrity/authenticity for unencrypted metadata (AAD). | RFC 5116 |
| **AES-GCM Nonce Reuse Catastrophe** | **Katastrofální znovupoužití nonce v AES-GCM** | A critical failure mode where encrypting two messages under the identical key and nonce reveals the XOR difference of the plaintexts ($C_1 \oplus C_2 = P_1 \oplus P_2$) and allows mathematical derivation of the GHASH authentication key $H$. | Joux (2006) |
| **Perfect Forward Secrecy (PFS)** | **Dokonalá dopředná bezpečnost** | A property of key exchange protocols ensuring that the compromise of long-term server private keys does not compromise historical session keys derived via ephemeral Diffie-Hellman (ECDHE). | RFC 8446 (TLS 1.3) |
| **HKDF (HMAC-based Key Derivation Function)** | **Klíčová derivační funkce HKDF** | A two-step key derivation standard (Extract-and-Expand) that extracts a pseudorandom key from raw input keying material and expands it into multiple independent, uniformly distributed cryptographic keys. | RFC 5869 |
| **Ed25519** | **Digitální podpis Ed25519** | A fast, side-channel-resistant Edwards-curve Digital Signature Algorithm (EdDSA) operating over Curve25519 providing 128-bit security. | RFC 8032 |

---

## 3. Passwords, Secrets Management & KDFs

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Argon2id** | **Algoritmus Argon2id** | The standard memory-hard password hashing function (winner of the Password Hashing Competition) combining Argon2d (data-dependent memory access) and Argon2i (data-independent memory access) to defend against side-channel and GPU/ASIC attacks. | RFC 9106 |
| **Password Salt** | **Sůl hesla** | A unique, cryptographically random bitstring generated per user account and stored alongside the password hash to neutralize precomputed dictionary and rainbow table lookups. | NIST SP 800-63B |
| **Password Pepper** | **Pepř hesla** | An organization-wide secret cryptographic key combined with passwords before hashing and stored separately from the user database (e.g. in a KMS/HSM). | OWASP Guidelines |
| **Bcrypt 72-Byte Truncation** | **72bajtové oříznutí v algoritmu bcrypt** | An inherent architectural limitation of the Eksblowfish cipher in bcrypt where all password input characters beyond the 72nd byte are silently ignored. | Eksblowfish Specification |
| **k-Anonymity (HIBP)** | **k-anonymita (kontrola prolomených hesel)** | A privacy-preserving lookup protocol where clients query a compromised password database using only the first 5 hexadecimal characters of the password hash, downloading matching hash suffixes to verify breaches locally. | Troy Hunt (HIBP) |
| **Envelope Encryption** | **Obálkové šifrování** | A two-tier cryptographic storage architecture where data is encrypted locally with a Data Encryption Key (DEK), and the DEK is encrypted (wrapped) by a centralized Key Encryption Key (KEK) managed in an HSM/KMS. | NIST SP 800-57 |
| **Crypto-Shredding** | **Kryptografické skartování (Crypto-Shredding)** | The practice of permanently deleting the unique cryptographic key used to encrypt sensitive personal data, rendering immutable storage records irreversibly unrecoverable under GDPR Article 17. | NIST SP 800-88, GDPR Art. 17 |

---

## 4. Public Key Infrastructure & Workload Identity

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **X.509 Certificate** | **Certifikát X.509** | An ITU-T standard defining the ASN.1 structure binding an entity's identity to a public key via a digital signature created by a trusted Certificate Authority. | RFC 5280 |
| **Subject Alternative Name (SAN)** | **Alternativní jméno subjektu (SAN)** | An X.509 extension specifying multiple hostnames, IP addresses, and URIs for which a certificate is valid, formally deprecating the legacy Common Name (CN). | RFC 5280 |
| **Basic Constraints** | **Základní omezení (Basic Constraints)** | An X.509 extension (`id-ce-basicConstraints`, critical) indicating whether the certificate subject is authorized to act as a Certificate Authority (`cA: TRUE`) and setting path length limits. | RFC 5280 |
| **Extended Key Usage (EKU)** | **Rozšířené použití klíče (EKU)** | An X.509 extension defining specific operational purposes for which the certified public key may be used (e.g. `serverAuth`, `clientAuth`, `codeSigning`). | RFC 5280 |
| **Certificate Transparency (CT)** | **Transparentnost certifikátů (CT)** | An open framework requiring publicly trusted TLS certificates to be recorded in public, append-only, tamper-evident Merkle tree logs to detect unauthorized issuance. | RFC 6962 |
| **OCSP Stapling** | **Připojování OCSP odpovědí (OCSP Stapling)** | A TLS enhancement (RFC 6066) where the web server queries the CA's OCSP responder, caches the signed time-stamped status, and delivers it directly to the client during the TLS handshake. | RFC 6066 |
| **CRLite** | **Úsporná distribuce odvolaných certifikátů (CRLite)** | An efficient certificate revocation mechanism compiling global Certificate Transparency and CRL databases into cascading Bloom filters distributed to browsers. | IEEE S&P |
| **Automated Certificate Management Environment (ACME)** | **Protokol ACME (automatická správa certifikátů)** | A standardized protocol (RFC 8555) automating domain validation challenges (HTTP-01, DNS-01) and seamless issuance and renewal of TLS certificates. | RFC 8555 |
| **Mutual TLS (mTLS)** | **Vzájemné ověření TLS (mTLS)** | A bidirectional TLS connection where both client and server present X.509 certificates, authenticating both endpoints cryptographically before payload transfer. | RFC 8446 |
| **SPIFFE / SVID** | **Standard SPIFFE / dokument SVID** | Secure Production Identity Framework for Everyone; defines SPIFFE IDs (URIs) encoded in X.509 or JWT SVIDs to provide cryptographic identities to cloud-native workloads. | CNCF SPIFFE Standard |

---

## 5. Web & Browser Security Architecture

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Same-Origin Policy (SOP)** | **Pravidlo stejného původu (SOP)** | A fundamental browser security model permitting scripts running on one web page to access data on another page only if both pages share identical Scheme, Host, and Port. | W3C / WHATWG |
| **Cross-Site Scripting (XSS)** | **Skriptování mezi stránkami (XSS)** | A vulnerability allowing an attacker to inject and execute arbitrary malicious client-side JavaScript in a victim's browser session (Stored, Reflected, or DOM-based). | OWASP Top 10 |
| **Cross-Site Request Forgery (CSRF)** | **Padělání požadavku mezi stránkami (CSRF)** | An attack tricking an authenticated user's browser into submitting unauthorized state-changing HTTP requests to a target site that relies implicitly on browser-managed cookies. | OWASP Top 10 |
| **Cookie Security Flags** | **Bezpečnostní příznaky cookie (HttpOnly, Secure, SameSite)** | Attributes restricting cookie access: `HttpOnly` blocks JavaScript `document.cookie`, `Secure` forces transmission over HTTPS, and `SameSite` (`Strict`/`Lax`) restricts cross-site attachment. | RFC 6265bis |
| **`__Host-` Cookie Prefix** | **Předpona cookie `__Host-`** | A strict cookie prefix enforced by modern browsers requiring the cookie to carry `Secure`, omit `Domain` (preventing subdomain tampering), and specify `Path=/`. | RFC 6265bis |
| **Content Security Policy (CSP Level 3)** | **Zásady zabezpečení obsahu (CSP Level 3)** | An HTTP response header allowing site operators to restrict the resources (scripts, images, iframes) browsers are permitted to load, leveraging cryptographic nonces to mitigate XSS. | W3C CSP Level 3 |
| **Fetch Metadata (`Sec-Fetch-*`)** | **Metadata požadavků Fetch** | Security request headers (`Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Sec-Fetch-Dest`) added by browsers enabling backend servers to enforce zero-token CSRF and cross-origin defenses. | W3C Fetch Metadata |
| **Backend-for-Frontend (BFF)** | **Vzor Backend-for-Frontend (BFF)** | An architectural design where an SPA communicates with a dedicated server-side backend via secure cookies; the BFF stores OAuth tokens server-side, preventing browser token exposure. | RFC 10017 |
| **Web Cache Deception (WCD)** | **Klamání webové mezipaměti (WCD)** | An attack exploiting path parsing discrepancies between caching reverse proxies and application backends to trick proxies into caching authenticated private dynamic user data. | Black Hat Security Research |

---

## 6. OAuth 2.1, OIDC & Federated Identity

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **OAuth 2.1** | **Autorizační rámec OAuth 2.1** | The consolidated specification modernizing OAuth 2.0: deprecates Implicit and ROPC grants, mandates PKCE for all clients, and requires exact string matching for redirect URIs. | IETF OAuth 2.1 Draft |
| **Authorization Code Flow** | **Tok s autorizačním kódem** | An OAuth redirection flow where the client receives a short-lived authorization code in the front channel and exchanges it for tokens directly over a back-channel TLS connection. | RFC 6749, OAuth 2.1 |
| **PKCE (Proof Key for Code Exchange)** | **Mechanismus PKCE (RFC 7636)** | A cryptographic extension binding authorization code requests to token redemption via a dynamic `code_verifier` and its SHA-256 hash (`code_challenge`), neutralizing interception attacks. | RFC 7636 |
| **Refresh Token Rotation (RTR)** | **Rotace obnovovacích tokenů (RTR)** | A security practice where a new refresh token is issued every time one is consumed; reusing an invalidated refresh token triggers immediate automated revocation of the entire token family. | OAuth 2.1 BCP |
| **OpenID Connect (OIDC Core)** | **Protokol OpenID Connect (OIDC)** | An identity layer built on top of OAuth 2.0 enabling clients to verify end-user identity and obtain basic profile data formatted as a cryptographically signed ID Token. | OpenID Foundation |
| **ID Token** | **Identifikační token (ID Token)** | A signed JSON Web Token (JWT) issued by an OpenID Provider asserting user authentication event details (`sub`, `iss`, `aud`, `iat`, `exp`, `at_hash`). | OIDC Core 1.0 |
| **JSON Web Key Set (JWKS)** | **Sada veřejných kryptografických klíčů (JWKS)** | A standard JSON data structure published at `/.well-known/jwks.json` containing the public keys used by an IdP to sign tokens, enabling automated key rotation. | RFC 7517 |
| **nOAuth Attack** | **Zranitelnost nOAuth** | An account takeover attack occurring when a relying party blindly trusts the `email` claim in an OIDC ID token without validating `email_verified: true`, allowing attackers to register victim emails at open IdPs. | Descope Security Advisory |
| **OIDC Back-Channel Logout** | **Odhlášení přes zpětný kanál (Back-Channel Logout)** | A logout specification where the Identity Provider delivers a signed Logout Token directly to the Relying Party backend via server-to-server HTTP POST, independent of browser iframes. | OpenID Foundation |

---

## 7. Tokens, JOSE & Sender-Constraining

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **JSON Object Signing and Encryption (JOSE)** | **Rámec JOSE (podepisování a šifrování JSON)** | The suite of specifications defining cryptographic representations in JSON: JWS (signatures), JWE (encryption), JWK (keys), JWA (algorithms), and JWT (tokens). | RFC 7515-7519 |
| **JSON Web Token (JWT)** | **Webový token JSON (JWT)** | A compact, URL-safe means of representing claims consisting of three base64url-encoded parts separated by dots: Header, Payload, and Signature (`header.payload.signature`). | RFC 7519 |
| **The `alg:none` Catastrophe** | **Zranitelnost s algoritmem "none"** | A critical vulnerability where a JWT library accepts tokens with `"alg": "none"` and an empty signature, allowing attackers to forge arbitrary claims if algorithm validation is omitted. | RFC 8725 |
| **RS256 / HS256 Algorithm Confusion** | **Záměna algoritmů RS256 a HS256** | An attack where an adversary alters a token header from asymmetric RS256 to symmetric HS256, signing the token using the server's public RSA key as the HMAC shared secret. | RFC 8725 |
| **Explicit Typing (`typ: "at+jwt"`)** | **Explicitní typování tokenů (RFC 9068)** | A profile requiring JWT access tokens to declare `{"typ": "at+jwt"}` in the header to prevent token confusion where an ID token is passed to an API expecting an access token. | RFC 9068 |
| **Demonstrating Proof-of-Possession (DPoP)** | **Prokázání držení klíče DPoP (RFC 9449)** | An application-layer sender-constraining mechanism where the client signs a unique ephemeral DPoP Proof JWT bound to the HTTP method, URI, and access token hash (`ath`). | RFC 9449 |
| **mTLS-Bound Access Tokens** | **Tokeny vázané na certifikát mTLS (RFC 8705)** | A sender-constraining mechanism embedding the SHA-256 fingerprint of the client's mutual TLS certificate in the access token's `cnf.x5t#S256` claim. | RFC 8705 |
| **Selective Disclosure JWT (SD-JWT)** | **Token SD-JWT s výběrovým zveřejněním** | A token standard (RFC 9901) enabling holders to selectively disclose specific claims (e.g. proving age $>21$ without disclosing date of birth or name) while preserving cryptographic integrity. | RFC 9901 |

---

## 8. Hardware-Backed MFA, WebAuthn & Passkeys

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **WebAuthn Level 3** | **Standard WebAuthn Level 3** | A W3C standard defining a JavaScript browser API for public-key authentication using on-device hardware authenticators (FIDO2/CTAP2). | W3C WebAuthn Level 3 |
| **Passkey** | **Přístupový klíč (Passkey)** | A user-friendly branding for FIDO2/WebAuthn credentials; consists of an asymmetric key pair where the private key never leaves the device or encrypted cloud keychain. | FIDO Alliance |
| **Phishing Resistance** | **Odolnost proti phishingu** | The property of WebAuthn where the browser signs the origin URL (`clientDataJSON`), preventing reverse-proxy phishing tools (Evilginx) from using harvested signatures on target domains. | FIDO Architecture |
| **User Presence (UP)** | **Fyzická přítomnost uživatele (UP)** | An authenticator verification bit (Bit 0 in `authenticatorData`) proving a human physically interacted with the hardware device (e.g. tapped a capacitive button). | W3C WebAuthn |
| **User Verification (UV)** | **Ověření identity uživatele (UV)** | An authenticator verification bit (Bit 2 in `authenticatorData`) proving the specific user was verified on-device via biometrics (fingerprint/face) or local device PIN. | W3C WebAuthn |
| **Synced Passkey** | **Synchronizovaný přístupový klíč** | A passkey backed up across a user's ecosystem devices via end-to-end encrypted cloud keychains (Apple iCloud Keychain, Google Password Manager). | FIDO Alliance |
| **Time-Based One-Time Password (TOTP)** | **Časově proměnné jednorázové heslo (TOTP)** | An algorithm (RFC 6238) computing 6-digit codes as $\text{HOTP}(K, \lfloor \text{time} / 30 \rfloor)$ based on a pre-shared secret key and 30-second time steps. | RFC 6238 |
| **MFA Push Fatigue (Prompt Bombing)** | **Útok zahlcením výzvami MFA (Push Fatigue)** | A social engineering attack where an adversary floods a victim's phone with repeated MFA push alerts until the user approves access; mitigated via Number Matching or WebAuthn. | CISA Advisory |

---

## 9. Authorization Models & Policy Engines

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Role-Based Access Control (RBAC)** | **Řízení přístupu na základě rolí (RBAC)** | An access model where permissions are grouped into static administrative roles and subjects are assigned to those roles. | ANSI/INCITS 359 |
| **Attribute-Based Access Control (ABAC)** | **Řízení přístupu na základě atributů (ABAC)** | A dynamic access model evaluating policies based on boolean expressions over attributes of the Subject, Resource, Action, and Environment. | NIST SP 800-162 |
| **Relationship-Based Access Control (ReBAC)** | **Řízení přístupu na základě vztahů (ReBAC)** | A graph-based access control paradigm evaluating permissions through multi-hop relationship edges between objects and subjects (inspired by Google Zanzibar). | Google Zanzibar (2019) |
| **Cedar Policy Language** | **Politický jazyk Cedar** | A formal, expressive authorization language with deterministic execution and explicit forbid-overrides-permit semantics developed by AWS. | Cedar Open Source Spec |
| **Broken Object Level Authorization (BOLA)** | **Porušená autorizace na úrovni objektů (BOLA / IDOR)** | An API vulnerability (OWASP API1:2023) where an endpoint fails to verify whether an authenticated user is authorized to perform actions on a requested database object ID. | OWASP API Security |
| **Zookies** | **Konzistentní tokeny Zookies** | Cryptographic consistency tokens used in Google Zanzibar to encode database revision timestamps, guaranteeing linearizable authorization checks and eliminating the New-Enemy problem. | Google Zanzibar Paper |

---

## 10. Web Application Vulnerabilities & Supply Chain

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Server-Side Request Forgery (SSRF)** | **Padělání požadavku na straně serveru (SSRF)** | A flaw allowing an attacker to coerce a server-side application into initiating arbitrary HTTP requests to internal network services or cloud instance metadata (169.254.169.254). | OWASP Top 10 |
| **DNS Rebinding** | **Útok DNS rebinding** | An exploit circumventing IP allowlists by returning a legitimate public IP during an application's validation check and a loopback/private IP during the subsequent socket connection. | Application Security Research |
| **Insecure Deserialization** | **Nezabezpečená deserializace objektů** | Converting untrusted serialization streams into language memory objects, enabling attackers to execute arbitrary code via structured gadget chains. | OWASP Top 10 |
| **Dependency Confusion** | **Záměna závislostí (Dependency Confusion)** | A supply chain attack where an adversary publishes a package with the identical name as an unscoped private enterprise package on public repositories with a higher semantic version. | Alex Birsan (2021) |
| **Software Bill of Materials (SBOM)** | **Soupiska softwarových komponent (SBOM)** | A formal, machine-readable inventory of software components, dependencies, libraries, and licenses comprising an application (standardized via CycloneDX and SPDX). | US Executive Order 14028 |
| **Supply-chain Levels for Software Artifacts (SLSA)** | **Úrovně zabezpečení dodavatelského řetězce (SLSA)** | A security framework defining incremental levels of build integrity, isolated build runners, and non-falsifiable cryptographic provenance. | OpenSSF SLSA Spec |
| **Sigstore / Cosign** | **Podepisování softwaru Sigstore / Cosign** | An open-source standard for signing container images and build artifacts using ephemeral OIDC identities, transparent PKI (Fulcio), and append-only transparency logs (Rekor). | Linux Foundation |

---

## 11. Security Operations & Detection Signals

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Security Information & Event Management (SIEM)** | **Správa bezpečnostních informací a událostí (SIEM)** | A centralized system aggregating, normalizing, correlating, and alerting on log telemetry across enterprise infrastructure. | NIST SP 800-92 |
| **Security Orchestration, Automation & Response (SOAR)** | **Bezpečnostní orchestrace a automatizace (SOAR)** | Technology automating repetitive SOC workflows, executing pre-programmed incident containment and remediation playbooks. | Gartner IT Glossary |
| **Common Vulnerability Scoring System (CVSS v4.0)** | **Metrika závažnosti zranitelností (CVSS v4.0)** | An open industry standard providing qualitative and quantitative severity ratings (0.0 to 10.0) based on base, threat, and environmental metrics. | FIRST CVSS v4.0 |
| **Exploit Prediction Scoring System (EPSS)** | **Systém predikce zneužití zranitelnosti (EPSS)** | A machine learning-driven model estimating the empirical probability ($0.0 \text{ to } 1.0$) that a specific software vulnerability will be exploited in the wild within 30 days. | FIRST EPSS Standard |
| **Stakeholder-Specific Vulnerability Categorization (SSVC)** | **Kategorizace zranitelností dle kontextu (SSVC)** | A decision tree methodology categorizing vulnerability remediation actions into four clear operational decisions: Track, Track*, Attend, and Act. | CISA / CERT/CC |
| **Impossible Travel Anomaly** | **Anomálie nemožné rychlosti cestování (Impossible Travel)** | A detection rule flagging consecutive logins from distinct geographic locations where the calculated velocity exceeds physically possible aircraft speeds ($>900\text{ km/h}$). | Detection Engineering |
| **Incident Response Lifecycle** | **Životní cyklus řešení incidentů** | The four-stage NIST SP 800-61r2 incident management framework: Preparation, Detection & Analysis, Containment/Eradication/Recovery, and Post-Incident Activity. | NIST SP 800-61r2 |

---

## 12. Advanced & Post-Quantum Security

| English Term | Czech Term | Definition & Context | Primary Reference |
| :--- | :--- | :--- | :--- |
| **Harvest Now, Decrypt Later (HNDL)** | **Ulož nyní, dešifruj později (HNDL)** | An adversary strategy where encrypted communications are captured and stored in bulk today, anticipating future quantum computers breaking classical asymmetric ciphers. | NSA / CISA Quantum Advisory |
| **Post-Quantum Cryptography (PQC)** | **Postkvantová kryptografie (PQC)** | Cryptographic ciphers designed to run on classical hardware while resisting attacks from quantum computers running Shor's or Grover's algorithms. | NIST PQC Standardization |
| **ML-KEM (FIPS 203)** | **Klíčový mechanismus ML-KEM (FIPS 203)** | NIST standard post-quantum Key Encapsulation Mechanism derived from CRYSTALS-Kyber, based on the hardness of the Module Learning with Errors (M-LWE) lattice problem. | NIST FIPS 203 |
| **ML-DSA (FIPS 204)** | **Digitální podpis ML-DSA (FIPS 204)** | NIST standard post-quantum digital signature algorithm derived from CRYSTALS-Dilithium, based on lattice mathematics. | NIST FIPS 204 |
| **Hybrid Key Exchange (X25519MLKEM768)** | **Hybridní výměna klíčů (RFC 10024)** | A transitional key exchange mechanism combining a classical ECDH secret ($K_{\text{classical}}$) and a post-quantum lattice secret ($K_{\text{PQ}}$) via HKDF, requiring both to be broken. | RFC 10024 |
| **Formal Protocol Verification** | **Formální verifikace bezpečnostních protokolů** | Mathematical analysis of cryptographic protocols (using tools like Tamarin or ProVerif) in symbolic models to verify secrecy and authentication against a Dolev-Yao adversary. | Computer Security Foundations |
| **Differential Privacy** | **Diferenciální soukromí** | A mathematical definition bounding information leakage, ensuring that an algorithm's output distribution remains virtually identical whether or not an individual's record is included. | Cynthia Dwork (2006) |
