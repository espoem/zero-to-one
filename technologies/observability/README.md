# Observability: Telemetry, Metrics, Logs, Traces, and SLOs

`Verified against OpenTelemetry Collector 0.164.0, OpenTelemetry Semantic Conventions 1.44.0, Prometheus 3.15.1, Alertmanager 0.34.1, Grafana 13.3.0, Grafana Loki 3.7.9, Grafana Tempo 3.1.1, Grafana Mimir 3.2.3, Grafana Alloy 1.21.2, Elasticsearch & Kibana 9.5.5, Sloth 0.16.0, Pyrra 0.10.2, k6 2.3.0, Node 25.9.0, TypeScript 7.0.2 on 2026-11-07.`

Welcome to the **Observability** track of `zero-to-one`. This curriculum provides a rigorous, senior-level exploration of cloud-native telemetry, distributed tracing, metrics architectures, logging pipelines, alerting systems, Service Level Objectives (SLOs), and enterprise observability platforms including Grafana LGTM and Elastic Observability.

## Prerequisites

Before diving into observability pipelines and telemetry mechanics, ensure you have mastered the foundational concepts in:

- [`../kubernetes/README.md`](../kubernetes/README.md) — Kubernetes control plane, CNI, workload primitives, and resource management.
- [`../containers/README.md`](../containers/README.md) — Container runtimes, cgroups v2, Linux namespaces, and OCI image execution.
- [`../elasticsearch/README.md`](../elasticsearch/README.md) — Inverted indices, BM25 scoring, and search cluster architectures.
- [`../nodejs/README.md`](../nodejs/README.md) — Node.js event loop diagnostics, async context propagation, and production operations.
- [`../../architecture/data-systems/README.md`](../../architecture/data-systems/README.md) — Write-ahead logs, B-trees vs LSM-trees, and crash recovery.
- [`../../architecture/distributed-systems/README.md`](../../architecture/distributed-systems/README.md) — Logical time, vector clocks, consensus protocols, and consistency models.

---

## Curriculum Syllabus

The track spans 13 self-contained modules, progressing from telemetry theory and instrumentation to collector pipelines, PromQL, distributed tracing, alerting, SLO burn-rate mathematics, Grafana 13, Elastic Observability, and production cardinality governance:

| Module | Filename | Core Focus |
| :-- | :-- | :-- |
| **01** | [`modules/01-observability-foundations-and-signals.md`](modules/01-observability-foundations-and-signals.md) | Monitoring vs Observability, Telemetry Signals, Cardinality Economics, Sampling Theory, RED/USE/Golden Signals |
| **02** | [`modules/02-opentelemetry-model-and-propagation.md`](modules/02-opentelemetry-model-and-propagation.md) | OTel API vs SDK, Semantic Conventions, W3C Trace Context, Spans, Metric Temporality, OTLP |
| **03** | [`modules/03-instrumentation-nodejs-and-python.md`](modules/03-instrumentation-nodejs-and-python.md) | Node.js & Python SDKs, Zero-Code Agents, Async Context Propagation, Log Correlation |
| **04** | [`modules/04-opentelemetry-collector-and-alloy.md`](modules/04-opentelemetry-collector-and-alloy.md) | OTel Collector & Grafana Alloy, Pipelines, OTTL Transforms, Memory Limiter, Tail Sampling |
| **05** | [`modules/05-prometheus-internals-and-tsdb.md`](modules/05-prometheus-internals-and-tsdb.md) | Prometheus 3 Internals, Data Model, TSDB Head Block, WAL, Compaction, Native Histograms, OTLP Ingestion |
| **06** | [`modules/06-promql-mastery-and-recording-rules.md`](modules/06-promql-mastery-and-recording-rules.md) | PromQL Vectors, Rate Extrapolation, Vector Matching Algebra, Histogram Quantiles, Subqueries |
| **07** | [`modules/07-alerting-architecture-and-alertmanager.md`](modules/07-alerting-architecture-and-alertmanager.md) | Alertmanager Routing Trees, Grouping, Inhibition, Gossip HA, Unit Testing with `promtool` |
| **08** | [`modules/08-slos-error-budgets-and-burn-rates.md`](modules/08-slos-error-budgets-and-burn-rates.md) | Service Level Objectives, Multi-Window Multi-Burn-Rate Math, Sloth, Pyrra |
| **09** | [`modules/09-logs-at-scale-grafana-loki-and-logql.md`](modules/09-logs-at-scale-grafana-loki-and-logql.md) | Grafana Loki Label-Indexed TSDB, Structured Metadata, LogQL, Alloy Migration |
| **10** | [`modules/10-distributed-tracing-tempo-and-mimir.md`](modules/10-distributed-tracing-tempo-and-mimir.md) | Grafana Tempo Architecture, TraceQL, Span Metrics, Mimir Hash Rings |
| **11** | [`modules/11-grafana-dashboards-as-code-and-correlations.md`](modules/11-grafana-dashboards-as-code-and-correlations.md) | Grafana 13 Architecture, Dynamic Dashboards Schema, Git Sync, Provisioning, Exemplar Correlations |
| **12** | [`modules/12-elastic-observability-kibana-and-edot.md`](modules/12-elastic-observability-kibana-and-edot.md) | Elastic Observability & Kibana 9.5, EDOT OTel Ingestion, APM Data Streams, Lens, ES\|QL Analytics |
| **13** | [`modules/13-production-observability-cost-and-meta-monitoring.md`](modules/13-production-observability-cost-and-meta-monitoring.md) | Cardinality Governance, Meta-Monitoring, Kubernetes Signals, eBPF/Pyroscope, Version History |

### Out of Scope

- General relational database storage internals (B-Trees vs LSM-Trees) — covered in [`../../architecture/data-systems/README.md`](../../architecture/data-systems/README.md).
- Kubernetes CNI, network policies, and cluster bootstrapping — covered in [`../kubernetes/README.md`](../kubernetes/README.md).
- Deep Elasticsearch inverted index scoring internals — covered in [`../elasticsearch/README.md`](../elasticsearch/README.md).

---

## Certifications & Exams

This track prepares candidates for official industry certifications and senior engineering evaluation loops:

1. **Prometheus Certified Associate (PCA)**
   - **Vendor**: Linux Foundation / CNCF
   - **Official Guide**: [CNCF PCA Curriculum & Exam Guide](https://www.cncf.io/certification/pca/)
   - **Version / Date Verified**: 2026-11-07 (Targeting Prometheus 3.x)
   - **Status**: Active
   - **Format**: 60 multiple-choice questions, 90 minutes, passing score 75%.
   - **Domain Weights**:
     - PromQL (28%)
     - Prometheus Fundamentals (20%)
     - Observability Concepts (18%)
     - Alerting & Dashboarding (18%)
     - Instrumentation & Exporters (16%)

2. **OpenTelemetry Certified Associate (OTCA)**
   - **Vendor**: Linux Foundation / CNCF
   - **Official Guide**: [CNCF OTCA Curriculum & Exam Guide](https://www.cncf.io/certification/otca/)
   - **Version / Date Verified**: 2026-11-07 (Targeting OpenTelemetry 1.x / Collector 0.164.0)
   - **Status**: Active
   - **Format**: 60 multiple-choice questions, 90 minutes, passing score 75%.
   - **Domain Weights**:
     - The OpenTelemetry API and SDK (46%)
     - The OpenTelemetry Collector (26%)
     - Fundamentals of Observability (18%)
     - Maintaining and Debugging Observability Pipelines (10%)

3. **Elastic Certified Observability Engineer & Senior SRE Loop**
   - **Vendor**: Elastic
   - **Official Guide**: [Elastic Certified Observability Engineer](https://www.elastic.co/training/elastic-certified-observability-engineer)
   - **Status**: Active (Targeting Elastic Stack 9.5.x)
   - **Format**: Hands-on practical performance-based tasks covering APM setup, agent instrumentation, Kibana Lens visualization, alerting rules, and ES\|QL log analytics.

See [`exams/README.md`](exams/README.md) for the complete domain-to-module coverage matrix and [`exams/pca-and-otca.md`](exams/pca-and-otca.md) for the 65-question preparation question bank and mock exam.
