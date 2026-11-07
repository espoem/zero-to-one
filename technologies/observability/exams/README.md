# Observability Certification Coverage Matrix (`exams/README.md`)

This matrix maps official domain objectives for the **Prometheus Certified Associate (PCA)** and **OpenTelemetry Certified Associate (OTCA)** exams to the modules and runnable example test suites in `technologies/observability`.

## 1. Prometheus Certified Associate (PCA) Coverage Matrix

| Domain # | Domain Name | Official Weight | Target Questions | Mapped Modules | Mapped Test Suites | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **PCA-1** | PromQL | 28% | 18 | [`modules/06-promql-mastery-and-recording-rules.md`](../modules/06-promql-mastery-and-recording-rules.md) | `examples/ts/06-promql-mastery-and-recording-rules.test.ts` | ✅ Full |
| **PCA-2** | Prometheus Fundamentals | 20% | 13 | [`modules/05-prometheus-internals-and-tsdb.md`](../modules/05-prometheus-internals-and-tsdb.md) | `examples/ts/05-prometheus-internals-and-tsdb.test.ts` | ✅ Full |
| **PCA-3** | Observability Concepts | 18% | 11 | [`modules/01-observability-foundations-and-signals.md`](../modules/01-observability-foundations-and-signals.md) | `examples/ts/01-observability-foundations-and-signals.test.ts` | ✅ Full |
| **PCA-4** | Alerting & Dashboarding | 18% | 11 | [`modules/07-alerting-architecture-and-alertmanager.md`](../modules/07-alerting-architecture-and-alertmanager.md), [`modules/11-grafana-dashboards-as-code-and-correlations.md`](../modules/11-grafana-dashboards-as-code-and-correlations.md) | `examples/ts/07-alerting-architecture-and-alertmanager.test.ts`, `examples/ts/11-grafana-dashboards-as-code-and-correlations.test.ts` | ✅ Full |
| **PCA-5** | Instrumentation & Exporters | 16% | 10 | [`modules/03-instrumentation-nodejs-and-python.md`](../modules/03-instrumentation-nodejs-and-python.md) | `examples/ts/03-instrumentation-nodejs-and-python.test.ts` | ✅ Full |

---

## 2. OpenTelemetry Certified Associate (OTCA) Coverage Matrix

| Domain # | Domain Name | Official Weight | Target Questions | Mapped Modules | Mapped Test Suites | Status |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **OTCA-1** | The OpenTelemetry API and SDK | 46% | 30 | [`modules/02-opentelemetry-model-and-propagation.md`](../modules/02-opentelemetry-model-and-propagation.md), [`modules/03-instrumentation-nodejs-and-python.md`](../modules/03-instrumentation-nodejs-and-python.md) | `examples/ts/02-opentelemetry-model-and-propagation.test.ts`, `examples/ts/03-instrumentation-nodejs-and-python.test.ts` | ✅ Full |
| **OTCA-2** | The OpenTelemetry Collector | 26% | 17 | [`modules/04-opentelemetry-collector-and-alloy.md`](../modules/04-opentelemetry-collector-and-alloy.md) | `examples/ts/04-opentelemetry-collector-and-alloy.test.ts` | ✅ Full |
| **OTCA-3** | Fundamentals of Observability | 18% | 12 | [`modules/01-observability-foundations-and-signals.md`](../modules/01-observability-foundations-and-signals.md) | `examples/ts/01-observability-foundations-and-signals.test.ts` | ✅ Full |
| **OTCA-4** | Maintaining and Debugging Observability Pipelines | 10% | 6 | [`modules/13-production-observability-cost-and-meta-monitoring.md`](../modules/13-production-observability-cost-and-meta-monitoring.md) | `examples/ts/13-production-observability-cost-and-meta-monitoring.test.ts` | ✅ Full |

---

## 3. Exam Deltas & Version Notes

- **Prometheus 3.x vs 2.x**: Prometheus 3.15.1 introduces native UTF-8 metric and label names, built-in OTLP ingestion receiver, and native exponential histograms (`histogram_quantile` over native histograms). Exam questions reflect Prometheus 3.x features.
- **Promtail EOL**: Promtail reached End-of-Life in March 2026. Grafana Alloy (`alloy`) is now the standard log collection agent for Loki.
- **Grafana 13**: Grafana 13.3.0 features GA Git Sync, new dynamic dashboard schemas, and deprecation of legacy `/api` endpoints in favor of `/apis`.
