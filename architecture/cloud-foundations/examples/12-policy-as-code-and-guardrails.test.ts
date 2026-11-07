import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PolicyGuardrailEngine, type ResourceDefinition } from './lib/cloud-models.ts';

describe('Module 12: Security Posture & Policy-as-Code Guardrails', () => {
  it('detects public object storage bucket in IaC resource definition', () => {
    const publicBucket: ResourceDefinition = {
      type: 'aws_s3_bucket',
      id: 's3-analytics-data',
      properties: {
        acl: 'public-read',
      },
    };

    const privateBucket: ResourceDefinition = {
      type: 'aws_s3_bucket',
      id: 's3-confidential-vault',
      properties: {
        acl: 'private',
      },
    };

    const violation = PolicyGuardrailEngine.checkPublicBucket(publicBucket);
    assert.ok(violation);
    assert.equal(violation.ruleId, 'SEC-01-NO-PUBLIC-OBJECT-STORAGE');

    const clean = PolicyGuardrailEngine.checkPublicBucket(privateBucket);
    assert.strictEqual(clean, null);
  });

  it('rejects open ingress port 22 on security group rules', () => {
    const insecureRule: ResourceDefinition = {
      type: 'aws_security_group_rule',
      id: 'sg-ssh-rule',
      properties: {
        from_port: 22,
        to_port: 22,
        cidr_blocks: ['0.0.0.0/0'],
      },
    };

    const secureRule: ResourceDefinition = {
      type: 'aws_security_group_rule',
      id: 'sg-https-rule',
      properties: {
        from_port: 443,
        to_port: 443,
        cidr_blocks: ['0.0.0.0/0'],
      },
    };

    const violation = PolicyGuardrailEngine.checkOpenSshSecurityGroup(insecureRule);
    assert.ok(violation);
    assert.equal(violation.ruleId, 'NET-02-NO-OPEN-INGRESS-PORT-22');

    assert.strictEqual(PolicyGuardrailEngine.checkOpenSshSecurityGroup(secureRule), null);
  });
});
