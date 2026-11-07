// Module 08: Testing and Policy-as-Code: terraform test, Mock Providers, OPA/Rego, CEL, Kyverno, and Terraform Policy
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PolicyEvaluator,
  type CelExpression,
  type KyvernoRule,
  type Terraform117Policy,
} from './lib/terraform-model.ts';

test('terraform test simulation with mock providers and assertions', () => {
  // Simulating a .tftest.hcl run with mock provider
  interface MockInstance {
    id: string;
    ami: string;
    instance_type: string;
    tags: Record<string, string>;
  }

  const runMockPlan = (vars: { env: string; type: string }): MockInstance => {
    // Mock provider generates synthetic values deterministically
    return {
      id: 'i-mock-0123456789abcdef0',
      ami: 'ami-mock-ubuntu-2404',
      instance_type: vars.type,
      tags: { Environment: vars.env, ManagedBy: 'terraform-test' },
    };
  };

  const plan = runMockPlan({ env: 'staging', type: 't3.micro' });

  // Assertions in run block
  assert.equal(plan.ami, 'ami-mock-ubuntu-2404');
  assert.equal(plan.instance_type, 't3.micro');
  assert.equal(plan.tags.Environment, 'staging');
});

test('negative test in terraform test: expect_failures asserts validation failures', () => {
  // Scenario: tftest expects failure when an invalid CIDR is provided
  const runValidationWithExpectFailures = (cidr: string, expectFailure: boolean) => {
    const isValidCidr = /^([0-9]{1,3}\.){3}[0-9]{1,3}\/([0-9]|[1-2][0-9]|3[0-2])$/.test(cidr);
    if (!isValidCidr) {
      if (expectFailure) {
        return { passed: true, expectedError: `Invalid CIDR block '${cidr}'` };
      }
      throw new Error(`Validation failed for '${cidr}'`);
    }
    if (expectFailure) {
      throw new Error('Test failed: expected failure but configuration passed validation!');
    }
    return { passed: true };
  };

  // Passing an invalid CIDR with expect_failures passes the test suite:
  const result = runValidationWithExpectFailures('999.999.999.999/99', true);
  assert.equal(result.passed, true);
  assert.match(result.expectedError!, /Invalid CIDR block/);
});

test('OPA / Rego policy evaluation on plan JSON', () => {
  const planResources = [
    {
      address: 'aws_security_group.web',
      type: 'aws_security_group',
      attributes: {
        ingress: [
          { from_port: 80, to_port: 80, protocol: 'tcp', cidr_blocks: ['0.0.0.0/0'] },
          { from_port: 22, to_port: 22, protocol: 'tcp', cidr_blocks: ['0.0.0.0/0'] }, // VIOLATION!
        ],
      },
    },
    {
      address: 'aws_s3_bucket.unencrypted',
      type: 'aws_s3_bucket',
      attributes: {
        bucket: 'company-data',
        server_side_encryption: false, // VIOLATION!
      },
    },
  ];

  const regoRules = [
    {
      name: 'deny_open_ssh',
      check: (res: { type: string; attributes: Record<string, unknown> }) => {
        if (res.type === 'aws_security_group') {
          const ingress = res.attributes['ingress'] as Array<{
            from_port: number;
            cidr_blocks: string[];
          }>;
          for (const rule of ingress) {
            if (rule.from_port === 22 && rule.cidr_blocks.includes('0.0.0.0/0')) {
              return 'Security group must not allow unrestricted SSH (port 22) from 0.0.0.0/0';
            }
          }
        }
        return null;
      },
    },
    {
      name: 'deny_unencrypted_s3',
      check: (res: { type: string; attributes: Record<string, unknown> }) => {
        if (res.type === 'aws_s3_bucket' && res.attributes['server_side_encryption'] !== true) {
          return 'S3 buckets must have server_side_encryption enabled';
        }
        return null;
      },
    },
  ];

  const outcomes = PolicyEvaluator.evaluateRego(planResources, regoRules);

  const sshRule = outcomes.find((o) => o.ruleName === 'deny_open_ssh')!;
  assert.equal(sshRule.allowed, false);
  assert.match(sshRule.violations[0]!, /unrestricted SSH/);

  const s3Rule = outcomes.find((o) => o.ruleName === 'deny_unencrypted_s3')!;
  assert.equal(s3Rule.allowed, false);
  assert.match(s3Rule.violations[0]!, /server_side_encryption/);
});

test('CEL admission expressions for cloud infrastructure tags', () => {
  const celRules: CelExpression[] = [
    {
      expression: 'resource.tags.Environment in ["dev", "staging", "prod"]',
      evaluate: (ctx) => {
        const tags = (ctx.resource as { tags?: Record<string, string> })?.tags ?? {};
        return ['dev', 'staging', 'prod'].includes(tags.Environment ?? '');
      },
    },
    {
      expression: 'has(resource.tags.Owner) && size(resource.tags.Owner) > 0',
      evaluate: (ctx) => {
        const tags = (ctx.resource as { tags?: Record<string, string> })?.tags ?? {};
        return typeof tags.Owner === 'string' && tags.Owner.length > 0;
      },
    },
  ];

  // Compliant resource passes
  const validContext = {
    resource: {
      tags: { Environment: 'prod', Owner: 'platform-team' },
    },
  };
  const validRes = PolicyEvaluator.evaluateCel(validContext, celRules);
  assert.equal(validRes.passed, true);

  // Non-compliant resource fails
  const invalidContext = {
    resource: {
      tags: { Environment: 'test-sandbox' }, // Missing Owner and invalid Environment
    },
  };
  const invalidRes = PolicyEvaluator.evaluateCel(invalidContext, celRules);
  assert.equal(invalidRes.passed, false);
  assert.equal(invalidRes.failures.length, 2);
});

test('Kyverno validate rules on container workload infrastructure', () => {
  const kyvernoRules: KyvernoRule[] = [
    {
      name: 'require-ro-rootfs',
      matchResource: 'kubernetes_deployment',
      validate: (spec) => {
        const readOnly = (spec as { readOnlyRootFilesystem?: boolean }).readOnlyRootFilesystem;
        return {
          valid: readOnly === true,
          message: 'Containers must run with readOnlyRootFilesystem = true',
        };
      },
    },
  ];

  const compliant = [
    {
      type: 'kubernetes_deployment',
      spec: { readOnlyRootFilesystem: true },
    },
  ];
  assert.equal(PolicyEvaluator.evaluateKyverno(compliant, kyvernoRules).valid, true);

  const nonCompliant = [
    {
      type: 'kubernetes_deployment',
      spec: { readOnlyRootFilesystem: false },
    },
  ];
  const evalRes = PolicyEvaluator.evaluateKyverno(nonCompliant, kyvernoRules);
  assert.equal(evalRes.valid, false);
  assert.match(evalRes.errors[0]!, /readOnlyRootFilesystem/);
});

test('Terraform 1.17 Policy GA: advisory warnings vs mandatory failures', () => {
  const policies: Terraform117Policy[] = [
    {
      name: 'cost-budget-advisory',
      enforcementLevel: 'advisory',
      evaluate: (plan) => ({
        pass: (plan.estimatedMonthlyCost as number) < 500,
        message: 'Plan increases monthly spend above $500 advisory threshold',
      }),
    },
    {
      name: 'require-tls-mandatory',
      enforcementLevel: 'mandatory',
      evaluate: (plan) => ({
        pass: plan.tlsVersion === 'TLS_1_3',
        message: 'All endpoints must enforce TLS 1.3',
      }),
    },
  ];

  // Case 1: Advisory fails but mandatory passes -> Allowed to apply with warning
  const plan1 = { estimatedMonthlyCost: 650, tlsVersion: 'TLS_1_3' };
  const res1 = PolicyEvaluator.evaluateTerraform117Policies(plan1, policies);
  assert.equal(res1.allowedToApply, true);
  assert.equal(res1.advisoryWarnings.length, 1);
  assert.equal(res1.mandatoryFailures.length, 0);

  // Case 2: Mandatory fails -> Application BLOCKED!
  const plan2 = { estimatedMonthlyCost: 100, tlsVersion: 'TLS_1_0' };
  const res2 = PolicyEvaluator.evaluateTerraform117Policies(plan2, policies);
  assert.equal(res2.allowedToApply, false);
  assert.equal(res2.mandatoryFailures.length, 1);
  assert.match(res2.mandatoryFailures[0]!, /enforce TLS 1.3/);
});
