import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  KmsEngine,
  envelopeEncrypt,
  envelopeDecrypt,
  S3BucketKeySimulation,
  type PolicyDocument,
} from './lib/aws-models.ts';

describe('KMS Envelope Encryption & Key Policy Engine', () => {
  const accountId = '111122223333';
  const aliceArn = `arn:aws:iam::${accountId}:user/Alice`;
  const bobArn = `arn:aws:iam::${accountId}:user/Bob`;
  const rootArn = `arn:aws:iam::${accountId}:root`;

  test('Key Policy Evaluation: Denies IAM identity policy if Key Policy omits root delegation', () => {
    const kms = new KmsEngine();

    // Key policy allows ONLY Alice explicitly; NO root delegation statement exists
    const restrictiveKeyPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowAliceDirectly',
          Effect: 'Allow',
          Action: 'kms:*',
          Resource: '*',
          ...({ Principal: { AWS: aliceArn } } as object),
        },
      ],
    };

    const key = kms.createKey(accountId, restrictiveKeyPolicy);

    // Bob has an administrator IAM Identity Policy allowing all KMS actions
    const bobIdentityPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AdminKmsAllow',
          Effect: 'Allow',
          Action: 'kms:*',
          Resource: '*',
        },
      ],
    };

    // Even though Bob has an IAM policy, KMS denies access because the Key Policy does not delegate to root!
    const bobAccess = kms.evaluateAccess(key.keyId, bobArn, 'kms:GenerateDataKey', [
      bobIdentityPolicy,
    ]);
    assert.equal(bobAccess.allowed, false);
    assert.equal(bobAccess.reason, 'DeniedBecauseKeyPolicyOmitsIamDelegation');

    // Alice is directly in the key policy, so her request succeeds
    const aliceAccess = kms.evaluateAccess(key.keyId, aliceArn, 'kms:GenerateDataKey', []);
    assert.equal(aliceAccess.allowed, true);
    assert.equal(aliceAccess.reason, 'AllowedByKeyPolicy');
  });

  test('Key Policy Delegation: Enables IAM identity policies when root delegation is present', () => {
    const kms = new KmsEngine();

    // Standard default KMS key policy that delegates administration to the account root
    const standardKeyPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'EnableIAMUserPermissions',
          Effect: 'Allow',
          Action: 'kms:*',
          Resource: '*',
          ...({ Principal: { AWS: rootArn } } as object),
        },
      ],
    };

    const key = kms.createKey(accountId, standardKeyPolicy);

    const bobIdentityPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowBobDataKey',
          Effect: 'Allow',
          Action: 'kms:GenerateDataKey',
          Resource: key.arn,
        },
      ],
    };

    // With root delegation in the Key Policy, Bob's identity policy successfully authorizes the action
    const bobAccess = kms.evaluateAccess(key.keyId, bobArn, 'kms:GenerateDataKey', [
      bobIdentityPolicy,
    ]);
    assert.equal(bobAccess.allowed, true);
    assert.equal(bobAccess.reason, 'AllowedViaIamDelegation');

    // Actions NOT granted in Bob's identity policy are still denied
    const bobDecryptAccess = kms.evaluateAccess(key.keyId, bobArn, 'kms:Decrypt', [
      bobIdentityPolicy,
    ]);
    assert.equal(bobDecryptAccess.allowed, false);
    assert.equal(bobDecryptAccess.reason, 'DefaultDeny');
  });

  test('KMS Grants: Temporarily delegates cryptographic operations and revokes on retirement', () => {
    const kms = new KmsEngine();

    const restrictiveKeyPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowAliceDirectly',
          Effect: 'Allow',
          Action: 'kms:*',
          Resource: '*',
          ...({ Principal: { AWS: aliceArn } } as object),
        },
      ],
    };

    const key = kms.createKey(accountId, restrictiveKeyPolicy);

    // Initial check: Bob has no access
    assert.equal(kms.evaluateAccess(key.keyId, bobArn, 'kms:Decrypt').allowed, false);

    // Alice creates a temporary Grant for Bob to perform Decrypt operations
    const grantId = kms.createGrant(key.keyId, {
      granteePrincipal: bobArn,
      operations: ['Decrypt'],
      name: 'TemporaryAppMigrationGrant',
    });

    // Bob can now decrypt
    const bobAccessWithGrant = kms.evaluateAccess(key.keyId, bobArn, 'kms:Decrypt');
    assert.equal(bobAccessWithGrant.allowed, true);
    assert.equal(bobAccessWithGrant.reason, 'AllowedViaGrant');

    // Operations outside the grant remain denied
    assert.equal(kms.evaluateAccess(key.keyId, bobArn, 'kms:GenerateDataKey').allowed, false);

    // Retire grant: access is immediately revoked
    const retired = kms.retireGrant(key.keyId, grantId);
    assert.equal(retired, true);
    assert.equal(kms.evaluateAccess(key.keyId, bobArn, 'kms:Decrypt').allowed, false);
  });

  test('Envelope Encryption: End-to-end data encryption, local DEK wiping, and authentication', () => {
    const kms = new KmsEngine();
    const standardKeyPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'RootDelegation',
          Effect: 'Allow',
          Action: 'kms:*',
          Resource: '*',
          ...({ Principal: { AWS: rootArn } } as object),
        },
      ],
    };
    const key = kms.createKey(accountId, standardKeyPolicy);

    const appIdentityPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'KmsOperations',
          Effect: 'Allow',
          Action: ['kms:GenerateDataKey', 'kms:Decrypt'],
          Resource: key.arn,
        },
      ],
    };

    const payload = Buffer.from(
      'Sensitive financial transaction payload: $4,500,000 USD transfer',
      'utf-8',
    );

    // Perform Envelope Encryption
    const encryptedPackage = envelopeEncrypt(payload, key.keyId, kms, aliceArn, [
      appIdentityPolicy,
    ]);

    assert.notDeepEqual(encryptedPackage.ciphertextPayload, payload);
    assert.equal(encryptedPackage.encryptedDataKey.length >= 28, true);

    // Decrypt Envelope
    const decryptedPayload = envelopeDecrypt(encryptedPackage, key.keyId, kms, aliceArn, [
      appIdentityPolicy,
    ]);
    assert.equal(decryptedPayload.toString('utf-8'), payload.toString('utf-8'));

    // Tampered payload fails authentication
    const tamperedPackage = {
      ...encryptedPackage,
      ciphertextPayload: Buffer.from(encryptedPackage.ciphertextPayload),
    };
    const firstByte = tamperedPackage.ciphertextPayload[0] ?? 0;
    tamperedPackage.ciphertextPayload[0] = firstByte ^ 0xff;

    assert.throws(
      () => envelopeDecrypt(tamperedPackage, key.keyId, kms, aliceArn, [appIdentityPolicy]),
      /Unsupported state or unable to authenticate data/,
    );
  });

  test('S3 Bucket Keys: Reduces KMS API requests by 99% on bulk object storage operations', () => {
    const kms = new KmsEngine();
    const standardKeyPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'RootDelegation',
          Effect: 'Allow',
          Action: 'kms:*',
          Resource: '*',
          ...({ Principal: { AWS: rootArn } } as object),
        },
      ],
    };
    const key = kms.createKey(accountId, standardKeyPolicy);

    const appIdentityPolicy: PolicyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'KmsOperations',
          Effect: 'Allow',
          Action: ['kms:GenerateDataKey', 'kms:Decrypt'],
          Resource: key.arn,
        },
      ],
    };

    const simulation = new S3BucketKeySimulation(kms, key.keyId, aliceArn, [appIdentityPolicy]);
    const objectCount = 1000;
    const sampleData = Buffer.from('Telemetry measurement row content', 'utf-8');

    // Phase 1: Upload 1,000 objects WITHOUT S3 Bucket Keys
    const initialCallCount = kms.apiCallCount;
    for (let i = 0; i < objectCount; i++) {
      simulation.putObjectWithoutBucketKey(`telemetry/sensor-${i}.json`, sampleData);
    }
    const callsWithoutBucketKey = kms.apiCallCount - initialCallCount;
    assert.equal(
      callsWithoutBucketKey,
      1000,
      'Without Bucket Keys, 1,000 objects require 1,000 KMS API calls',
    );

    // Phase 2: Upload 1,000 objects WITH S3 Bucket Keys
    const beforeBucketKeyCount = kms.apiCallCount;
    for (let i = 0; i < objectCount; i++) {
      simulation.putObjectWithBucketKey(`telemetry/sensor-${i}.json`, sampleData);
    }
    const callsWithBucketKey = kms.apiCallCount - beforeBucketKeyCount;
    assert.equal(
      callsWithBucketKey,
      1,
      'With Bucket Keys, 1,000 objects require exactly 1 KMS API call for bucket key negotiation',
    );

    const reductionPercent =
      ((callsWithoutBucketKey - callsWithBucketKey) / callsWithoutBucketKey) * 100;
    assert.equal(
      reductionPercent,
      99.9,
      'S3 Bucket Keys achieve 99.9% reduction in KMS request volume',
    );
  });
});
