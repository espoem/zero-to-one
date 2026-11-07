/**
 * Argo CD Deterministic Model & Simulation Engine
 * Proves core concepts and production failure modes across 11 modules.
 */

export interface Application {
  name: string;
  namespace: string;
  project: string;
  source: {
    repoURL: string;
    path?: string;
    chart?: string;
    targetRevision: string;
    helm?: { values?: string; valueFiles?: string[] };
    kustomize?: { version?: string };
  };
  sources?: Array<{
    repoURL: string;
    path?: string;
    targetRevision: string;
    ref?: string;
  }>;
  destination: {
    server: string;
    namespace: string;
  };
  syncPolicy?: {
    automated?: {
      prune?: boolean;
      selfHeal?: boolean;
      allowEmpty?: boolean;
    };
    syncOptions?: string[];
  };
  status?: {
    sync?: {
      status: 'Synced' | 'OutOfSync' | 'Unknown';
      comparedTo?: { source: any; destination: any };
    };
    health?: {
      status: 'Healthy' | 'Degraded' | 'Progressing' | 'Suspended' | 'Missing';
      message?: string;
    };
    resources?: Array<{
      kind: string;
      name: string;
      namespace: string;
      status: 'Synced' | 'OutOfSync';
      health?: 'Healthy' | 'Degraded';
    }>;
  };
}

export interface AppProject {
  name: string;
  description: string;
  sourceRepos: string[];
  destinations: Array<{ server: string; namespace: string }>;
  clusterResourceWhitelist?: Array<{ group: string; kind: string }>;
  namespaceResourceBlacklist?: Array<{ group: string; kind: string }>;
}

export interface SyncWaveItem {
  kind: string;
  name: string;
  wave: number;
  phase: 'PreSync' | 'Sync' | 'PostSync' | 'SyncFail';
}

/**
 * 01. OpenGitOps 4 Principles Evaluation
 */
export function evaluateOpenGitOpsPrinciples(params: {
  declarative: boolean;
  versionedAndImmutable: boolean;
  pulledAutomatically: boolean;
  continuouslyReconciled: boolean;
}): { compliant: boolean; score: number } {
  let score = 0;
  if (params.declarative) score++;
  if (params.versionedAndImmutable) score++;
  if (params.pulledAutomatically) score++;
  if (params.continuouslyReconciled) score++;
  return { compliant: score === 4, score };
}

/**
 * 02. Repo-Server Cache Key Generation & Invalidation
 */
export function generateRepoServerCacheKey(
  repoURL: string,
  revision: string,
  path: string,
): string {
  return `repo:${repoURL}:${revision}:${path}`;
}

/**
 * 03. Multi-Source / Values Reference Resolution
 */
export function resolveMultiSourceValues(
  sources: Array<{ ref?: string; path?: string }>,
  valuesContent: string,
): string {
  return valuesContent.replace(/\$([\w-]+)\/([\w-/.]+)/g, (match, refName, _filePath) => {
    const found = sources.find((s) => s.ref === refName);
    return found ? `resolved-from-${found.path}` : 'missing-ref';
  });
}

/**
 * 04. Sync Waves & Phase Sorting
 * Sorting order: (phaseOrder, wave, kind, name)
 */
export const phaseOrderMap: Record<string, number> = {
  PreSync: 1,
  Sync: 2,
  PostSync: 3,
  SyncFail: 4,
};

export function sortSyncWaveItems(items: SyncWaveItem[]): SyncWaveItem[] {
  return [...items].sort((a, b) => {
    const pA = phaseOrderMap[a.phase] || 2;
    const pB = phaseOrderMap[b.phase] || 2;
    if (pA !== pB) return pA - pB;
    if (a.wave !== b.wave) return a.wave - b.wave;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.name.localeCompare(b.name);
  });
}

/**
 * 05. Drift Reconciliation & ignoreDifferences normalization
 */
export function calculateDrift(
  desired: any,
  live: any,
  ignorePaths: string[],
): { isOutOfSync: boolean; diff: any } {
  const cleanDesired = JSON.parse(JSON.stringify(desired));
  const cleanLive = JSON.parse(JSON.stringify(live));

  for (const path of ignorePaths) {
    const parts = path.split('/').filter(Boolean);
    let dObj = cleanDesired;
    let lObj = cleanLive;
    for (let i = 0; i < parts.length - 1; i++) {
      if (dObj) dObj = dObj[parts[i]];
      if (lObj) lObj = lObj[parts[i]];
    }
    if (parts.length > 0) {
      const last = parts[parts.length - 1];
      if (dObj) delete dObj[last];
      if (lObj) delete lObj[last];
    }
  }

  const isOutOfSync = JSON.stringify(cleanDesired) !== JSON.stringify(cleanLive);
  return { isOutOfSync, diff: { desired: cleanDesired, live: cleanLive } };
}

/**
 * 06. ApplicationSet Matrix Generator Cartesian Product
 */
export function evaluateMatrixGenerator(
  clusters: Array<{ name: string }>,
  regions: Array<{ name: string }>,
): Array<{ cluster: string; region: string }> {
  const result: Array<{ cluster: string; region: string }> = [];
  for (const c of clusters) {
    for (const r of regions) {
      result.push({ cluster: c.name, region: r.name });
    }
  }
  return result;
}

/**
 * 07. AppProject Boundary Enforcement
 */
export function validateAppProjectAccess(
  project: AppProject,
  targetRepo: string,
  destServer: string,
  destNamespace: string,
): boolean {
  const repoAllowed = project.sourceRepos.some((r) => {
    if (r === '*') return true;
    if (r.endsWith('*')) return targetRepo.startsWith(r.slice(0, -1));
    return r === targetRepo;
  });

  const destAllowed = project.destinations.some((d) => {
    const serverMatch = d.server === '*' || d.server === destServer;
    const nsMatch =
      d.namespace === '*' ||
      (d.namespace.endsWith('*')
        ? destNamespace.startsWith(d.namespace.slice(0, -1))
        : d.namespace === destNamespace);
    return serverMatch && nsMatch;
  });

  return repoAllowed && destAllowed;
}

/**
 * 08. Repo Topology Promotion Gate
 */
export function validateEnvironmentPromotion(
  currentEnv: string,
  targetEnv: string,
  _sha: string,
): { promoted: boolean; reason?: string } {
  const envOrder = ['dev', 'staging', 'prod'];
  const currIdx = envOrder.indexOf(currentEnv);
  const targIdx = envOrder.indexOf(targetEnv);
  if (targIdx === currIdx + 1) {
    return { promoted: true };
  }
  return { promoted: false, reason: `Invalid promotion jump from ${currentEnv} to ${targetEnv}` };
}

/**
 * 09. Argo Rollouts Progressive Delivery State Machine
 */
export function evaluateRolloutStep(
  currentWeight: number,
  stepWeight: number,
  analysisStatus: 'Successful' | 'Running' | 'Failed',
): { nextWeight: number; status: 'Progressing' | 'Promoted' | 'Aborted' } {
  if (analysisStatus === 'Failed') {
    return { nextWeight: 0, status: 'Aborted' };
  }
  if (analysisStatus === 'Running') {
    return { nextWeight: currentWeight, status: 'Progressing' };
  }
  return { nextWeight: stepWeight, status: stepWeight === 100 ? 'Promoted' : 'Progressing' };
}

/**
 * 10. Controller Sharding Hash Function
 */
export function calculateControllerShard(appName: string, shardCount: number): number {
  let hash = 0;
  for (let i = 0; i < appName.length; i++) {
    hash = (hash << 5) - hash + appName.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % shardCount;
}

/**
 * 11. Argo Workflows DAG Topological Execution
 */
export function evaluateDAGTopologicalSort(
  tasks: Array<{ name: string; dependencies: string[] }>,
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  const map = new Map(tasks.map((t) => [t.name, t]));

  function visit(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    const task = map.get(name);
    if (task) {
      for (const dep of task.dependencies) {
        visit(dep);
      }
      result.push(name);
    }
  }

  for (const t of tasks) {
    visit(t.name);
  }
  return result;
}
