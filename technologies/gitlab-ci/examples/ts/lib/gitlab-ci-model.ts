// GitLab CI/CD Domain Model & Verification Engine
// Implements core CI/CD semantics, DORA metrics, GitLab 19 DAG, Components,
// Runner security, Supply-Chain Security (SBOM/Cosign/SLSA), Resource Groups, and OIDC federation.

// ============================================================================
// 1. DORA Four Keys Calculator (Module 01)
// ============================================================================

export type DORARating = 'Elite' | 'High' | 'Medium' | 'Low';

export interface DeploymentRecord {
  id: string;
  commitSha: string;
  commitTimestamp: number; // Unix epoch ms
  deployedAt: number; // Unix epoch ms
  environment: 'production' | 'staging' | string;
  status: 'success' | 'failure';
  failureResolvedAt?: number; // Unix epoch ms when incident was mitigated
}

export interface MetricResult {
  value: number;
  unit: string;
  rating: DORARating;
  description: string;
}

export interface DORAMetrics {
  deploymentFrequency: MetricResult;
  leadTimeForChanges: MetricResult;
  changeFailureRate: MetricResult;
  failedDeploymentRecoveryTime: MetricResult;
  overallTier: DORARating;
}

export function calculateDORAMetrics(
  deployments: DeploymentRecord[],
  windowDays = 30,
): DORAMetrics {
  const prodDeploys = deployments.filter((d) => d.environment === 'production');
  const now = Date.now();
  const windowMs = windowDays * 24 * 3600 * 1000;
  const recentDeploys = prodDeploys.filter((d) => d.deployedAt >= now - windowMs);

  // 1. Deployment Frequency: deployments per day
  const deployCount = recentDeploys.length;
  const deploysPerDay = windowDays > 0 ? deployCount / windowDays : 0;
  let dfRating: DORARating = 'Low';
  if (deploysPerDay >= 1.0) {
    dfRating = 'Elite'; // Multiple or at least daily
  } else if (deploysPerDay >= 1 / 7) {
    dfRating = 'High'; // Weekly to daily
  } else if (deploysPerDay >= 1 / 30) {
    dfRating = 'Medium'; // Monthly to weekly
  }

  // 2. Lead Time for Changes (median commit-to-production in hours)
  const leadTimesHours = recentDeploys
    .filter((d) => d.status === 'success')
    .map((d) => Math.max(0, (d.deployedAt - d.commitTimestamp) / (3600 * 1000)))
    .sort((a, b) => a - b);

  const medianLeadTimeHours =
    leadTimesHours.length > 0 ? (leadTimesHours[Math.floor(leadTimesHours.length / 2)] ?? 0) : 0;

  let ltRating: DORARating = 'Low';
  if (medianLeadTimeHours > 0 && medianLeadTimeHours <= 24) {
    ltRating = 'Elite'; // < 1 day
  } else if (medianLeadTimeHours <= 168) {
    ltRating = 'High'; // 1 day to 1 week
  } else if (medianLeadTimeHours <= 720) {
    ltRating = 'Medium'; // 1 week to 1 month
  }

  // 3. Change Failure Rate (failed prod deployments / total prod deployments)
  const failedDeploys = recentDeploys.filter((d) => d.status === 'failure');
  const failureRatePercent =
    recentDeploys.length > 0 ? (failedDeploys.length / recentDeploys.length) * 100 : 0;

  let cfrRating: DORARating = 'Low';
  if (failureRatePercent <= 15) {
    cfrRating = 'Elite'; // 0-15%
  } else if (failureRatePercent <= 30) {
    cfrRating = 'High'; // 16-30%
  } else if (failureRatePercent <= 45) {
    cfrRating = 'Medium'; // 31-45%
  }

  // 4. Failed Deployment Recovery Time (formerly MTTR): median hours to restore service
  const recoveryTimesHours = failedDeploys
    .filter((d) => d.failureResolvedAt && d.failureResolvedAt >= d.deployedAt)
    .map((d) => ((d.failureResolvedAt as number) - d.deployedAt) / (3600 * 1000))
    .sort((a, b) => a - b);

  const medianRecoveryHours =
    recoveryTimesHours.length > 0
      ? (recoveryTimesHours[Math.floor(recoveryTimesHours.length / 2)] ?? 0)
      : 0;

  let fdrtRating: DORARating = 'Low';
  if (recoveryTimesHours.length === 0 || medianRecoveryHours <= 1) {
    fdrtRating = 'Elite'; // < 1 hour
  } else if (medianRecoveryHours <= 24) {
    fdrtRating = 'High'; // < 1 day
  } else if (medianRecoveryHours <= 168) {
    fdrtRating = 'Medium'; // < 1 week
  }

  // Overall Tier calculation (Conservative: minimum or plurality)
  const scores: Record<DORARating, number> = { Elite: 4, High: 3, Medium: 2, Low: 1 };
  const avgScore =
    (scores[dfRating] + scores[ltRating] + scores[cfrRating] + scores[fdrtRating]) / 4;
  let overallTier: DORARating = 'Low';
  if (avgScore >= 3.5) {
    overallTier = 'Elite';
  } else if (avgScore >= 2.75) {
    overallTier = 'High';
  } else if (avgScore >= 1.75) {
    overallTier = 'Medium';
  }

  return {
    deploymentFrequency: {
      value: deploysPerDay,
      unit: 'deploys/day',
      rating: dfRating,
      description: `${deploysPerDay.toFixed(2)} deployments/day`,
    },
    leadTimeForChanges: {
      value: medianLeadTimeHours,
      unit: 'hours',
      rating: ltRating,
      description: `${medianLeadTimeHours.toFixed(1)} hours median lead time`,
    },
    changeFailureRate: {
      value: failureRatePercent,
      unit: 'percent',
      rating: cfrRating,
      description: `${failureRatePercent.toFixed(1)}% change failure rate`,
    },
    failedDeploymentRecoveryTime: {
      value: medianRecoveryHours,
      unit: 'hours',
      rating: fdrtRating,
      description: `${medianRecoveryHours.toFixed(1)} hours median recovery time`,
    },
    overallTier,
  };
}

// ============================================================================
// 2. GitLab CI Execution Model, Stages vs Needs DAG & Precedence (Module 02)
// ============================================================================

export interface RuleCondition {
  if?: string;
  changes?: { paths: string[]; compareTo?: string };
  when?: 'on_success' | 'manual' | 'always' | 'never';
  allow_failure?: boolean;
}

export interface CacheConfig {
  key?: string | { files?: string[]; prefix?: string };
  paths?: string[];
  policy?: 'pull-push' | 'pull' | 'push';
  untracked?: boolean;
}

export interface ArtifactConfig {
  paths: string[];
  expireIn?: string; // e.g. "1 hour", "7 days", "1 month"
  when?: 'on_success' | 'on_failure' | 'always';
  reports?: Record<string, string>;
}

export interface NeedDependency {
  job: string;
  artifacts?: boolean;
}

export interface JobDefinition {
  name: string;
  stage?: string;
  needs?: Array<string | NeedDependency>;
  rules?: RuleCondition[];
  only?: string[];
  except?: string[];
  variables?: Record<string, string>;
  cache?: CacheConfig;
  artifacts?: ArtifactConfig;
  interruptible?: boolean;
  resourceGroup?: string;
  script?: string[];
}

export interface PipelineContext {
  pipelineSource: 'push' | 'merge_request_event' | 'schedule' | 'tag' | 'web';
  branch?: string;
  tag?: string;
  openMergeRequests?: boolean;
  changedFiles?: string[];
  isProtected?: boolean;
}

// Gotcha 8: mixing legacy only/except with rules is disallowed by GitLab CI parser
export function validateJobSyntax(job: JobDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const hasRules = job.rules && job.rules.length > 0;
  const hasLegacyOnlyExcept =
    (job.only && job.only.length > 0) || (job.except && job.except.length > 0);

  if (hasRules && hasLegacyOnlyExcept) {
    errors.push(
      `Job '${job.name}' mixes legacy 'only'/'except' keywords with modern 'rules'. This is a syntax error in GitLab CI.`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Gotcha 2: duplicate pipelines (branch + MR) without workflow:rules
export function evaluateDuplicatePipelineRisk(
  ctx: PipelineContext,
  hasWorkflowRules: boolean,
): {
  createdPipelines: Array<'branch' | 'merge_request'>;
  duplicateDetected: boolean;
} {
  const created: Array<'branch' | 'merge_request'> = [];

  if (!hasWorkflowRules) {
    // Default legacy behavior: branch push creates branch pipeline
    if (ctx.branch) {
      created.push('branch');
    }
    // If branch has an open MR or push is MR event, MR pipeline is ALSO created!
    if (ctx.openMergeRequests || ctx.pipelineSource === 'merge_request_event') {
      created.push('merge_request');
    }
  } else {
    // Best practice workflow:rules:
    // If MR event, create MR pipeline; if branch push with open MR, skip branch pipeline!
    if (ctx.pipelineSource === 'merge_request_event') {
      created.push('merge_request');
    } else if (ctx.branch && !ctx.openMergeRequests) {
      created.push('branch');
    }
  }

  return {
    createdPipelines: created,
    duplicateDetected: created.length > 1,
  };
}

// Gotcha 1: rules:changes on scheduled or tag pipelines evaluates to true without compare_to
export function evaluateRulesChanges(condition: RuleCondition, ctx: PipelineContext): boolean {
  if (!condition.changes || !condition.changes.paths) {
    return true; // No changes restriction
  }

  // Trapping Gotcha: On scheduled or tag pipelines without compare_to, GitLab defaults changes to true!
  if (
    (ctx.pipelineSource === 'schedule' || ctx.pipelineSource === 'tag') &&
    !condition.changes.compareTo
  ) {
    return true; // Always true gotcha!
  }

  // Normal comparison against changedFiles
  const changedFiles = ctx.changedFiles ?? [];
  return condition.changes.paths.some((pattern) => {
    const cleanPattern = pattern.replace('/*', '');
    return changedFiles.some((f) => f.startsWith(cleanPattern) || f === pattern);
  });
}

// Gotcha 9: needs across stages skipping implicit artifact download unless specified
export function resolveArtifactPropagation(
  allJobs: Record<string, JobDefinition>,
  targetJobName: string,
): {
  downloadedFrom: string[];
  skippedEarlierStageJobs: string[];
} {
  const targetJob = allJobs[targetJobName];
  if (!targetJob) {
    throw new Error(`Job ${targetJobName} not found in pipeline`);
  }

  const stagesOrder = ['.pre', 'build', 'test', 'deploy', '.post'];
  const targetStageIndex = stagesOrder.indexOf(targetJob.stage ?? 'test');

  const earlierJobsWithArtifacts = Object.values(allJobs).filter((j) => {
    const jStageIndex = stagesOrder.indexOf(j.stage ?? 'test');
    return jStageIndex < targetStageIndex && j.artifacts && j.artifacts.paths.length > 0;
  });

  if (!targetJob.needs || targetJob.needs.length === 0) {
    // Classic stage execution: implicitly downloads artifacts from ALL earlier stages!
    return {
      downloadedFrom: earlierJobsWithArtifacts.map((j) => j.name),
      skippedEarlierStageJobs: [],
    };
  }

  // 'needs' DAG execution: ONLY downloads from explicit needs where artifacts !== false!
  const explicitNeeds = targetJob.needs.map((n) => (typeof n === 'string' ? { job: n } : n));
  const downloadedFrom: string[] = [];
  const explicitJobNames = new Set(explicitNeeds.map((n) => n.job));

  for (const need of explicitNeeds) {
    if (need.artifacts !== false && allJobs[need.job]?.artifacts) {
      downloadedFrom.push(need.job);
    }
  }

  const skippedEarlierStageJobs = earlierJobsWithArtifacts
    .filter((j) => !explicitJobNames.has(j.name))
    .map((j) => j.name);

  return {
    downloadedFrom,
    skippedEarlierStageJobs,
  };
}

// Gotcha 6: Unkeyed or shared cache poisoning
export function validateCacheKey(
  cache?: CacheConfig,
  _branch?: string,
): { safe: boolean; riskLevel: 'NONE' | 'HIGH'; warning?: string } {
  if (!cache || !cache.key) {
    return {
      safe: false,
      riskLevel: 'HIGH',
      warning:
        'Cache key is undefined: falls back to default unkeyed cache shared across all branches, causing cross-branch contamination.',
    };
  }

  const keyStr = typeof cache.key === 'string' ? cache.key : JSON.stringify(cache.key);
  if (keyStr === 'default' || keyStr === 'global') {
    return {
      safe: false,
      riskLevel: 'HIGH',
      warning: `Cache key '${keyStr}' is static and shared across all branches, allowing dirty dependencies to poison subsequent builds.`,
    };
  }

  return { safe: true, riskLevel: 'NONE' };
}

// Gotcha 7: Missing artifacts:expire_in leading to coordinator storage exhaustion
export function validateArtifactConfig(artifacts?: ArtifactConfig): {
  safe: boolean;
  warning?: string;
} {
  if (!artifacts) return { safe: true };

  if (!artifacts.expireIn || artifacts.expireIn.trim() === '') {
    return {
      safe: false,
      warning:
        'Missing artifacts:expire_in. Artifacts will be kept indefinitely by default, risking storage volume exhaustion.',
    };
  }

  return { safe: true };
}

// 14-Level Variable Precedence Hierarchy in GitLab CI/CD
export interface VariableScopeContext {
  triggerVariables?: Record<string, string>; // 1
  scheduledVariables?: Record<string, string>; // 2
  manualVariables?: Record<string, string>; // 3
  parentPipelineVariables?: Record<string, string>; // 4
  projectVariables?: Record<string, string>; // 5
  projectEnvVariables?: Record<string, string>; // 6
  groupVariables?: Record<string, string>; // 7
  groupEnvVariables?: Record<string, string>; // 8
  instanceVariables?: Record<string, string>; // 9
  jobVariables?: Record<string, string>; // 10
  rootVariables?: Record<string, string>; // 11
  inheritedVariables?: Record<string, string>; // 12
  predefinedVariables?: Record<string, string>; // 13
  deploymentVariables?: Record<string, string>; // 14
}

export function resolveVariablePrecedence(
  varName: string,
  ctx: VariableScopeContext,
): { value: string | undefined; level: number; source: string } {
  const levels: Array<{ level: number; source: string; vars?: Record<string, string> }> = [
    { level: 1, source: 'Trigger variables', vars: ctx.triggerVariables },
    { level: 2, source: 'Scheduled pipeline variables', vars: ctx.scheduledVariables },
    { level: 3, source: 'Manual pipeline run variables', vars: ctx.manualVariables },
    {
      level: 4,
      source: 'Pipeline variables (parent/downstream)',
      vars: ctx.parentPipelineVariables,
    },
    { level: 5, source: 'Project-level CI variables', vars: ctx.projectVariables },
    { level: 6, source: 'Project-level environment variables', vars: ctx.projectEnvVariables },
    { level: 7, source: 'Group-level CI variables', vars: ctx.groupVariables },
    { level: 8, source: 'Group-level environment variables', vars: ctx.groupEnvVariables },
    { level: 9, source: 'Instance-level variables', vars: ctx.instanceVariables },
    { level: 10, source: 'Job-level .gitlab-ci.yml variables', vars: ctx.jobVariables },
    { level: 11, source: 'Root-level .gitlab-ci.yml variables', vars: ctx.rootVariables },
    { level: 12, source: 'Inherited variables', vars: ctx.inheritedVariables },
    { level: 13, source: 'Predefined variables', vars: ctx.predefinedVariables },
    { level: 14, source: 'Deployment variables', vars: ctx.deploymentVariables },
  ];

  for (const lvl of levels) {
    if (lvl.vars && Object.prototype.hasOwnProperty.call(lvl.vars, varName)) {
      return {
        value: lvl.vars[varName],
        level: lvl.level,
        source: lvl.source,
      };
    }
  }

  return { value: undefined, level: -1, source: 'Not Found' };
}

// DAG Cycle Detector & Topological Sorter
export function buildPipelineDAG(jobs: Record<string, JobDefinition>): {
  hasCycle: boolean;
  cycleNodes: string[];
  executionOrder: string[];
} {
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const jobName of Object.keys(jobs)) {
    adj.set(jobName, []);
    inDegree.set(jobName, 0);
  }

  for (const [name, job] of Object.entries(jobs)) {
    if (job.needs) {
      for (const n of job.needs) {
        const depName = typeof n === 'string' ? n : n.job;
        if (adj.has(depName)) {
          adj.get(depName)?.push(name);
          inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
        }
      }
    }
  }

  const queue: string[] = [];
  for (const [node, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(node);
  }

  const executionOrder: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    executionOrder.push(curr);
    for (const neighbor of adj.get(curr) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  const hasCycle = executionOrder.length < Object.keys(jobs).length;
  const cycleNodes = hasCycle ? Object.keys(jobs).filter((k) => !executionOrder.includes(k)) : [];

  return {
    hasCycle,
    cycleNodes,
    executionOrder,
  };
}

// ============================================================================
// 3. Pipeline Reuse, CI/CD Components & Spec Inputs (Module 03)
// ============================================================================

export interface ComponentInputSpec {
  name: string;
  type?: 'string' | 'number' | 'boolean' | 'array';
  default?: any;
  regex?: string;
  description?: string;
  options?: any[];
}

export function validateComponentInputs(
  specs: Record<string, ComponentInputSpec>,
  passedInputs: Record<string, any>,
): { valid: boolean; errors: string[]; resolved: Record<string, any> } {
  const errors: string[] = [];
  const resolved: Record<string, any> = {};

  for (const [name, spec] of Object.entries(specs)) {
    const hasPassed = Object.prototype.hasOwnProperty.call(passedInputs, name);
    let val = hasPassed ? passedInputs[name] : spec.default;

    if (val === undefined) {
      errors.push(`Required input '${name}' is missing without a default value.`);
      continue;
    }

    // Type checking
    if (spec.type) {
      const actualType = Array.isArray(val) ? 'array' : typeof val;
      if (actualType !== spec.type) {
        errors.push(`Input '${name}' expected type '${spec.type}', but received '${actualType}'.`);
      }
    }

    // Regex validation for strings
    if (spec.regex && typeof val === 'string') {
      const reg = new RegExp(spec.regex);
      if (!reg.test(val)) {
        errors.push(`Input '${name}' value '${val}' does not match regex /${spec.regex}/.`);
      }
    }

    // Options validation
    if (spec.options && spec.options.length > 0) {
      if (!spec.options.includes(val)) {
        errors.push(
          `Input '${name}' value '${val}' is not in allowed options: [${spec.options.join(', ')}].`,
        );
      }
    }

    resolved[name] = val;
  }

  return {
    valid: errors.length === 0,
    errors,
    resolved,
  };
}

// Resolves extends: [baseJob] and !reference [block, key]
export function resolveReferencesAndExtends(rawConfig: Record<string, any>): Record<string, any> {
  const output: Record<string, any> = JSON.parse(JSON.stringify(rawConfig));

  // 1. Resolve extends
  for (const [key, job] of Object.entries(output)) {
    if (job && typeof job === 'object' && job.extends) {
      const baseKeys = Array.isArray(job.extends) ? job.extends : [job.extends];
      let mergedBase: Record<string, any> = {};
      for (const baseKey of baseKeys) {
        if (output[baseKey]) {
          mergedBase = { ...mergedBase, ...output[baseKey] };
        }
      }
      output[key] = { ...mergedBase, ...job };
      delete output[key].extends;
    }
  }

  // 2. Resolve !reference pseudo tokens ({ $ref: [block, prop] })
  function resolveRefRecursively(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(resolveRefRecursively);

    if (obj.$ref && Array.isArray(obj.$ref) && obj.$ref.length === 2) {
      const [block, prop] = obj.$ref;
      return output[block]?.[prop] ?? obj;
    }

    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = resolveRefRecursively(v);
    }
    return res;
  }

  return resolveRefRecursively(output);
}

// Dynamic Child Pipeline Generator
export function generateDynamicChildPipeline(
  services: Array<{ name: string; path: string; hasChanges: boolean }>,
): { generatedConfig: Record<string, any>; activeJobsCount: number } {
  const changedServices = services.filter((s) => s.hasChanges);
  const jobs: Record<string, any> = {
    stages: ['build', 'test'],
  };

  for (const svc of changedServices) {
    jobs[`build:${svc.name}`] = {
      stage: 'build',
      script: [`cd ${svc.path} && make build`],
      artifacts: { paths: [`${svc.path}/dist/`] },
    };
    jobs[`test:${svc.name}`] = {
      stage: 'test',
      needs: [`build:${svc.name}`],
      script: [`cd ${svc.path} && make test`],
    };
  }

  return {
    generatedConfig: jobs,
    activeJobsCount: changedServices.length * 2,
  };
}

// ============================================================================
// 4. Runner Architecture, Executors & DinD Security (Module 04)
// ============================================================================

export type RunnerExecutor = 'docker' | 'kubernetes' | 'docker-autoscaler' | 'shell';

export interface RunnerConfig {
  executor: RunnerExecutor;
  privileged?: boolean;
  tags: string[];
  shared: boolean;
  rootless?: boolean;
}

export function selectRunnerExecutor(req: {
  isolatedContainer: boolean;
  k8sNative: boolean;
  vmScale: boolean;
  hostDirect: boolean;
}): RunnerExecutor {
  if (req.hostDirect) return 'shell';
  if (req.k8sNative) return 'kubernetes';
  if (req.vmScale) return 'docker-autoscaler';
  return 'docker';
}

// Gotcha 5: privileged docker:dind container escape on shared runner
export function auditContainerBuildSecurity(
  runner: RunnerConfig,
  build: { usesDinD: boolean; usesBuildKitRootless: boolean; usesKaniko: boolean },
): { secure: boolean; riskLevel: 'NONE' | 'MEDIUM' | 'CRITICAL'; escapeVulnerabilities: string[] } {
  const escapes: string[] = [];

  if (build.usesDinD && runner.privileged) {
    if (runner.shared) {
      escapes.push(
        'CRITICAL: Shared multi-tenant runner grants privileged: true with docker:dind. Malicious jobs can access /dev, mount host rootfs, read host Docker daemon socket, or escape namespace boundaries.',
      );
    } else {
      escapes.push(
        'MEDIUM: Dedicated runner with privileged: true has host escape surface if untrusted code or PRs are built.',
      );
    }
  }

  if (build.usesBuildKitRootless || build.usesKaniko) {
    // Daemonless or rootless user-namespace build
    return {
      secure: true,
      riskLevel: 'NONE',
      escapeVulnerabilities: [],
    };
  }

  return {
    secure: escapes.length === 0,
    riskLevel: escapes.some((e) => e.startsWith('CRITICAL'))
      ? 'CRITICAL'
      : escapes.length > 0
        ? 'MEDIUM'
        : 'NONE',
    escapeVulnerabilities: escapes,
  };
}

// ============================================================================
// 5. Testing Quality Gates, Parallel Matrix & Merge Trains (Module 05)
// ============================================================================

export type MatrixConfig = Record<string, Array<string | number>>;

export function expandParallelMatrix(matrix: MatrixConfig): Array<Record<string, string | number>> {
  const keys = Object.keys(matrix);
  if (keys.length === 0) return [{}];

  function cartesian(index: number): Array<Record<string, string | number>> {
    if (index === keys.length) return [{}];
    const key = keys[index]!;
    const values = matrix[key] ?? [];
    const rest = cartesian(index + 1);
    const result: Array<Record<string, string | number>> = [];

    for (const val of values) {
      for (const r of rest) {
        result.push({ [key]: val, ...r });
      }
    }
    return result;
  }

  return cartesian(0);
}

export interface FlakyTestRecord {
  testName: string;
  totalRuns: number;
  failures: number;
  retriedSuccesses: number;
}

export function evaluateFlakyTestQuarantine(
  records: FlakyTestRecord[],
  thresholdFlakinessRate = 0.2, // 20% retry-flip rate
): { quarantined: string[]; healthy: string[]; passTrunk: boolean } {
  const quarantined: string[] = [];
  const healthy: string[] = [];

  for (const r of records) {
    const flakeRate = r.totalRuns > 0 ? r.retriedSuccesses / r.totalRuns : 0;
    if (flakeRate >= thresholdFlakinessRate) {
      quarantined.push(r.testName);
    } else {
      healthy.push(r.testName);
    }
  }

  return {
    quarantined,
    healthy,
    passTrunk: quarantined.length === 0,
  };
}

export interface MergeTrainCar {
  mrId: number;
  targetBranch: string;
  sourceBranch: string;
  commitSha: string;
  status: 'running' | 'passed' | 'failed' | 'dropped';
}

export function simulateMergeTrainCascade(
  train: MergeTrainCar[],
  failureCarIndex: number,
): {
  survivingCars: MergeTrainCar[];
  ejectedCar: MergeTrainCar;
  rebasedCars: MergeTrainCar[];
} {
  if (failureCarIndex < 0 || failureCarIndex >= train.length) {
    throw new Error('Invalid failure index in train');
  }

  const ejectedCar = { ...train[failureCarIndex]!, status: 'failed' as const };
  const survivingCars: MergeTrainCar[] = [];
  const rebasedCars: MergeTrainCar[] = [];

  for (let i = 0; i < train.length; i++) {
    if (i < failureCarIndex) {
      survivingCars.push({ ...train[i]! });
    } else if (i > failureCarIndex) {
      const car = { ...train[i]!, status: 'running' as const };
      rebasedCars.push(car);
      survivingCars.push(car);
    }
  }

  return {
    survivingCars,
    ejectedCar,
    rebasedCars,
  };
}

// ============================================================================
// 6. Software Supply-Chain Security: SBOM, Cosign v3 & SLSA L3 (Module 06)
// ============================================================================

export interface CycloneDXComponent {
  name: string;
  version: string;
  purl: string;
  hashes: Array<{ alg: string; content: string }>;
  licenses?: Array<{ license: { id?: string; name?: string } }>;
}

export interface CycloneDXSBOM {
  bomFormat: 'CycloneDX';
  specVersion: string;
  metadata: {
    component: {
      name: string;
      version: string;
      purl: string;
    };
  };
  components: CycloneDXComponent[];
  dependencies?: Array<{ ref: string; dependsOn: string[] }>;
}

export function verifyCycloneDXSBOM(
  sbom: CycloneDXSBOM,
  expectedComponentHashes: Record<string, string>,
): { verified: boolean; tamperedComponents: string[]; missingDigests: string[] } {
  const tampered: string[] = [];
  const missing: string[] = [];

  for (const comp of sbom.components) {
    const expected = expectedComponentHashes[comp.name];
    if (!expected) {
      missing.push(comp.name);
      continue;
    }

    const sha256Hash = comp.hashes.find((h) => h.alg.toLowerCase() === 'sha-256')?.content;
    if (!sha256Hash || sha256Hash.toLowerCase() !== expected.toLowerCase()) {
      tampered.push(comp.name);
    }
  }

  return {
    verified: tampered.length === 0 && missing.length === 0,
    tamperedComponents: tampered,
    missingDigests: missing,
  };
}

// Sigstore Cosign v3 Keyless Signing Bundle & Verification
export interface SigstoreCosignBundle {
  mediaType: string;
  verificationMaterial: {
    certificate: {
      claims: {
        iss: string;
        sub: string;
        aud: string;
        jobUrl: string;
        sha: string;
      };
    };
    rekorEntry: {
      logIndex: number;
      logId: string;
      signedEntryTimestamp: string;
      integratedTime: number;
    };
  };
  signature: string;
}

export function signAndGenerateSigstoreBundle(
  oidcClaims: { iss: string; sub: string; aud: string; jobUrl: string; sha: string },
  artifactDigest: string,
): SigstoreCosignBundle {
  return {
    mediaType: 'application/vnd.dev.sigstore.bundle+json;version=0.2',
    verificationMaterial: {
      certificate: {
        claims: { ...oidcClaims },
      },
      rekorEntry: {
        logIndex: 4289102,
        logId: 'c0519e-rekor-transparency-log-id',
        signedEntryTimestamp: Buffer.from(`SET-${Date.now()}`).toString('base64'),
        integratedTime: Math.floor(Date.now() / 1000),
      },
    },
    signature: Buffer.from(`SIG(${artifactDigest}:${oidcClaims.sha})`).toString('base64'),
  };
}

export function verifySigstoreCosignBundle(
  bundle: SigstoreCosignBundle,
  artifactDigest: string,
  policy: { expectedIssuer: string; expectedProjectSubPrefix: string; expectedAud: string },
): { verified: boolean; error?: string } {
  const { certificate, rekorEntry } = bundle.verificationMaterial;

  if (certificate.claims.iss !== policy.expectedIssuer) {
    return {
      verified: false,
      error: `Issuer mismatch: expected ${policy.expectedIssuer}, got ${certificate.claims.iss}`,
    };
  }

  if (certificate.claims.aud !== policy.expectedAud) {
    return {
      verified: false,
      error: `Audience mismatch: expected ${policy.expectedAud}, got ${certificate.claims.aud}`,
    };
  }

  if (!certificate.claims.sub.startsWith(policy.expectedProjectSubPrefix)) {
    return {
      verified: false,
      error: `Subject mismatch: expected prefix ${policy.expectedProjectSubPrefix}, got ${certificate.claims.sub}`,
    };
  }

  if (!rekorEntry.signedEntryTimestamp || rekorEntry.integratedTime <= 0) {
    return {
      verified: false,
      error: 'Invalid Rekor transparency log proof.',
    };
  }

  const expectedSig = Buffer.from(`SIG(${artifactDigest}:${certificate.claims.sha})`).toString(
    'base64',
  );
  if (bundle.signature !== expectedSig) {
    return {
      verified: false,
      error: 'Signature does not match expected artifact digest and commit SHA.',
    };
  }

  return { verified: true };
}

// SLSA v1.0 Provenance Attestation (Build Level 3)
export interface SLSAProvenanceStatement {
  _type: 'https://in-toto.io/Statement/v1';
  subject: Array<{ name: string; digest: Record<string, string> }>;
  predicateType: 'https://slsa.dev/provenance/v1';
  predicate: {
    buildDefinition: {
      buildType: string;
      externalParameters: Record<string, any>;
      internalParameters?: Record<string, any>;
      resolvedDependencies?: Array<{ uri: string; digest: Record<string, string> }>;
    };
    runDetails: {
      builder: {
        id: string;
        version?: string;
      };
      metadata: {
        invocationId: string;
        startedOn: string;
        finishedOn: string;
      };
    };
  };
}

export function verifySLSALevel3Provenance(
  stmt: SLSAProvenanceStatement,
  artifactDigest: string,
  trustedBuilderId: string,
): { verified: boolean; slsaLevel: 'L1' | 'L2' | 'L3' | 'NONE'; reasons: string[] } {
  const reasons: string[] = [];

  // 1. In-toto and SLSA v1.0 predicate check
  if (stmt._type !== 'https://in-toto.io/Statement/v1') {
    reasons.push('Invalid in-toto statement type');
  }
  if (stmt.predicateType !== 'https://slsa.dev/provenance/v1') {
    reasons.push('Invalid SLSA predicate type');
  }

  // 2. Subject matches target artifact digest
  const subjectMatch = stmt.subject.some((s) => s.digest.sha256 === artifactDigest);
  if (!subjectMatch) {
    reasons.push(`Artifact digest sha256:${artifactDigest} not found in SLSA subject`);
  }

  // 3. Trusted builder identity (Hosted/Hermetic Runner Control Plane)
  if (!stmt.predicate.runDetails.builder.id.startsWith(trustedBuilderId)) {
    reasons.push(
      `Untrusted builder ID: ${stmt.predicate.runDetails.builder.id} (expected ${trustedBuilderId})`,
    );
  }

  // 4. L3 requirements: hermetic build definition with resolvedDependencies and immutable external parameters
  const hasResolvedDeps =
    stmt.predicate.buildDefinition.resolvedDependencies &&
    stmt.predicate.buildDefinition.resolvedDependencies.length > 0;
  if (!hasResolvedDeps) {
    reasons.push('Missing resolvedDependencies required for SLSA Build Level 3 hermeticity');
  }

  if (reasons.length === 0) {
    return { verified: true, slsaLevel: 'L3', reasons: [] };
  } else if (subjectMatch && stmt.predicate.runDetails.builder.id) {
    return { verified: false, slsaLevel: 'L1', reasons };
  }
  return { verified: false, slsaLevel: 'NONE', reasons };
}

// ============================================================================
// 7. Continuous Deployment Mechanics & Resource Group Serialization (Module 07)
// ============================================================================

export type ResourceGroupMode = 'unordered' | 'oldest_first' | 'newest_first';

export interface DeploymentJob {
  id: number;
  pipelineId: number;
  commitSha: string;
  environment: string;
  createdAt: number;
  status: 'waiting' | 'running' | 'success' | 'failed' | 'cancelled';
}

// Gotcha 11: Concurrent deployments racing without resource_group
export function evaluateResourceGroup(
  mode: ResourceGroupMode,
  queue: DeploymentJob[],
  activeJob: DeploymentJob | null,
): {
  nextToRun: DeploymentJob | null;
  raceConditionRisk: boolean;
} {
  // If no resource group serialization, any queued job can run immediately in parallel!
  const pendingJobs = queue.filter((j) => j.status === 'waiting');

  if (activeJob && activeJob.status === 'running') {
    // A deployment is already in progress: with resource_group, next job MUST wait
    return {
      nextToRun: null,
      raceConditionRisk: false,
    };
  }

  if (pendingJobs.length === 0) {
    return { nextToRun: null, raceConditionRisk: false };
  }

  let next: DeploymentJob | null = null;
  if (mode === 'oldest_first') {
    next = [...pendingJobs].sort((a, b) => a.createdAt - b.createdAt)[0] ?? null;
  } else if (mode === 'newest_first') {
    // Newest first automatically supersedes older queued deployments
    next = [...pendingJobs].sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;
  } else {
    // unordered
    next = pendingJobs[0] ?? null;
  }

  return {
    nextToRun: next,
    raceConditionRisk: false,
  };
}

export function detectConcurrentDeployRaceWithoutResourceGroup(
  runningDeployments: DeploymentJob[],
): { raceDetected: boolean; warning?: string } {
  if (runningDeployments.length > 1) {
    return {
      raceDetected: true,
      warning:
        'CRITICAL: Concurrent deployments are running against the same target environment without a resource_group. Deployments may apply out-of-order, overwriting newer revisions with older commits.',
    };
  }
  return { raceDetected: false };
}

export function computeEnvironmentRollback(
  history: Array<{
    id: number;
    environment: string;
    status: 'success' | 'failed';
    imageDigest: string;
    deployedAt: number;
  }>,
): { canRollback: boolean; targetDigest: string | null; targetDeploymentId: number | null } {
  const successfulDeploys = history
    .filter((h) => h.status === 'success')
    .sort((a, b) => b.deployedAt - a.deployedAt);

  // Index 0 is the current/latest successful deployment; rollback targets index 1
  if (successfulDeploys.length < 2) {
    return { canRollback: false, targetDigest: null, targetDeploymentId: null };
  }

  const prev = successfulDeploys[1]!;
  return {
    canRollback: true,
    targetDigest: prev.imageDigest,
    targetDeploymentId: prev.id,
  };
}

export interface GitOpsManifestCommit {
  repo: string;
  branch: string;
  targetFile: string;
  oldDigest: string;
  newDigest: string;
  commitMessage: string;
}

export function createGitOpsHandoffCommit(
  manifest: { repo: string; app: string; environment: string },
  immutableDigest: string,
  previousDigest: string,
): GitOpsManifestCommit {
  if (!immutableDigest.startsWith('sha256:')) {
    throw new Error('GitOps handoff requires an immutable sha256 digest, not a mutable tag.');
  }

  return {
    repo: manifest.repo,
    branch: 'main',
    targetFile: `environments/${manifest.environment}/apps/${manifest.app}/values.yaml`,
    oldDigest: previousDigest,
    newDigest: immutableDigest,
    commitMessage: `chore(gitops): promote ${manifest.app} to ${immutableDigest} in ${manifest.environment}`,
  };
}

// ============================================================================
// 8. Secrets Management & Cloud OIDC Federation (Module 08)
// ============================================================================

export interface GitLabOidcClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  ref: string;
  ref_type: 'branch' | 'tag';
  ref_protected: 'true' | 'false';
  project_path: string;
  environment?: string;
  user_login?: string;
}

export interface CloudFederationPolicy {
  provider: 'aws' | 'gcp' | 'azure' | 'vault';
  expectedAudience: string;
  requiredSubjectPattern: RegExp;
  requireProtectedRef: boolean;
  allowedEnvironments?: string[];
}

export function validateCloudFederationOIDC(
  claims: GitLabOidcClaims,
  policy: CloudFederationPolicy,
): { authorized: boolean; reason?: string } {
  // 1. Audience validation
  const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audList.includes(policy.expectedAudience)) {
    return {
      authorized: false,
      reason: `Audience claim [${audList.join(', ')}] does not include expected audience '${policy.expectedAudience}'.`,
    };
  }

  // 2. Protected branch/tag validation
  if (policy.requireProtectedRef && claims.ref_protected !== 'true') {
    return {
      authorized: false,
      reason:
        'Cloud federation policy requires a protected Git ref (ref_protected == "true"). Untrusted feature branches cannot assume cloud roles.',
    };
  }

  // 3. Subject regex matching (e.g. project_path:my-org/my-repo:ref_type:branch:ref:main)
  if (!policy.requiredSubjectPattern.test(claims.sub)) {
    return {
      authorized: false,
      reason: `Subject '${claims.sub}' does not match required pattern ${policy.requiredSubjectPattern}.`,
    };
  }

  // 4. Environment restriction if applicable
  if (policy.allowedEnvironments && policy.allowedEnvironments.length > 0) {
    if (!claims.environment || !policy.allowedEnvironments.includes(claims.environment)) {
      return {
        authorized: false,
        reason: `Environment '${claims.environment}' is not in allowed federation environments [${policy.allowedEnvironments.join(', ')}].`,
      };
    }
  }

  return { authorized: true };
}

// Gotcha 4: Unprotected variables exfiltrated by untrusted MR branches
export function detectVariableExfiltrationRisk(
  variable: { key: string; value: string; protected: boolean; masked: boolean },
  context: { branch: string; isProtected: boolean; isMergeRequest: boolean; isFork: boolean },
): { exfiltratable: boolean; riskLevel: 'CRITICAL' | 'LOW'; reason?: string } {
  if (!variable.protected) {
    if (context.isFork || context.isMergeRequest || !context.isProtected) {
      return {
        exfiltratable: true,
        riskLevel: 'CRITICAL',
        reason: `Variable '${variable.key}' is NOT protected. Any pipeline on branch '${context.branch}' or an untrusted fork MR can access, print, or exfiltrate this credential.`,
      };
    }
  }
  return { exfiltratable: false, riskLevel: 'LOW' };
}

// Gotcha 3: CI_DEBUG_TRACE=true leaking masked variables in logs
export function auditLogMaskingSafety(
  logOutput: string,
  maskedSecrets: string[],
  ciDebugTrace: boolean,
): { leakedSecrets: string[]; maskedSafely: boolean; warning?: string } {
  const leaked: string[] = [];

  for (const secret of maskedSecrets) {
    if (secret.length < 8) continue; // GitLab masks secrets with >= 8 chars
    if (logOutput.includes(secret)) {
      leaked.push(secret);
    }
  }

  if (ciDebugTrace && leaked.length > 0) {
    return {
      leakedSecrets: leaked,
      maskedSafely: false,
      warning:
        'CRITICAL: CI_DEBUG_TRACE=true enables shell execution tracing (set -x). Shell expansion prints raw argument evaluations into runner console logs before masking can redact them.',
    };
  }

  return {
    leakedSecrets: leaked,
    maskedSafely: leaked.length === 0,
  };
}

// ============================================================================
// 9. Pipeline Performance, Monorepo DAG & Interruptibility (Module 09)
// ============================================================================

export interface MonorepoPackage {
  name: string;
  path: string;
  dependencies: string[]; // local dependencies by name
}

export function optimizeMonorepoDAG(
  packages: MonorepoPackage[],
  changedFiles: string[],
): {
  affectedPackages: string[];
  skippedPackages: string[];
  dagEdges: Array<{ from: string; to: string }>;
} {
  // 1. Identify directly changed packages
  const directlyChanged = new Set<string>();
  for (const pkg of packages) {
    const pkgPrefix = pkg.path.endsWith('/') ? pkg.path : `${pkg.path}/`;
    if (changedFiles.some((f) => f.startsWith(pkgPrefix))) {
      directlyChanged.add(pkg.name);
    }
  }

  // 2. Compute transitive dependents: if A changes, and B depends on A, B is affected
  const affected = new Set<string>(directlyChanged);
  let changed = true;
  while (changed) {
    changed = false;
    for (const pkg of packages) {
      if (!affected.has(pkg.name)) {
        const dependsOnAffected = pkg.dependencies.some((dep) => affected.has(dep));
        if (dependsOnAffected) {
          affected.add(pkg.name);
          changed = true;
        }
      }
    }
  }

  const affectedPackages = Array.from(affected);
  const skippedPackages = packages.filter((p) => !affected.has(p.name)).map((p) => p.name);

  // 3. Build minimal DAG edges for affected packages
  const dagEdges: Array<{ from: string; to: string }> = [];
  for (const pkg of packages) {
    if (affected.has(pkg.name)) {
      for (const dep of pkg.dependencies) {
        if (affected.has(dep)) {
          dagEdges.push({ from: dep, to: pkg.name });
        }
      }
    }
  }

  return {
    affectedPackages,
    skippedPackages,
    dagEdges,
  };
}

// Gotcha 10: non-interruptible jobs wasting runner capacity on superseded commits
export function evaluatePipelineInterruptibility(
  runningJobs: Array<{ id: number; name: string; interruptible: boolean; durationSec: number }>,
  newCommitPushed: boolean,
): { cancelledJobs: number[]; continuedJobs: number[]; savedRunnerSeconds: number } {
  if (!newCommitPushed) {
    return {
      cancelledJobs: [],
      continuedJobs: runningJobs.map((j) => j.id),
      savedRunnerSeconds: 0,
    };
  }

  const cancelledJobs: number[] = [];
  const continuedJobs: number[] = [];
  let savedSec = 0;

  for (const job of runningJobs) {
    if (job.interruptible) {
      cancelledJobs.push(job.id);
      savedSec += job.durationSec;
    } else {
      continuedJobs.push(job.id);
    }
  }

  return {
    cancelledJobs,
    continuedJobs,
    savedRunnerSeconds: savedSec,
  };
}

export function calculateCacheEfficiency(
  hitCount: number,
  missCount: number,
  uploadDurationSec: number,
  downloadDurationSec: number,
  buildTimeWithoutCacheSec: number,
  buildTimeWithCacheSec: number,
): { hitRatio: number; netTimeSavedSec: number; recommendCache: boolean } {
  const total = hitCount + missCount;
  const hitRatio = total > 0 ? hitCount / total : 0;
  const netSavedPerHit = buildTimeWithoutCacheSec - (buildTimeWithCacheSec + downloadDurationSec);
  const netPenaltyPerMiss = uploadDurationSec; // Cache creation overhead on miss

  const totalSaved = hitCount * netSavedPerHit;
  const totalPenalty = missCount * netPenaltyPerMiss;
  const netTimeSavedSec = totalSaved - totalPenalty;

  return {
    hitRatio,
    netTimeSavedSec,
    recommendCache: netTimeSavedSec > 0 && hitRatio >= 0.5,
  };
}
