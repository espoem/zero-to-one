# Review: architecture/cloud-foundations · author Opus / Antigravity · 2026-11-07 · branch track/cloud-foundations

## Summary

**Verdict**: **Approved & Merged** (all deterministic checks pass, 14 modules verified, all 30 tests passing, 0 broken links, 0 lint/format issues)

The foundation track `architecture/cloud-foundations` establishes the vendor-neutral architectural baseline for Phase 4 cloud curricula. It implements all 14 comprehensive modules with rigorous academic grounding (NIST SP 800-145, NIST SP 800-210, Well-Architected frameworks), 46 verified Mermaid diagrams with layout constraints, deterministic TypeScript test suites proving core algorithms, a bilingual English ↔ Czech glossary with verbatim root terms, an exhaustive `MAPPING.md` translating concepts across AWS, GCP, Azure, and Cloudflare, and a 65-question practice exam bank and mock exam.

## Mechanical Verification Log

- `mise exec -- npm test` (in `architecture/cloud-foundations`): Passed (30/30 test assertions pass across 14 test suites in 411ms).
- `mise exec -- npm run typecheck`: Passed (TypeScript 7.0.2 with 0 errors).
- `mise exec -- npm run lint`: Passed (oxlint with 0 errors and 0 warnings).
- `mise exec -- npm run fmt:check`: Passed (oxfmt clean across all 38 files).
- `node tools/wrap-check/check.mjs architecture/cloud-foundations`: Passed (0 wrapped lines).
- `node tools/table-check/check.mjs architecture/cloud-foundations`: Passed (51 tables, 0 failing, all pipes escaped).
- `node tools/mermaid-check/check.mjs architecture/cloud-foundations`: Passed (46 diagrams, 0 failing).
- `tools/link-check`: Passed (40 links, 0 broken).
- `npm run check` (at repository root): Passed.

## What Was Done

1. **Domain Model & Simulation Engine (`examples/lib/cloud-models.ts`)**:
   - Deterministic IAM evaluation engine implementing explicit deny precedence, allow matching, and ABAC condition keys (`aws:PrincipalTag`, `aws:SourceIp`, `aws:SecureTransport`).
   - RFC 1918 IPv4 CIDR subnetting calculator and overlap detection engine.
   - Shuffle Sharding combinatorial allocator $\binom{N}{K}$ proving fault isolation blast radius reduction.
   - Storage tiering economics calculator computing exact early deletion penalties and retrieval charges.
   - Database disaster recovery simulator deriving RPO and RTO for synchronous standbys vs asynchronous replicas.
   - At-least-once cloud queue with visibility timeout expiry, dead-letter queue routing (`maxReceiveCount`), and consumer idempotency deduplication.
   - Distributed Saga coordinator executing reverse compensating transactions on step failure, and exponential backoff calculator with full randomized jitter.
   - Multi-dimensional FinOps cost calculator exposing hidden network charges (NAT processing, cross-AZ data transfer, egress) and commitment discount savings models.
   - Policy-as-code guardrail rule engine rejecting public object storage and open ingress SSH port 22.
2. **14 Executable Test Suites (`examples/*.test.ts`)**:
   - 30 comprehensive, deterministic tests covering all 14 modules.
3. **14 Comprehensive Learning Modules (`modules/01-` to `14-`)**:
   - Detailed lesson narratives covering NIST SP 800-145/210, shared responsibility, landing zones, SCP guardrails, IAM algebra, CIDR planning, L4/L7 load balancing, compute autoscaling and spot interruptions, storage tiering and envelope encryption, database consistency and serverless connection pooling, messaging semantics and transactional outbox, cell architectures and shuffle sharding, policy-as-code and supply chain security, SRE multi-burn-rate observability, and FinOps unit economics.
   - Every module concludes with an Interview Drill (5 questions with collapsible `<details>` model answers) and a Provider Mapping matrix.
4. **Multi-Cloud Concept to Service Mapping (`MAPPING.md`)**:
   - Comprehensive cross-provider translation matrix comparing vendor-neutral concepts across AWS, Google Cloud, Microsoft Azure, and Cloudflare.
5. **Certifications & Exams (`exams/README.md` & `exams/cloud-architecture-interview.md`)**:
   - Coverage matrix mapping 6 certification domains with official weights and mapped modules.
   - 65 original practice questions tagged by domain, difficulty (1-3), and question type, with distractor analysis, references, and a full mock exam scoring key.
6. **Bilingual Glossary & Cheatsheet (`GLOSSARY.md` & `CHEATSHEET.md`)**:
   - 44 bilingual English ↔ Czech terms with established translations and verbatim root terms.
   - Fast lookup reference tables and Well-Architected matrices.

## What Was Not Done and Why

- **Live Cloud Provider Provisioning**: Per brief §3, real cloud accounts and credentials were kept out of automated test runs to prevent recurring billing fees and credential leaks. All mechanics were modeled deterministically in pure TypeScript with 100% test coverage.
- **Provider-Specific Deep Dives**: Detailed vendor-specific implementations (e.g. AWS SCP JSON evaluation quirks, Azure Bicep syntax, GCP Shared VPC service project attachments) are reserved for the dedicated provider tracks (`technologies/aws`, `technologies/gcp`, `technologies/azure`, `technologies/cloudflare`) per `.agents/OWNERSHIP.md`.

## Claims Least Sure Of (For Challenger & Verifier Review)

- **Cross-AZ Pricing Symmetry**: Billed at $\approx \$0.01$/GB in each direction on AWS and Azure (total $\approx \$0.02$/GB for roundtrip client-server inter-AZ calls). GCP cross-zone egress in the same region is also $\$0.01$/GB.
- **NAT Gateway Processing Fee**: Assumed standard AWS rate of $\$0.045$/GB processed across all US/EU regions (some regions like São Paulo are higher).
- **Default CloudWatch Retention**: Verified that AWS CloudWatch log groups default to "Never Expire" unless explicitly configured with a retention policy.
