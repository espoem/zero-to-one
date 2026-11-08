import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateIamPolicy,
  type EvaluationContext,
  type PolicyDocument,
} from './lib/aws-models.ts';

describe('IAM Policy Evaluation Engine', () => {
  const aliceArn = 'arn:aws:iam::111122223333:user/Alice';
  const bucketArn = 'arn:aws:s3:::corporate-finance-vault';
  const objectArn = 'arn:aws:s3:::corporate-finance-vault/reports/q3.pdf';

  test('Default Deny: Request with empty policies is denied', () => {
    const ctx: EvaluationContext = {
      principalArn: aliceArn,
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: true,
      identityPolicies: [],
    };

    const result = evaluateIamPolicy(ctx);
    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'DEFAULT_DENY');
  });

  test('Explicit Allow: Matching identity policy grants access', () => {
    const allowPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3Read',
          Effect: 'Allow',
          Action: ['s3:GetObject', 's3:ListBucket'],
          Resource: [bucketArn, 'arn:aws:s3:::corporate-finance-vault/*'],
        },
      ],
    };

    const ctx: EvaluationContext = {
      principalArn: aliceArn,
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: true,
      identityPolicies: [allowPolicy],
    };

    const result = evaluateIamPolicy(ctx);
    assert.equal(result.allowed, true);
    assert.equal(result.decision, 'ACCESS_ALLOWED');
  });

  test('Explicit Deny Trumps Allow: Deny statement overrides Allow in another policy', () => {
    const allowPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowAllS3',
          Effect: 'Allow',
          Action: 's3:*',
          Resource: '*',
        },
      ],
    };

    const denyPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'DenyFinancialReports',
          Effect: 'Deny',
          Action: 's3:GetObject',
          Resource: 'arn:aws:s3:::corporate-finance-vault/*',
        },
      ],
    };

    const ctx: EvaluationContext = {
      principalArn: aliceArn,
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: true,
      identityPolicies: [allowPolicy, denyPolicy],
    };

    const result = evaluateIamPolicy(ctx);
    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'EXPLICIT_DENY');
  });

  test('Organization SCP: Denies access if SCP does not grant action', () => {
    const allowPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AdminFullAccess',
          Effect: 'Allow',
          Action: '*',
          Resource: '*',
        },
      ],
    };

    const restrictiveScp: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'ScpAllowEc2Only',
          Effect: 'Allow',
          Action: 'ec2:*',
          Resource: '*',
        },
      ],
    };

    const ctx: EvaluationContext = {
      principalArn: aliceArn,
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: true,
      identityPolicies: [allowPolicy],
      scpPolicies: [restrictiveScp],
    };

    const result = evaluateIamPolicy(ctx);
    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'SCP_DENY');
  });

  test('Cross-Account Two-Sided Authorization: Requires both resource and identity allows', () => {
    const resourcePolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowExternalAccount',
          Effect: 'Allow',
          Action: 's3:GetObject',
          Resource: 'arn:aws:s3:::corporate-finance-vault/*',
        },
      ],
    };

    // Case 1: Resource policy allows, but identity policy is empty -> DENY
    const ctxNoIdentity: EvaluationContext = {
      principalArn: 'arn:aws:iam::999988887777:user/ExternalDev',
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: false,
      identityPolicies: [],
      resourcePolicy,
    };

    const resultNoIdentity = evaluateIamPolicy(ctxNoIdentity);
    assert.equal(resultNoIdentity.allowed, false);
    assert.equal(resultNoIdentity.decision, 'CROSS_ACCOUNT_IDENTITY_DENY');

    // Case 2: Both resource policy and identity policy allow -> ALLOW
    const identityPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowS3CrossAccount',
          Effect: 'Allow',
          Action: 's3:GetObject',
          Resource: 'arn:aws:s3:::corporate-finance-vault/*',
        },
      ],
    };

    const ctxBoth: EvaluationContext = {
      ...ctxNoIdentity,
      identityPolicies: [identityPolicy],
    };

    const resultBoth = evaluateIamPolicy(ctxBoth);
    assert.equal(resultBoth.allowed, true);
    assert.equal(resultBoth.decision, 'ACCESS_ALLOWED');
  });

  test('Permission Boundary: Intersects identity policy and blocks out-of-boundary actions', () => {
    const adminIdentityPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowEverything',
          Effect: 'Allow',
          Action: '*',
          Resource: '*',
        },
      ],
    };

    const boundaryRestrictingS3: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'BoundaryAllowEc2Only',
          Effect: 'Allow',
          Action: 'ec2:*',
          Resource: '*',
        },
      ],
    };

    const ctx: EvaluationContext = {
      principalArn: aliceArn,
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: true,
      identityPolicies: [adminIdentityPolicy],
      permissionBoundary: boundaryRestrictingS3,
    };

    const result = evaluateIamPolicy(ctx);
    assert.equal(result.allowed, false);
    assert.equal(result.decision, 'PERMISSION_BOUNDARY_DENY');
  });

  test('Permission Boundary: Does not restrict access granted directly by same-account resource policy', () => {
    const boundaryRestrictingS3: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'BoundaryAllowEc2Only',
          Effect: 'Allow',
          Action: 'ec2:*',
          Resource: '*',
        },
      ],
    };

    const s3ResourcePolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'ResourceAllowAlice',
          Effect: 'Allow',
          Principal: aliceArn,
          Action: 's3:GetObject',
          Resource: objectArn,
        },
      ],
    };

    const ctx: EvaluationContext = {
      principalArn: aliceArn,
      action: 's3:GetObject',
      resourceArn: objectArn,
      isSameAccount: true,
      identityPolicies: [],
      resourcePolicy: s3ResourcePolicy,
      permissionBoundary: boundaryRestrictingS3,
    };

    const result = evaluateIamPolicy(ctx);
    assert.equal(result.allowed, true);
    assert.equal(result.decision, 'ACCESS_ALLOWED');
  });
});
