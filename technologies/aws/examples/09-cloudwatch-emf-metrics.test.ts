import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatEmf,
  extractEmfMetrics,
  evaluateMetricAlarm,
  evaluateCompositeAlarm,
  type AlarmState,
} from './lib/aws-models.ts';

describe('CloudWatch EMF Metrics & Composite Alarm Engine', () => {
  test('EMF Formatting: Serializes zero-overhead structured JSON with embedded metric envelope', () => {
    const timestamp = 1700000000000;
    const emfLine = formatEmf({
      namespace: 'RetailPlatform/Checkout',
      dimensions: {
        Environment: 'production',
        Region: 'us-east-1',
        PaymentMethod: 'ApplePay',
      },
      metrics: {
        Latency: { value: 142.8, unit: 'Milliseconds' },
        CartItemCount: { value: 4, unit: 'Count' },
      },
      customFields: {
        OrderId: 'ord-98234-xyz',
        CustomerId: 'cust-5512',
      },
      timestamp,
    });

    const parsed = JSON.parse(emfLine);
    assert.equal(parsed._aws.Timestamp, timestamp);
    assert.equal(parsed._aws.CloudWatchMetrics[0].Namespace, 'RetailPlatform/Checkout');
    assert.deepEqual(parsed._aws.CloudWatchMetrics[0].Dimensions[0], [
      'Environment',
      'Region',
      'PaymentMethod',
    ]);
    assert.equal(parsed.OrderId, 'ord-98234-xyz');
    assert.equal(parsed.Latency, 142.8);
    assert.equal(parsed.CartItemCount, 4);
  });

  test('EMF Extraction: Ingestion engine extracts multidimensional metrics from structured logs', () => {
    const rawEmf = JSON.stringify({
      _aws: {
        Timestamp: 1700001234000,
        CloudWatchMetrics: [
          {
            Namespace: 'Payments/Gateway',
            Dimensions: [['Service', 'Stage']],
            Metrics: [
              { Name: 'ProcessingDuration', Unit: 'Milliseconds' },
              { Name: 'ErrorRate', Unit: 'Percent' },
            ],
          },
        ],
      },
      Service: 'payment-authorizer',
      Stage: 'prod',
      ProcessingDuration: 85.5,
      ErrorRate: 0.0,
      TraceId: '1-5f84c4d7-000000000000',
    });

    const metrics = extractEmfMetrics(rawEmf);
    assert.equal(metrics.length, 2);

    const durationMetric = metrics.find((m) => m.name === 'ProcessingDuration')!;
    assert.equal(durationMetric.value, 85.5);
    assert.equal(durationMetric.unit, 'Milliseconds');
    assert.equal(durationMetric.dimensions.Service, 'payment-authorizer');
    assert.equal(durationMetric.dimensions.Stage, 'prod');
  });

  test('Metric Alarm Evaluation: M-of-N evaluation window with threshold breaches', () => {
    const alarmConfig = {
      threshold: 80.0,
      comparisonOperator: 'GreaterThanThreshold' as const,
      evaluationPeriods: 5,
      datapointsToAlarm: 3,
    };

    // Case 1: Insufficient data points
    assert.equal(evaluateMetricAlarm(alarmConfig, [85.0, 90.0]), 'INSUFFICIENT_DATA');

    // Case 2: 5 datapoints, only 2 breaches -> OK
    assert.equal(evaluateMetricAlarm(alarmConfig, [50.0, 85.0, 60.0, 82.0, 75.0]), 'OK');

    // Case 3: 5 datapoints, 3 breaches -> ALARM
    assert.equal(evaluateMetricAlarm(alarmConfig, [50.0, 85.0, 92.0, 82.0, 75.0]), 'ALARM');
  });

  test('Composite Alarm: Evaluates boolean logic and suppresses alert fatigue during maintenance', () => {
    const rule = 'ALARM(HighHttp5xxErrors) AND NOT ALARM(ScheduledMaintenanceMode)';

    // Scenario A: High 5xx errors occur while maintenance mode is ACTIVE -> Alarm suppressed to OK
    const maintenanceActiveStates: Record<string, AlarmState> = {
      HighHttp5xxErrors: 'ALARM',
      ScheduledMaintenanceMode: 'ALARM',
    };
    assert.equal(
      evaluateCompositeAlarm(rule, maintenanceActiveStates),
      'OK',
      'Maintenance mode actively suppresses composite alarm',
    );

    // Scenario B: High 5xx errors occur while maintenance mode is INACTIVE -> Fires ALARM
    const productionOutageStates: Record<string, AlarmState> = {
      HighHttp5xxErrors: 'ALARM',
      ScheduledMaintenanceMode: 'OK',
    };
    assert.equal(
      evaluateCompositeAlarm(rule, productionOutageStates),
      'ALARM',
      'Composite alarm triggers when errors occur outside maintenance window',
    );

    // Scenario C: Complex nested rule with OR and AND
    const clusterRule =
      '(ALARM(CpuSaturation) OR ALARM(MemoryPressure)) AND NOT OK(BackupWindowRunning)';

    // Backup is running (OK state), so composite alarm stays OK
    const runningBackupStates: Record<string, AlarmState> = {
      CpuSaturation: 'ALARM',
      MemoryPressure: 'OK',
      BackupWindowRunning: 'OK',
    };
    assert.equal(evaluateCompositeAlarm(clusterRule, runningBackupStates), 'OK');

    // Backup is not running, CPU is saturated -> ALARM
    const realSaturationStates: Record<string, AlarmState> = {
      CpuSaturation: 'ALARM',
      MemoryPressure: 'OK',
      BackupWindowRunning: 'ALARM',
    };
    assert.equal(evaluateCompositeAlarm(clusterRule, realSaturationStates), 'ALARM');
  });
});
