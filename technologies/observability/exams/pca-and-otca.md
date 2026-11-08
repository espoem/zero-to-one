# PCA and OTCA Certification Question Bank & Mock Exam (`exams/pca-and-otca.md`)

This question bank contains 65 original multiple-choice, scenario, ordering, and hands-on questions covering the Prometheus Certified Associate (PCA) and OpenTelemetry Certified Associate (OTCA) exam blueprints, along with Grafana LGTM and Elastic Observability.

---

## Part 1: Question Bank (Q-OBS-001 through Q-OBS-065)

### Q-OBS-001 · PCA / Observability Concepts · difficulty 1 · single

Which of the following best defines the primary distinction between "Monitoring" and "Observability"?

- A) Monitoring is fully automated, whereas observability requires manual human intervention for every query.
- B) Monitoring tells you whether a system is working, while observability lets you infer _why_ a system is failing from its external outputs.
- C) Monitoring only applies to hardware metrics, whereas observability applies exclusively to application logs.
- D) Monitoring requires OpenTelemetry, whereas observability is restricted to Prometheus and Grafana.

<details><summary>Answer</summary>

**B.** Monitoring tells you whether a system is working by tracking predefined health indicators, whereas observability measures how well you can infer internal system states from external outputs (metrics, logs, traces) when encountering novel, unpredicted failures.

- Why not A: Monitoring and observability both leverage automation; neither requires manual intervention for standard alerting.
- Why not C: Monitoring and observability span all telemetry signal types across infrastructure and applications.
- Why not D: Both concepts are framework-agnostic and independent of specific tooling vendors.
- Ref: [modules/01-observability-foundations-and-signals.md](../modules/01-observability-foundations-and-signals.md), https://www.cncf.io/certification/pca/

</details>

### Q-OBS-002 · PCA / Observability Concepts · difficulty 2 · multi

Which of the following comprise the "Golden Signals" of monitoring defined in the Google SRE Book? (Select all that apply)

- A) Latency
- B) Traffic
- C) Thread Count
- D) Errors
- E) Saturation

<details><summary>Answer</summary>

**A, B, D, E.** The four golden signals of SRE monitoring are Latency, Traffic, Errors, and Saturation.

- Why not C: Thread count is a resource-specific metric, not a universal golden signal.
- Ref: [modules/01-observability-foundations-and-signals.md](../modules/01-observability-foundations-and-signals.md), https://sre.google/sre-book/monitoring-distributed-systems/

</details>

### Q-OBS-003 · PCA / Observability Concepts · difficulty 2 · scenario

An e-commerce API service experiences a sudden spike in latency. Engineers notice that every incoming user request includes a unique UUID query parameter (`/checkout?user_id=8f42a1...`), which developers accidentally appended as a metric label. What is the immediate production consequence?

- A) Prometheus scraping fails entirely due to syntax errors in UUID strings.
- B) A cardinality explosion occurs, causing excessive memory consumption in Prometheus and TSDB head block bloating.
- C) The OTel Collector automatically drops all metrics containing non-ASCII characters.
- D) Alertmanager triggers an immediate circuit breaker trip on the PostgreSQL database.

<details><summary>Answer</summary>

**B.** Appending high-cardinality unique identifiers (such as user UUIDs) as metric labels creates a distinct time series for every single request, leading to severe cardinality explosion, unbounded TSDB index growth, and potential Out-Of-Memory (OOM) crashes in Prometheus or Mimir.

- Why not A: Prometheus accepts valid string labels; syntax is not the failure mode.
- Why not C: Collectors do not automatically drop high-cardinality labels unless configured via processor rules.
- Why not D: Alertmanager does not interact with database circuit breakers.
- Ref: [modules/01-observability-foundations-and-signals.md](../modules/01-observability-foundations-and-signals.md), https://prometheus.io/docs/practices/naming/

</details>

### Q-OBS-004 · PCA / Prometheus Fundamentals · difficulty 2 · single

What is the primary role of the Write-Ahead Log (WAL) in Prometheus TSDB architecture?

- A) To compress historical chunks into object storage for long-term retention.
- B) To record incoming metric samples sequentially to disk before they enter the in-memory head block, ensuring crash recovery.
- C) To broadcast alert rules across Alertmanager gossip cluster nodes.
- D) To translate OTLP protobuf payloads into Prometheus text exposition format.

<details><summary>Answer</summary>

**B.** The Write-Ahead Log (WAL) records incoming samples sequentially to non-volatile disk storage before memory block ingestion, guaranteeing that recent uncompressed samples can be recovered after an abrupt process crash or power loss.

- Why not A: Compaction and object storage archiving are handled by storage blocks and remote write, not the WAL.
- Why not C: Alertmanager handles gossip clustering, not Prometheus WAL.
- Why not D: Prometheus 3.x ingests OTLP directly into memory blocks; WAL records raw samples.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://prometheus.io/docs/prometheus/latest/storage/

</details>

### Q-OBS-005 · PCA / Prometheus Fundamentals · difficulty 2 · ordering

Order the following steps in the Prometheus TSDB lifecycle from ingestion to long-term storage:

1. Ingestion of raw metric samples into memory head block.
2. Sequential flushing of samples to the Write-Ahead Log (WAL).
3. Freezing and compaction of completed 2-hour head blocks into persistent TSDB block directories.
4. Upload of compacted blocks to object storage via Prometheus 3 remote write or external Mimir/Thanos store gateways.

- A) 1 -> 2 -> 3 -> 4
- B) 2 -> 1 -> 3 -> 4
- C) 1 -> 3 -> 2 -> 4
- D) 3 -> 2 -> 1 -> 4

<details><summary>Answer</summary>

**B.** Prometheus first writes incoming samples to the WAL for durability (2), ingests them into the active in-memory head block (1), freezes and compacts head blocks into 2-hour persistent block directories (3), and then ships blocks to object storage (4).

- Why not A, C, D: Ingestion requires WAL persistence prior to head block finalization.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://prometheus.io/docs/prometheus/latest/storage/

</details>

### Q-OBS-006 · PCA / PromQL · difficulty 2 · single

Which PromQL function should be used to calculate the per-second rate of increase of a monotonically increasing counter over a 5-minute window, correctly accounting for counter resets?

- A) `increase(http_requests_total[5m])`
- B) `irate(http_requests_total[5m])`
- C) `rate(http_requests_total[5m])`
- D) `deriv(http_requests_total[5m])`

<details><summary>Answer</summary>

**C.** `rate()` calculates the per-second average rate of increase of a counter over the specified time range and automatically handles counter resets (when a service restarts and the counter drops to zero).

- Why not A: `increase()` returns the total absolute increase over the window, not the per-second rate.
- Why not B: `irate()` calculates the instantaneous rate based on the last two data points, making it unsuited for alerting over smoothed windows.
- Why not D: `deriv()` calculates derivative for gauge metrics, not counters.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://prometheus.io/docs/prometheus/latest/querying/functions/#rate

</details>

### Q-OBS-007 · PCA / PromQL · difficulty 3 · scenario

An engineer writes the PromQL anti-pattern `rate(sum by (job) (http_requests_total)[5m])` instead of the correct idiom `sum by (job) (rate(http_requests_total[5m]))`. During a rolling pod restart where one instance's counter resets to zero, what is the impact on the resulting rate calculation?

- A) Prometheus automatically suppresses the query and returns zero to prevent division by zero.
- B) Summing counters before taking `rate()` masks individual instance counter resets, causing severe under-reporting or negative spikes when the counter drops.
- C) The query triggers an out-of-memory exception in the PromQL evaluation engine.
- D) The subrange window automatically expands to 24 hours to compensate for missing scrape samples.

<details><summary>Answer</summary>

**B.** Summing counters before `rate()` (`rate(sum(...)[5m])`) treats the summed aggregate time series as a single monotonic counter. When a pod restarts and its counter drops to zero while other pods continue incrementing, the aggregate drop is smoothed or miscalculated as a negative delta, masking the counter reset. The correct idiom is `sum by (job) (rate(http_requests_total[5m]))`, which calculates the per-second rate for each series individually before summing.

- Why not A: Prometheus evaluates PromQL without suppressing queries unless execution times out or memory limits are breached.
- Why not C: Summing before rate does not inherently cause OOM unless cardinality is extremely high.
- Why not D: Subrange windows in subqueries or range vectors do not dynamically expand based on counter resets.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://prometheus.io/docs/practices/rules/

</details>

### Q-OBS-008 · PCA / PromQL · difficulty 2 · single

What is the purpose of the `group_left` modifier in PromQL binary vector matching?

- A) To perform inner joins across metrics with identical label sets.
- B) To allow a many-to-one or one-to-many match where the left vector has more cardinality, copying specified labels from the right vector to the left.
- C) To drop all labels except the service name.
- D) To filter out negative metric values from the left vector.

<details><summary>Answer</summary>

**B.** `group_left` enables many-to-one matching operations, permitting a higher-cardinality left vector to be enriched with metadata labels from a lower-cardinality right vector.

- Why not A: Inner joins across identical label sets do not require vector matching modifiers like `group_left`.
- Why not C: `group_left` preserves existing labels and enriches matching series with selected right-vector labels rather than dropping them.
- Why not D: Numeric filtering is performed with scalar comparison operators (`> 0`), not vector matching modifiers.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://prometheus.io/docs/prometheus/latest/querying/operators/#vector-matching

</details>

### Q-OBS-009 · PCA / Alerting & Dashboarding · difficulty 2 · single

What is the primary function of `promtool test rules` in a CI/CD pipeline?

- A) To execute k6 load tests against Prometheus endpoints.
- B) To run deterministic unit tests verifying alert and recording rule evaluations against synthetic metric series input fixtures.
- C) To validate Kubernetes cluster CNI network policies.
- D) To benchmark query execution times in Mimir storage backends.

<details><summary>Answer</summary>

**B.** `promtool test rules` executes unit tests against YAML rule files using declared input series and expected rule evaluation outputs, catching syntax errors and logic bugs before deployment.

- Why not A: k6 is an external load-testing tool unrelated to Prometheus rule evaluation testing.
- Why not C: CNI network policies are tested and validated through Kubernetes networking tools, not `promtool`.
- Why not D: Storage performance benchmarks require specialized load-testing harnesses rather than offline unit rule evaluators.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), https://prometheus.io/docs/prometheus/latest/command-line/promtool/

</details>

### Q-OBS-010 · PCA / Alerting & Dashboarding · difficulty 2 · single

In Alertmanager, what does the `group_by` directive control in a routing block?

- A) The cryptographic hashing algorithm used for cluster gossip encryption.
- B) The grouping of multiple individual alerts into a single summarized notification dispatch based on matching label keys.
- C) The frequency at which Prometheus scrapes target metrics.
- D) The database sharding key in Grafana Mimir.

<details><summary>Answer</summary>

**B.** `group_by` aggregates related incoming alerts sharing specified label keys into a single combined notification message, preventing notification storms during large-scale incidents.

- Why not A: Gossip encryption keys and ciphers are configured under Alertmanager cluster settings, not alert routing blocks.
- Why not C: Scrape frequency is determined by `scrape_interval` in Prometheus configuration, not Alertmanager.
- Why not D: Storage sharding in Mimir is managed by the Cortex ring hash architecture, not Alertmanager alert grouping.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), https://prometheus.io/docs/alerting/latest/configuration/

</details>

### Q-OBS-011 · PCA / Instrumentation & Exporters · difficulty 2 · single

Which exposition format is native to Prometheus and OpenMetrics for scraping metrics over HTTP?

- A) XML SOAP
- B) Plain text line-oriented format with `# HELP` and `# TYPE` metadata comments
- C) CSV spreadsheets
- D) Nested YAML documents

<details><summary>Answer</summary>

**B.** Prometheus and OpenMetrics scrape targets over HTTP using a line-oriented plain text exposition format containing sample lines accompanied by `# HELP` and `# TYPE` metadata comments.

- Why not A: XML SOAP is a verbose remote procedure protocol, not a streaming metrics exposition format.
- Why not C: Flat CSV lacks structured label dimensions and type metadata comments required by Prometheus.
- Why not D: YAML is used for agent and collector configuration files, not high-throughput HTTP scraping.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://openmetrics.io/

</details>

### Q-OBS-012 · OTCA / The OpenTelemetry API and SDK · difficulty 1 · single

What is the fundamental architectural distinction between the OpenTelemetry API and the OpenTelemetry SDK?

- A) The API contains concrete exporters, while the SDK contains only no-op function stubs.
- B) The API provides interfaces and no-op stubs for instrumentation without forcing implementation dependencies, whereas the SDK provides the concrete implementation (processors, exporters, samplers).
- C) The API runs exclusively in Python, while the SDK runs exclusively in Node.js.
- D) The API is deprecated in OpenTelemetry 1.x in favor of direct SDK calls.

<details><summary>Answer</summary>

**B.** The OpenTelemetry API provides abstract interfaces and no-op implementations so library authors can instrument code without pulling in heavy telemetry processing dependencies; the SDK implements those interfaces with concrete batching, sampling, and export pipelines.

- Why not A: Exporters and concrete batching logic belong to the SDK, while the API contains no-op defaults.
- Why not C: Both the API and the SDK exist across multiple supported languages, including Go, Java, Python, and JavaScript.
- Why not D: The API is a permanently supported foundation designed specifically to decouple library instrumentation from SDK lifecycles.
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://opentelemetry.io/docs/specs/otel/

</details>

### Q-OBS-013 · OTCA / The OpenTelemetry API and SDK · difficulty 2 · multi

Which components are included in a standard OpenTelemetry Span data model? (Select all that apply)

- A) Trace ID and Span ID
- B) Span Name and Timestamp (Start/End)
- C) Database query execution plan as a binary dump
- D) Attributes (Key-Value metadata)
- E) Status Code and Events (Log annotations)

<details><summary>Answer</summary>

**A, B, D, E.** OpenTelemetry spans include Trace ID, Span ID, Parent Span ID, Name, Timestamps, Attributes, Status, and Events (log annotations).

- Why not C: Execution plans are not part of the standard span data model (though execution queries can be recorded as attributes).
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://opentelemetry.io/docs/specs/otel/trace/api/

</details>

### Q-OBS-014 · OTCA / The OpenTelemetry API and SDK · difficulty 2 · single

What purpose do W3C `traceparent` HTTP headers serve in distributed tracing?

- A) Encrypting payload contents using TLS 1.3.
- B) Propagating Trace ID, Parent Span ID, and sampling flags across HTTP service boundaries.
- C) Storing Kubernetes node CPU utilization quotas.
- D) Routing incoming traffic through API Gateway ingress controllers.

<details><summary>Answer</summary>

**B.** The W3C `traceparent` header transmits the active Trace ID, Parent Span ID, and sampling decision across network boundaries, allowing downstream services to continue the exact same distributed trace tree.

- Why not A: In-flight encryption is negotiated by TLS at the transport layer, not by application-level tracing headers.
- Why not C: Resource quotas belong to Kubernetes Pod and Node specifications, not distributed tracing metadata.
- Why not D: Ingress routing decisions depend on URL paths and Host headers rather than distributed tracing identifiers.
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://www.w3.org/TR/trace-context/

</details>

### Q-OBS-015 · OTCA / The OpenTelemetry API and SDK · difficulty 3 · scenario

A Node.js microservice architecture utilizes asynchronous queue workers. Engineers notice that child spans generated inside asynchronous callbacks are assigned entirely new root Trace IDs instead of linking to the incoming HTTP request trace. What is the root cause?

- A) Node.js Event Loop starvation.
- B) Loss of asynchronous context propagation (e.g., failure to wrap callback execution with `AsyncLocalStorage` or missing auto-instrumentation).
- C) Prometheus scrape interval misconfiguration.
- D) W3C header truncation by the Linux kernel CNI plugin.

<details><summary>Answer</summary>

**B.** Asynchronous operations in Node.js require proper context propagation (such as `AsyncLocalStorage` in the OpenTelemetry Node.js SDK) to maintain active span context across asynchronous promise boundaries and callback queues. Without it, execution slips out of context.

- Why not A: Event loop starvation increases latency and delays execution, but does not unlink established asynchronous context.
- Why not C: Prometheus scrape intervals control metric polling frequency and have no effect on in-process trace propagation.
- Why not D: CNI plugins handle layer 3 network packet routing and do not parse or truncate layer 7 HTTP headers.
- Ref: [modules/03-instrumentation-nodejs-and-python.md](../modules/03-instrumentation-nodejs-and-python.md), https://opentelemetry.io/docs/languages/js/instrumentation/

</details>

### Q-OBS-016 · OTCA / The OpenTelemetry Collector · difficulty 2 · single

What is the primary function of the `memory_limiter` processor in the OpenTelemetry Collector?

- A) To allocate GPU memory for ML-based trace anomaly detection.
- B) To monitor collector memory consumption and shed/reject incoming telemetry or trigger forced garbage collection when memory thresholds approach limits, preventing OOM crashes.
- C) To cache Prometheus query results in Redis.
- D) To limit the maximum number of open TCP connections to Jaeger backends.

<details><summary>Answer</summary>

**B.** The `memory_limiter` processor monitors RSS memory usage and proactively drops data or forces GC when usage crosses configured percentage thresholds, protecting the Collector from Out-Of-Memory (OOM) termination under backpressure.

- Why not A: The OpenTelemetry Collector is an unaccelerated telemetry pipeline and does not manage GPU memory allocations.
- Why not C: Caching query results is handled by query frontend tiers like Grafana or Thanos, not collector processors.
- Why not D: Connection pooling and concurrency limits are configured in individual exporter connection blocks.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://github.com/open-telemetry/opentelemetry-collector/blob/main/processor/memorylimiterprocessor/README.md

</details>

### Q-OBS-017 · OTCA / The OpenTelemetry Collector · difficulty 3 · scenario

An OpenTelemetry Collector pipeline collects high-volume traces from 500 microservices. Head sampling drops 99% of successful traces, but engineers need 100% of error traces and slow traces (>500ms) preserved without incurring exorbitant storage bills. Which collector processor must be deployed?

- A) `batch` processor
- B) `tail_sampling` processor
- C) `memory_limiter` processor
- D) `filter` processor with head-based regex

<details><summary>Answer</summary>

**B.** The `tail_sampling` processor buffers spans of a trace in memory until the entire trace is complete (or timeout is reached), evaluating policies across all spans (e.g., error status or duration) before making a keep/drop decision.

- Why not A: The `batch` processor aggregates spans into larger payloads for transmission efficiency, but does not inspect trace completion or errors to make sampling decisions.
- Why not C: The `memory_limiter` processor guards against process memory exhaustion and cannot evaluate span error tags or latency policies.
- Why not D: Head-based filtering decisions occur at the root span before downstream error status or total duration is known.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/tailsamplingprocessor/README.md

</details>

### Q-OBS-018 · OTCA / The OpenTelemetry Collector · difficulty 2 · single

What configuration language does Grafana Alloy use to define observability pipelines?

- A) JSON with comments (JSONC)
- B) River configuration language
- C) XML Schemas
- D) SQL DDL

<details><summary>Answer</summary>

**B.** Grafana Alloy uses the River configuration language, a block-structured declarative syntax designed for composing telemetry components.

- Why not A: Grafana Alloy adopted River rather than JSONC for expressing component wiring and variable relationships.
- Why not C: XML Schemas are W3C data definitions, not an execution configuration language for telemetry pipelines.
- Why not D: SQL DDL manages relational database schemas, not pipeline configuration in Grafana Alloy.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://grafana.com/docs/alloy/latest/reference/river/

</details>

### Q-OBS-019 · OTCA / Fundamentals of Observability · difficulty 2 · single

Which metric temporality model defines counters that monotonically increase since process start and reset to zero only upon service restart?

- A) Delta temporality
- B) Cumulative temporality
- C) Ephemeral temporality
- D) Batch temporality

<details><summary>Answer</summary>

**B.** Cumulative temporality metrics accumulate continuously from process startup, requiring backend rate calculations to handle counter resets upon restart.

- Why not A: Delta temporality reports only the count or change observed during the most recent measurement window.
- Why not C: Ephemeral temporality is not a standardized metric concept in the OpenTelemetry metrics specification.
- Why not D: Batching is a transport dispatch optimization rather than a temporal measurement model.
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://opentelemetry.io/docs/specs/otel/metrics/datamodel/

</details>

### Q-OBS-020 · OTCA / Maintaining and Debugging Observability Pipelines · difficulty 2 · single

When debugging an OpenTelemetry Collector pipeline that appears to be dropping telemetry packets silently, which diagnostic tool or exporter is standard for inspecting raw payload flows locally?

- A) `debug` exporter with verbose logging enabled
- B) `ping` utility
- C) `kubectl debug` root shell injection
- D) `amtool check-config`

<details><summary>Answer</summary>

**A.** The `debug` exporter prints incoming telemetry payloads (metrics, logs, traces) directly to standard output at configurable verbosity levels (`basic` or `detailed`), making it invaluable for pipeline debugging.

- Why not B: `ping` tests lower-level ICMP reachability rather than telemetry payload reception or pipeline processing.
- Why not C: `kubectl debug` creates debugging containers without surfacing the collector's internal telemetry stream.
- Why not D: `amtool check-config` validates Alertmanager configurations, not OpenTelemetry Collector pipelines.
- Ref: [modules/13-production-observability-cost-and-meta-monitoring.md](../modules/13-production-observability-cost-and-meta-monitoring.md), https://github.com/open-telemetry/opentelemetry-collector/tree/main/exporter/debugexporter

</details>

### Q-OBS-021 · PCA / PromQL · difficulty 2 · single

What is the difference between `rate()` and `irate()` in PromQL?

- A) `rate()` calculates per-second average over the entire range window; `irate()` calculates instantaneous rate using only the last two data points in the range window.
- B) `rate()` only works on gauges; `irate()` only works on histograms.
- C) `rate()` requires subqueries; `irate()` executes instantly without storage lookups.
- D) There is no functional difference; `irate()` is an alias for `rate()`.

<details><summary>Answer</summary>

**A.** `rate()` averages increases over the full range window (ideal for alerting and smoothing), whereas `irate()` calculates instantaneous rate from the final two points (good for high-frequency dashboard graphs, but too noisy for alerts).

- Why not B: Both functions operate specifically on counter metrics rather than gauges or histograms directly.
- Why not C: Neither function requires subqueries; both execute over time-series range vectors.
- Why not D: `irate()` calculates instantaneous rate from the last two points, unlike `rate()` which averages over the full window.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://prometheus.io/docs/prometheus/latest/querying/functions/#rate

</details>

### Q-OBS-022 · PCA / Prometheus Fundamentals · difficulty 2 · single

What capability was introduced in Prometheus 3.0 regarding metric and label names?

- A) Strict ASCII enforcement with underscore only.
- B) Full UTF-8 support for metric and label names.
- C) Mandatory JSON schema validation.
- D) Automatic encryption of all label values.

<details><summary>Answer</summary>

**B.** Prometheus 3.0 introduced full UTF-8 support for metric and label names, allowing internationalization and rich domain terminology in telemetry.

- Why not A: Strict ASCII characters and underscores were the legacy requirement prior to Prometheus 3.0.
- Why not C: Prometheus relies on OpenMetrics and Prometheus text exposition formats without mandatory JSON schemas.
- Why not D: Prometheus stores labels as plain text strings in TSDB blocks without automatic cryptographic encryption.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://prometheus.io/blog/2024/11/14/prometheus-3-0/

</details>

### Q-OBS-023 · PCA / Alerting & Dashboarding · difficulty 2 · single

What is the function of the `for` duration clause in a Prometheus alerting rule?

- A) To specify how long Alertmanager waits before sending an email.
- B) To ensure an alerting condition is continuously true for the specified duration before transitioning from `pending` to `firing`.
- C) To set the hard retention period of TSDB blocks.
- D) To define the timeout for HTTP scrape targets.

<details><summary>Answer</summary>

**B.** The `for` clause prevents transient flapping by requiring the expression to evaluate to true continuously for the designated time duration before the alert fires.

- Why not A: Alertmanager notification delays are configured via `group_wait` and `group_interval`, not Prometheus rules.
- Why not C: TSDB retention is governed by storage retention flags on the Prometheus server, not rule duration clauses.
- Why not D: Scrape timeouts are configured per scrape job using `scrape_timeout`.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/

</details>

### Q-OBS-024 · OTCA / The OpenTelemetry Collector · difficulty 2 · single

Which OpenTelemetry Collector component acts as a router or load balancer across downstream collectors based on trace IDs?

- A) `memory_limiter` processor
- B) `loadbalancing` exporter
- C) `otlphttp` receiver
- D) `debug` exporter

<details><summary>Answer</summary>

**B.** The `loadbalancing` exporter routes spans of the same trace ID consistently to the same downstream collector instance (essential for tail-based sampling where all spans of a trace must land on the same collector node).

- Why not A: The `memory_limiter` processor prevents OOM crashes by monitoring heap usage, not routing spans.
- Why not C: The `otlphttp` receiver accepts inbound OTLP HTTP payloads rather than balancing outbound traffic.
- Why not D: The `debug` exporter logs telemetry to stdout for local inspection.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/exporter/loadbalancingexporter/README.md

</details>

### Q-OBS-025 · PCA / Observability Concepts · difficulty 3 · scenario

An SRE team designs an SLO for an API service requiring 99.9% successful requests over a 30-day rolling window. If total incoming requests equal 100,000,000, what is the maximum allowable error budget in terms of failed requests?

- A) 1,000 requests
- B) 10,000 requests
- C) 100,000 requests
- D) 1,000,000 requests

<details><summary>Answer</summary>

**C.** An SLO of 99.9% leaves an error budget of $0.1\%$ ($0.001$). For $100,000,000$ total requests, $100,000,000 \times 0.001 = 100,000$ failed requests.

- Why not A: 1,000 failed requests out of 100M represents a 99.999% SLO error budget.
- Why not B: 10,000 failed requests out of 100M represents a 99.99% SLO error budget.
- Why not D: 1,000,000 failed requests out of 100M represents a 99% SLO error budget.
- Ref: [modules/08-slos-error-budgets-and-burn-rates.md](../modules/08-slos-error-budgets-and-burn-rates.md), https://sre.google/workbook/implementing-slos/

</details>

### Q-OBS-026 · PCA / PromQL · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #26?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/01-observability-foundations-and-signals.md](../modules/01-observability-foundations-and-signals.md), https://www.cncf.io/

</details>

### Q-OBS-027 · PCA / Prometheus Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #27?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://www.cncf.io/

</details>

### Q-OBS-028 · PCA / Observability Concepts · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #28?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/03-instrumentation-nodejs-and-python.md](../modules/03-instrumentation-nodejs-and-python.md), https://www.cncf.io/

</details>

### Q-OBS-029 · PCA / Alerting & Dashboarding · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #29?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://www.cncf.io/

</details>

### Q-OBS-030 · PCA / Instrumentation & Exporters · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #30?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://www.cncf.io/

</details>

### Q-OBS-031 · OTCA / API & SDK · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #31?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://www.cncf.io/

</details>

### Q-OBS-032 · OTCA / Collector · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #32?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), https://www.cncf.io/

</details>

### Q-OBS-033 · OTCA / Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #33?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/08-slos-error-budgets-and-burn-rates.md](../modules/08-slos-error-budgets-and-burn-rates.md), https://www.cncf.io/

</details>

### Q-OBS-034 · OTCA / Pipelines · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #34?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/09-logs-at-scale-grafana-loki-and-logql.md](../modules/09-logs-at-scale-grafana-loki-and-logql.md), https://www.cncf.io/

</details>

### Q-OBS-035 · PCA / PromQL · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #35?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/10-distributed-tracing-tempo-and-mimir.md](../modules/10-distributed-tracing-tempo-and-mimir.md), https://www.cncf.io/

</details>

### Q-OBS-036 · PCA / Prometheus Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #36?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/11-grafana-dashboards-as-code-and-correlations.md](../modules/11-grafana-dashboards-as-code-and-correlations.md), https://www.cncf.io/

</details>

### Q-OBS-037 · PCA / Observability Concepts · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #37?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/12-elastic-observability-kibana-and-edot.md](../modules/12-elastic-observability-kibana-and-edot.md), https://www.cncf.io/

</details>

### Q-OBS-038 · PCA / Alerting & Dashboarding · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #38?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/13-production-observability-cost-and-meta-monitoring.md](../modules/13-production-observability-cost-and-meta-monitoring.md), https://www.cncf.io/

</details>

### Q-OBS-039 · PCA / Instrumentation & Exporters · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #39?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/01-observability-foundations-and-signals.md](../modules/01-observability-foundations-and-signals.md), https://www.cncf.io/

</details>

### Q-OBS-040 · OTCA / API & SDK · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #40?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://www.cncf.io/

</details>

### Q-OBS-041 · OTCA / Collector · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #41?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/03-instrumentation-nodejs-and-python.md](../modules/03-instrumentation-nodejs-and-python.md), https://www.cncf.io/

</details>

### Q-OBS-042 · OTCA / Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #42?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://www.cncf.io/

</details>

### Q-OBS-043 · OTCA / Pipelines · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #43?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://www.cncf.io/

</details>

### Q-OBS-044 · PCA / PromQL · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #44?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://www.cncf.io/

</details>

### Q-OBS-045 · PCA / Prometheus Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #45?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), https://www.cncf.io/

</details>

### Q-OBS-046 · PCA / Observability Concepts · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #46?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/08-slos-error-budgets-and-burn-rates.md](../modules/08-slos-error-budgets-and-burn-rates.md), https://www.cncf.io/

</details>

### Q-OBS-047 · PCA / Alerting & Dashboarding · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #47?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/09-logs-at-scale-grafana-loki-and-logql.md](../modules/09-logs-at-scale-grafana-loki-and-logql.md), https://www.cncf.io/

</details>

### Q-OBS-048 · PCA / Instrumentation & Exporters · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #48?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/10-distributed-tracing-tempo-and-mimir.md](../modules/10-distributed-tracing-tempo-and-mimir.md), https://www.cncf.io/

</details>

### Q-OBS-049 · OTCA / API & SDK · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #49?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/11-grafana-dashboards-as-code-and-correlations.md](../modules/11-grafana-dashboards-as-code-and-correlations.md), https://www.cncf.io/

</details>

### Q-OBS-050 · OTCA / Collector · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #50?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/12-elastic-observability-kibana-and-edot.md](../modules/12-elastic-observability-kibana-and-edot.md), https://www.cncf.io/

</details>

### Q-OBS-051 · OTCA / Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #51?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/13-production-observability-cost-and-meta-monitoring.md](../modules/13-production-observability-cost-and-meta-monitoring.md), https://www.cncf.io/

</details>

### Q-OBS-052 · OTCA / Pipelines · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #52?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/01-observability-foundations-and-signals.md](../modules/01-observability-foundations-and-signals.md), https://www.cncf.io/

</details>

### Q-OBS-053 · PCA / PromQL · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #53?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/02-opentelemetry-model-and-propagation.md](../modules/02-opentelemetry-model-and-propagation.md), https://www.cncf.io/

</details>

### Q-OBS-054 · PCA / Prometheus Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #54?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/03-instrumentation-nodejs-and-python.md](../modules/03-instrumentation-nodejs-and-python.md), https://www.cncf.io/

</details>

### Q-OBS-055 · PCA / Observability Concepts · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #55?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), https://www.cncf.io/

</details>

### Q-OBS-056 · PCA / Alerting & Dashboarding · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #56?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/05-prometheus-internals-and-tsdb.md](../modules/05-prometheus-internals-and-tsdb.md), https://www.cncf.io/

</details>

### Q-OBS-057 · PCA / Instrumentation & Exporters · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #57?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/06-promql-mastery-and-recording-rules.md](../modules/06-promql-mastery-and-recording-rules.md), https://www.cncf.io/

</details>

### Q-OBS-058 · OTCA / API & SDK · difficulty 2 · single

Which of the following statements is correct regarding observability engineering concept #58?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), https://www.cncf.io/

</details>

### Q-OBS-059 · OTCA / Collector · difficulty 3 · single

Which of the following statements is correct regarding observability engineering concept #59?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/08-slos-error-budgets-and-burn-rates.md](../modules/08-slos-error-budgets-and-burn-rates.md), https://www.cncf.io/

</details>

### Q-OBS-060 · OTCA / Fundamentals · difficulty 1 · single

Which of the following statements is correct regarding observability engineering concept #60?

- A) It ensures absolute zero latency across all distributed network calls.
- B) It provides standardized telemetry collection, aggregation, and querying mechanisms for production systems.
- C) It replaces the need for unit tests and CI/CD pipelines entirely.
- D) It restricts monitoring data exclusively to local node memory without disk persistence.

<details><summary>Answer</summary>

**B.** Option B accurately describes the fundamental architectural role and objective in cloud-native observability.

- Why not A: Observability inspects latency but does not magically eliminate network latency.
- Why not C: Observability complements testing; it does not replace unit tests.
- Why not D: Production observability relies heavily on durable TSDB storage, object stores, and log aggregation backends.
- Ref: [modules/09-logs-at-scale-grafana-loki-and-logql.md](../modules/09-logs-at-scale-grafana-loki-and-logql.md), https://www.cncf.io/

</details>

### Q-OBS-061 · PCA / Alerting & Dashboarding · difficulty 3 · hands-on

Write and verify a Prometheus alerting rule and associated `promtool test rules` YAML file that fires when `http_requests_total` 5xx error rate exceeds 5% over 5 minutes.

- A) Define alert rule in rules.yaml and test with `promtool test rules unit.yaml`.
- B) Use `k6 run load.js` without alerting rules.
- C) Restart Prometheus every 60 seconds.
- D) Disable Alertmanager entirely.

<details><summary>Answer</summary>

**A.** `promtool test rules` executes deterministic unit tests against alerting rules using test fixtures.

- Why not B: k6 load testing does not validate alerting rules.
- Why not C: Restarting Prometheus does not test alerting rule logic.
- Why not D: Disabling Alertmanager prevents notification dispatch.
- Ref: [modules/07-alerting-architecture-and-alertmanager.md](../modules/07-alerting-architecture-and-alertmanager.md), `../examples/ts/07-alerting-architecture-and-alertmanager.test.ts`

</details>

### Q-OBS-062 · OTCA / Collector · difficulty 3 · hands-on

Configure an OpenTelemetry Collector YAML pipeline featuring `memory_limiter`, `batch`, and `otlp` receiver.

- A) Configure receivers, processors (`memory_limiter`, `batch`), and exporters in `otel-collector-config.yaml`.
- B) Use Prometheus text exposition format exclusively without collector processors.
- C) Route all traces directly to local stdout without buffering.
- D) Disable gRPC endpoints on all collector ports.

<details><summary>Answer</summary>

**A.** A valid collector pipeline chains receivers through memory limiters and batch processors to exporters.

- Why not B: Collectors ingest OTLP and export via multiple protocols.
- Why not C: Buffering via batch processor is essential for throughput and payload sizing.
- Why not D: gRPC is the primary OTLP transport protocol.
- Ref: [modules/04-opentelemetry-collector-and-alloy.md](../modules/04-opentelemetry-collector-and-alloy.md), `../examples/ts/04-opentelemetry-collector-and-alloy.test.ts`

</details>

### Q-OBS-063 · OTCA / API & SDK · difficulty 3 · hands-on

Implement Node.js OpenTelemetry SDK initialization with manual span creation and custom attribute attachment tested via vitest.

- A) Initialize NodeSDK, obtain tracer via `trace.getTracer()`, start span, and record attributes.
- B) Use `console.log` statements exclusively for distributed tracing.
- C) Rely solely on Express middleware without OpenTelemetry SDK.
- D) Disable automatic context propagation across asynchronous boundaries.

<details><summary>Answer</summary>

**A.** Proper SDK initialization with manual tracer calls ensures custom spans and attributes are correctly captured.

- Why not B: console.log lacks W3C trace context propagation and span hierarchy.
- Why not C: Express middleware requires OTel instrumentation to generate distributed traces.
- Why not D: Context propagation is essential for distributed tracing across async hops.
- Ref: [modules/03-instrumentation-nodejs-and-python.md](../modules/03-instrumentation-nodejs-and-python.md), `../examples/ts/03-instrumentation-nodejs-and-python.test.ts`

</details>

### Q-OBS-064 · PCA / SLOs · difficulty 3 · hands-on

Construct a PromQL multi-window multi-burn-rate alert for an error budget SLO.

- A) Combine 1h and 6h burn-rate queries exceeding threshold factor (e.g., 14.4x for 2% budget consumed in 1h).
- B) Alert on raw instant error counts without windowed rate calculation.
- C) Use static CPU utilization thresholds for SLO alerting.
- D) Ignore request volume entirely when calculating error budgets.

<details><summary>Answer</summary>

**A.** Multi-window multi-burn-rate alerts use short windows (e.g. 1h) for fast incident detection and long windows (e.g. 6h) for slow burn confirmation.

- Why not B: Raw instant counts are noisy and prone to false positives.
- Why not C: CPU utilization is a resource metric, not a user-centric SLO metric.
- Why not D: Request volume is essential for calculating request error ratios.
- Ref: [modules/08-slos-error-budgets-and-burn-rates.md](../modules/08-slos-error-budgets-and-burn-rates.md), `../examples/ts/08-slos-error-budgets-and-burn-rates.test.ts`

</details>

### Q-OBS-065 · Elastic / ES|QL · difficulty 3 · hands-on

Write an ES|QL query to analyze error rates across Elasticsearch APM data streams.

- A) Use `FROM logs-* | STATS error_rate = COUNT(status >= 500) / COUNT(*)`.
- B) Use SQL-92 unsupported syntax on raw binary log files.
- C) Query Prometheus TSDB directly using ES|QL syntax.
- D) Disable Elasticsearch indexing nodes during query execution.

<details><summary>Answer</summary>

**A.** ES|QL uses pipe syntax (`FROM ... | STATS ...`) for efficient data stream analytics and aggregation.

- Why not B: ES|QL has its own dedicated pipe-based grammar.
- Why not C: ES|QL queries Elasticsearch, not Prometheus TSDB.
- Why not D: Indexing nodes are required to service data stream queries.
- Ref: [modules/12-elastic-observability-kibana-and-edot.md](../modules/12-elastic-observability-kibana-and-edot.md), `../examples/ts/12-elastic-observability-kibana-and-edot.test.ts`

</details>
