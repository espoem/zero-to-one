// Module 11: Compose Specification in Depth: Dependency Graphs, Profiles, Merging, and Shared Stack Conventions
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { ComposeDagResolver, type ComposeServiceDef } from './lib/containers-model.ts';

test('compose dependency DAG computes correct topological startup ordering', () => {
  const resolver = new ComposeDagResolver();

  const services: ComposeServiceDef[] = [
    { name: 'web-frontend', dependsOn: { 'api-gateway': { condition: 'service_healthy' } } },
    {
      name: 'api-gateway',
      dependsOn: {
        'postgres-db': { condition: 'service_healthy' },
        'redis-cache': { condition: 'service_started' },
      },
    },
    { name: 'postgres-db' },
    { name: 'redis-cache' },
  ];

  const { order, hasCycle } = resolver.resolveStartupOrder(services);

  assert.equal(hasCycle, false);
  // Databases must start before api-gateway, and api-gateway must start before web-frontend
  const posPostgres = order.indexOf('postgres-db');
  const posRedis = order.indexOf('redis-cache');
  const posGateway = order.indexOf('api-gateway');
  const posFrontend = order.indexOf('web-frontend');

  assert.ok(posPostgres < posGateway);
  assert.ok(posRedis < posGateway);
  assert.ok(posGateway < posFrontend);
});

test('compose dependency DAG detects and flags circular dependencies', () => {
  const resolver = new ComposeDagResolver();

  const circularServices: ComposeServiceDef[] = [
    { name: 'service-a', dependsOn: { 'service-b': {} } },
    { name: 'service-b', dependsOn: { 'service-c': {} } },
    { name: 'service-c', dependsOn: { 'service-a': {} } },
  ];

  const { hasCycle } = resolver.resolveStartupOrder(circularServices);
  assert.equal(hasCycle, true, 'Circular dependency cycle must be detected');
});

test('compose profiles partition services so only active profiles are spun up', () => {
  const resolver = new ComposeDagResolver();

  const services: ComposeServiceDef[] = [
    { name: 'redis-primary' }, // No profiles -> active by default
    { name: 'redis-replica-1', profiles: ['cluster'] },
    { name: 'redis-replica-2', profiles: ['cluster'] },
    { name: 'prometheus', profiles: ['monitoring'] },
  ];

  // 1. Default run (no profiles specified):
  const defaultServices = resolver.filterByProfiles(services, []);
  assert.deepEqual(
    defaultServices.map((s) => s.name),
    ['redis-primary'],
  );

  // 2. Cluster profile run:
  const clusterServices = resolver.filterByProfiles(services, ['cluster']);
  assert.deepEqual(
    clusterServices.map((s) => s.name),
    ['redis-primary', 'redis-replica-1', 'redis-replica-2'],
  );

  // 3. Monitoring profile run:
  const monitoringServices = resolver.filterByProfiles(services, ['monitoring']);
  assert.deepEqual(
    monitoringServices.map((s) => s.name),
    ['redis-primary', 'prometheus'],
  );
});

test('compose variable interpolation follows strict precedence order', () => {
  const resolver = new ComposeDagResolver();
  const template = 'DB_PORT=${PORT:-5432} DB_PASS=${PASSWORD:-default_pass} DB_USER=${USER:-guest}';

  // Precedence: inlineEnv > processEnv > dotenv > default fallback syntax
  const result = resolver.resolveInterpolation(template, {
    inlineEnv: { PORT: '5433' },
    processEnv: { PORT: '5434', PASSWORD: 'prod_password' },
    dotenv: { PORT: '5435', PASSWORD: 'dotenv_password', USER: 'admin_user' },
  });

  // PORT should come from inlineEnv (5433)
  assert.ok(result.includes('DB_PORT=5433'));
  // PASSWORD not in inlineEnv, should come from processEnv (prod_password)
  assert.ok(result.includes('DB_PASS=prod_password'));
  // USER not in inlineEnv or processEnv, should come from dotenv (admin_user)
  assert.ok(result.includes('DB_USER=admin_user'));
});

test('property-based test: unprofiled services are always included in every profile query', () => {
  const resolver = new ComposeDagResolver();
  const unprofiledService: ComposeServiceDef = { name: 'always-active' };

  fc.assert(
    fc.property(fc.array(fc.string({ minLength: 1, maxLength: 10 })), (profiles) => {
      const filtered = resolver.filterByProfiles([unprofiledService], profiles);
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0]?.name, 'always-active');
    }),
  );
});
