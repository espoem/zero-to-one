import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BigQueryCostModel,
  type BigQueryTable,
  CloudRunExecutionSimulator,
} from './lib/gcp-models.ts';

describe('BigQuery Columnar Byte Billing & Optimization Engine', () => {
  const telemetryTable: BigQueryTable = {
    projectId: 'analytics-prod',
    datasetId: 'telemetry',
    tableId: 'events',
    totalRows: 10_000_000,
    columns: [
      { name: 'event_id', type: 'STRING', bytesPerRow: 36 },
      { name: 'timestamp', type: 'TIMESTAMP', bytesPerRow: 8 },
      { name: 'device_id', type: 'INT64', bytesPerRow: 8 },
      { name: 'payload_json', type: 'STRING', bytesPerRow: 500 },
      { name: 'geo_location', type: 'STRING', bytesPerRow: 50 },
    ],
    partitionColumn: 'timestamp',
    partitionCount: 100, // 100 daily partitions
    isClustered: true,
  };

  it('Full-table scan (SELECT *) scans 100% of row and column bytes', () => {
    const result = BigQueryCostModel.calculateScanBytes(telemetryTable, ['*'], 1.0, 1.0);

    const totalBytesPerRow = 36 + 8 + 8 + 500 + 50; // 602 bytes
    const expectedBytes = 10_000_000 * totalBytesPerRow; // 6,020,000,000 bytes (~5.6 GB)

    assert.equal(result.totalScannedBytes, expectedBytes);
    assert.ok(result.costUsd > 0.03, 'Should incur significant scanning charge');
  });

  it('Column projection selects only required columns, eliminating unqueried payload bytes', () => {
    // Only select timestamp and device_id (16 bytes per row vs 602 bytes per row)
    const result = BigQueryCostModel.calculateScanBytes(
      telemetryTable,
      ['timestamp', 'device_id'],
      1.0,
      1.0,
    );

    const projectedBytesPerRow = 16;
    const expectedBytes = 10_000_000 * projectedBytesPerRow; // 160,000,000 bytes

    assert.equal(result.totalScannedBytes, expectedBytes);
    // 160 MB vs 6020 MB -> scans ~2.6% of full table bytes
    assert.ok(result.totalScannedBytes < 200_000_000);
  });

  it('Partition pruning skips 99% of table partitions, billing only matching partition', () => {
    // Query filtering on a single day out of 100 daily partitions (1% of partitions scanned)
    const result = BigQueryCostModel.calculateScanBytes(
      telemetryTable,
      ['timestamp', 'device_id'],
      0.01,
      1.0,
    );

    const rawBytes = 10_000_000 * 0.01 * 16; // 1,600,000 bytes
    assert.ok(rawBytes < 10 * 1024 * 1024, 'Raw scanned bytes is below 10 MiB threshold');
    // Since 1.6 MB is below BigQuery's 10 MiB minimum billable threshold, it is rounded up to 10 MiB
    assert.equal(result.totalScannedBytes, 10 * 1024 * 1024);
  });

  it('Combined partition pruning and cluster block pruning minimizes billable bytes', () => {
    // Query filtering 5% of partitions and 10% of cluster blocks within those partitions
    const result = BigQueryCostModel.calculateScanBytes(telemetryTable, ['*'], 0.05, 0.1);

    const totalBytesPerRow = 602;
    const scannedRows = 10_000_000 * 0.05 * 0.1; // 50,000 rows
    const expectedRaw = scannedRows * totalBytesPerRow; // 30,100,000 bytes (~28.7 MB)

    assert.equal(result.totalScannedBytes, expectedRaw);
    assert.ok(result.totalScannedBytes < 35_000_000);
  });

  it('Minimum 10 MiB billable bytes rule is enforced on small query scans', () => {
    const smallTable: BigQueryTable = {
      projectId: 'test',
      datasetId: 'd',
      tableId: 'small',
      totalRows: 100,
      columns: [{ name: 'id', type: 'INT64', bytesPerRow: 8 }],
    };

    const result = BigQueryCostModel.calculateScanBytes(smallTable, ['id'], 1.0, 1.0);
    const TEN_MIB = 10 * 1024 * 1024;

    assert.equal(result.totalScannedBytes, TEN_MIB, 'Must be rounded up to 10 MiB minimum');
  });
});

describe('Cloud Run Serverless Execution & Throttling Simulation Engine', () => {
  const serviceConfig = {
    name: 'order-api',
    minInstances: 2,
    maxInstances: 50,
    concurrency: 80,
    cpuAlwaysAllocated: false, // Request-based billing
    vCpu: 2,
    memoryMb: 1024,
  };

  it('Calculates required instance scaling based on active requests and concurrency limit', () => {
    const simulator = new CloudRunExecutionSimulator(serviceConfig);

    // 0 requests -> returns minInstances (2)
    assert.equal(simulator.calculateRequiredInstances(0), 2);

    // 80 requests -> 1 instance needed, but minInstances is 2 -> returns 2
    assert.equal(simulator.calculateRequiredInstances(80), 2);

    // 320 requests -> ceil(320 / 80) = 4 instances
    assert.equal(simulator.calculateRequiredInstances(320), 4);

    // 8,000 requests -> ceil(8000 / 80) = 100, capped at maxInstances (50)
    assert.equal(simulator.calculateRequiredInstances(8000), 50);
  });

  it('Request-based billing severely throttles asynchronous background tasks outside active requests', () => {
    const simulator = new CloudRunExecutionSimulator(serviceConfig);
    const WORKLOAD_CYCLES = 100_000;

    // During active HTTP request: full 2 vCPUs allocated
    const activeResult = simulator.executeBackgroundTask(WORKLOAD_CYCLES, true);
    assert.equal(activeResult.wasThrottled, false);
    assert.equal(activeResult.completionTimeMs, 50); // 100000 / (2 * 1000) = 50ms

    // After HTTP response sent (outside active request): throttled to 0.05 vCPU
    const throttledResult = simulator.executeBackgroundTask(WORKLOAD_CYCLES, false);
    assert.equal(throttledResult.wasThrottled, true);
    assert.equal(throttledResult.completionTimeMs, 2000); // 100000 / (0.05 * 1000) = 2000ms (40x slower!)
  });

  it('Instance-based billing (CPU always allocated) prevents throttling of background tasks', () => {
    const alwaysAllocatedSim = new CloudRunExecutionSimulator({
      ...serviceConfig,
      cpuAlwaysAllocated: true,
    });
    const WORKLOAD_CYCLES = 100_000;

    // Background task executed outside active HTTP request with CPU always allocated
    const result = alwaysAllocatedSim.executeBackgroundTask(WORKLOAD_CYCLES, false);
    assert.equal(result.wasThrottled, false);
    assert.equal(result.completionTimeMs, 50, 'Full CPU speed preserved for background execution');
  });
});
