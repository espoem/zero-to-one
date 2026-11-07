import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Module 01: Cloud Model & Static Stability', () => {
  it('differentiates static stability from control-plane runtime dependency', () => {
    // A statically stable system continues processing existing data plane traffic
    // even when the cloud provider control plane API (e.g. EC2 RunInstances, Route 53 control plane) is 100% down.
    interface SystemComponent {
      name: string;
      plane: 'CONTROL' | 'DATA';
      availableDuringControlPlaneOutage: boolean;
    }

    const architecture: SystemComponent[] = [
      {
        name: 'EC2 Instance AutoScaling API',
        plane: 'CONTROL',
        availableDuringControlPlaneOutage: false,
      },
      {
        name: 'Existing Pre-Provisioned VM Capacity',
        plane: 'DATA',
        availableDuringControlPlaneOutage: true,
      },
      {
        name: 'Route 53 Hosted Zone Upsert API',
        plane: 'CONTROL',
        availableDuringControlPlaneOutage: false,
      },
      {
        name: 'Route 53 Anycast Authoritative DNS Resolution',
        plane: 'DATA',
        availableDuringControlPlaneOutage: true,
      },
      {
        name: 'IAM Role Update Policy API',
        plane: 'CONTROL',
        availableDuringControlPlaneOutage: false,
      },
      {
        name: 'Local Instance Metadata Service (IMDSv2) Cached Token Evaluation',
        plane: 'DATA',
        availableDuringControlPlaneOutage: true,
      },
    ];

    const dataPlaneComponents = architecture.filter((c) => c.plane === 'DATA');
    assert.equal(dataPlaneComponents.length, 3);
    assert.ok(dataPlaneComponents.every((c) => c.availableDuringControlPlaneOutage));

    const controlPlaneComponents = architecture.filter((c) => c.plane === 'CONTROL');
    assert.equal(controlPlaneComponents.length, 3);
    assert.ok(controlPlaneComponents.every((c) => !c.availableDuringControlPlaneOutage));
  });

  it('validates NIST SP 800-145 essential characteristics boundaries', () => {
    const nistCharacteristics = [
      'ON_DEMAND_SELF_SERVICE',
      'BROAD_NETWORK_ACCESS',
      'RESOURCE_POOLING',
      'RAPID_ELASTICITY',
      'MEASURED_SERVICE',
    ];
    assert.equal(nistCharacteristics.length, 5);
  });
});
