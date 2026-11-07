# Observability Cheatsheet

Fast-lookup reference covering OpenTelemetry configuration, W3C propagation, Prometheus PromQL idioms, Alertmanager routes, LogQL, TraceQL, Grafana Alloy, ES\|QL, and burn-rate alerting math.

## 1. W3C Trace Context Headers

- `traceparent`: Version (`00`) - Trace ID (32 hex) - Parent Span ID (16 hex) - Trace Flags (`01` sampled). Example: `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`
- `tracestate`: Vendor-specific key-value pairs for additional context routing. Example: `rojo=00f067aa0ba902b7,congo=t61rcWkgMzE`

---

## 2. OpenTelemetry Collector (`otelcol-contrib`) Configuration

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  memory_limiter:
    check_interval: 1s
    limit_percentage: 80
    spike_limit_percentage: 20
  batch:
    send_batch_size: 8192
    timeout: 1s
  transform:
    error_mode: ignore
    metric_statements:
      - context: metric
        statements:
          - set(attributes["env"], "production") where resource.attributes["service.namespace"] == "prod"
  tail_sampling:
    decision_wait: 10s
    num_traces: 50000
    expected_new_traces_per_sec: 2000
    policies:
      - name: drop-healthcheck-success
        type: status_code
        status_code: { statuses: [OK] }
      - name: keep-errors-and-slow
        type: and
        and:
          and_sub_policy:
            - name: error-policy
              type: status_code
              status_code: { statuses: [ERROR] }
            - name: latency-policy
              type: latency
              latency: { threshold_ms: 500 }

exporters:
  prometheus:
    endpoint: 0.0.0.0:8889
  otlp/tempo:
    endpoint: tempo:4317
    tls: { insecure: true }

service:
  pipelines:
    metrics:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [prometheus]
    traces:
      receivers: [otlp]
      processors: [memory_limiter, tail_sampling, batch]
      exporters: [otlp/tempo]
```

---

## 3. PromQL Quick Reference & Idioms

| Operation | PromQL Expression | Purpose |
| :-- | :-- | :-- |
| **Counter Rate** | `sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)` | Per-second error rate over 5m window with counter reset handling |
| **Increase** | `increase(http_requests_total[1h])` | Total request count increase over 1 hour |
| **Vector Matching** | `service:latency:p99{env="prod"} * on(service) group_left(tier) service_info` | Joining metadata labels onto metric streams |
| **Histogram Quantile** | `histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))` | Calculating p99 latency from classic Prometheus histograms |
| **Native Histogram Quantile** | `histogram_quantile(0.99, sum(rate(http_request_duration_seconds[5m])) by (service))` | Calculating p99 latency from Prometheus 3.x native exponential histograms |
| **Subquery** | `max_over_time(rate(http_requests_total[5m])[30m:1m])` | Evaluating max rate over a 30-minute window sampled every 1 minute |

---

## 4. Alertmanager Configuration & Testing

```yaml
global:
  resolve_timeout: 5m
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'pager-duty'
  routes:
    - match:
        severity: critical
      receiver: 'pager-duty'
receivers:
  - name: 'pager-duty'
    pagerduty_configs:
      - service_key: '<key>'
```

### `promtool` Unit Test Example

```yaml
rule_files:
  - alert_rules.yml
evaluation_interval: 1m
tests:
  - interval: 1m
    input_series:
      - series: 'http_requests_total{job="api", status="500"}'
        values: '0+10x10'
    alert_rule_test:
      - eval_time: 5m
        alertname: HighErrorRate
        exp_alerts:
          - iter: 0
            labels:
              job: api
              severity: critical
            annotations:
              summary: 'High error rate detected'
```

---

## 5. Multi-Window Multi-Burn-Rate Alerting Matrix

| Objective | Error Budget | Burn Rate | Window | Time to Exhaustion | Coverage of Budget | Max False Positive |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| **99.9%** | 0.1% | 14.4 | 1 hour | 5 hours | 2% | Low |
| **99.9%** | 0.1% | 6.0 | 6 hours | 12 hours | 5% | Low |
| **99.9%** | 0.1% | 1.0 | 24 hours | 72 hours | 50% | Medium |

---

## 6. LogQL, TraceQL, and ES\|QL Quick Reference

- **LogQL Stream Filter**: `{app="api", env="prod"} \|= "error" \| json \| status == 500`
- **LogQL Metric Extraction**: `sum(rate({app="api"} \| json \| unwrap latency [5m])) by (endpoint)`
- **TraceQL Span Query**: `{ resource.service.name = "api" && span.http.status_code >= 500 && duration > 500ms }`
- **Grafana Alloy River Config**:
  ```alloy
  otelcol.receiver.otlp "default" {
    grpc { endpoint = "0.0.0.0:4317" }
    output { metrics = [otelcol.processor.batch.default.input] }
  }
  ```
- **ES\|QL Observability Query**:
  ```esql
  FROM logs-*
  | WHERE service.name == "api" AND http.response.status_code >= 500
  | STATS error_count = COUNT(*) BY http.route
  | SORT error_count DESC
  | LIMIT 10
  ```
