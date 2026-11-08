import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FirewallEvaluationEngine, CloudNatSimulator } from './lib/gcp-models.ts';
import type { FirewallRule, CloudNatConfig } from './lib/gcp-models.ts';

describe('Google Cloud VPC Firewall & Cloud NAT Simulation Engine', () => {
  describe('Hierarchical & VPC Firewall Policy Evaluation', () => {
    const engine = new FirewallEvaluationEngine();

    // 1. Organization-level rule: Deny SSH (port 22) from all public IPs everywhere
    const orgDenySsh: FirewallRule = {
      name: 'org-deny-public-ssh',
      priority: 100,
      direction: 'INGRESS',
      action: 'DENY',
      level: 'ORGANIZATION',
      sourceRanges: ['0.0.0.0/0'],
      protocol: 'tcp',
      ports: [22],
    };

    // 2. Folder-level rule: Allow corporate VPN CIDR
    const folderAllowVpn: FirewallRule = {
      name: 'folder-allow-corp-vpn',
      priority: 500,
      direction: 'INGRESS',
      action: 'ALLOW',
      level: 'FOLDER',
      sourceRanges: ['10.100.0.0/16'],
      protocol: 'tcp',
      ports: [22, 443, 80],
    };

    // 3. VPC-level rule: Allow HTTP/HTTPS traffic to tagged webservers
    const vpcAllowWeb: FirewallRule = {
      name: 'vpc-allow-web-tagged',
      priority: 1000,
      direction: 'INGRESS',
      action: 'ALLOW',
      level: 'VPC',
      sourceRanges: ['0.0.0.0/0'],
      protocol: 'tcp',
      ports: [80, 443],
      targetTags: ['web-server'],
    };

    // 4. VPC-level rule: Allow backend communication targeted to Service Account
    const vpcAllowBackend: FirewallRule = {
      name: 'vpc-allow-backend-sa',
      priority: 1000,
      direction: 'INGRESS',
      action: 'ALLOW',
      level: 'VPC',
      sourceRanges: ['10.0.0.0/8'],
      protocol: 'tcp',
      ports: [8080],
      targetServiceAccounts: ['orders-sa@prod.iam.gserviceaccount.com'],
    };

    engine.addRule(orgDenySsh);
    engine.addRule(folderAllowVpn);
    engine.addRule(vpcAllowWeb);
    engine.addRule(vpcAllowBackend);

    it('Hierarchical Precedence: Org-level rule overrides VPC allow rules at higher priority', () => {
      // Public SSH request to web-server VM
      const result = engine.evaluatePacket({
        direction: 'INGRESS',
        sourceIp: '198.51.100.25',
        destinationIp: '10.0.1.5',
        protocol: 'tcp',
        port: 22,
        vmTags: ['web-server'],
      });

      assert.equal(result.action, 'DENY');
      assert.equal(result.matchedRule, 'org-deny-public-ssh');
      assert.equal(result.matchedPriority, 100);
      assert.equal(result.matchedLevel, 'ORGANIZATION');
      assert.equal(result.isDefaultRule, false);
    });

    it('Target Tag Filtering: Grants access only to VMs carrying designated network tag', () => {
      // Packet to VM with 'web-server' tag on port 443
      const taggedResult = engine.evaluatePacket({
        direction: 'INGRESS',
        sourceIp: '203.0.113.10',
        destinationIp: '10.0.1.5',
        protocol: 'tcp',
        port: 443,
        vmTags: ['web-server'],
      });
      assert.equal(taggedResult.action, 'ALLOW');
      assert.equal(taggedResult.matchedRule, 'vpc-allow-web-tagged');

      // Packet to untagged database VM on port 443 -> falls through to default VPC deny
      const untaggedResult = engine.evaluatePacket({
        direction: 'INGRESS',
        sourceIp: '203.0.113.10',
        destinationIp: '10.0.1.6',
        protocol: 'tcp',
        port: 443,
        vmTags: ['db-node'],
      });
      assert.equal(untaggedResult.action, 'DENY');
      assert.equal(untaggedResult.isDefaultRule, true);
      assert.equal(untaggedResult.matchedPriority, 65535);
    });

    it('Service Account Filtering: Grants access exclusively to workload service account', () => {
      const matchResult = engine.evaluatePacket({
        direction: 'INGRESS',
        sourceIp: '10.2.0.15',
        destinationIp: '10.0.1.10',
        protocol: 'tcp',
        port: 8080,
        vmServiceAccount: 'orders-sa@prod.iam.gserviceaccount.com',
      });
      assert.equal(matchResult.action, 'ALLOW');
      assert.equal(matchResult.matchedRule, 'vpc-allow-backend-sa');

      const wrongSaResult = engine.evaluatePacket({
        direction: 'INGRESS',
        sourceIp: '10.2.0.15',
        destinationIp: '10.0.1.10',
        protocol: 'tcp',
        port: 8080,
        vmServiceAccount: 'analytics-sa@prod.iam.gserviceaccount.com',
      });
      assert.equal(wrongSaResult.action, 'DENY');
      assert.equal(wrongSaResult.isDefaultRule, true);
    });

    it('Default Egress Behavior: Allows outbound traffic implicitly when no custom rule blocks it', () => {
      const egressResult = engine.evaluatePacket({
        direction: 'EGRESS',
        sourceIp: '10.0.1.5',
        destinationIp: '93.184.216.34',
        protocol: 'tcp',
        port: 443,
      });

      assert.equal(egressResult.action, 'ALLOW');
      assert.equal(egressResult.isDefaultRule, true);
      assert.equal(egressResult.matchedRule, 'default-implied-allow-egress');
    });
  });

  describe('Cloud NAT Port Allocation & Exhaustion Simulation', () => {
    it('Static Allocation: Default 64 ports per VM leads to drops when connections exceed quota', () => {
      const config: CloudNatConfig = {
        mode: 'STATIC',
        minPortsPerVm: 64, // GCP official static default
        allocatedPublicIps: 1, // 64,512 usable ports
      };

      // 10 VMs each attempting 100 concurrent outbound TCP sockets
      const result = CloudNatSimulator.simulateVmLoad(10, 100, config);

      assert.equal(result.allocatedPortsPerVm, 64);
      assert.equal(result.portExhaustionOccurred, true);
      assert.equal(result.connectionsAllowed, 640); // 10 * 64
      assert.equal(result.connectionsDropped, 360); // 10 * 36 dropped
      assert.equal(result.maxSupportedVms, Math.floor(64512 / 64)); // 1008 VMs
    });

    it('Dynamic Allocation: Scales port assignment in powers of 2 to absorb connection bursts', () => {
      const config: CloudNatConfig = {
        mode: 'DYNAMIC',
        minPortsPerVm: 32, // GCP official dynamic default
        maxPortsPerVm: 512,
        allocatedPublicIps: 1,
      };

      // 10 VMs each needing 100 connections
      // Dynamic allocation scales 32 -> 64 -> 128
      const result = CloudNatSimulator.simulateVmLoad(10, 100, config);

      assert.equal(result.allocatedPortsPerVm, 128);
      assert.equal(result.portExhaustionOccurred, false);
      assert.equal(result.connectionsAllowed, 1000); // all 1000 succeed
      assert.equal(result.connectionsDropped, 0);
    });

    it('Gateway Total Capacity Exhaustion: Fails when demanded fleet ports exceed IP pool', () => {
      const config: CloudNatConfig = {
        mode: 'STATIC',
        minPortsPerVm: 64,
        allocatedPublicIps: 1, // 64,512 ports total
      };

      // 2000 VMs demanding 64 ports each = 128,000 ports > 64,512
      const result = CloudNatSimulator.simulateVmLoad(2000, 50, config);

      assert.equal(result.portExhaustionOccurred, true);
      assert.equal(result.connectionsAllowed, 0);
      assert.equal(result.connectionsDropped, 2000 * 50);
    });
  });
});
