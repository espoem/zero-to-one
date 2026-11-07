// Module 10: Collaborative IaC Operations: HCP Terraform, Atlantis, GitLab State, and Saved-Plan Pipelines
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

test('CI/CD pipeline model: cryptographic plan artifact verification between plan and apply', () => {
  interface PlanArtifact {
    planId: string;
    commitSha: string;
    targetWorkspace: string;
    plannedChanges: string[];
    artifactSha256: string;
  }

  const generatePlanArtifact = (
    commitSha: string,
    workspace: string,
    changes: string[],
  ): { fileBuffer: Buffer; metadata: PlanArtifact } => {
    const rawContent = JSON.stringify({ commitSha, workspace, changes });
    const buffer = Buffer.from(rawContent, 'utf-8');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      fileBuffer: buffer,
      metadata: {
        planId: 'plan-run-9876',
        commitSha,
        targetWorkspace: workspace,
        plannedChanges: changes,
        artifactSha256: hash,
      },
    };
  };

  const verifyAndApplyPlan = (buffer: Buffer, expectedMeta: PlanArtifact): boolean => {
    const calculatedHash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (calculatedHash !== expectedMeta.artifactSha256) {
      throw new Error('Integrity failure: Plan artifact was tampered with between plan and apply!');
    }
    return true;
  };

  const { fileBuffer, metadata } = generatePlanArtifact('c0ffee1234', 'prod-networking', [
    'aws_vpc.main: update',
  ]);

  // Valid artifact applies cleanly:
  assert.equal(verifyAndApplyPlan(fileBuffer, metadata), true);

  // Negative test: Tampered plan artifact is rejected before apply
  const tamperedBuffer = Buffer.from(fileBuffer.toString('utf-8').replace('update', 'destroy'));
  assert.throws(
    () => verifyAndApplyPlan(tamperedBuffer, metadata),
    /Integrity failure: Plan artifact was tampered with/,
  );
});

test('speculative plans in PR workflows do not acquire state locks', () => {
  interface WorkspaceRun {
    id: string;
    isSpeculative: boolean;
    acquiresStateLock: boolean;
    canMutateState: boolean;
  }

  const triggerRun = (runType: 'pull_request' | 'merge_commit'): WorkspaceRun => {
    if (runType === 'pull_request') {
      return {
        id: 'run-speculative-1',
        isSpeculative: true,
        acquiresStateLock: false, // Speculative plan is read-only
        canMutateState: false,
      };
    }
    return {
      id: 'run-apply-prod-1',
      isSpeculative: false,
      acquiresStateLock: true, // Apply acquires exclusive write lock
      canMutateState: true,
    };
  };

  const prRun = triggerRun('pull_request');
  assert.equal(prRun.isSpeculative, true);
  assert.equal(prRun.acquiresStateLock, false);
  assert.equal(prRun.canMutateState, false);

  const mainRun = triggerRun('merge_commit');
  assert.equal(mainRun.isSpeculative, false);
  assert.equal(mainRun.acquiresStateLock, true);
  assert.equal(mainRun.canMutateState, true);
});

test('HCP Terraform variable sets hierarchy: organization vs project vs workspace scope', () => {
  interface VarHierarchy {
    orgLevel: Record<string, string>;
    projectLevel: Record<string, string>;
    workspaceLevel: Record<string, string>;
  }

  const resolveVariables = (hierarchy: VarHierarchy): Record<string, string> => {
    // Precedence: workspace overrides project, which overrides organization
    return {
      ...hierarchy.orgLevel,
      ...hierarchy.projectLevel,
      ...hierarchy.workspaceLevel,
    };
  };

  const hierarchy: VarHierarchy = {
    orgLevel: { AWS_DEFAULT_REGION: 'us-east-1', COST_CENTER: 'infra-shared' },
    projectLevel: { COST_CENTER: 'ecommerce-platform' },
    workspaceLevel: { AWS_DEFAULT_REGION: 'eu-west-1' },
  };

  const resolved = resolveVariables(hierarchy);
  // Workspace overrides org default:
  assert.equal(resolved.AWS_DEFAULT_REGION, 'eu-west-1');
  // Project overrides org default:
  assert.equal(resolved.COST_CENTER, 'ecommerce-platform');
});
