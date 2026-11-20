import { createHash, createHmac } from 'node:crypto';
import { createConnection } from 'node:net';

// ============================================================================
// 1. Governance: scope hierarchy, Policy, locks, RG-region outage
// ============================================================================

export type ScopeKind =
  | 'Tenant'
  | 'ManagementGroup'
  | 'Subscription'
  | 'ResourceGroup'
  | 'Resource';

export interface ScopeNode {
  id: string;
  kind: ScopeKind;
  parentId: string | undefined;
  displayName: string;
}

/** Azure allows at most 6 management-group levels below the tenant root. */
export const MAX_MANAGEMENT_GROUP_LEVELS = 6;

export function scopeChain(nodeId: string, nodes: Map<string, ScopeNode>): ScopeNode[] {
  const chain: ScopeNode[] = [];
  let current: ScopeNode | undefined = nodes.get(nodeId);
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = current.parentId === undefined ? undefined : nodes.get(current.parentId);
  }
  return chain;
}

export function countManagementGroupLevels(nodeId: string, nodes: Map<string, ScopeNode>): number {
  return scopeChain(nodeId, nodes).filter((n) => n.kind === 'ManagementGroup').length;
}

export function validateManagementGroupDepth(
  nodeId: string,
  nodes: Map<string, ScopeNode>,
): { depth: number; valid: boolean; reason: string } {
  const depth = countManagementGroupLevels(nodeId, nodes);
  if (depth > MAX_MANAGEMENT_GROUP_LEVELS) {
    return {
      depth,
      valid: false,
      reason: `Management-group depth ${depth} exceeds the maximum of ${MAX_MANAGEMENT_GROUP_LEVELS}`,
    };
  }
  return { depth, valid: true, reason: 'Hierarchy depth is within limits' };
}

export function isScopeOrAncestor(
  ancestorId: string,
  scopeId: string,
  nodes: Map<string, ScopeNode>,
): boolean {
  return scopeChain(scopeId, nodes).some((n) => n.id === ancestorId);
}

export type PolicyEffect = 'Deny' | 'Audit' | 'DeployIfNotExists' | 'Modify';

export interface PolicyAssignment {
  name: string;
  scopeId: string;
  effect: PolicyEffect;
  targetResourceType?: string;
  field?: string;
  forbiddenValue?: unknown;
  assignedAtMs: number;
}

export interface GovernedResource {
  id: string;
  scopeId: string;
  type: string;
  fields: Record<string, unknown>;
  createdAtMs: number;
  updatedAtMs?: number;
}

export interface PolicyDecision {
  allowed: boolean;
  compliant: boolean;
  reason: string;
}

function denyMatches(
  resource: GovernedResource,
  assignment: PolicyAssignment,
  nodes: Map<string, ScopeNode>,
): boolean {
  if (assignment.effect !== 'Deny') return false;
  if (!isScopeOrAncestor(assignment.scopeId, resource.scopeId, nodes)) return false;
  if (assignment.targetResourceType && assignment.targetResourceType !== resource.type) {
    return false;
  }
  if (assignment.field !== undefined) {
    return resource.fields[assignment.field] === assignment.forbiddenValue;
  }
  return true;
}

/** A Deny assignment on ANY ancestor scope overrides otherwise-compliant children. */
export function evaluateDenyPolicies(
  resource: GovernedResource,
  assignments: PolicyAssignment[],
  nodes: Map<string, ScopeNode>,
): PolicyDecision {
  const hit = assignments.find((a) => denyMatches(resource, a, nodes));
  if (hit) {
    return {
      allowed: false,
      compliant: false,
      reason: `Denied by policy '${hit.name}' at scope '${hit.scopeId}'`,
    };
  }
  return { allowed: true, compliant: true, reason: 'No matching Deny assignment' };
}

export interface DineResult {
  compliant: boolean;
  remediated: boolean;
  reason: string;
}

/**
 * DeployIfNotExists evaluates on create and update only. Resources that already
 * existed in a non-compliant state and are never updated stay non-compliant
 * until an explicit remediation task runs.
 */
export function evaluateDeployIfNotExists(
  resource: GovernedResource,
  assignment: PolicyAssignment,
  remediationExecuted: boolean,
): DineResult {
  const writtenAtMs = resource.updatedAtMs ?? resource.createdAtMs;
  if (writtenAtMs >= assignment.assignedAtMs) {
    const verb = resource.updatedAtMs !== undefined ? 'Updated' : 'Created';
    return {
      compliant: true,
      remediated: true,
      reason: `${verb} after assignment: DeployIfNotExists evaluated on write`,
    };
  }
  if (remediationExecuted) {
    return {
      compliant: true,
      remediated: true,
      reason: 'Pre-existing resource brought to compliance by explicit remediation task',
    };
  }
  return {
    compliant: false,
    remediated: false,
    reason: 'Pre-existing non-compliant resource: DeployIfNotExists requires a remediation task',
  };
}

/** Creates a governed resource at `nowMs` and evaluates `DeployIfNotExists` on create. */
export function createResource(
  resource: Omit<GovernedResource, 'createdAtMs' | 'updatedAtMs'>,
  assignment: PolicyAssignment,
  nowMs: number,
): { resource: GovernedResource; dine: DineResult } {
  const created: GovernedResource = { ...resource, createdAtMs: nowMs };
  return { resource: created, dine: evaluateDeployIfNotExists(created, assignment, false) };
}

/** Updates a governed resource at `nowMs` and triggers `DeployIfNotExists` on update. */
export function updateResource(
  resource: GovernedResource,
  fieldsPatch: Record<string, unknown>,
  assignment: PolicyAssignment,
  nowMs: number,
): { resource: GovernedResource; dine: DineResult } {
  const updated: GovernedResource = {
    ...resource,
    fields: { ...resource.fields, ...fieldsPatch },
    updatedAtMs: nowMs,
  };
  return { resource: updated, dine: evaluateDeployIfNotExists(updated, assignment, false) };
}

export type LockLevel = 'ReadOnly' | 'CanNotDelete';

export interface LockAssignment {
  scopeId: string;
  level: LockLevel;
}

export type ArmPlane = 'control-plane' | 'data-plane';

export interface ArmOperation {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  plane: ArmPlane;
  description: string;
  /** e.g. POST .../listKeys: a control-plane read of a data-plane secret. */
  isListKeys?: boolean;
}

export interface ArmDecision {
  allowed: boolean;
  status: number;
  code?: string;
  reason: string;
}

/** Resource locks are an ARM control-plane guardrail; data-plane I/O bypasses them. */
export function authorizeArmOperation(
  operation: ArmOperation,
  scopeId: string,
  locks: LockAssignment[],
  nodes: Map<string, ScopeNode>,
): ArmDecision {
  if (operation.plane === 'data-plane') {
    return { allowed: true, status: 200, reason: 'Resource locks do not apply to data-plane I/O' };
  }
  const applicable = locks.filter((l) => isScopeOrAncestor(l.scopeId, scopeId, nodes));
  const readOnly = applicable.some((l) => l.level === 'ReadOnly');
  if (readOnly && operation.method !== 'GET') {
    return {
      allowed: false,
      status: 409,
      code: 'ScopeLocked',
      reason: `ScopeLocked: ReadOnly lock blocks ${operation.description} (HTTP POST listKeys included)`,
    };
  }
  const noDelete = applicable.some((l) => l.level === 'CanNotDelete');
  if (noDelete && operation.method === 'DELETE') {
    return {
      allowed: false,
      status: 409,
      code: 'ScopeLocked',
      reason: 'ScopeLocked: CanNotDelete lock blocks DELETE',
    };
  }
  return { allowed: true, status: 200, reason: 'Allowed by lock evaluation' };
}

export type RegionStatus = 'healthy' | 'outage';

/**
 * The resource-group location stores metadata only, but an RG-region outage
 * blocks ARM control-plane writes for resources located in healthy regions.
 */
export function canPerformControlPlaneWrite(options: {
  rgRegionStatus: RegionStatus;
  resourceRegionStatus: RegionStatus;
}): ArmDecision {
  if (options.rgRegionStatus === 'outage') {
    return {
      allowed: false,
      status: 503,
      reason:
        'RG metadata region is in outage: ARM control-plane writes are blocked even though the resource region is healthy',
    };
  }
  if (options.resourceRegionStatus === 'outage') {
    return { allowed: false, status: 503, reason: 'Resource region is in outage' };
  }
  return { allowed: true, status: 200, reason: 'Control-plane write accepted' };
}

// ============================================================================
// 2. Entra ID RBAC (control vs data plane) + ABAC + propagation
// ============================================================================

export type AccessPlane = 'control-plane' | 'data-plane';

export interface RoleDefinition {
  name: string;
  actions: string[];
  dataActions: string[];
  notActions: string[];
  notDataActions: string[];
}

export const OWNER_ROLE: RoleDefinition = {
  name: 'Owner',
  actions: ['*'],
  dataActions: [],
  notActions: [],
  notDataActions: [],
};

export const READER_ROLE: RoleDefinition = {
  name: 'Reader',
  actions: ['*/read'],
  dataActions: [],
  notActions: [],
  notDataActions: [],
};

export const STORAGE_BLOB_DATA_READER_ROLE: RoleDefinition = {
  name: 'Storage Blob Data Reader',
  actions: ['Microsoft.Storage/storageAccounts/read'],
  dataActions: ['Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read'],
  notActions: [],
  notDataActions: [],
};

export const STORAGE_BLOB_DATA_CONTRIBUTOR_ROLE: RoleDefinition = {
  name: 'Storage Blob Data Contributor',
  actions: ['Microsoft.Storage/storageAccounts/read'],
  dataActions: [
    'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/read',
    'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/write',
    'Microsoft.Storage/storageAccounts/blobServices/containers/blobs/delete',
  ],
  notActions: [],
  notDataActions: [],
};

export interface RoleAssignment {
  principalId: string;
  role: RoleDefinition;
  scopeId: string;
  assignedAtMs: number;
}

export interface DenyAssignment {
  name: string;
  principalIds: string[];
  scopeId: string;
  deniedActions: string[];
  deniedDataActions: string[];
}

export interface AccessRequest {
  principalId: string;
  action: string;
  scopeId: string;
  plane: AccessPlane;
}

export interface AccessDecision {
  allowed: boolean;
  status: number;
  reason: string;
}

function wildcardMatch(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`^${escaped.replace(/\*/g, '.*')}$`, 'i');
  return regex.test(value);
}

export function actionMatches(patterns: string[], action: string): boolean {
  return patterns.some((p) => wildcardMatch(p, action));
}

/** Typical RBAC propagation takes seconds to ~1 minute; worst-case ARM/RP cache lag is 30 minutes. */
export const DEFAULT_ROLE_PROPAGATION_DELAY_MS = 60_000;
export const MAX_ROLE_PROPAGATION_DELAY_MS = 30 * 60 * 1000;
export const ROLE_PROPAGATION_DELAY_MS = DEFAULT_ROLE_PROPAGATION_DELAY_MS;

export function evaluateAccess(options: {
  request: AccessRequest;
  assignments: RoleAssignment[];
  denyAssignments: DenyAssignment[];
  nodes: Map<string, ScopeNode>;
  nowMs: number;
  propagationDelayMs?: number;
}): AccessDecision {
  const delay = options.propagationDelayMs ?? ROLE_PROPAGATION_DELAY_MS;
  const { request } = options;

  for (const deny of options.denyAssignments) {
    const principalHit =
      deny.principalIds.includes('*') || deny.principalIds.includes(request.principalId);
    if (!principalHit) continue;
    if (!isScopeOrAncestor(deny.scopeId, request.scopeId, options.nodes)) continue;
    const deniedList =
      request.plane === 'control-plane' ? deny.deniedActions : deny.deniedDataActions;
    if (actionMatches(deniedList, request.action)) {
      return {
        allowed: false,
        status: 403,
        reason: `Blocked by deny assignment '${deny.name}'`,
      };
    }
  }

  let allowed = false;
  let pendingPropagation = false;
  for (const assignment of options.assignments) {
    if (assignment.principalId !== request.principalId) continue;
    if (!isScopeOrAncestor(assignment.scopeId, request.scopeId, options.nodes)) continue;
    const allowList =
      request.plane === 'control-plane' ? assignment.role.actions : assignment.role.dataActions;
    const denyList =
      request.plane === 'control-plane'
        ? assignment.role.notActions
        : assignment.role.notDataActions;
    if (!actionMatches(allowList, request.action)) continue;
    if (actionMatches(denyList, request.action)) continue;
    if (options.nowMs - assignment.assignedAtMs < delay) {
      pendingPropagation = true;
      continue;
    }
    allowed = true;
    break;
  }

  if (allowed) {
    return { allowed: true, status: 200, reason: 'Allowed by role assignment' };
  }
  if (pendingPropagation) {
    return {
      allowed: false,
      status: 403,
      reason: 'Role assignment has not propagated yet (ARM/RP cache window)',
    };
  }
  return { allowed: false, status: 403, reason: 'No role assignment grants this action' };
}

/** Simulates polling with exponential backoff until the assignment propagates. */
export function backoffAttemptsUntilPropagated(options: {
  assignedAtMs: number;
  firstAttemptAtMs: number;
  propagationDelayMs?: number;
  baseDelayMs?: number;
  maxAttempts?: number;
}): { attempts: number; propagatedAtAttempt: boolean } {
  const delay = options.propagationDelayMs ?? ROLE_PROPAGATION_DELAY_MS;
  const base = options.baseDelayMs ?? 60 * 1000;
  const maxAttempts = options.maxAttempts ?? 12;
  let at = options.firstAttemptAtMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (at - options.assignedAtMs >= delay) {
      return { attempts: attempt, propagatedAtAttempt: true };
    }
    at += base * 2 ** (attempt - 1);
  }
  return { attempts: maxAttempts, propagatedAtAttempt: false };
}

export type AbacOperator = 'StringEquals' | 'StringStartsWith' | 'StringLike';

export interface AbacCondition {
  /** e.g. '@Resource:containerName' or '@Request:blobPath'. */
  left: string;
  operator: AbacOperator;
  right: string;
}

export function evaluateAbacConditions(
  conditions: AbacCondition[],
  context: Record<string, string>,
): boolean {
  return conditions.every((c) => {
    const actual = context[c.left];
    if (actual === undefined) return false;
    if (c.operator === 'StringEquals') return actual === c.right;
    if (c.operator === 'StringStartsWith') return actual.startsWith(c.right);
    return wildcardMatch(c.right, actual);
  });
}

export function evaluateAccessWithAbac(options: {
  request: AccessRequest;
  assignments: RoleAssignment[];
  denyAssignments: DenyAssignment[];
  nodes: Map<string, ScopeNode>;
  nowMs: number;
  propagationDelayMs?: number;
  abacConditions: AbacCondition[];
  abacContext: Record<string, string>;
}): AccessDecision {
  const rbac = evaluateAccess(options);
  if (!rbac.allowed) return rbac;
  if (!evaluateAbacConditions(options.abacConditions, options.abacContext)) {
    return { allowed: false, status: 403, reason: 'ABAC condition evaluation failed' };
  }
  return { allowed: true, status: 200, reason: 'Allowed by RBAC + ABAC condition' };
}

// ============================================================================
// 3. ARM deployments (Incremental vs Complete), Deployment Stacks, policy check
// ============================================================================

export type DeploymentMode = 'Incremental' | 'Complete';

export interface DeploymentPlan {
  toCreate: string[];
  toKeep: string[];
  toDelete: string[];
}

export function planDeployment(options: {
  existing: string[];
  template: string[];
  mode: DeploymentMode;
}): DeploymentPlan {
  const existingSet = new Set(options.existing);
  const templateSet = new Set(options.template);
  const toCreate = options.template.filter((r) => !existingSet.has(r));
  const toKeep = options.template.filter((r) => existingSet.has(r));
  const toDelete =
    options.mode === 'Complete' ? options.existing.filter((r) => !templateSet.has(r)) : [];
  return { toCreate, toKeep, toDelete };
}

export type ActionOnUnmanage = 'deleteAll' | 'detachAll';
export type DenySettingsMode = 'none' | 'denyDelete' | 'denyWriteAndDelete';

export interface DeploymentStack {
  name: string;
  managedResources: string[];
  templateResources: string[];
  actionOnUnmanage: ActionOnUnmanage;
  denySettings: DenySettingsMode;
  excludedPrincipals: string[];
}

export function applyStackDeletion(stack: DeploymentStack): {
  deleted: string[];
  detached: string[];
} {
  const unmanaged = stack.managedResources.filter((r) => !stack.templateResources.includes(r));
  if (stack.actionOnUnmanage === 'deleteAll') {
    return { deleted: unmanaged, detached: [] };
  }
  return { deleted: [], detached: unmanaged };
}

export function authorizeStackOperation(options: {
  stack: DeploymentStack;
  callerPrincipalId: string;
  operation: 'write' | 'delete';
}): AccessDecision {
  const excluded = options.stack.excludedPrincipals.includes(options.callerPrincipalId);
  if (excluded) {
    return { allowed: true, status: 200, reason: 'Caller is in denySettings excludedPrincipals' };
  }
  if (options.stack.denySettings === 'denyWriteAndDelete') {
    return {
      allowed: false,
      status: 403,
      reason: `denyWriteAndDelete blocks ${options.operation} for unlisted principals`,
    };
  }
  if (options.stack.denySettings === 'denyDelete' && options.operation === 'delete') {
    return {
      allowed: false,
      status: 403,
      reason: 'denyDelete blocks delete for unlisted principals',
    };
  }
  return { allowed: true, status: 200, reason: 'Allowed by deployment-stack deny settings' };
}

export interface TemplateResource {
  type: string;
  name: string;
  allowBlobPublicAccess?: boolean;
  minimumTlsVersion?: string;
}

const TLS_ORDER: Record<string, number> = {
  TLS1_0: 0,
  TLS1_1: 1,
  TLS1_2: 2,
  '1.2': 2,
  TLS1_3: 3,
};

/** Offline policy-as-code gate: no public blob access, TLS >= 1.2. */
export function auditStorageCompliance(resources: TemplateResource[]): {
  compliant: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  for (const r of resources) {
    if (r.type !== 'Microsoft.Storage/storageAccounts') continue;
    if (r.allowBlobPublicAccess === true) {
      violations.push(`${r.name}: allowBlobPublicAccess must be false`);
    }
    const rank = r.minimumTlsVersion === undefined ? 2 : (TLS_ORDER[r.minimumTlsVersion] ?? -1);
    if (rank < 2) {
      violations.push(`${r.name}: minimumTlsVersion must be TLS1_2 or later`);
    }
  }
  return { compliant: violations.length === 0, violations };
}

// ============================================================================
// 4. VNet: addressing, egress, Private DNS, NSG, UDR, SNAT
// ============================================================================

export const AZURE_RESERVED_IP_COUNT = 5;

export function usableHostCount(prefixLength: number): number {
  if (prefixLength < 0 || prefixLength > 32) {
    throw new Error(`Invalid prefix length: ${prefixLength}`);
  }
  return Math.max(0, 2 ** (32 - prefixLength) - AZURE_RESERVED_IP_COUNT);
}

export interface EgressConfig {
  defaultOutboundAccess: boolean;
  natGatewayAttached: boolean;
  loadBalancerOutboundRule: boolean;
  instancePublicIp: boolean;
  userDefinedRouteToNvaWithEgress: boolean;
  /** A UDR with nextHopType='Internet' (0.0.0.0/0 -> Internet) does NOT restore egress on a private subnet. */
  userDefinedRouteNextHopInternet?: boolean;
}

export interface EgressDecision {
  allowed: boolean;
  path: string;
  reason: string;
}

/**
 * After the default-outbound-access retirement (effective 2026-03-31,
 * REST API 2025-07-01+), a subnet without explicit outbound connectivity
 * has no internet egress. A UDR with nextHopType='Internet' does not override this.
 */
export function evaluateInternetEgress(config: EgressConfig): EgressDecision {
  if (config.defaultOutboundAccess) {
    return { allowed: true, path: 'default-outbound', reason: 'Implicit default outbound access' };
  }
  if (config.natGatewayAttached) {
    return { allowed: true, path: 'nat-gateway', reason: 'Egress via NAT Gateway' };
  }
  if (config.loadBalancerOutboundRule) {
    return { allowed: true, path: 'lb-outbound', reason: 'Egress via Load Balancer outbound rule' };
  }
  if (config.instancePublicIp) {
    return { allowed: true, path: 'instance-public-ip', reason: 'Egress via instance public IP' };
  }
  if (config.userDefinedRouteToNvaWithEgress) {
    return {
      allowed: true,
      path: 'udr-nva',
      reason: 'Egress via UDR to NVA/Firewall with explicit outbound connectivity',
    };
  }
  if (config.userDefinedRouteNextHopInternet) {
    return {
      allowed: false,
      path: 'none',
      reason:
        'UDR with nextHopType=Internet does not restore egress on a private subnet (defaultOutboundAccess=false)',
    };
  }
  return {
    allowed: false,
    path: 'none',
    reason: 'No outbound connectivity: default outbound retired and no NAT/LB/PIP/UDR-to-NVA',
  };
}

export function resolveStoragePrivateDns(options: {
  privateEndpointIp: string;
  publicIp: string;
  linkedPrivateDnsZones: string[];
}): { ip: string; path: 'private-endpoint' | 'public-internet' } {
  if (options.linkedPrivateDnsZones.includes('privatelink.blob.core.windows.net')) {
    return { ip: options.privateEndpointIp, path: 'private-endpoint' };
  }
  return { ip: options.publicIp, path: 'public-internet' };
}

export function evaluateStorageFirewall(options: {
  path: 'private-endpoint' | 'public-internet';
  publicNetworkAccess: 'Enabled' | 'Disabled';
}): { allowed: boolean; status: number; reason: string } {
  if (options.path === 'private-endpoint') {
    return { allowed: true, status: 200, reason: 'Private endpoint bypasses public firewall' };
  }
  if (options.publicNetworkAccess === 'Disabled') {
    return {
      allowed: false,
      status: 403,
      reason: 'Public endpoint resolved but public network access is Disabled',
    };
  }
  return { allowed: true, status: 200, reason: 'Public access permitted' };
}

export type NsgAction = 'Allow' | 'Deny';

export interface NsgRule {
  name: string;
  priority: number;
  direction: 'Inbound' | 'Outbound';
  action: NsgAction;
  sourcePrefix: string;
  destPrefix: string;
  destPort: string;
  protocol: 'Tcp' | 'Udp' | '*';
}

export interface Packet {
  direction: 'Inbound' | 'Outbound';
  sourceIp: string;
  destIp: string;
  destPort: number;
  protocol: 'Tcp' | 'Udp';
}

export function ipToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    throw new Error(`Invalid IPv4 address: ${ip}`);
  }
  const [a, b, c, d] = parts as [number, number, number, number];
  return ((a * 256 + b) * 256 + c) * 256 + d;
}

export function parseCidr(cidr: string): { network: number; prefix: number } {
  const [ip, prefixText] = cidr.split('/') as [string, string | undefined];
  if (prefixText === undefined) {
    return { network: ipToInt(cidr), prefix: 32 };
  }
  const prefix = Number.parseInt(prefixText, 10);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix: ${cidr}`);
  }
  const mask = prefix === 0 ? 0 : (0xff_ff_ff_ff - (2 ** (32 - prefix) - 1)) >>> 0;
  return { network: (ipToInt(ip) & mask) >>> 0, prefix };
}

export function cidrContains(cidr: string, ip: string): boolean {
  if (cidr === '*') return true;
  const { network, prefix } = parseCidr(cidr);
  if (prefix === 0) return true;
  const mask = (0xff_ff_ff_ff - (2 ** (32 - prefix) - 1)) >>> 0;
  return (ipToInt(ip) & mask) >>> 0 === network;
}

const VNET_PRIVATE_PREFIXES = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const AZURE_LOAD_BALANCER_IP = '168.63.129.16';

export const AZURE_DEFAULT_NSG_RULES: readonly NsgRule[] = [
  {
    name: 'AllowVnetInBound',
    priority: 65000,
    direction: 'Inbound',
    action: 'Allow',
    sourcePrefix: 'VirtualNetwork',
    destPrefix: 'VirtualNetwork',
    destPort: '*',
    protocol: '*',
  },
  {
    name: 'AllowAzureLoadBalancerInBound',
    priority: 65001,
    direction: 'Inbound',
    action: 'Allow',
    sourcePrefix: 'AzureLoadBalancer',
    destPrefix: '*',
    destPort: '*',
    protocol: '*',
  },
  {
    name: 'DenyAllInBound',
    priority: 65500,
    direction: 'Inbound',
    action: 'Deny',
    sourcePrefix: '*',
    destPrefix: '*',
    destPort: '*',
    protocol: '*',
  },
  {
    name: 'AllowVnetOutBound',
    priority: 65000,
    direction: 'Outbound',
    action: 'Allow',
    sourcePrefix: 'VirtualNetwork',
    destPrefix: 'VirtualNetwork',
    destPort: '*',
    protocol: '*',
  },
  {
    name: 'AllowInternetOutBound',
    priority: 65001,
    direction: 'Outbound',
    action: 'Allow',
    sourcePrefix: '*',
    destPrefix: 'Internet',
    destPort: '*',
    protocol: '*',
  },
  {
    name: 'DenyAllOutBound',
    priority: 65500,
    direction: 'Outbound',
    action: 'Deny',
    sourcePrefix: '*',
    destPrefix: '*',
    destPort: '*',
    protocol: '*',
  },
];

function isVirtualNetworkIp(ip: string): boolean {
  return VNET_PRIVATE_PREFIXES.some((cidr) => cidrContains(cidr, ip));
}

function prefixMatches(pattern: string, ip: string): boolean {
  if (pattern === '*') return true;
  if (pattern === 'VirtualNetwork') return isVirtualNetworkIp(ip);
  if (pattern === 'AzureLoadBalancer') return ip === AZURE_LOAD_BALANCER_IP;
  if (pattern === 'Internet') return !isVirtualNetworkIp(ip) && ip !== AZURE_LOAD_BALANCER_IP;
  return cidrContains(pattern, ip);
}

function portMatches(pattern: string, port: number): boolean {
  if (pattern === '*') return true;
  if (pattern.includes('-')) {
    const [lo, hi] = pattern.split('-').map((p) => Number.parseInt(p, 10)) as [number, number];
    return port >= lo && port <= hi;
  }
  return Number.parseInt(pattern, 10) === port;
}

export function evaluateNsg(
  rules: NsgRule[],
  packet: Packet,
  includeDefaultRules = true,
): { allowed: boolean; matchedRule: string } {
  const effective = includeDefaultRules ? [...rules, ...AZURE_DEFAULT_NSG_RULES] : [...rules];
  const ordered = effective.sort((a, b) => a.priority - b.priority);
  for (const rule of ordered) {
    if (rule.direction !== packet.direction) continue;
    if (rule.protocol !== '*' && rule.protocol !== packet.protocol) continue;
    if (!prefixMatches(rule.sourcePrefix, packet.sourceIp)) continue;
    if (!prefixMatches(rule.destPrefix, packet.destIp)) continue;
    if (!portMatches(rule.destPort, packet.destPort)) continue;
    return { allowed: rule.action === 'Allow', matchedRule: rule.name };
  }
  return { allowed: false, matchedRule: 'DefaultDeny' };
}

/**
 * Evaluates effective NSGs across subnet and NIC.
 * When `nicNsg` is `undefined`, no NIC NSG is attached and the subnet NSG alone governs.
 * Attached NSGs include Azure's built-in default rules (AllowVnetInBound,
 * AllowAzureLoadBalancerInBound, DenyAllInBound, AllowInternetOutBound, etc.).
 */
export function evaluateEffectiveNsg(options: {
  subnetNsg?: NsgRule[];
  nicNsg?: NsgRule[];
  includeDefaultRules?: boolean;
  packet: Packet;
}): { allowed: boolean; reason: string } {
  const includeDefaults = options.includeDefaultRules ?? true;
  const subnet =
    options.subnetNsg !== undefined
      ? evaluateNsg(options.subnetNsg, options.packet, includeDefaults)
      : undefined;
  const nic =
    options.nicNsg !== undefined
      ? evaluateNsg(options.nicNsg, options.packet, includeDefaults)
      : undefined;

  if (subnet && !subnet.allowed) {
    return { allowed: false, reason: `Dropped by subnet NSG (${subnet.matchedRule})` };
  }
  if (nic && !nic.allowed) {
    return { allowed: false, reason: `Dropped by NIC NSG (${nic.matchedRule})` };
  }
  if (subnet && nic) {
    return { allowed: true, reason: 'Allowed by both subnet and NIC NSG' };
  }
  if (subnet) {
    return {
      allowed: true,
      reason: `Allowed by subnet NSG (${subnet.matchedRule}, no NIC NSG attached)`,
    };
  }
  if (nic) {
    return {
      allowed: true,
      reason: `Allowed by NIC NSG (${nic.matchedRule}, no subnet NSG attached)`,
    };
  }
  return { allowed: true, reason: 'No subnet or NIC NSG attached' };
}

export type RouteOrigin = 'UDR' | 'BGP' | 'System';

export interface RouteEntry {
  name: string;
  addressPrefix: string;
  nextHop: string;
  origin: RouteOrigin;
}

const ORIGIN_RANK: Record<RouteOrigin, number> = { UDR: 0, BGP: 1, System: 2 };

/** Longest-prefix match wins; ties break UDR > BGP > System. */
export function selectRoute(routes: RouteEntry[], destIp: string): RouteEntry | undefined {
  const matching = routes.filter((r) => cidrContains(r.addressPrefix, destIp));
  matching.sort((a, b) => {
    const prefixA = parseCidr(a.addressPrefix).prefix;
    const prefixB = parseCidr(b.addressPrefix).prefix;
    if (prefixA !== prefixB) return prefixB - prefixA;
    return ORIGIN_RANK[a.origin] - ORIGIN_RANK[b.origin];
  });
  return matching[0];
}

export const SNAT_PORTS_PER_IP = 64_512;

export function snatCapacity(publicIpCount: number, portsPerIp = SNAT_PORTS_PER_IP): number {
  return publicIpCount * portsPerIp;
}

export function snatExhausted(options: {
  publicIpCount: number;
  concurrentFlows: number;
  portsPerIp?: number;
}): boolean {
  return options.concurrentFlows > snatCapacity(options.publicIpCount, options.portsPerIp);
}

// ============================================================================
// 5. Compute: App Service slots, Durable determinism, Service Bus
// ============================================================================

export interface SlotSetting {
  value: string;
  slotSticky: boolean;
}

export function simulateSlotSwap(options: {
  production: Record<string, SlotSetting>;
  staging: Record<string, SlotSetting>;
}): {
  newProduction: Record<string, string>;
  newStaging: Record<string, string>;
  swappedKeys: string[];
  stickyKeys: string[];
} {
  const newProduction: Record<string, string> = {};
  const newStaging: Record<string, string> = {};
  const swappedKeys: string[] = [];
  const stickyKeys: string[] = [];
  const keys = new Set([...Object.keys(options.production), ...Object.keys(options.staging)]);
  for (const key of keys) {
    const prod = options.production[key];
    const stag = options.staging[key];
    const sticky = (prod?.slotSticky ?? false) || (stag?.slotSticky ?? false);
    if (sticky) {
      if (prod) newProduction[key] = prod.value;
      if (stag) newStaging[key] = stag.value;
      stickyKeys.push(key);
    } else {
      if (stag) newProduction[key] = stag.value;
      if (prod) newStaging[key] = prod.value;
      swappedKeys.push(key);
    }
  }
  return { newProduction, newStaging, swappedKeys, stickyKeys };
}

export function simulateSwapWarmup(options: { instanceCount: number; warmedInstances: number }): {
  ok: number;
  http503: number;
} {
  const warmed = Math.min(options.instanceCount, options.warmedInstances);
  return { ok: warmed, http503: options.instanceCount - warmed };
}

export class NonDeterministicWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonDeterministicWorkflowError';
  }
}

export interface DeterministicOrchestratorContext {
  currentUtcDateTime: Date;
  callActivity: (name: string, input?: unknown) => unknown;
}

export interface UnsafeDeps {
  /** Represents calling Date.now()/Date() directly in the orchestrator. */
  wallClockNow: () => number;
  /** Represents calling Math.random() directly in the orchestrator. */
  random: () => number;
}

/**
 * Runs the orchestrator twice (initial + replay after a restart with a
 * different wall clock) while replaying identical activity results. A
 * deterministic orchestrator returns identical output; anything reading the
 * wall clock or Math.random directly diverges and fails replay.
 */
export function executeWithReplayCheck(
  orchestrator: (ctx: DeterministicOrchestratorContext, deps: UnsafeDeps) => unknown,
  options: { fixedUtc: Date; replayWallClockMs: number },
): { ok: true; result: unknown } {
  const journal = new Map<string, unknown>();
  const makeCtx = (): DeterministicOrchestratorContext => ({
    currentUtcDateTime: new Date(options.fixedUtc.getTime()),
    callActivity: (name: string, input?: unknown) => {
      const key = `${name}:${JSON.stringify(input)}`;
      if (!journal.has(key)) {
        journal.set(key, `result-of-${name}`);
      }
      return journal.get(key);
    },
  });
  const first = orchestrator(makeCtx(), {
    wallClockNow: () => options.fixedUtc.getTime(),
    random: () => 0.42,
  });
  const second = orchestrator(makeCtx(), {
    wallClockNow: () => options.replayWallClockMs,
    random: () => 0.97,
  });
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new NonDeterministicWorkflowError(
      'Orchestrator output diverged on replay: it must use ctx.currentUtcDateTime and activities only',
    );
  }
  return { ok: true, result: first };
}

export const DEFAULT_DUPLICATE_DETECTION_WINDOW_MS = 10 * 60_000;
export const MIN_DUPLICATE_DETECTION_WINDOW_MS = 20_000;
export const MAX_DUPLICATE_DETECTION_WINDOW_MS = 7 * 24 * 60 * 60_000;

export interface SbStoredMessage {
  id: string;
  messageId: string;
  partitionKey: string | undefined;
  sessionId: string | undefined;
  body: string;
  deliveryCount: number;
  lockedUntilMs: number;
  lockToken: string | undefined;
  state: 'active' | 'locked' | 'completed' | 'deadletter';
  deadLetterReason: string | undefined;
}

export interface SbSendResult {
  accepted: boolean;
  deduplicated: boolean;
  message: SbStoredMessage | undefined;
}

export class ServiceBusQueue {
  public readonly lockDurationMs: number;
  public readonly maxDeliveryCount: number;
  public readonly duplicateDetectionWindowMs: number;

  private messages: SbStoredMessage[] = [];
  private deadLetter: SbStoredMessage[] = [];
  private seenMessageIds = new Map<string, number>();
  private idCounter = 0;
  private lockCounter = 0;

  constructor(options?: {
    lockDurationMs?: number;
    maxDeliveryCount?: number;
    duplicateDetectionWindowMs?: number;
  }) {
    this.lockDurationMs = options?.lockDurationMs ?? 60_000;
    this.maxDeliveryCount = options?.maxDeliveryCount ?? 10;
    const windowMs = options?.duplicateDetectionWindowMs ?? DEFAULT_DUPLICATE_DETECTION_WINDOW_MS;
    if (
      windowMs < MIN_DUPLICATE_DETECTION_WINDOW_MS ||
      windowMs > MAX_DUPLICATE_DETECTION_WINDOW_MS
    ) {
      throw new Error(
        `duplicateDetectionWindowMs must be between ${MIN_DUPLICATE_DETECTION_WINDOW_MS}ms (20s) and ${MAX_DUPLICATE_DETECTION_WINDOW_MS}ms (7d)`,
      );
    }
    this.duplicateDetectionWindowMs = windowMs;
  }

  send(
    body: string,
    options?: { messageId?: string; sessionId?: string; partitionKey?: string },
    nowMs = 0,
  ): SbSendResult {
    const messageId = options?.messageId ?? `auto-${this.idCounter}`;
    const dedupeKey = `${options?.partitionKey ?? ''}\0${messageId}`;
    const lastSeen = this.seenMessageIds.get(dedupeKey);
    if (options?.messageId !== undefined && lastSeen !== undefined) {
      if (nowMs - lastSeen < this.duplicateDetectionWindowMs) {
        // Service Bus accepts the send and silently drops the duplicate message.
        return { accepted: true, deduplicated: true, message: undefined };
      }
    }
    this.seenMessageIds.set(dedupeKey, nowMs);
    this.idCounter += 1;
    const message: SbStoredMessage = {
      id: `msg-${this.idCounter}`,
      messageId,
      partitionKey: options?.partitionKey,
      sessionId: options?.sessionId,
      body,
      deliveryCount: 0,
      lockedUntilMs: 0,
      lockToken: undefined,
      state: 'active',
      deadLetterReason: undefined,
    };
    this.messages.push(message);
    return { accepted: true, deduplicated: false, message };
  }

  private lockHead(message: SbStoredMessage, nowMs: number): SbStoredMessage {
    this.lockCounter += 1;
    message.deliveryCount += 1;
    message.lockedUntilMs = nowMs + this.lockDurationMs;
    message.lockToken = `lock-${this.lockCounter}`;
    message.state = 'locked';
    return message;
  }

  receive(nowMs: number): SbStoredMessage | undefined {
    const head = this.messages.find((m) => m.state === 'active' && m.sessionId === undefined);
    if (!head) return undefined;
    return this.lockHead(head, nowMs);
  }

  /** Strict per-session FIFO: only the head of that session's queue is delivered. */
  receiveSession(sessionId: string, nowMs: number): SbStoredMessage | undefined {
    const head = this.messages.find(
      (m) => m.sessionId === sessionId && m.state !== 'completed' && m.state !== 'deadletter',
    );
    if (!head || head.state !== 'active') return undefined;
    return this.lockHead(head, nowMs);
  }

  complete(lockToken: string, nowMs: number): { ok: boolean; error?: string } {
    const message = this.messages.find((m) => m.lockToken === lockToken);
    if (!message || message.state !== 'locked') {
      return { ok: false, error: 'MessageNotFound' };
    }
    if (nowMs > message.lockedUntilMs) {
      return { ok: false, error: 'MessageLockLost' };
    }
    message.state = 'completed';
    message.lockToken = undefined;
    return { ok: true };
  }

  /**
   * Sweeps expired locks: redelivers while under MaxDeliveryCount, else moves
   * the message to the DLQ with reason MaxDeliveryCountExceeded.
   */
  sweep(nowMs: number): { expired: number; redelivered: number; deadLettered: number } {
    let expired = 0;
    let redelivered = 0;
    let deadLettered = 0;
    const remaining: SbStoredMessage[] = [];
    for (const message of this.messages) {
      if (message.state === 'locked' && nowMs > message.lockedUntilMs) {
        expired += 1;
        if (message.deliveryCount >= this.maxDeliveryCount) {
          message.state = 'deadletter';
          message.deadLetterReason = 'MaxDeliveryCountExceeded';
          this.deadLetter.push(message);
          deadLettered += 1;
        } else {
          message.state = 'active';
          message.lockToken = undefined;
          message.lockedUntilMs = 0;
          remaining.push(message);
          redelivered += 1;
        }
      } else {
        remaining.push(message);
      }
    }
    this.messages = remaining;
    return { expired, redelivered, deadLettered };
  }

  pendingCount(): number {
    return this.messages.filter((m) => m.state !== 'completed').length;
  }

  deadLetterCount(): number {
    return this.deadLetter.length;
  }

  deadLetterReason(id: string): string | undefined {
    return this.deadLetter.find((m) => m.id === id)?.deadLetterReason;
  }
}

/**
 * KEDA queue-scaler replica count: scales to `minReplicas` (default 0) when
 * backlog is 0, and scales up to `min(maxReplicas, ceil(backlog / targetQueueLength))`.
 */
export function calculateKedaReplicas(options: {
  backlog: number;
  targetQueueLength: number;
  minReplicas?: number;
  maxReplicas: number;
}): number {
  if (options.targetQueueLength <= 0) {
    throw new Error(`targetQueueLength must be positive, got ${options.targetQueueLength}`);
  }
  if (options.maxReplicas < 0) {
    throw new Error(`maxReplicas must be non-negative, got ${options.maxReplicas}`);
  }
  const minReplicas = options.minReplicas ?? 0;
  if (options.backlog <= 0) {
    return minReplicas;
  }
  const desired = Math.ceil(options.backlog / options.targetQueueLength);
  return Math.min(options.maxReplicas, Math.max(minReplicas, desired));
}

export interface RevisionTrafficRule {
  revisionName: string;
  weight: number;
}

/** Container Apps active-revision traffic weights must be 0..100 integers summing to 100. */
export function validateRevisionTrafficWeights(rules: RevisionTrafficRule[]): {
  valid: boolean;
  totalWeight: number;
  reason: string;
} {
  if (rules.length === 0) {
    return {
      valid: false,
      totalWeight: 0,
      reason: 'At least one revision traffic rule is required',
    };
  }
  const seen = new Set<string>();
  let totalWeight = 0;
  for (const rule of rules) {
    if (seen.has(rule.revisionName)) {
      return {
        valid: false,
        totalWeight,
        reason: `Duplicate revision '${rule.revisionName}' in traffic split`,
      };
    }
    seen.add(rule.revisionName);
    if (!Number.isInteger(rule.weight) || rule.weight < 0 || rule.weight > 100) {
      return {
        valid: false,
        totalWeight,
        reason: `Revision '${rule.revisionName}' has invalid weight ${rule.weight}`,
      };
    }
    totalWeight += rule.weight;
  }
  if (totalWeight !== 100) {
    return {
      valid: false,
      totalWeight,
      reason: `Revision traffic weights sum to ${totalWeight}%, must equal 100%`,
    };
  }
  return { valid: true, totalWeight, reason: 'Traffic weights sum to 100%' };
}

export interface BSeriesCreditState {
  credits: number;
  baselinePercent: number;
  maxCredits: number;
}

export interface BSeriesStepResult {
  effectiveCpuPercent: number;
  creditsRemaining: number;
  throttled: boolean;
}

/**
 * Models B-series burstable VM CPU credits:
 * - Below baseline: accrues credits up to `maxCredits`.
 * - Above baseline: spends credits; when credits reach 0, throttles to `baselinePercent`.
 */
export function stepBSeriesCpu(
  state: BSeriesCreditState,
  requestedCpuPercent: number,
  durationMinutes = 1,
): BSeriesStepResult {
  const clampedRequest = Math.max(0, Math.min(100, requestedCpuPercent));
  if (durationMinutes <= 0) {
    return {
      effectiveCpuPercent: clampedRequest,
      creditsRemaining: state.credits,
      throttled: false,
    };
  }
  if (clampedRequest <= state.baselinePercent) {
    const accrued = ((state.baselinePercent - clampedRequest) / 100) * durationMinutes;
    const creditsRemaining = Math.min(state.maxCredits, state.credits + accrued);
    return { effectiveCpuPercent: clampedRequest, creditsRemaining, throttled: false };
  }
  const needed = ((clampedRequest - state.baselinePercent) / 100) * durationMinutes;
  if (state.credits >= needed) {
    return {
      effectiveCpuPercent: clampedRequest,
      creditsRemaining: state.credits - needed,
      throttled: false,
    };
  }
  // Credits exhausted (either 0 at start or drained mid-interval): platform caps CPU at baseline.
  const burstFraction = state.credits > 0 ? state.credits / needed : 0;
  const effectiveCpuPercent =
    state.baselinePercent + (clampedRequest - state.baselinePercent) * burstFraction;
  return { effectiveCpuPercent, creditsRemaining: 0, throttled: true };
}

export interface ImdsScheduledEventRaw {
  EventId: string;
  EventStatus: string;
  EventType: string;
  ResourceType: string;
  Resources: string[];
  NotBefore: string;
  Description?: string;
  EventSource?: string;
}

export interface ImdsScheduledEventsDocument {
  DocumentIncarnation: number;
  Events: ImdsScheduledEventRaw[];
}

export interface ParsedPreemptNotice {
  eventId: string;
  resources: string[];
  notBeforeMs: number;
  secondsRemaining: number;
}

/** Parses IMDS Scheduled Events JSON and detects Spot `Preempt` eviction notices. */
export function parseImdsScheduledEvents(
  rawJson: string | ImdsScheduledEventsDocument,
  nowMs: number,
): {
  documentIncarnation: number;
  hasPreemptNotice: boolean;
  preemptEvents: ParsedPreemptNotice[];
  ackPayload: { StartRequests: Array<{ EventId: string }> };
} {
  const doc =
    typeof rawJson === 'string' ? (JSON.parse(rawJson) as ImdsScheduledEventsDocument) : rawJson;
  if (!Array.isArray(doc.Events)) {
    throw new Error('Invalid IMDS Scheduled Events document: Events must be an array');
  }
  const preemptEvents: ParsedPreemptNotice[] = [];
  for (const event of doc.Events) {
    if (event.EventType !== 'Preempt') continue;
    const notBeforeMs = Date.parse(event.NotBefore);
    if (!Number.isFinite(notBeforeMs)) {
      throw new Error(`Invalid NotBefore timestamp in event ${event.EventId}: ${event.NotBefore}`);
    }
    const secondsRemaining = Math.max(0, Math.round((notBeforeMs - nowMs) / 1000));
    preemptEvents.push({
      eventId: event.EventId,
      resources: event.Resources,
      notBeforeMs,
      secondsRemaining,
    });
  }
  return {
    documentIncarnation: doc.DocumentIncarnation,
    hasPreemptNotice: preemptEvents.length > 0,
    preemptEvents,
    ackPayload: { StartRequests: preemptEvents.map((e) => ({ EventId: e.eventId })) },
  };
}

/** Models APIM `llm-token-limit` / `azure-openai-token-limit` token-bucket policy per counter key. */
export class ApimLlmTokenLimiter {
  public readonly tokensPerMinute: number;
  private buckets = new Map<string, { tokens: number; lastRefillMs: number }>();

  constructor(tokensPerMinute: number) {
    if (tokensPerMinute <= 0) {
      throw new Error(`tokensPerMinute must be positive, got ${tokensPerMinute}`);
    }
    this.tokensPerMinute = tokensPerMinute;
  }

  consume(
    counterKey: string,
    requestedTokens: number,
    nowMs: number,
  ): { allowed: boolean; status: number; remainingTokens: number; retryAfterSeconds: number } {
    const existing = this.buckets.get(counterKey) ?? {
      tokens: this.tokensPerMinute,
      lastRefillMs: nowMs,
    };
    const elapsedMs = Math.max(0, nowMs - existing.lastRefillMs);
    const refilled = Math.min(
      this.tokensPerMinute,
      existing.tokens + (elapsedMs / 60_000) * this.tokensPerMinute,
    );
    if (requestedTokens > refilled) {
      this.buckets.set(counterKey, { tokens: refilled, lastRefillMs: nowMs });
      const deficit = requestedTokens - refilled;
      const retryAfterSeconds = Math.max(1, Math.ceil(deficit / (this.tokensPerMinute / 60)));
      return {
        allowed: false,
        status: 429,
        remainingTokens: Math.floor(refilled),
        retryAfterSeconds,
      };
    }
    const remaining = refilled - requestedTokens;
    this.buckets.set(counterKey, { tokens: remaining, lastRefillMs: nowMs });
    return {
      allowed: true,
      status: 200,
      remainingTokens: Math.floor(remaining),
      retryAfterSeconds: 0,
    };
  }
}

// ============================================================================
// 6. Storage: naming, SAS, ETag, GRS failover, early-deletion penalty
// ============================================================================

export function validateStorageAccountName(name: string): { valid: boolean; reason: string } {
  if (name.length < 3 || name.length > 24) {
    return { valid: false, reason: 'Storage account names must be 3-24 characters long' };
  }
  if (!/^[a-z0-9]+$/.test(name)) {
    return {
      valid: false,
      reason: 'Storage account names must be lowercase alphanumeric (no hyphens)',
    };
  }
  return { valid: true, reason: 'Name is valid' };
}

export class StorageAccountNameRegistry {
  private taken = new Set<string>();

  register(name: string): { registered: boolean; reason: string } {
    const validity = validateStorageAccountName(name);
    if (!validity.valid) return { registered: false, reason: validity.reason };
    if (this.taken.has(name)) {
      return { registered: false, reason: 'NameAlreadyTaken: storage account DNS is global' };
    }
    this.taken.add(name);
    return { registered: true, reason: 'Registered' };
  }
}

export type SasKind = 'Account' | 'Service' | 'UserDelegation';

export interface SasDescriptor {
  kind: SasKind;
  permissions: string;
  expiresOnMs: number;
}

export interface SasDecision {
  allowed: boolean;
  status: number;
  code: string;
}

/** Shared-key-based SAS is rejected when the account disables shared key. */
export function authorizeSas(options: {
  sas: SasDescriptor;
  allowSharedKeyAccess: boolean;
  nowMs: number;
  requiredPermission: string;
}): SasDecision {
  if (
    (options.sas.kind === 'Account' || options.sas.kind === 'Service') &&
    !options.allowSharedKeyAccess
  ) {
    return { allowed: false, status: 403, code: 'SharedKeyDisabled' };
  }
  if (options.nowMs >= options.sas.expiresOnMs) {
    return { allowed: false, status: 403, code: 'AuthenticationFailed: SAS expired' };
  }
  if (!options.sas.permissions.includes(options.requiredPermission)) {
    return { allowed: false, status: 403, code: 'InsufficientPermissions' };
  }
  return { allowed: true, status: 200, code: 'Authorized' };
}

export class VersionedBlobStore {
  private blobs = new Map<string, { content: string; etag: string; version: number }>();

  putBlob(
    container: string,
    name: string,
    content: string,
    options?: { ifMatch?: string; ifNoneMatch?: string },
  ): { status: number; etag?: string; code?: string } {
    const key = `${container}/${name}`;
    const existing = this.blobs.get(key);
    if (options?.ifNoneMatch === '*') {
      if (existing) {
        return { status: 409, code: 'BlobAlreadyExists' };
      }
      const version = 1;
      const etag = `"${createHash('sha256').update(`${key}:${version}:${content}`).digest('hex').slice(0, 16)}"`;
      this.blobs.set(key, { content, etag, version });
      return { status: 201, etag };
    }
    if (options?.ifNoneMatch !== undefined && existing && existing.etag === options.ifNoneMatch) {
      return { status: 412, code: 'ConditionNotMet' };
    }
    if (options?.ifMatch !== undefined) {
      if (!existing || existing.etag !== options.ifMatch) {
        return { status: 412, code: 'PreconditionFailed' };
      }
    }
    const version = (existing?.version ?? 0) + 1;
    const etag = `"${createHash('sha256').update(`${key}:${version}:${content}`).digest('hex').slice(0, 16)}"`;
    this.blobs.set(key, { content, etag, version });
    return { status: 200, etag };
  }

  /** Create-once write using `If-None-Match: *`: returns 201 on create, 409 if already present. */
  createOnce(
    container: string,
    name: string,
    content: string,
  ): { status: number; etag?: string; code?: string } {
    return this.putBlob(container, name, content, { ifNoneMatch: '*' });
  }

  getBlob(container: string, name: string): { status: number; etag?: string; content?: string } {
    const existing = this.blobs.get(`${container}/${name}`);
    if (!existing) return { status: 404 };
    return { status: 200, etag: existing.etag, content: existing.content };
  }
}

export type GeoRedundancy = 'LRS' | 'ZRS' | 'GRS' | 'GZRS' | 'RA-GRS' | 'RA-GZRS';

interface TimestampedWrite {
  content: string;
  atMs: number;
}

/** Simulates GRS/GZRS/RA-GRS/RA-GZRS async replication (typical lag <= 15 min) and failover. */
export class GeoReplicatedBlob {
  private writes: TimestampedWrite[] = [];
  private secondaryContent = '';
  private lastSyncTimeMs = 0;
  public redundancy: GeoRedundancy;

  constructor(options?: { redundancy?: GeoRedundancy }) {
    this.redundancy = options?.redundancy ?? 'GRS';
  }

  write(content: string, nowMs: number): void {
    this.writes.push({ content, atMs: nowMs });
  }

  replicate(nowMs: number): void {
    const latest = this.writes[this.writes.length - 1];
    if (latest) {
      this.secondaryContent = latest.content;
    }
    this.lastSyncTimeMs = nowMs;
  }

  lastSyncTime(): number {
    return this.lastSyncTimeMs;
  }

  readPrimary(): string | undefined {
    return this.writes[this.writes.length - 1]?.content;
  }

  readSecondary(): { status: number; content?: string; stale?: boolean; code?: string } {
    if (this.redundancy === 'LRS' || this.redundancy === 'ZRS') {
      return { status: 409, code: 'SecondaryNotAvailable' };
    }
    if (this.redundancy === 'GRS' || this.redundancy === 'GZRS') {
      return { status: 403, code: 'SecondaryReadNotAllowed' };
    }
    const latestAt = this.writes[this.writes.length - 1]?.atMs ?? 0;
    return {
      status: 200,
      content: this.secondaryContent,
      stale: latestAt > this.lastSyncTimeMs,
    };
  }

  /** Customer-initiated unplanned failover loses writes after lastSyncTime. */
  unplannedFailover(nowMs: number): { lostWrites: number; newRedundancy: GeoRedundancy } {
    void nowMs;
    const lost = this.writes.filter((w) => w.atMs > this.lastSyncTimeMs);
    const kept = this.writes.filter((w) => w.atMs <= this.lastSyncTimeMs);
    this.writes = kept;
    this.secondaryContent = '';
    const demoted: GeoRedundancy =
      this.redundancy === 'GZRS' || this.redundancy === 'RA-GZRS' ? 'ZRS' : 'LRS';
    this.redundancy = demoted;
    return { lostWrites: lost.length, newRedundancy: demoted };
  }
}

export type ArchiveTier = 'Hot' | 'Cool' | 'Cold' | 'Archive';

export const TIER_MINIMUM_DAYS: Record<ArchiveTier, number> = {
  Hot: 0,
  Cool: 30,
  Cold: 90,
  Archive: 180,
};

export function earlyDeletionChargeableDays(tier: ArchiveTier, elapsedDays: number): number {
  return Math.max(0, TIER_MINIMUM_DAYS[tier] - Math.max(0, elapsedDays));
}

// ============================================================================
// 7. Cosmos DB: partitioning, throttling, consistency
// ============================================================================

export const LOGICAL_PARTITION_LIMIT_BYTES = 20 * 1024 * 1024 * 1024;

export class LogicalPartition {
  public bytesUsed = 0;

  write(sizeBytes: number): { status: number; substatus?: number; code?: string } {
    if (this.bytesUsed + sizeBytes > LOGICAL_PARTITION_LIMIT_BYTES) {
      return { status: 403, substatus: 1014, code: 'PartitionKeyRangeIsFull' };
    }
    this.bytesUsed += sizeBytes;
    return { status: 201 };
  }
}

export const MAX_PARTITION_RU_PER_SEC = 10_000;

export interface HpkQueryRouteResult {
  strategy: 'single-partition' | 'prefix-targeted' | 'fan-out';
  prefixLength: number;
  partitionsContacted: number;
  matchedLogicalPartitions: number;
}

export class HierarchicalPartitionCollection {
  private partitions = new Map<string, LogicalPartition>();
  public readonly keyPaths: string[];

  constructor(keyPaths: string[]) {
    this.keyPaths = keyPaths;
  }

  write(doc: Record<string, unknown>, sizeBytes: number): ReturnType<LogicalPartition['write']> {
    const key = this.keyPaths.map((p) => String(doc[p] ?? '')).join('!');
    let partition = this.partitions.get(key);
    if (!partition) {
      partition = new LogicalPartition();
      this.partitions.set(key, partition);
    }
    return partition.write(sizeBytes);
  }

  partitionCount(): number {
    return this.partitions.size;
  }

  maxUsageBytes(): number {
    let max = 0;
    for (const p of this.partitions.values()) {
      max = Math.max(max, p.bytesUsed);
    }
    return max;
  }

  /**
   * Routes a query using contiguous leading HPK prefix values.
   * Supplying leading `keyPaths[0]` (e.g. `tenantId`) targets only the partition(s)
   * holding that prefix; omitting `keyPaths[0]` forces a full fan-out across all
   * physical partitions.
   */
  routeQuery(filter: Record<string, string>, totalPhysicalPartitions: number): HpkQueryRouteResult {
    let prefixLength = 0;
    for (const path of this.keyPaths) {
      if (filter[path] === undefined) break;
      prefixLength += 1;
    }
    if (prefixLength === 0) {
      return {
        strategy: 'fan-out',
        prefixLength: 0,
        partitionsContacted: totalPhysicalPartitions,
        matchedLogicalPartitions: this.partitions.size,
      };
    }
    const prefixParts = this.keyPaths.slice(0, prefixLength).map((p) => filter[p] ?? '');
    const prefixJoined = prefixParts.join('!');
    let matchedLogical = 0;
    const physicalHits = new Set<number>();
    for (const key of this.partitions.keys()) {
      const parts = key.split('!');
      if (parts.slice(0, prefixLength).join('!') === prefixJoined) {
        matchedLogical += 1;
        // Subpartitions sharing the leading level co-locate on the leading-level hash range.
        physicalHits.add(hashPartitionKey(parts[0] ?? '', totalPhysicalPartitions));
      }
    }
    if (prefixLength === this.keyPaths.length) {
      return {
        strategy: 'single-partition',
        prefixLength,
        partitionsContacted: 1,
        matchedLogicalPartitions: Math.max(1, matchedLogical),
      };
    }
    return {
      strategy: 'prefix-targeted',
      prefixLength,
      partitionsContacted: Math.max(1, physicalHits.size),
      matchedLogicalPartitions: matchedLogical,
    };
  }
}

export function estimatePointReadRu(itemSizeKb = 1): number {
  return Math.max(1, Math.ceil(itemSizeKb));
}

export function estimateQueryRu(options: {
  partitionsContacted: number;
  baseRuPerPartition?: number;
  matchedItems?: number;
  itemSizeKb?: number;
}): number {
  const base = options.baseRuPerPartition ?? 2.8;
  const itemCharge =
    (options.matchedItems ?? 0) * Math.max(1, Math.ceil(options.itemSizeKb ?? 1)) * 0.5;
  return Number((options.partitionsContacted * base + itemCharge).toFixed(2));
}

function hashPartitionKey(key: string, buckets: number): number {
  const digest = createHash('sha256').update(key).digest();
  return (digest[0] ?? 0) % buckets;
}

/** Models RU caps per physical partition plus SDK retry on 429. */
export class CosmosThroughputPool {
  public readonly totalRuPerSec: number;
  public readonly physicalPartitionCount: number;
  private usageByPartition = new Map<number, { windowMs: number; usedRu: number }>();

  constructor(options: { totalRuPerSec: number; physicalPartitionCount: number }) {
    this.totalRuPerSec = options.totalRuPerSec;
    this.physicalPartitionCount = options.physicalPartitionCount;
  }

  perPartitionCap(): number {
    return Math.min(
      MAX_PARTITION_RU_PER_SEC,
      Math.floor(this.totalRuPerSec / this.physicalPartitionCount),
    );
  }

  locatePartition(partitionKey: string): number {
    return hashPartitionKey(partitionKey, this.physicalPartitionCount);
  }

  consumeAt(
    partitionKey: string,
    ru: number,
    nowMs: number,
  ): { throttled: boolean; status: number; retryAfterMs: number } {
    const partition = this.locatePartition(partitionKey);
    const windowMs = Math.floor(nowMs / 1000) * 1000;
    const usage = this.usageByPartition.get(partition);
    const used = usage && usage.windowMs === windowMs ? usage.usedRu : 0;
    if (used + ru > this.perPartitionCap()) {
      return { throttled: true, status: 429, retryAfterMs: 100 };
    }
    this.usageByPartition.set(partition, { windowMs, usedRu: used + ru });
    return { throttled: false, status: 200, retryAfterMs: 0 };
  }

  /** SDK-style retry loop obeying x-ms-retry-after-ms on the virtual clock. */
  consumeWithRetry(
    partitionKey: string,
    ru: number,
    startMs: number,
    maxAttempts = 10,
  ): { ok: boolean; attempts: number; finishedAtMs: number } {
    let nowMs = startMs;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const result = this.consumeAt(partitionKey, ru, nowMs);
      if (!result.throttled) {
        return { ok: true, attempts: attempt, finishedAtMs: nowMs };
      }
      nowMs += result.retryAfterMs + 1000;
    }
    return { ok: false, attempts: maxAttempts, finishedAtMs: nowMs };
  }
}

export type CosmosConsistency =
  | 'Strong'
  | 'BoundedStaleness'
  | 'Session'
  | 'ConsistentPrefix'
  | 'Eventual';

export class CosmosConsistencyWorld {
  private committed: string[] = [];
  private replicaVisibleCount = 0;

  write(value: string): number {
    this.committed.push(value);
    return this.committed.length;
  }

  replicateAll(): void {
    this.replicaVisibleCount = this.committed.length;
  }

  setReplicaLag(versions: number): void {
    this.replicaVisibleCount = Math.max(0, this.committed.length - versions);
  }

  committedCount(): number {
    return this.committed.length;
  }

  replicaLag(): number {
    return this.committed.length - this.replicaVisibleCount;
  }

  read(options?: {
    consistency?: CosmosConsistency;
    sessionToken?: number;
    maxStalenessVersions?: number;
  }): { value: string | undefined; lsn: number; stale: boolean } {
    const consistency = options?.consistency ?? 'Eventual';
    const latest = this.committed.length;
    if (consistency === 'Strong') {
      const value = this.committed[latest - 1];
      return { value, lsn: latest, stale: false };
    }
    if (consistency === 'BoundedStaleness') {
      const bound = options?.maxStalenessVersions ?? 100;
      if (this.replicaLag() > bound) {
        throw new Error(`BoundedStaleness violated: lag ${this.replicaLag()} exceeds K=${bound}`);
      }
    }
    if (consistency === 'Session' && options?.sessionToken !== undefined) {
      const token = options.sessionToken;
      const visible = Math.max(this.replicaVisibleCount, Math.min(token, latest));
      const value = this.committed[visible - 1];
      return { value, lsn: visible, stale: visible < latest };
    }
    const value = this.committed[this.replicaVisibleCount - 1];
    return { value, lsn: this.replicaVisibleCount, stale: this.replicaVisibleCount < latest };
  }
}

// ============================================================================
// 8. Key Vault (soft-delete + purge protection), SLA math, BCDR topologies
// ============================================================================

export class SoftDeleteKeyVault {
  private live = new Map<string, { value: string; version: number }>();
  private softDeleted = new Map<string, { value: string; deletedAtMs: number }>();
  private vaultDeletedAtMs: number | undefined;
  public readonly retentionDays: number;
  public readonly purgeProtection: boolean;
  private versionCounter = 0;

  constructor(options?: { retentionDays?: number; purgeProtection?: boolean }) {
    this.retentionDays = options?.retentionDays ?? 90;
    this.purgeProtection = options?.purgeProtection ?? true;
  }

  setSecret(name: string, value: string): { status: number; version?: string; code?: string } {
    if (this.vaultDeletedAtMs !== undefined) {
      return { status: 404, code: 'VaultNotFound' };
    }
    if (this.softDeleted.has(name)) {
      return { status: 409, code: 'SecretSoftDeleted: recover or purge first' };
    }
    this.versionCounter += 1;
    this.live.set(name, { value, version: this.versionCounter });
    return { status: 200, version: `v${this.versionCounter}` };
  }

  getSecret(name: string): { status: number; value?: string; code?: string } {
    const entry = this.live.get(name);
    if (!entry) return { status: 404, code: 'SecretNotFound' };
    return { status: 200, value: entry.value };
  }

  deleteSecret(name: string, nowMs: number): { status: number; code?: string } {
    const entry = this.live.get(name);
    if (!entry) return { status: 404, code: 'SecretNotFound' };
    this.live.delete(name);
    this.softDeleted.set(name, { value: entry.value, deletedAtMs: nowMs });
    return { status: 200 };
  }

  recoverSecret(name: string, nowMs: number): { status: number; code?: string } {
    const entry = this.softDeleted.get(name);
    if (!entry) return { status: 404, code: 'NothingToRecover' };
    const ageDays = (nowMs - entry.deletedAtMs) / (24 * 60 * 60 * 1000);
    if (ageDays > this.retentionDays) {
      return { status: 410, code: 'RetentionExpired' };
    }
    this.softDeleted.delete(name);
    this.live.set(name, { value: entry.value, version: 1 });
    return { status: 200 };
  }

  purgeSecret(name: string): { status: number; code?: string } {
    if (this.purgeProtection) {
      return { status: 409, code: 'PurgeProtectionEnabled' };
    }
    if (!this.softDeleted.has(name)) return { status: 404, code: 'NothingToPurge' };
    this.softDeleted.delete(name);
    return { status: 200 };
  }

  deleteVault(nowMs: number): { status: number } {
    this.vaultDeletedAtMs = nowMs;
    return { status: 200 };
  }

  /** Recreating a vault/secret name during retention collides with soft-delete. */
  recreateVault(): { status: number; code: string } {
    if (this.vaultDeletedAtMs !== undefined && this.purgeProtection) {
      return { status: 409, code: 'PurgeProtectionEnabled: retention window still active' };
    }
    this.vaultDeletedAtMs = undefined;
    return { status: 201, code: 'Created' };
  }

  recoverVault(): { status: number; code: string } {
    if (this.vaultDeletedAtMs === undefined) {
      return { status: 404, code: 'NothingToRecover' };
    }
    this.vaultDeletedAtMs = undefined;
    return { status: 200, code: 'Recovered' };
  }
}

export type SecretAccessModel = 'RBAC' | 'VaultAccessPolicy';

export interface RbacSecretGrant {
  principalId: string;
  /** Secret-level '/vaults/v/secrets/s' or vault-level '/vaults/v'. */
  scope: string;
}

export function authorizeSecretRead(options: {
  model: SecretAccessModel;
  principalId: string;
  secretName: string;
  vaultName: string;
  rbacGrants?: RbacSecretGrant[];
  vaultPolicyGet?: string[];
}): { allowed: boolean; status: number; reason: string } {
  if (options.model === 'VaultAccessPolicy') {
    if (options.vaultPolicyGet?.includes(options.principalId) === true) {
      return {
        allowed: true,
        status: 200,
        reason: 'Vault access policy grants get on every secret (vault-wide blast radius)',
      };
    }
    return { allowed: false, status: 403, reason: 'No vault access policy entry' };
  }
  const secretScope = `/vaults/${options.vaultName}/secrets/${options.secretName}`;
  const vaultScope = `/vaults/${options.vaultName}`;
  const hit = (options.rbacGrants ?? []).some(
    (g) =>
      g.principalId === options.principalId && (g.scope === secretScope || g.scope === vaultScope),
  );
  if (hit) {
    return { allowed: true, status: 200, reason: 'RBAC grant covers this secret scope' };
  }
  return { allowed: false, status: 403, reason: 'RBAC: no grant on this secret scope' };
}

/** Series: every dependency must be up (product). */
export function seriesAvailability(components: number[]): number {
  return components.reduce((acc, c) => acc * c, 1);
}

/** Active-active parallel: the system is down only if every replica is down. */
export function activeActiveAvailability(a: number, b: number): number {
  return 1 - (1 - a) * (1 - b);
}

export type BcdrTopology = 'BackupRestore' | 'WarmStandby' | 'ActiveActive';

export const TOPOLOGY_RPO_RTO: Record<
  BcdrTopology,
  { rpoMinutes: [number, number]; rtoMinutes: [number, number]; description: string }
> = {
  BackupRestore: {
    rpoMinutes: [60, 1440],
    rtoMinutes: [60, 1440],
    description: 'Nightly backups + restore on demand; hours of RPO/RTO',
  },
  WarmStandby: {
    rpoMinutes: [1, 15],
    rtoMinutes: [5, 60],
    description: 'Scaled-down replica with log shipping; minutes of RPO/RTO',
  },
  ActiveActive: {
    rpoMinutes: [0, 1],
    rtoMinutes: [0, 5],
    description: 'Multi-region writes behind a global endpoint; near-zero RPO/RTO',
  },
};

export function meetsRpoRto(
  topology: BcdrTopology,
  requiredRpoMinutes: number,
  requiredRtoMinutes: number,
): { meetsRpo: boolean; meetsRto: boolean; reason: string } {
  const bounds = TOPOLOGY_RPO_RTO[topology];
  const meetsRpo = bounds.rpoMinutes[1] <= requiredRpoMinutes;
  const meetsRto = bounds.rtoMinutes[1] <= requiredRtoMinutes;
  return {
    meetsRpo,
    meetsRto,
    reason: `${topology}: worst-case RPO ${bounds.rpoMinutes[1]}m / RTO ${bounds.rtoMinutes[1]}m`,
  };
}

/** Rolling-window weighted transaction throttle bucket for Azure Key Vault (default 2,000 / 10s). */
export class KeyVaultThrottleBucket {
  public readonly limit: number;
  public readonly windowMs: number;
  private events: Array<{ atMs: number; weight: number }> = [];

  constructor(options?: { limit?: number; windowMs?: number }) {
    this.limit = options?.limit ?? 2_000;
    this.windowMs = options?.windowMs ?? 10_000;
  }

  consume(
    weight = 1,
    nowMs = 0,
  ): {
    allowed: boolean;
    status: number;
    code?: string;
    remaining: number;
    retryAfterSeconds: number;
  } {
    this.events = this.events.filter((e) => nowMs - e.atMs < this.windowMs);
    const used = this.events.reduce((sum, e) => sum + e.weight, 0);
    if (used + weight > this.limit) {
      const oldest = this.events[0];
      const waitMs = oldest ? Math.max(1, oldest.atMs + this.windowMs - nowMs) : this.windowMs;
      return {
        allowed: false,
        status: 429,
        code: 'Throttled',
        remaining: Math.max(0, this.limit - used),
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      };
    }
    this.events.push({ atMs: nowMs, weight });
    return {
      allowed: true,
      status: 200,
      remaining: this.limit - (used + weight),
      retryAfterSeconds: 0,
    };
  }
}

export type LogTablePlan = 'Analytics' | 'Basic' | 'Auxiliary';

export interface LogTablePlanRates {
  ingestPerGb: number;
  queryPerGbScanned: number;
  retentionPerGbMonth: number;
}

export const DEFAULT_LOG_TABLE_RATES: Record<LogTablePlan, LogTablePlanRates> = {
  Analytics: { ingestPerGb: 2.3, queryPerGbScanned: 0, retentionPerGbMonth: 0.1 },
  Basic: { ingestPerGb: 0.5, queryPerGbScanned: 0.005, retentionPerGbMonth: 0.02 },
  Auxiliary: { ingestPerGb: 0.15, queryPerGbScanned: 0.005, retentionPerGbMonth: 0.02 },
};

export interface LogTablePlanCostBreakdown {
  plan: LogTablePlan;
  ingestionCost: number;
  queryCost: number;
  retentionCost: number;
  totalCost: number;
}

/** Compares Log Analytics Analytics, Basic, and Auxiliary table plans for an ingestion/query mix. */
export function compareLogTablePlanCosts(options: {
  ingestionGbPerMonth: number;
  queriedGbPerMonth: number;
  retentionMonthsBeyondIncluded?: number;
  rates?: Record<LogTablePlan, LogTablePlanRates>;
}): { plans: LogTablePlanCostBreakdown[]; cheapestPlan: LogTablePlan } {
  const rates = options.rates ?? DEFAULT_LOG_TABLE_RATES;
  const retentionMonths = options.retentionMonthsBeyondIncluded ?? 0;
  const order: LogTablePlan[] = ['Analytics', 'Basic', 'Auxiliary'];
  const plans: LogTablePlanCostBreakdown[] = order.map((plan) => {
    const rate = rates[plan];
    const ingestionCost = Number((options.ingestionGbPerMonth * rate.ingestPerGb).toFixed(4));
    const queryCost = Number((options.queriedGbPerMonth * rate.queryPerGbScanned).toFixed(4));
    const retentionCost = Number(
      (options.ingestionGbPerMonth * retentionMonths * rate.retentionPerGbMonth).toFixed(4),
    );
    const totalCost = Number((ingestionCost + queryCost + retentionCost).toFixed(4));
    return { plan, ingestionCost, queryCost, retentionCost, totalCost };
  });
  let cheapest = plans[0]!;
  for (const candidate of plans) {
    if (candidate.totalCost < cheapest.totalCost) {
      cheapest = candidate;
    }
  }
  return { plans, cheapestPlan: cheapest.plan };
}

export type FinOpsCommitmentModel =
  | 'OnDemand'
  | 'Reservation1Yr'
  | 'Reservation3Yr'
  | 'SavingsPlan1Yr'
  | 'SavingsPlan3Yr';

/** Break-even utilization threshold for a prepaid commitment: `1 - discount`. */
export function commitmentBreakEvenUtilization(discountRate: number): number {
  if (discountRate < 0 || discountRate >= 1) {
    throw new Error(`discountRate must be in [0, 1), got ${discountRate}`);
  }
  return Number((1 - discountRate).toFixed(6));
}

/**
 * Evaluates On-Demand vs Reservation (1-yr/3-yr) vs Savings Plan (1-yr/3-yr),
 * including Azure Hybrid Benefit (AHB) stacking which eliminates the OS/SQL
 * license meter on top of the compute commitment discount.
 */
export function evaluateFinOpsCommitment(options: {
  model: FinOpsCommitmentModel;
  baseComputeHourly: number;
  licenseHourly: number;
  termHours: number;
  usedHours: number;
  commitmentDiscount: number;
  committedHours?: number;
  azureHybridBenefit?: boolean;
}): {
  model: FinOpsCommitmentModel;
  totalCost: number;
  onDemandCost: number;
  effectiveHourlyRate: number;
  utilization: number;
  breakEvenUtilization: number;
  beatsOnDemand: boolean;
  savingsVsOnDemand: number;
} {
  const ahb = options.azureHybridBenefit ?? false;
  const onDemandLicenseCost = ahb ? 0 : options.usedHours * options.licenseHourly;
  const onDemandNoAhb = options.usedHours * (options.baseComputeHourly + options.licenseHourly);
  const utilization = options.termHours > 0 ? options.usedHours / options.termHours : 0;

  if (options.model === 'OnDemand') {
    const totalCost = Number(
      (options.usedHours * options.baseComputeHourly + onDemandLicenseCost).toFixed(4),
    );
    return {
      model: options.model,
      totalCost,
      onDemandCost: Number(onDemandNoAhb.toFixed(4)),
      effectiveHourlyRate:
        options.usedHours > 0 ? Number((totalCost / options.usedHours).toFixed(4)) : 0,
      utilization,
      breakEvenUtilization: 0,
      beatsOnDemand: ahb && options.licenseHourly > 0,
      savingsVsOnDemand: Number((onDemandNoAhb - totalCost).toFixed(4)),
    };
  }

  const breakEvenUtilization = commitmentBreakEvenUtilization(options.commitmentDiscount);
  const committedHours = options.committedHours ?? options.termHours;
  const committedComputeCost =
    committedHours * options.baseComputeHourly * (1 - options.commitmentDiscount);
  const overageHours = Math.max(0, options.usedHours - committedHours);
  const overageComputeCost = overageHours * options.baseComputeHourly;
  const totalCost = Number(
    (committedComputeCost + overageComputeCost + onDemandLicenseCost).toFixed(4),
  );
  const onDemandBaseline = options.usedHours * options.baseComputeHourly + onDemandLicenseCost;
  return {
    model: options.model,
    totalCost,
    onDemandCost: Number(onDemandBaseline.toFixed(4)),
    effectiveHourlyRate:
      options.usedHours > 0 ? Number((totalCost / options.usedHours).toFixed(4)) : 0,
    utilization,
    breakEvenUtilization,
    beatsOnDemand: totalCost < onDemandBaseline,
    savingsVsOnDemand: Number((onDemandBaseline - totalCost).toFixed(4)),
  };
}

// ============================================================================
// 9. Azurite helpers: TCP probe + Blob Service SAS (SharedKey-free REST)
// ============================================================================

export function isTcpReachable(host: string, port: number, timeoutMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const done = (ok: boolean): void => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

export const AZURITE_ACCOUNT_NAME = 'devstoreaccount1';
export const AZURITE_ACCOUNT_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==';

export function isoWithoutMillis(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export interface BlobServiceSasOptions {
  accountName: string;
  accountKeyBase64: string;
  container: string;
  blob?: string;
  permissions: string;
  startMs: number;
  expiryMs: number;
  /** Service SAS resource: 'c' container, 'b' blob. */
  resource: 'b' | 'c';
  version?: string;
}

function buildServiceSasSignature(options: BlobServiceSasOptions): {
  stringToSign: string;
  signature: string;
  version: string;
  start: string;
  expiry: string;
  canonicalResource: string;
} {
  const version = options.version ?? '2021-12-02';
  const start = isoWithoutMillis(options.startMs);
  const expiry = isoWithoutMillis(options.expiryMs);
  const canonicalResource =
    options.resource === 'b' && options.blob !== undefined
      ? `/blob/${options.accountName}/${options.container}/${options.blob}`
      : `/blob/${options.accountName}/${options.container}`;
  const stringToSign = [
    options.permissions,
    start,
    expiry,
    canonicalResource,
    '', // signedIdentifier
    '', // signedIP
    'https,http', // signedProtocol
    version,
    options.resource, // signedResource
    '', // snapshot time
    '', // encryption scope
    '', // rscc
    '', // rscd
    '', // rsce
    '', // rscl
    '', // rsct
  ].join('\n');
  const key = Buffer.from(options.accountKeyBase64, 'base64');
  const signature = createHmac('sha256', key).update(stringToSign, 'utf8').digest('base64');
  return { stringToSign, signature, version, start, expiry, canonicalResource };
}

export function buildBlobServiceSasUrl(
  baseUrl: string,
  options: BlobServiceSasOptions,
): { url: string; stringToSign: string } {
  const built = buildServiceSasSignature(options);
  const params = new URLSearchParams({
    sp: options.permissions,
    st: built.start,
    se: built.expiry,
    spr: 'https,http',
    sv: built.version,
    sr: options.resource,
    sig: built.signature,
  });
  const path =
    options.resource === 'b' && options.blob !== undefined
      ? `${options.container}/${options.blob}`
      : options.container;
  return { url: `${baseUrl}/${path}?${params.toString()}`, stringToSign: built.stringToSign };
}

export interface AccountSasOptions {
  accountName: string;
  accountKeyBase64: string;
  /** e.g. 'b' blob, 'q' queue, 't' table, 'f' file. */
  services: string;
  /** e.g. 'sco' (service/container/object). */
  resourceTypes: string;
  permissions: string;
  startMs: number;
  expiryMs: number;
  version?: string;
}

/** Account SAS: the only SAS flavor authorized for Create Container. */
export function buildAccountSasUrl(
  baseUrl: string,
  options: AccountSasOptions,
): { url: string; stringToSign: string } {
  const version = options.version ?? '2019-12-12';
  const start = isoWithoutMillis(options.startMs);
  const expiry = isoWithoutMillis(options.expiryMs);
  const stringToSign = [
    options.accountName,
    options.permissions,
    options.services,
    options.resourceTypes,
    start,
    expiry,
    '', // signedIP
    'https,http', // signedProtocol
    version,
    '', // Account SAS requires an additional trailing newline character
  ].join('\n');
  const key = Buffer.from(options.accountKeyBase64, 'base64');
  const signature = createHmac('sha256', key).update(stringToSign, 'utf8').digest('base64');
  const params = new URLSearchParams({
    ss: options.services,
    srt: options.resourceTypes,
    sp: options.permissions,
    se: expiry,
    st: start,
    spr: 'https,http',
    sv: version,
    sig: signature,
  });
  return { url: `${baseUrl}?${params.toString()}`, stringToSign };
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
