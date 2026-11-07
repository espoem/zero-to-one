import test from 'node:test';
import assert from 'node:assert';
import { validateAppProjectAccess, AppProject } from './lib/argocd-model.js';

test('07-multi-tenancy-rbac-and-secrets: AppProject Boundary Enforcement', () => {
  const project: AppProject = {
    name: 'team-a',
    description: 'Team A Project',
    sourceRepos: ['https://github.com/org/team-a-*'],
    destinations: [{ server: 'https://kubernetes.default.svc', namespace: 'team-a-*' }],
  };

  assert.strictEqual(
    validateAppProjectAccess(
      project,
      'https://github.com/org/team-a-repo',
      'https://kubernetes.default.svc',
      'team-a-dev',
    ),
    true,
  );
  assert.strictEqual(
    validateAppProjectAccess(
      project,
      'https://github.com/org/forbidden-repo',
      'https://kubernetes.default.svc',
      'team-a-dev',
    ),
    false,
  );
});
