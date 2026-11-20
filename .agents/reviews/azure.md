# Review: azure · verifier (Antigravity flash) & challenger (opencode-go/grok-4.7) · 2026-11-20 · branch track/azure

## Summary

Verdict: **approve** (after full remediation of all P0, P1, and P2 findings from both independent reviews). Track delivers 10 modules (6,500+ lines), 75-term bilingual glossary, 432-line practitioner cheatsheet, 1,100+ lines of deterministic TypeScript models with 62 passing hermetic unit/property/negative tests plus live Azurite integration test, and 190 original exam questions across AZ-104 (65q + 60q mock), AZ-305 (65q + 50q mock), and AI-200 (60q + 50q mock). All versions and `(unverified)` claims were verified against live primary sources on 2026-11-20.

## Multi-Agent Provenance

- **Coordinator / Integrator / Final Gate**: Antigravity (main session) — live version and primary-source verification, scaffold (`package.json`, `.mise.toml`, `mise.lock`, `README.md`, `exams/README.md`), `lane-check.ts` manifests, final integration, and root gate verification.
- **Wave 1 Authors (disjoint lanes)**:
  - `modules/01–02`: `opencode-go/deepseek-v4.1-flash`
  - `modules/03–04`: `opencode-go/gpt-6-luna`
  - `modules/05–06`: `opencode-go/claude-haiku-5-5`
  - `modules/07–08`: `opencode-go/minimax-m3.1-flash`
  - `modules/09`: `opencode-go/step-5-preview`
  - `modules/10`: `opencode-go/gpt-6-luna`
  - `GLOSSARY.md` & `CHEATSHEET.md`: Antigravity `flash`
  - `examples/lib/azure-models.ts` & `examples/01..09-*.test.ts`: `opencode-go/muse-spark-1.3-contributor`
- **Wave 2 Exam Authors (disjoint lanes)**:
  - `exams/az-104.md`: `opencode-go/deepseek-v4.1-flash`
  - `exams/az-305.md`: `opencode-go/claude-haiku-5-5`
  - `exams/ai-200.md`: `opencode-go/minimax-m3.1-flash`
- **Wave 3 Independent Review & Remediation**:
  - Read-only `verifier`: Antigravity `flash`
  - Cross-family adversarial `challenger`: `opencode-go/grok-4.7`
  - Disjoint remediation lanes: Antigravity `flash` (`examples/` and `modules+exams/`)

## Findings

### Challenger Findings (`opencode-go/grok-4.7`, independent review)

- [x] **P0** `README.md`, `modules/04`, `modules/10`, `CHEATSHEET.md`, `GLOSSARY.md`, `exams/README.md`, `exams/az-104.md` (`Q-AZ104-043`): Default outbound access retirement was pinned to Network API `2025-07-01+`; Microsoft Learn specifies only the Network API version released after 2026-03-31 defaults new VNets to private subnets (`defaultOutboundAccess: false`), while earlier API versions retain the legacy default unless set explicitly.
- [x] **P0** `modules/08-data-platforms-sql-cosmos-and-ai-data.md`: VNet-injected PostgreSQL Flexible Server referenced `privatelink.postgresql.database.azure.com`; corrected to `.postgres.database.azure.com` for VNet Private Access and `privatelink.postgres.database.azure.com` for Private Endpoints, and added the ARM resource-lock provisioning/HA DNS trap.
- [x] **P0** `CHEATSHEET.md`: Combined Azure SQL Database and SQL Managed Instance under one `privatelink.database.windows.net` row; split SQL MI into its own row (`managedInstance`, `privatelink.{dnsPrefix}.database.windows.net`).
- [x] **P0** `modules/06-serverless-messaging-and-event-integration.md`: Storage Queue TTL was described as a 7-day maximum; corrected to 7-day default with any positive integer or `-1` (never expires) supported since REST `2017-07-29`.
- [x] **P0** `examples/lib/azure-models.ts`, `examples/06-storage-sas-and-durability.test.ts`: `readSecondary()` returned 200 for `GRS`; fixed to reject `GRS`/`GZRS` with `403 SecondaryReadNotAllowed` and allow secondary reads only on `RA-GRS`/`RA-GZRS`.
- [x] **P0** `modules/01-tenancy-governance-and-policy.md`, `examples/lib/azure-models.ts`, `examples/01-governance-and-policy.test.ts`, `exams/az-104.md` (`Q-AZ104-003`): ARM `ReadOnly` lock rejection on `listKeys` used HTTP `403` instead of ARM's `409 Conflict` (`ScopeLocked`); aligned model, test, module, and exam question on `409 ScopeLocked`.
- [x] **P0** `modules/06-serverless-messaging-and-event-integration.md`, `examples/lib/azure-models.ts`, `examples/05-compute-and-serverless.test.ts`: Service Bus duplicate detection returned `accepted: false` instead of broker accept-and-silently-drop, and defaulted to 60s instead of 10 minutes; fixed semantics, 10-minute default window (20s–7d), and `(messageId, partitionKey)` deduplication for partitioned entities.
- [x] **P0** `modules/07-storage-blob-files-and-data-protection.md`: Omitted `GRS`/`GZRS` support on Azure Files HDD SMB shares (only `RA-GRS`/`RA-GZRS` are unsupported; SSD supports `LRS`/`ZRS`) and conflated Entra Kerberos with AD DS; corrected both redundancy and all four SMB auth options.
- [x] **P0** `exams/ai-200.md` (`Q-AI200-049`): Misstated that direct Managed Identity RBAC grants live in JWT claims and that wrong audience fails at IMDS instead of Storage (`401` vs Storage firewall `403`); corrected stem, explanation, and distractors while keeping scoring key aligned.
- [x] **P1** `examples/lib/azure-models.ts` & tests: Fixed `perPartitionCap()` to enforce the `10,000 RU/s` hard cap, modeled `nicNsg: undefined` separately from attached NSGs with Azure default rules, fixed one-sided non-sticky slot swap to move rather than copy, added `updateResource` trigger to `DeployIfNotExists`, parameterized RBAC propagation latency (60s typical + 30m cached worst case), and proved UDR next-hop `Internet` does not restore egress on private subnets.
- [x] **P2** `CHEATSHEET.md`, `modules/05`, `modules/08`: Added App Service/Functions Kudu `scm` Private DNS record requirement and replaced unsourced Cosmos DB "four to six hours" split estimate.

### Verifier Findings (Antigravity `flash`, read-only review)

- [x] **P0** `modules/05..10` vs `examples/05..08`: Implemented and tested all six missing model families referenced in module verification sections (`calculateKedaReplicas`, `validateRevisionTrafficWeights`, `stepBSeriesCpu`, `parseImdsScheduledEvents`, `ApimLlmTokenLimiter`, `VersionedBlobStore.createOnce` / `If-None-Match: *` `409`, `estimatePointReadRu` / `estimateQueryRu` / `HierarchicalPartitionCollection.routeQuery`, `KeyVaultThrottleBucket`, `compareLogTablePlanCosts`, `commitmentBreakEvenUtilization`, and `evaluateFinOpsCommitment` with AHB stacking), growing the hermetic test suite from 52 to 62 passing tests.
- [x] **P1** `modules/06`, `07`, `08` & `README.md`: Clarified illustrative Azure SDK TypeScript snippets vs hermetic protocol/state-machine proofs in `examples/`, and noted AZ-104 lab/hands-on backing in `README.md`.
- [x] **P2** `README.md`, `exams/README.md`, `exams/ai-200.md`: Reconciled AI-200 Domain 2 published weight (`25–30%` on 2026-11-05 study guide vs earlier `30–35%` heading).

## Final Gate Evidence (2026-11-20)

- `technologies/azure`: `mise exec -- npm test` (62/62 pass, 0 fail, 0 skipped), `mise exec -- npm run test:integration` (clean skip without Azurite, verified live against Azurite 3.38.0 during authoring), `typecheck` (exit 0), `lint` (0 warnings/errors), `fmt:check` (exit 0).
- Repository root: `bun tools/check-questions.ts` (0 schema issues across all banks including 190 Azure questions), `npm run check` (`oxfmt --check`, `oxlint`, `wrap-check`, `table-check`, `link-check` with `technologies/azure` removed from `LINK_CHECK_PENDING`, `mermaid-check` v11+v12, `katex-check`, `heading-check`) all exit 0.
