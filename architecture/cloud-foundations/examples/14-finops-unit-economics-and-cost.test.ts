import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FinOpsCalculator, type FinOpsUsage } from './lib/cloud-models.ts';

describe('Module 14: FinOps, Unit Economics & Hidden Cloud Charges', () => {
  it('exposes hidden network charges (NAT processing + cross-AZ egress) dominating compute bills', () => {
    const microserviceProfile: FinOpsUsage = {
      computeHours: 720, // 1 month of a c6g.xlarge
      computeHourlyRate: 0.136, // ~$97.92 compute
      dataProcessedByNatGb: 10_000, // 10 TB through NAT gateway ($0.045/GB)
      crossAzDataTransferGb: 20_000, // 20 TB chatty microservices across AZs ($0.02/GB roundtrip)
      publicEgressGb: 1_000, // 1 TB public egress ($0.09/GB)
      storageGbMonth: 500,
      storageRatePerGbMonth: 0.023,
    };

    const bill = FinOpsCalculator.calculate(microserviceProfile);

    // Compute cost: 720 * 0.136 = $97.92
    // NAT processing: 10,000 * 0.045 = $450.00
    // Cross-AZ data transfer: 20,000 * 0.02 = $400.00
    // Public egress: 1,000 * 0.09 = $90.00
    // Storage: 500 * 0.023 = $11.50
    // Total = $1,049.42
    // Notice that network cost ($940.00) represents ~89.57% of the entire bill, while compute was only $97.92!
    assert.equal(bill.computeCost, 97.92);
    assert.equal(bill.natProcessingCost, 450);
    assert.equal(bill.crossAzCost, 400);
    assert.equal(bill.internetEgressCost, 90);
    assert.equal(bill.storageCost, 11.5);
    assert.equal(bill.totalCost, 1049.42);
    assert.ok(bill.networkCostPercentage > 85);
  });

  it('demonstrates commitment discounts (Savings Plans / Reserved Instances) vs on-demand unit economics', () => {
    const onDemandHourly = 0.5;
    const computeSavingsPlan3YrAllUpfrontHourly = 0.17; // ~66% discount

    const annualOnDemand = onDemandHourly * 24 * 365;
    const annualSavingsPlan = computeSavingsPlan3YrAllUpfrontHourly * 24 * 365;

    assert.equal(annualOnDemand, 4380);
    assert.equal(annualSavingsPlan, 1489.2);
    assert.ok(annualOnDemand - annualSavingsPlan > 2800);
  });
});
