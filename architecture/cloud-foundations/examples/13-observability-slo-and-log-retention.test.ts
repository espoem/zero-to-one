import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Module 13: Observability, Log Retention & SLO Error Budgets', () => {
  it('calculates SLO error budget consumption and burn rate', () => {
    // 30-day window, 99.9% availability target
    // Total requests = 10,000,000
    // Allowed error budget = 10,000 requests (0.1%)
    const totalRequests = 10_000_000;
    const targetAvailability = 0.999;
    const allowedErrors = Math.round(totalRequests * (1 - targetAvailability));
    assert.equal(allowedErrors, 10_000);

    const actualErrors = 3_500;
    const remainingBudget = allowedErrors - actualErrors;
    const percentConsumed = (actualErrors / allowedErrors) * 100;

    assert.equal(remainingBudget, 6_500);
    assert.equal(percentConsumed, 35);
  });

  it('proves setting finite log retention saves compounding storage costs vs infinite defaults', () => {
    // CloudWatch logs default retention is Never Expire (infinite).
    // Ingesting 50 GB/day at $0.03/GB-month storage.
    const dailyIngestGb = 50;
    const monthlyRatePerGb = 0.03;

    function storageAfterMonths(months: number, retentionMonths: number): number {
      const activeStoredMonths = Math.min(months, retentionMonths);
      return dailyIngestGb * 30 * activeStoredMonths * monthlyRatePerGb;
    }

    // At 24 months:
    const infiniteCostMonth24 = storageAfterMonths(24, 999); // 24 months accumulated = 36,000 GB * $0.03 = $1,080 / month
    const capped30DayCostMonth24 = storageAfterMonths(24, 1); // 1 month accumulated = 1,500 GB * $0.03 = $45 / month

    assert.equal(infiniteCostMonth24, 1080);
    assert.equal(capped30DayCostMonth24, 45);
    assert.ok(infiniteCostMonth24 > capped30DayCostMonth24 * 20);
  });
});
