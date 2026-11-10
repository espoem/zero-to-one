// Domain models for the exam hands-on verification suite.
// These functions model the logic behind the performance-based tasks in the
// CKA, CKAD, and CKS mock exams. They are pure and deterministic so they run
// hermetically under `node --test`.

export interface NodeCondition {
  type: string;
  status: 'True' | 'False' | 'Unknown';
  reason?: string;
  message?: string;
}

export function classifyNodeConditions(
  conditions: NodeCondition[],
): 'Ready' | 'NotReady' | 'Unknown' {
  const ready = conditions.find((c) => c.type === 'Ready');
  if (!ready) return 'Unknown';
  if (ready.status === 'True') return 'Ready';
  if (ready.status === 'False') return 'NotReady';
  return 'Unknown';
}

export interface ReplicaSetRevision {
  name: string;
  revision: number;
  replicas: number;
  image: string;
}

export function evaluateRollbackTarget(
  replicaSets: ReplicaSetRevision[],
  currentRevision: number,
): ReplicaSetRevision | undefined {
  return replicaSets
    .filter((rs) => rs.revision < currentRevision)
    .sort((a, b) => b.revision - a.revision)[0];
}

export interface KubeconfigContext {
  name: string;
  cluster: string;
  user: string;
  namespace?: string;
}

export function evaluateKubeconfigContext(
  currentContext: string | undefined,
  contexts: KubeconfigContext[],
): KubeconfigContext | undefined {
  return contexts.find((c) => c.name === currentContext);
}

export function evaluateCertificateExpiry(notAfter: string, now: Date = new Date()): number {
  return Math.floor((Date.parse(notAfter) - now.getTime()) / 86_400_000);
}

export interface PodLabels {
  name: string;
  labels: Record<string, string>;
  ready: boolean;
}

export function evaluateServiceEndpoints(
  selector: Record<string, string>,
  pods: PodLabels[],
): string[] {
  return pods
    .filter((p) => p.ready)
    .filter((p) => Object.entries(selector).every(([key, value]) => p.labels[key] === value))
    .map((p) => p.name);
}

export function evaluateVolumeExpansion(
  currentGi: number,
  requestedGi: number,
  allowExpansion: boolean,
): 'allowed' | 'rejected' | 'no-change' {
  if (requestedGi <= currentGi) return 'no-change';
  return allowExpansion ? 'allowed' : 'rejected';
}

export function evaluateConfigMapEnvInjection(
  configMap: Record<string, string>,
  existing: Record<string, string> = {},
): Record<string, string> {
  return { ...configMap, ...existing };
}

export interface ResourceQuota {
  requestsCpu: number;
  limitsMemoryGi: number;
}

export interface PodRequest {
  requestsCpu: number;
  limitsMemoryGi: number;
}

export function evaluateResourceQuota(
  quota: ResourceQuota,
  request: PodRequest,
  used: PodRequest = { requestsCpu: 0, limitsMemoryGi: 0 },
): { allowed: boolean; remainingCpu: number; remainingMemoryGi: number } {
  const remainingCpu = quota.requestsCpu - used.requestsCpu - request.requestsCpu;
  const remainingMemoryGi = quota.limitsMemoryGi - used.limitsMemoryGi - request.limitsMemoryGi;
  return { allowed: remainingCpu >= 0 && remainingMemoryGi >= 0, remainingCpu, remainingMemoryGi };
}

export interface HelmChart {
  chartYaml: { name: string; version: string; apiVersion: string };
  values: Record<string, unknown>;
  templates: string[];
}

export function evaluateHelmChart(chart: HelmChart): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!chart.chartYaml.name) errors.push('Chart.yaml missing name');
  if (!chart.chartYaml.version) errors.push('Chart.yaml missing version');
  if (!chart.chartYaml.apiVersion) errors.push('Chart.yaml missing apiVersion');
  if (chart.templates.length === 0) errors.push('chart has no templates');
  return { valid: errors.length === 0, errors };
}

export interface KustomizeOverlay {
  base: Record<string, unknown>[];
  labels: Record<string, string>;
  replicas: number;
}

export function evaluateKustomizeOverlay(overlay: KustomizeOverlay): Record<string, unknown>[] {
  return overlay.base.map((resource) => {
    const metadata = (resource.metadata ?? {}) as Record<string, unknown>;
    const labels = (metadata.labels ?? {}) as Record<string, string>;
    const spec = (resource.spec ?? {}) as Record<string, unknown>;
    return {
      ...resource,
      metadata: { ...metadata, labels: { ...labels, ...overlay.labels } },
      spec: { ...spec, replicas: overlay.replicas },
    };
  });
}

export interface JobSpec {
  backoffLimit: number;
  completions: number;
  parallelism: number;
  concurrencyPolicy?: 'Allow' | 'Replace' | 'Forbid';
}

export function evaluateJobPolicy(spec: JobSpec): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (spec.backoffLimit < 0) errors.push('backoffLimit must be >= 0');
  if (spec.completions < 1) errors.push('completions must be >= 1');
  if (spec.parallelism < 1) errors.push('parallelism must be >= 1');
  if (spec.concurrencyPolicy && !['Allow', 'Replace', 'Forbid'].includes(spec.concurrencyPolicy)) {
    errors.push('invalid concurrencyPolicy');
  }
  return { valid: errors.length === 0, errors };
}

export function evaluateEphemeralDebugTarget(
  pod: { name: string; containers: string[] },
  target?: string,
): { sharesNamespaces: boolean; targetContainer?: string; errors: string[] } {
  const errors: string[] = [];
  if (target && !pod.containers.includes(target)) {
    errors.push(`target container ${target} not found`);
  }
  return { sharesNamespaces: true, targetContainer: target, errors };
}

export function evaluateUserNamespaces(hostUsers: boolean): { enabled: boolean; mapping: string } {
  return hostUsers
    ? { enabled: false, mapping: 'container root maps to host root' }
    : { enabled: true, mapping: 'container root maps to a non-root host UID' };
}

export function evaluateSeccompProfile(
  type: 'Unconfined' | 'RuntimeDefault' | 'Localhost',
  localhostProfile?: string,
): { effective: string; errors: string[] } {
  if (type === 'Localhost' && !localhostProfile) {
    return { effective: '', errors: ['Localhost requires localhostProfile'] };
  }
  return { effective: type === 'Localhost' ? (localhostProfile as string) : type, errors: [] };
}

export interface ImageSignature {
  image: string;
  digest: string;
  signature: string;
}

export function verifyImageSignature(signature: ImageSignature, publicKey: string): boolean {
  // Deterministic stand-in for a cryptographic check: the signature must bind
  // the image digest and the verifying key.
  const expected = `${signature.image}@${signature.digest}:${publicKey}`;
  return signature.signature === expected;
}

export function evaluateImagePullSecret(
  secretType: string,
  secretName: string,
  imagePullSecrets: string[],
): { authenticated: boolean; secret?: string } {
  const referenced = imagePullSecrets.includes(secretName);
  return {
    authenticated: secretType === 'kubernetes.io/dockerconfigjson' && referenced,
    secret: referenced ? secretName : undefined,
  };
}

export interface Vulnerability {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export function scanImageVulnerabilities(vulnerabilities: Vulnerability[]): {
  critical: Vulnerability[];
  total: number;
} {
  const critical = vulnerabilities.filter((v) => v.severity === 'CRITICAL');
  return { critical, total: vulnerabilities.length };
}

export interface AuditRule {
  namespace?: string;
  verb: string;
  resource: string;
  stage: 'None' | 'Metadata' | 'RequestResponse';
}

export interface AuditRequest {
  namespace: string;
  verb: string;
  resource: string;
}

export function evaluateAuditPolicy(
  rules: AuditRule[],
  request: AuditRequest,
): AuditRule | undefined {
  return rules.find(
    (rule) =>
      rule.verb === request.verb &&
      rule.resource === request.resource &&
      (rule.namespace === undefined || rule.namespace === request.namespace) &&
      rule.stage !== 'None',
  );
}

export function evaluateRuntimeDetection(
  events: string[],
  rule: { process: string; network: string },
): { detected: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (events.includes(rule.process)) reasons.push(`process ${rule.process} executed`);
  if (events.includes(rule.network)) reasons.push(`network connection to ${rule.network}`);
  return { detected: reasons.length > 0, reasons };
}

export function evaluateLogForwarding(target: string): { forwarded: boolean; target: string } {
  return { forwarded: Boolean(target && !target.startsWith('/var/log/')), target };
}

export function evaluateEncryptionAtRest(
  kmsProvider: string | undefined,
  resources: string[],
): { encrypted: boolean; provider?: string; resources: string[] } {
  return { encrypted: Boolean(kmsProvider), provider: kmsProvider, resources };
}

export function evaluateAuthorizationMode(
  modes: string[],
  anonymousAuth: boolean,
): { secure: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!modes.includes('RBAC')) reasons.push('RBAC not enabled');
  if (!modes.includes('Node')) reasons.push('Node authorizer not enabled');
  if (anonymousAuth) reasons.push('anonymous auth enabled');
  return { secure: reasons.length === 0, reasons };
}

export interface RbacRole {
  name: string;
  verbs: string[];
  resources: string[];
}

export function auditRbacEscalate(roles: RbacRole[]): { name: string; verbs: string[] }[] {
  return roles
    .filter((role) => role.verbs.includes('escalate') || role.verbs.includes('*'))
    .map((role) => ({ name: role.name, verbs: role.verbs }));
}

export function evaluateServiceAccountTokenMounting(automount: boolean | undefined): {
  mounted: boolean;
} {
  // The API default is true when the field is unset.
  return { mounted: automount !== false };
}

const DEFAULT_CAPABILITIES = [
  'AUDIT_WRITE',
  'CHOWN',
  'DAC_OVERRIDE',
  'FOWNER',
  'FSETID',
  'KILL',
  'MKNOD',
  'NET_BIND_SERVICE',
  'SETFCAP',
  'SETGID',
  'SETPCAP',
  'SETUID',
  'SYS_CHROOT',
];

export function evaluateCapabilities(dropAll: boolean, added: string[]): { effective: string[] } {
  const base = dropAll ? [] : DEFAULT_CAPABILITIES;
  return { effective: [...new Set([...base, ...added])].sort() };
}

export function evaluateReadOnlyRootFilesystem(readOnly: boolean): {
  readOnly: boolean;
  ephemeralWritable: boolean;
} {
  return { readOnly, ephemeralWritable: true };
}

export interface NetworkPolicyFrom {
  podSelector: Record<string, string>;
}

export function evaluateNetworkPolicyIngress(
  from: NetworkPolicyFrom[] | undefined,
  sourceLabels: Record<string, string>,
  port: number,
  allowedPorts: number[],
): boolean {
  if (!from) return true;
  const fromMatches = from.some((entry) =>
    Object.entries(entry.podSelector).every(([key, value]) => sourceLabels[key] === value),
  );
  return fromMatches && allowedPorts.includes(port);
}

export function evaluateSecretVolumeMount(
  secretName: string,
  volumes: { name: string; secretName?: string }[],
  volumeMounts: { name: string; mountPath: string }[],
): { mounted: boolean; mountPath?: string; errors: string[] } {
  const errors: string[] = [];
  const volume = volumes.find((v) => v.secretName === secretName);
  if (!volume) {
    errors.push(`no volume references Secret ${secretName}`);
    return { mounted: false, errors };
  }
  const mount = volumeMounts.find((m) => m.name === volume.name);
  if (!mount) {
    errors.push(`volume ${volume.name} is not mounted`);
    return { mounted: false, errors };
  }
  return { mounted: true, mountPath: mount.mountPath, errors };
}

export function validateCrdInstance(
  schema: { properties: Record<string, { type: string }> },
  instance: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [key, prop] of Object.entries(schema.properties)) {
    const value = instance[key];
    if (value === undefined) {
      errors.push(`missing required property ${key}`);
      continue;
    }
    if (typeof value !== prop.type) {
      errors.push(`property ${key} must be ${prop.type}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function evaluateDeploymentScaling(
  currentReplicas: number,
  desiredReplicas: number,
): { action: 'scale-up' | 'scale-down' | 'none'; delta: number } {
  const delta = desiredReplicas - currentReplicas;
  const action = delta > 0 ? 'scale-up' : delta < 0 ? 'scale-down' : 'none';
  return { action, delta: Math.abs(delta) };
}
