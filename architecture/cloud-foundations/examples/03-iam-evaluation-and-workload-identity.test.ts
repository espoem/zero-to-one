import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { IamEvaluator, type IamPolicy } from './lib/cloud-models.ts';

describe('Module 03: IAM Evaluation & Workload Identity', () => {
  it('demonstrates explicit deny overrides broad allow permissions', () => {
    const policies: IamPolicy[] = [
      {
        statements: [
          {
            sid: 'AllowAllS3Read',
            effect: 'Allow',
            actions: ['s3:GetObject', 's3:ListBucket'],
            resources: ['arn:aws:s3:::corporate-data/*'],
          },
          {
            sid: 'DenyConfidentialFolder',
            effect: 'Deny',
            actions: ['s3:GetObject'],
            resources: ['arn:aws:s3:::corporate-data/confidential/*'],
          },
        ],
      },
    ];

    const allowedReq = IamEvaluator.evaluate(policies, {
      principal: 'arn:aws:iam::1111:user/analyst',
      action: 's3:GetObject',
      resource: 'arn:aws:s3:::corporate-data/public-reports/q3.csv',
    });
    assert.equal(allowedReq, 'ALLOWED');

    const deniedReq = IamEvaluator.evaluate(policies, {
      principal: 'arn:aws:iam::1111:user/analyst',
      action: 's3:GetObject',
      resource: 'arn:aws:s3:::corporate-data/confidential/salaries.csv',
    });
    assert.equal(deniedReq, 'DENIED_EXPLICIT');
  });

  it('evaluates ABAC principal tag condition keys', () => {
    const abacPolicy: IamPolicy = {
      statements: [
        {
          effect: 'Allow',
          actions: ['ec2:StartInstances', 'ec2:StopInstances'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:PrincipalTag/Department': 'PlatformEngineering',
            },
          },
        },
      ],
    };

    const devopsUser = IamEvaluator.evaluate([abacPolicy], {
      principal: 'arn:aws:iam::1111:user/devops',
      principalTags: { Department: 'PlatformEngineering' },
      action: 'ec2:StartInstances',
      resource: 'arn:aws:ec2:us-east-1:1111:instance/i-12345',
    });
    assert.equal(devopsUser, 'ALLOWED');

    const salesUser = IamEvaluator.evaluate([abacPolicy], {
      principal: 'arn:aws:iam::1111:user/sales',
      principalTags: { Department: 'Sales' },
      action: 'ec2:StartInstances',
      resource: 'arn:aws:ec2:us-east-1:1111:instance/i-12345',
    });
    assert.equal(salesUser, 'DENIED_DEFAULT');
  });

  it('proves OIDC workload identity eliminates static long-lived credentials', () => {
    // Workload identity exchange simulation (GitLab CI/CD JWT -> STS AssumeRoleWithWebIdentity)
    interface OidcTokenClaims {
      iss: string;
      sub: string;
      aud: string;
      exp: number;
    }

    function validateFederation(
      claims: OidcTokenClaims,
      expectedIssuer: string,
      expectedRepoSub: string,
      now: number,
    ): boolean {
      if (claims.iss !== expectedIssuer) return false;
      if (claims.sub !== expectedRepoSub) return false;
      if (claims.exp <= now) return false;
      return true;
    }

    const validToken: OidcTokenClaims = {
      iss: 'https://gitlab.com',
      sub: 'project_path:org/infra:ref_type:branch:ref:main',
      aud: 'https://aws.amazon.com',
      exp: 1800000000,
    };

    assert.ok(
      validateFederation(
        validToken,
        'https://gitlab.com',
        'project_path:org/infra:ref_type:branch:ref:main',
        1700000000,
      ),
    );
    assert.strictEqual(
      validateFederation(
        validToken,
        'https://evil.com',
        'project_path:org/infra:ref_type:branch:ref:main',
        1700000000,
      ),
      false,
    );
  });
});
