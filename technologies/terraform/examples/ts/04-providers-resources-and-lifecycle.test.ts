// Module 04: Providers, Resources, Data Sources, Meta-Arguments, and Lifecycle Invariants
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ResourcePlanner,
  planInstanceLifecycle,
  NameCollisionError,
  PreventDestroyError,
  createUnknown,
  isUnknown,
} from './lib/terraform-model.ts';

test('count vs for_each address generation', () => {
  const countAddrs = ResourcePlanner.planCountAddresses('aws_instance', 'web', 3);
  assert.deepEqual(countAddrs, [
    'aws_instance.web[0]',
    'aws_instance.web[1]',
    'aws_instance.web[2]',
  ]);

  const forEachAddrs = ResourcePlanner.planForEachAddresses('aws_instance', 'web', [
    'api',
    'worker',
  ]);
  assert.deepEqual(forEachAddrs, ['aws_instance.web["api"]', 'aws_instance.web["worker"]']);
});

test('production gotcha: count index shifting cascades destroys and updates', () => {
  // Initial 3 database servers created by count:
  const oldItems = [
    { id: 'srv-1', name: 'db-primary' },
    { id: 'srv-2', name: 'db-replica-eu' },
    { id: 'srv-3', name: 'db-replica-us' },
  ];

  // Operator deletes db-replica-eu from the middle of the list:
  const newItems = [
    { id: 'srv-1', name: 'db-primary' },
    { id: 'srv-3', name: 'db-replica-us' },
  ];

  const { plans, unintendedChurnCount } = ResourcePlanner.diffCountList(
    'aws_instance',
    'db',
    oldItems,
    newItems,
  );

  assert.equal(plans.length, 3);
  // [0] is no-op
  assert.equal(plans[0]?.action, 'no-op');
  // [1] was db-replica-eu, but now contains db-replica-us -> UPDATED or REPLACED!
  assert.equal(plans[1]?.action, 'update');
  assert.deepEqual(plans[1]?.diffAttributes, ['id', 'name']);
  // [2] was db-replica-us, but is now beyond new length -> DESTROYED!
  assert.equal(plans[2]?.action, 'destroy');

  // Downstream instances suffered unintended churn!
  assert.equal(unintendedChurnCount, 1);
});

test('for_each with stable keys eliminates index shift churn', () => {
  const oldMap = {
    primary: { id: 'srv-1', name: 'db-primary' },
    'replica-eu': { id: 'srv-2', name: 'db-replica-eu' },
    'replica-us': { id: 'srv-3', name: 'db-replica-us' },
  };

  // Delete 'replica-eu'
  const newMap = {
    primary: { id: 'srv-1', name: 'db-primary' },
    'replica-us': { id: 'srv-3', name: 'db-replica-us' },
  };

  const { plans, unintendedChurnCount } = ResourcePlanner.diffForEachMap(
    'aws_instance',
    'db',
    oldMap,
    newMap,
  );

  assert.equal(unintendedChurnCount, 0);

  const planPrimary = plans.find((p) => p.address === 'aws_instance.db["primary"]');
  const planEu = plans.find((p) => p.address === 'aws_instance.db["replica-eu"]');
  const planUs = plans.find((p) => p.address === 'aws_instance.db["replica-us"]');

  assert.equal(planPrimary?.action, 'no-op');
  assert.equal(planEu?.action, 'destroy');
  assert.equal(planUs?.action, 'no-op'); // Stable! Zero unintended changes.
});

test('lifecycle: create_before_destroy vs destroy_before_create', () => {
  const planDbc = planInstanceLifecycle({
    address: 'aws_instance.app',
    isExisting: true,
    isConfigured: true,
    oldAttrs: { ami: 'ami-1111' },
    newAttrs: { ami: 'ami-2222', force_new: true },
    lifecycle: { createBeforeDestroy: false },
  });
  assert.equal(planDbc.action, 'replace-dbc');

  const planCbd = planInstanceLifecycle({
    address: 'aws_instance.app',
    isExisting: true,
    isConfigured: true,
    oldAttrs: { ami: 'ami-1111' },
    newAttrs: { ami: 'ami-2222', force_new: true },
    lifecycle: { createBeforeDestroy: true },
  });
  assert.equal(planCbd.action, 'replace-cbd');
});

test('negative test: create_before_destroy with globally unique name causes collision failure', () => {
  // S3 bucket names and IAM role names must be globally unique across AWS!
  // When an attribute forcing replacement (e.g. account_id or subnet_id) changes,
  // CBD attempts to create the new instance before destroying the old one.
  assert.throws(
    () =>
      planInstanceLifecycle({
        address: 'aws_s3_bucket.data',
        isExisting: true,
        isConfigured: true,
        oldAttrs: { bucket: 'my-unique-company-bucket', region_id: 'us-east-1' },
        newAttrs: { bucket: 'my-unique-company-bucket', region_id: 'us-west-2' }, // forces replacement!
        lifecycle: { createBeforeDestroy: true },
        uniqueNameField: 'bucket',
        allowUniqueCollision: false,
      }),
    (err: unknown) => {
      assert.ok(err instanceof NameCollisionError);
      assert.equal(err.uniqueName, 'my-unique-company-bucket');
      return true;
    },
  );
});

test('lifecycle: prevent_destroy blocks destroy and replacement', () => {
  // Trying to destroy a protected resource
  assert.throws(
    () =>
      planInstanceLifecycle({
        address: 'aws_rds_cluster.main',
        isExisting: true,
        isConfigured: false,
        lifecycle: { preventDestroy: true },
      }),
    (err: unknown) => {
      assert.ok(err instanceof PreventDestroyError);
      return true;
    },
  );

  // Trying to replace a protected resource
  assert.throws(
    () =>
      planInstanceLifecycle({
        address: 'aws_rds_cluster.main',
        isExisting: true,
        isConfigured: true,
        oldAttrs: { engine_version: '15.4' },
        newAttrs: { engine_version: '16.1', force_new: true },
        lifecycle: { preventDestroy: true },
      }),
    (err: unknown) => {
      assert.ok(err instanceof PreventDestroyError);
      return true;
    },
  );
});

test('lifecycle: ignore_changes suppresses attribute diffs vs ignore_changes = all drift blindness', () => {
  // Scoped ignore_changes on tags
  const planScoped = planInstanceLifecycle({
    address: 'aws_instance.worker',
    isExisting: true,
    isConfigured: true,
    oldAttrs: { instance_type: 't3.micro', tags: { CostCenter: 'Finance' } },
    newAttrs: { instance_type: 't3.micro', tags: { CostCenter: 'Engineering' } },
    lifecycle: { ignoreChanges: ['tags'] },
  });
  // Since tags were ignored, no action is required
  assert.equal(planScoped.action, 'no-op');

  // Gotcha: ignore_changes = all ignores real infrastructure drift across every attribute
  const planAll = planInstanceLifecycle({
    address: 'aws_security_group.allow_all',
    isExisting: true,
    isConfigured: true,
    oldAttrs: { description: 'Old desc', cidr: '10.0.0.0/8' },
    newAttrs: { description: 'New desc', cidr: '0.0.0.0/0' }, // dangerous security change!
    lifecycle: { ignoreChanges: 'all' },
  });
  assert.equal(planAll.action, 'no-op');
});

test('data source with depends_on defers read to apply time and introduces unknown values', () => {
  // When a data source depends on a managed resource, reading it at plan time is impossible
  // because the resource might not exist or might change during apply.
  const dataReadAtPlanTime = (hasDependsOn: boolean) => {
    if (hasDependsOn) {
      return createUnknown('Deferred read of data.aws_ami.ubuntu until apply');
    }
    return 'ami-0c55b159cbfafe1f0'; // resolved at plan time
  };

  const valWithDep = dataReadAtPlanTime(true);
  assert.ok(isUnknown(valWithDep));

  const valWithoutDep = dataReadAtPlanTime(false);
  assert.equal(valWithoutDep, 'ami-0c55b159cbfafe1f0');
});

test('child module with internal provider configuration blocks count and for_each', () => {
  // Architectural invariant: Provider configs inside reusable modules block meta-arguments
  const canUseForEachOnModule = (moduleHasProviderConfig: boolean): boolean => {
    // Terraform documentation explicitly forbids `count` or `for_each` on module calls
    // if the child module defines its own provider configuration.
    return !moduleHasProviderConfig;
  };

  assert.equal(canUseForEachOnModule(false), true);
  assert.equal(canUseForEachOnModule(true), false);
});
