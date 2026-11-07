// Comprehensive Terraform & OpenTofu Domain Model, Execution Engine, and Invariant Verifier.
import crypto from 'node:crypto';

// ============================================================================
// 1. Three-Valued Kleene Logic & Unknown Value Propagation ("Known After Apply")
// ============================================================================

export const UNKNOWN_SYMBOL: unique symbol = Symbol.for('terraform.unknown');

export interface UnknownValue {
  readonly [UNKNOWN_SYMBOL]: true;
  readonly description?: string;
  readonly origin?: string;
}

export function createUnknown(description?: string, origin?: string): UnknownValue {
  return Object.freeze({
    [UNKNOWN_SYMBOL]: true as const,
    description: description ?? 'Value known only after apply',
    origin,
  });
}

export function isUnknown(value: unknown): value is UnknownValue {
  return typeof value === 'object' && value !== null && UNKNOWN_SYMBOL in value;
}

export type KleeneBool = boolean | UnknownValue;

export function kleeneAnd(a: KleeneBool, b: KleeneBool): KleeneBool {
  if (a === false || b === false) return false;
  if (isUnknown(a) || isUnknown(b)) return createUnknown('Kleene AND with unknown');
  return a && b;
}

export function kleeneOr(a: KleeneBool, b: KleeneBool): KleeneBool {
  if (a === true || b === true) return true;
  if (isUnknown(a) || isUnknown(b)) return createUnknown('Kleene OR with unknown');
  return a || b;
}

export function kleeneNot(a: KleeneBool): KleeneBool {
  if (isUnknown(a)) return createUnknown('Kleene NOT of unknown');
  return !a;
}

// ============================================================================
// 2. HCL Type System & Structural Type Checker
// ============================================================================

export type PrimitiveType = 'string' | 'number' | 'bool';

export type HclType =
  | PrimitiveType
  | 'any'
  | { kind: 'list'; elem: HclType }
  | { kind: 'set'; elem: HclType }
  | { kind: 'map'; elem: HclType }
  | { kind: 'tuple'; elems: HclType[] }
  | {
      kind: 'object';
      attributes: Record<
        string,
        {
          type: HclType;
          optional?: boolean;
          default?: unknown;
        }
      >;
    };

export interface TypeCheckResult {
  valid: boolean;
  coercedValue?: unknown;
  error?: string;
}

export function typeCheck(value: unknown, targetType: HclType): TypeCheckResult {
  if (isUnknown(value)) {
    return { valid: true, coercedValue: value };
  }

  if (targetType === 'any') {
    return { valid: true, coercedValue: value };
  }

  if (targetType === 'string') {
    if (typeof value === 'string') return { valid: true, coercedValue: value };
    if (typeof value === 'number' || typeof value === 'boolean') {
      return { valid: true, coercedValue: String(value) };
    }
    return { valid: false, error: `Expected string, got ${typeof value}` };
  }

  if (targetType === 'number') {
    if (typeof value === 'number' && !Number.isNaN(value))
      return { valid: true, coercedValue: value };
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return { valid: true, coercedValue: Number(value) };
    }
    return { valid: false, error: `Expected number, got ${typeof value}` };
  }

  if (targetType === 'bool') {
    if (typeof value === 'boolean') return { valid: true, coercedValue: value };
    if (value === 'true') return { valid: true, coercedValue: true };
    if (value === 'false') return { valid: true, coercedValue: false };
    return { valid: false, error: `Expected bool, got ${typeof value}` };
  }

  if (targetType.kind === 'list') {
    if (!Array.isArray(value)) return { valid: false, error: `Expected list, got ${typeof value}` };
    const coerced: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const elemRes = typeCheck(value[i], targetType.elem);
      if (!elemRes.valid) {
        return { valid: false, error: `List element at index ${i}: ${elemRes.error}` };
      }
      coerced.push(elemRes.coercedValue);
    }
    return { valid: true, coercedValue: coerced };
  }

  if (targetType.kind === 'set') {
    if (!Array.isArray(value) && !(value instanceof Set)) {
      return { valid: false, error: `Expected set, got ${typeof value}` };
    }
    const arr = Array.isArray(value) ? value : Array.from(value);
    const coerced: unknown[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < arr.length; i++) {
      const elemRes = typeCheck(arr[i], targetType.elem);
      if (!elemRes.valid) {
        return { valid: false, error: `Set element at index ${i}: ${elemRes.error}` };
      }
      const key = JSON.stringify(elemRes.coercedValue);
      if (!seen.has(key)) {
        seen.add(key);
        coerced.push(elemRes.coercedValue);
      }
    }
    return { valid: true, coercedValue: coerced };
  }

  if (targetType.kind === 'map') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, error: `Expected map, got ${typeof value}` };
    }
    const coerced: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const elemRes = typeCheck(v, targetType.elem);
      if (!elemRes.valid) {
        return { valid: false, error: `Map key '${k}': ${elemRes.error}` };
      }
      coerced[k] = elemRes.coercedValue;
    }
    return { valid: true, coercedValue: coerced };
  }

  if (targetType.kind === 'tuple') {
    if (!Array.isArray(value))
      return { valid: false, error: `Expected tuple, got ${typeof value}` };
    if (value.length !== targetType.elems.length) {
      return {
        valid: false,
        error: `Expected tuple of length ${targetType.elems.length}, got ${value.length}`,
      };
    }
    const coerced: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const elemRes = typeCheck(value[i], targetType.elems[i]!);
      if (!elemRes.valid) {
        return { valid: false, error: `Tuple element ${i}: ${elemRes.error}` };
      }
      coerced.push(elemRes.coercedValue);
    }
    return { valid: true, coercedValue: coerced };
  }

  if (targetType.kind === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, error: `Expected object, got ${typeof value}` };
    }
    const src = value as Record<string, unknown>;
    const coerced: Record<string, unknown> = {};

    for (const [attrName, attrSpec] of Object.entries(targetType.attributes)) {
      if (attrName in src) {
        const checkRes = typeCheck(src[attrName], attrSpec.type);
        if (!checkRes.valid) {
          return { valid: false, error: `Attribute '${attrName}': ${checkRes.error}` };
        }
        coerced[attrName] = checkRes.coercedValue;
      } else if (attrSpec.optional) {
        coerced[attrName] = attrSpec.default !== undefined ? attrSpec.default : null;
      } else {
        return { valid: false, error: `Missing required attribute '${attrName}'` };
      }
    }
    return { valid: true, coercedValue: coerced };
  }

  return { valid: false, error: 'Unknown type specification' };
}

// ============================================================================
// 3. DAG Builder, Cycle Detection, Topological Sort & Transitive Reduction
// ============================================================================

export type NodeType = 'provider' | 'resource' | 'data' | 'variable' | 'output' | 'local' | 'check';

export interface GraphNode {
  id: string;
  type: NodeType;
  address: string;
  metadata?: Record<string, unknown>;
}

export class CycleError extends Error {
  readonly cyclePath: string[];
  constructor(cyclePath: string[]) {
    super(`Dependency cycle detected: ${cyclePath.join(' -> ')}`);
    this.cyclePath = cyclePath;
    this.name = 'CycleError';
  }
}

export class DependencyGraph {
  private nodes = new Map<string, GraphNode>();
  // Edges: fromNode -> set of toNodes (meaning fromNode depends on toNode; toNode must execute first)
  private dependencies = new Map<string, Set<string>>();
  // Reverse: toNode -> set of fromNodes (dependents)
  private dependents = new Map<string, Set<string>>();

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
    if (!this.dependencies.has(node.id)) this.dependencies.set(node.id, new Set());
    if (!this.dependents.has(node.id)) this.dependents.set(node.id, new Set());
  }

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  addEdge(fromId: string, toId: string): void {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error(`Cannot add edge: node '${fromId}' or '${toId}' does not exist`);
    }
    this.dependencies.get(fromId)!.add(toId);
    this.dependents.get(toId)!.add(fromId);
  }

  removeEdge(fromId: string, toId: string): void {
    this.dependencies.get(fromId)?.delete(toId);
    this.dependents.get(toId)?.delete(fromId);
  }

  getDependencies(id: string): Set<string> {
    return new Set(this.dependencies.get(id) ?? []);
  }

  getDependents(id: string): Set<string> {
    return new Set(this.dependents.get(id) ?? []);
  }

  /**
   * Tarjan's strongly connected components or DFS cycle detector.
   */
  detectCycles(): string[][] {
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const parentMap = new Map<string, string>();
    const cycles: string[][] = [];

    const dfs = (curr: string) => {
      visited.add(curr);
      recStack.add(curr);

      const neighbors = this.dependencies.get(curr) ?? new Set();
      for (const next of neighbors) {
        if (!visited.has(next)) {
          parentMap.set(next, curr);
          dfs(next);
        } else if (recStack.has(next)) {
          // Cycle found
          const cycle: string[] = [next];
          let p: string | undefined = curr;
          while (p && p !== next) {
            cycle.push(p);
            p = parentMap.get(p);
          }
          cycle.push(next);
          cycle.reverse();
          cycles.push(cycle);
        }
      }
      recStack.delete(curr);
    };

    for (const nodeId of this.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * Topological sort (Kahn's algorithm).
   * Returns nodes in execution order (dependencies first, dependents last).
   */
  topologicalSort(): string[] {
    const cycles = this.detectCycles();
    if (cycles.length > 0) {
      throw new CycleError(cycles[0]!);
    }

    // In-degree for topological order where dependency runs before dependent:
    // A depends on B means B must run before A.
    // So edge is B -> A in execution order graph.
    const inDegree = new Map<string, number>();
    for (const nodeId of this.nodes.keys()) {
      inDegree.set(nodeId, 0);
    }

    for (const [fromNode, deps] of this.dependencies.entries()) {
      // fromNode depends on deps. So each dep must finish before fromNode.
      // Thus fromNode has inDegree = number of dependencies.
      inDegree.set(fromNode, deps.size);
    }

    const queue: string[] = [];
    for (const [nodeId, deg] of inDegree.entries()) {
      if (deg === 0) {
        queue.push(nodeId);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      // Deterministic sort order among ready nodes
      queue.sort();
      const curr = queue.shift()!;
      order.push(curr);

      const dependents = this.dependents.get(curr) ?? new Set();
      for (const dep of dependents) {
        const newDeg = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDeg);
        if (newDeg === 0) {
          queue.push(dep);
        }
      }
    }

    if (order.length !== this.nodes.size) {
      throw new Error('Graph contains unresolved cycles');
    }

    return order;
  }

  /**
   * Transitive reduction of a DAG:
   * If there is an edge u -> w and an alternate directed path u -> ... -> w of length >= 2,
   * remove edge u -> w.
   */
  transitiveReduction(): DependencyGraph {
    const reduced = new DependencyGraph();
    for (const node of this.nodes.values()) {
      reduced.addNode({ ...node });
    }

    // Precompute reachability using Floyd-Warshall or BFS
    const nodeIds = Array.from(this.nodes.keys());
    const isReachable = (start: string, end: string, skipEdge: [string, string]): boolean => {
      const q = [start];
      const visited = new Set<string>([start]);
      while (q.length > 0) {
        const u = q.shift()!;
        if (u === end) return true;
        for (const v of this.dependencies.get(u) ?? []) {
          if (u === skipEdge[0] && v === skipEdge[1]) continue;
          if (!visited.has(v)) {
            visited.add(v);
            q.push(v);
          }
        }
      }
      return false;
    };

    for (const u of nodeIds) {
      for (const v of this.dependencies.get(u) ?? []) {
        // Check if v is still reachable from u via path not using direct edge u -> v
        if (!isReachable(u, v, [u, v])) {
          reduced.addEdge(u, v);
        }
      }
    }

    return reduced;
  }

  /**
   * Generates a subgraph for targeted apply (-target=...).
   * Computes upstream dependencies of targets, demonstrating routine -target gotchas
   * (unselected downstream dependents and unselected siblings with shared dependencies).
   */
  subgraphForTargets(targets: string[]): {
    subgraph: DependencyGraph;
    skippedDependents: string[];
    driftRiskNodes: string[];
  } {
    const included = new Set<string>();
    const queue = [...targets];

    for (const t of targets) {
      if (!this.nodes.has(t)) {
        throw new Error(`Target '${t}' not found in graph`);
      }
      included.add(t);
    }

    // Walk upstream dependencies
    while (queue.length > 0) {
      const curr = queue.shift()!;
      for (const dep of this.dependencies.get(curr) ?? []) {
        if (!included.has(dep)) {
          included.add(dep);
          queue.push(dep);
        }
      }
    }

    const subgraph = new DependencyGraph();
    for (const id of included) {
      subgraph.addNode({ ...this.nodes.get(id)! });
    }
    for (const u of included) {
      for (const v of this.dependencies.get(u) ?? []) {
        if (included.has(v)) {
          subgraph.addEdge(u, v);
        }
      }
    }

    // Find all nodes in the original graph that depend on anything in `included`
    // but are NOT themselves in `included`. These are skipped dependents (drift risk!).
    const skipped = new Set<string>();
    for (const id of included) {
      for (const dep of this.dependents.get(id) ?? []) {
        if (!included.has(dep)) {
          skipped.add(dep);
        }
      }
    }

    return {
      subgraph,
      skippedDependents: Array.from(skipped),
      driftRiskNodes: Array.from(skipped),
    };
  }

  toMermaid(): string {
    const lines: string[] = ['flowchart TD'];
    for (const node of this.nodes.values()) {
      lines.push(`  ${node.id}["${node.address} (${node.type})"]`);
    }
    for (const [from, deps] of this.dependencies.entries()) {
      for (const to of deps) {
        lines.push(`  ${from} --> ${to}`);
      }
    }
    return lines.join('\n');
  }
}

// ============================================================================
// 4. Provider Lockfile (.terraform.lock.hcl) & Checksum Verification
// ============================================================================

export interface ProviderLock {
  address: string;
  version: string;
  constraints: string;
  hashes: string[]; // e.g. "h1:...", "zh:..."
}

export class LockfileManager {
  private locks = new Map<string, ProviderLock>();

  setLock(lock: ProviderLock): void {
    this.locks.set(lock.address, lock);
  }

  getLock(address: string): ProviderLock | undefined {
    return this.locks.get(address);
  }

  hasLock(address: string): boolean {
    return this.locks.has(address);
  }

  verify(
    address: string,
    version: string,
    calculatedHash: string,
  ): { ok: boolean; reason?: string } {
    const lock = this.locks.get(address);
    if (!lock) {
      return { ok: false, reason: `No lockfile entry for provider '${address}'` };
    }
    if (lock.version !== version) {
      return {
        ok: false,
        reason: `Version mismatch: lockfile specifies ${lock.version}, attempting to install ${version}`,
      };
    }
    if (!lock.hashes.includes(calculatedHash)) {
      return {
        ok: false,
        reason: `Hash mismatch for '${address}' ${version}: package hash '${calculatedHash}' not in lockfile checksums [${lock.hashes.join(', ')}]`,
      };
    }
    return { ok: true };
  }

  serialize(): string {
    const chunks: string[] = ['# This file is maintained automatically by "terraform init".'];
    for (const [addr, lock] of this.locks.entries()) {
      chunks.push(`provider "${addr}" {`);
      chunks.push(`  version     = "${lock.version}"`);
      if (lock.constraints) chunks.push(`  constraints = "${lock.constraints}"`);
      chunks.push('  hashes = [');
      for (const h of lock.hashes) {
        chunks.push(`    "${h}",`);
      }
      chunks.push('  ]');
      chunks.push('}\n');
    }
    return chunks.join('\n');
  }
}

export function computeSha256ZhHash(content: Buffer | string): string {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  return `zh:${hash}`;
}

export function computeH1Hash(content: Buffer | string): string {
  const hash = crypto.createHash('sha256').update(content).digest('base64');
  return `h1:${hash}`;
}

// ============================================================================
// 5. Resource Addressing: count vs for_each & Index Shifting Gotchas
// ============================================================================

export interface ResourceConfig {
  address: string;
  type: string;
  name: string;
  count?: number | unknown[];
  forEach?: Record<string, unknown> | string[];
  attributes: Record<string, unknown>;
  lifecycle?: ResourceLifecycle;
}

export interface ResourceLifecycle {
  createBeforeDestroy?: boolean;
  preventDestroy?: boolean | UnknownValue;
  ignoreChanges?: string[] | 'all';
  replaceTriggeredBy?: string[];
  destroy?: boolean; // Terraform 1.16+ lifecycle { destroy = false }
}

export interface InstancePlan {
  address: string;
  action: 'no-op' | 'create' | 'update' | 'destroy' | 'replace-cbd' | 'replace-dbc';
  oldAttributes?: Record<string, unknown>;
  newAttributes?: Record<string, unknown>;
  diffAttributes?: string[];
  requiresReplacement?: boolean;
}

export class ResourcePlanner {
  /**
   * Computes addresses for `count`.
   * Address format: `<type>.<name>[<index>]`
   */
  static planCountAddresses(type: string, name: string, countVal: number): string[] {
    const addresses: string[] = [];
    for (let i = 0; i < countVal; i++) {
      addresses.push(`${type}.${name}[${i}]`);
    }
    return addresses;
  }

  /**
   * Computes addresses for `for_each`.
   * Address format: `<type>.<name>["<key>"]`
   */
  static planForEachAddresses(type: string, name: string, keys: string[]): string[] {
    return keys.map((k) => `${type}.${name}["${k}"]`);
  }

  /**
   * Simulates the infamous `count` index shift gotcha:
   * When an item in the middle of a list is removed, every subsequent item
   * changes its index, causing Terraform to plan updates/recreates for all downstream instances!
   */
  static diffCountList(
    type: string,
    name: string,
    oldItems: Array<{ id: string; name: string }>,
    newItems: Array<{ id: string; name: string }>,
  ): {
    plans: InstancePlan[];
    unintendedChurnCount: number;
  } {
    const plans: InstancePlan[] = [];
    const maxLen = Math.max(oldItems.length, newItems.length);
    let unintendedChurn = 0;

    for (let i = 0; i < maxLen; i++) {
      const addr = `${type}.${name}[${i}]`;
      const oldItem = oldItems[i];
      const newItem = newItems[i];

      if (oldItem && newItem) {
        if (oldItem.id === newItem.id && oldItem.name === newItem.name) {
          plans.push({
            address: addr,
            action: 'no-op',
            oldAttributes: oldItem,
            newAttributes: newItem,
          });
        } else {
          // Index holds a different item now because of shifting!
          unintendedChurn++;
          plans.push({
            address: addr,
            action: 'update',
            oldAttributes: oldItem,
            newAttributes: newItem,
            diffAttributes: Object.keys(newItem).filter(
              (k) =>
                (oldItem as Record<string, unknown>)[k] !== (newItem as Record<string, unknown>)[k],
            ),
          });
        }
      } else if (oldItem && !newItem) {
        plans.push({ address: addr, action: 'destroy', oldAttributes: oldItem });
      } else if (!oldItem && newItem) {
        plans.push({ address: addr, action: 'create', newAttributes: newItem });
      }
    }

    return { plans, unintendedChurnCount: unintendedChurn };
  }

  /**
   * Contrasts with `for_each` using stable keys:
   * Removing an item by key ONLY plans destruction of that single key.
   * All other keys have zero diff!
   */
  static diffForEachMap(
    type: string,
    name: string,
    oldMap: Record<string, { id: string; name: string }>,
    newMap: Record<string, { id: string; name: string }>,
  ): {
    plans: InstancePlan[];
    unintendedChurnCount: number;
  } {
    const plans: InstancePlan[] = [];
    const allKeys = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

    for (const key of allKeys) {
      const addr = `${type}.${name}["${key}"]`;
      const oldItem = oldMap[key];
      const newItem = newMap[key];

      if (oldItem && newItem) {
        if (oldItem.id === newItem.id && oldItem.name === newItem.name) {
          plans.push({
            address: addr,
            action: 'no-op',
            oldAttributes: oldItem,
            newAttributes: newItem,
          });
        } else {
          plans.push({
            address: addr,
            action: 'update',
            oldAttributes: oldItem,
            newAttributes: newItem,
            diffAttributes: ['name'],
          });
        }
      } else if (oldItem && !newItem) {
        plans.push({ address: addr, action: 'destroy', oldAttributes: oldItem });
      } else if (!oldItem && newItem) {
        plans.push({ address: addr, action: 'create', newAttributes: newItem });
      }
    }

    return { plans, unintendedChurnCount: 0 };
  }
}

// ============================================================================
// 6. Lifecycle Invariants: create_before_destroy, prevent_destroy & ignore_changes
// ============================================================================

export class NameCollisionError extends Error {
  readonly resourceAddress: string;
  readonly uniqueName: string;
  constructor(resourceAddress: string, uniqueName: string) {
    super(
      `create_before_destroy failure: cannot create new '${resourceAddress}' before destroying old one due to unique name collision on '${uniqueName}'`,
    );
    this.resourceAddress = resourceAddress;
    this.uniqueName = uniqueName;
    this.name = 'NameCollisionError';
  }
}

export class PreventDestroyError extends Error {
  readonly resourceAddress: string;
  constructor(resourceAddress: string) {
    super(
      `Instance ${resourceAddress} has lifecycle.prevent_destroy set, but the plan contains a destroy/replace action`,
    );
    this.resourceAddress = resourceAddress;
    this.name = 'PreventDestroyError';
  }
}

export function planInstanceLifecycle(opts: {
  address: string;
  isExisting: boolean;
  isConfigured: boolean;
  oldAttrs?: Record<string, unknown>;
  newAttrs?: Record<string, unknown>;
  lifecycle?: ResourceLifecycle;
  uniqueNameField?: string;
  allowUniqueCollision?: boolean;
}): InstancePlan {
  const {
    address,
    isExisting,
    isConfigured,
    oldAttrs = {},
    newAttrs = {},
    lifecycle = {},
    uniqueNameField,
    allowUniqueCollision = false,
  } = opts;

  // Case 1: Resource is deleted from configuration
  if (isExisting && !isConfigured) {
    // If prevent_destroy is configured on this instance:
    if (lifecycle.preventDestroy === true) {
      throw new PreventDestroyError(address);
    }
    // If Terraform 1.16+ lifecycle.destroy == false:
    if (lifecycle.destroy === false) {
      return { address, action: 'no-op', oldAttributes: oldAttrs };
    }
    return { address, action: 'destroy', oldAttributes: oldAttrs };
  }

  // Case 2: Brand new resource
  if (!isExisting && isConfigured) {
    return { address, action: 'create', newAttributes: newAttrs };
  }

  // Case 3: Existing resource modified
  let requiresReplace = false;
  const diffAttrs: string[] = [];

  for (const [k, v] of Object.entries(newAttrs)) {
    if (
      lifecycle.ignoreChanges === 'all' ||
      (Array.isArray(lifecycle.ignoreChanges) && lifecycle.ignoreChanges.includes(k))
    ) {
      continue; // Ignored attribute drift
    }
    if (JSON.stringify(oldAttrs[k]) !== JSON.stringify(v)) {
      diffAttrs.push(k);
      if (k.endsWith('_id') || k === 'force_new') {
        requiresReplace = true;
      }
    }
  }

  // replace_triggered_by check
  if (lifecycle.replaceTriggeredBy && lifecycle.replaceTriggeredBy.length > 0) {
    requiresReplace = true;
  }

  if (diffAttrs.length === 0 && !requiresReplace) {
    return { address, action: 'no-op', oldAttributes: oldAttrs, newAttributes: newAttrs };
  }

  if (requiresReplace) {
    if (lifecycle.preventDestroy === true) {
      throw new PreventDestroyError(address);
    }

    if (lifecycle.createBeforeDestroy) {
      // Check for unique name collision gotcha!
      if (uniqueNameField && !allowUniqueCollision) {
        const oldName = oldAttrs[uniqueNameField];
        const newName = newAttrs[uniqueNameField];
        if (oldName && newName && oldName === newName) {
          throw new NameCollisionError(address, String(oldName));
        }
      }
      return {
        address,
        action: 'replace-cbd',
        oldAttributes: oldAttrs,
        newAttributes: newAttrs,
        requiresReplacement: true,
        diffAttributes: diffAttrs,
      };
    } else {
      return {
        address,
        action: 'replace-dbc',
        oldAttributes: oldAttrs,
        newAttributes: newAttrs,
        requiresReplacement: true,
        diffAttributes: diffAttrs,
      };
    }
  }

  return {
    address,
    action: 'update',
    oldAttributes: oldAttrs,
    newAttributes: newAttrs,
    diffAttributes: diffAttrs,
  };
}

// ============================================================================
// 7. Variables, Validation, Pre/Postconditions, Sensitive & Ephemeral State
// ============================================================================

export interface VariableValidation {
  condition: (val: unknown) => boolean;
  errorMessage: string;
}

export interface VariableDefinition {
  name: string;
  type: HclType;
  default?: unknown;
  sensitive?: boolean;
  ephemeral?: boolean;
  validations?: VariableValidation[];
}

export class ValidationError extends Error {
  readonly varName: string;
  constructor(varName: string, message: string) {
    super(`Invalid value for variable '${varName}': ${message}`);
    this.varName = varName;
    this.name = 'ValidationError';
  }
}

export class ConditionAssertionError extends Error {
  readonly conditionType: 'precondition' | 'postcondition' | 'check';
  constructor(conditionType: 'precondition' | 'postcondition' | 'check', message: string) {
    super(`${conditionType} failed: ${message}`);
    this.conditionType = conditionType;
    this.name = 'ConditionAssertionError';
  }
}

export function evaluateVariable(
  def: VariableDefinition,
  providedValue?: unknown,
): {
  value: unknown;
  sensitive: boolean;
  ephemeral: boolean;
} {
  const val = providedValue !== undefined ? providedValue : def.default;
  if (val === undefined) {
    throw new ValidationError(def.name, 'Missing required variable argument');
  }

  const check = typeCheck(val, def.type);
  if (!check.valid) {
    throw new ValidationError(def.name, check.error ?? 'Type check failed');
  }

  if (def.validations) {
    for (const v of def.validations) {
      if (!v.condition(check.coercedValue)) {
        throw new ValidationError(def.name, v.errorMessage);
      }
    }
  }

  return {
    value: check.coercedValue,
    sensitive: !!def.sensitive,
    ephemeral: !!def.ephemeral,
  };
}

/**
 * Validates sensitive vs ephemeral vs write-only omission from state:
 * - `sensitive`: redacted in CLI UI/logs, but PERSISTED IN STATE in plaintext!
 * - `ephemeral` & write-only (`_wo`): OMITTED FROM STATE ENTIRELY!
 */
export function renderPlanOutput(value: unknown, sensitive: boolean, ephemeral: boolean): string {
  if (ephemeral) return '(ephemeral value)';
  if (sensitive) return '(sensitive value)';
  if (isUnknown(value)) return '(known after apply)';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

export function filterStateAttributes(
  rawAttributes: Record<string, unknown>,
  schema: Record<string, { sensitive?: boolean; ephemeral?: boolean; writeOnly?: boolean }>,
): {
  stateAttributes: Record<string, unknown>;
  omittedAttributes: string[];
} {
  const stateAttributes: Record<string, unknown> = {};
  const omittedAttributes: string[] = [];

  for (const [k, v] of Object.entries(rawAttributes)) {
    const fieldDef = schema[k];
    if (fieldDef?.ephemeral || fieldDef?.writeOnly || k.endsWith('_wo')) {
      omittedAttributes.push(k);
    } else {
      // Note: sensitive attributes ARE kept in state!
      stateAttributes[k] = v;
    }
  }

  return { stateAttributes, omittedAttributes };
}

// ============================================================================
// 8. State Internals, Lineage, S3 use_lockfile CAS Locking & State Refactoring
// ============================================================================

export interface StateResourceInstance {
  schema_version: number;
  attributes: Record<string, unknown>;
  sensitive_attributes?: unknown[];
  dependencies?: string[];
}

export interface StateResource {
  module?: string;
  mode: 'managed' | 'data';
  type: string;
  name: string;
  provider: string;
  instances: StateResourceInstance[];
}

export interface StateV4 {
  format_version: '1.0';
  terraform_version: string;
  serial: number;
  lineage: string; // UUID
  resources: StateResource[];
}

export interface LockInfo {
  ID: string;
  Operation: string;
  Info: string;
  Who: string;
  Version: string;
  Created: string;
  Path: string;
}

export class StateLockError extends Error {
  readonly lockInfo: LockInfo;
  constructor(lockInfo: LockInfo) {
    super(
      `Error acquiring the state lock: State is currently locked by operation '${lockInfo.Operation}' by '${lockInfo.Who}' (Lock ID: ${lockInfo.ID})`,
    );
    this.lockInfo = lockInfo;
    this.name = 'StateLockError';
  }
}

export class S3BackendLockManager {
  private activeLock: LockInfo | null = null;
  private stateStorage = new Map<string, StateV4>();

  acquireLock(info: LockInfo): void {
    if (this.activeLock !== null) {
      throw new StateLockError(this.activeLock);
    }
    this.activeLock = { ...info };
  }

  releaseLock(lockId: string): void {
    if (!this.activeLock) return;
    if (this.activeLock.ID !== lockId) {
      throw new Error(`Cannot release lock '${lockId}': active lock is '${this.activeLock.ID}'`);
    }
    this.activeLock = null;
  }

  forceUnlock(lockId: string): void {
    // Unconditional release (gotcha: leads to concurrent write races!)
    if (this.activeLock && this.activeLock.ID === lockId) {
      this.activeLock = null;
    }
  }

  isLocked(): boolean {
    return this.activeLock !== null;
  }

  getActiveLock(): LockInfo | null {
    return this.activeLock ? { ...this.activeLock } : null;
  }

  /**
   * CAS write to state: serial must match expected serial or increment monotonically.
   */
  writeState(key: string, state: StateV4, expectedSerial: number): void {
    const existing = this.stateStorage.get(key);
    if (existing) {
      if (existing.lineage !== state.lineage) {
        throw new Error(
          `State lineage mismatch: expected ${existing.lineage}, got ${state.lineage}`,
        );
      }
      if (existing.serial !== expectedSerial) {
        throw new Error(
          `CAS violation: expected serial ${expectedSerial}, current state serial is ${existing.serial}`,
        );
      }
    }
    this.stateStorage.set(key, JSON.parse(JSON.stringify(state)));
  }

  readState(key: string): StateV4 | undefined {
    const val = this.stateStorage.get(key);
    return val ? JSON.parse(JSON.stringify(val)) : undefined;
  }
}

export function parseResourceAddress(addr: string): {
  module?: string;
  type: string;
  name: string;
} {
  const parts = addr.split('.');
  if (parts.length === 2) {
    return { type: parts[0]!, name: parts[1]! };
  }
  const name = parts[parts.length - 1]!;
  const type = parts[parts.length - 2]!;
  const module = parts.slice(0, parts.length - 2).join('.');
  return { module, type, name };
}

export function formatResourceAddress(res: {
  module?: string;
  type: string;
  name: string;
}): string {
  return res.module ? `${res.module}.${res.type}.${res.name}` : `${res.type}.${res.name}`;
}

// Declarative state refactoring engine: moved, removed, import
export class StateRefactorEngine {
  /**
   * Evaluates `moved` blocks:
   * moved { from = aws_instance.old_name; to = aws_instance.new_name }
   */
  static applyMovedBlocks(
    state: StateV4,
    movedList: Array<{ from: string; to: string }>,
  ): { state: StateV4; renames: string[] } {
    const newState: StateV4 = JSON.parse(JSON.stringify(state));
    const renames: string[] = [];

    for (const { from, to } of movedList) {
      const fromParsed = parseResourceAddress(from);
      const toParsed = parseResourceAddress(to);

      for (const res of newState.resources) {
        const matchesModule =
          (!fromParsed.module && !res.module) || res.module === fromParsed.module;
        if (matchesModule && res.type === fromParsed.type && res.name === fromParsed.name) {
          res.module = toParsed.module;
          res.type = toParsed.type;
          res.name = toParsed.name;
          renames.push(`${from} -> ${to}`);
        }
      }
    }

    newState.serial += 1;
    return { state: newState, renames };
  }

  /**
   * Evaluates `removed` blocks (Terraform 1.16+):
   * removed { from = aws_instance.db; lifecycle { destroy = false } }
   * If destroy = false: drops from state, does not destroy real infra.
   */
  static applyRemovedBlocks(
    state: StateV4,
    removedList: Array<{ from: string; destroy: boolean }>,
  ): {
    state: StateV4;
    droppedFromState: string[];
    destroyedInInfra: string[];
  } {
    const newState: StateV4 = JSON.parse(JSON.stringify(state));
    const dropped: string[] = [];
    const destroyed: string[] = [];

    for (const rem of removedList) {
      const [remType, remName] = rem.from.split('.');
      const idx = newState.resources.findIndex((r) => r.type === remType && r.name === remName);
      if (idx !== -1) {
        newState.resources.splice(idx, 1);
        dropped.push(rem.from);
        if (rem.destroy) {
          destroyed.push(rem.from);
        }
      }
    }

    newState.serial += 1;
    return { state: newState, droppedFromState: dropped, destroyedInInfra: destroyed };
  }

  /**
   * Evaluates `import` blocks:
   * import { to = aws_s3_bucket.data; id = "my-bucket-name" }
   */
  static applyImport(
    state: StateV4,
    imports: Array<{
      to: string;
      id: string;
      provider: string;
      attributes: Record<string, unknown>;
    }>,
  ): StateV4 {
    const newState: StateV4 = JSON.parse(JSON.stringify(state));

    for (const imp of imports) {
      const [impType, impName] = imp.to.split('.');
      const existing = newState.resources.find((r) => r.type === impType && r.name === impName);
      if (existing) {
        throw new Error(
          `Resource '${imp.to}' already exists in state; cannot import duplicate address`,
        );
      }

      newState.resources.push({
        mode: 'managed',
        type: impType!,
        name: impName!,
        provider: imp.provider,
        instances: [
          {
            schema_version: 1,
            attributes: { id: imp.id, ...imp.attributes },
          },
        ],
      });
    }

    newState.serial += 1;
    return newState;
  }
}

// ============================================================================
// 9. Plan Refresh Modes: normal, -refresh-only, -minimal-refresh (Terraform 1.17)
// ============================================================================

export type RefreshMode = 'normal' | 'refresh-only' | 'minimal-refresh' | 'none';

export interface RefreshResult {
  refreshedAddresses: string[];
  skippedAddresses: string[];
  detectedDrift: Record<string, { field: string; oldVal: unknown; newVal: unknown }[]>;
}

export function executeRefresh(
  state: StateV4,
  remoteProvider: Map<string, Record<string, unknown>>,
  mode: RefreshMode,
  modifiedConfigAddresses?: Set<string>,
): RefreshResult {
  const refreshed: string[] = [];
  const skipped: string[] = [];
  const drift: Record<string, { field: string; oldVal: unknown; newVal: unknown }[]> = {};

  for (const res of state.resources) {
    const addr = `${res.type}.${res.name}`;
    const remoteData = remoteProvider.get(addr);
    const localAttrs = res.instances[0]?.attributes ?? {};

    if (mode === 'none') {
      skipped.push(addr);
      continue;
    }

    if (mode === 'minimal-refresh') {
      // Terraform 1.17 -minimal-refresh: ONLY refresh if this address is in modified set or referenced
      if (!modifiedConfigAddresses?.has(addr)) {
        skipped.push(addr);
        continue;
      }
    }

    refreshed.push(addr);

    if (remoteData) {
      const fieldDrifts: { field: string; oldVal: unknown; newVal: unknown }[] = [];
      for (const [k, v] of Object.entries(remoteData)) {
        if (JSON.stringify(localAttrs[k]) !== JSON.stringify(v)) {
          fieldDrifts.push({ field: k, oldVal: localAttrs[k], newVal: v });
        }
      }
      if (fieldDrifts.length > 0) {
        drift[addr] = fieldDrifts;
      }
    }
  }

  return { refreshedAddresses: refreshed, skippedAddresses: skipped, detectedDrift: drift };
}

// ============================================================================
// 10. Policy-as-Code Evaluator (tftest, OPA/Rego, CEL, Kyverno, TF 1.17 Policy)
// ============================================================================

export interface TestAssert {
  condition: boolean;
  errorMessage: string;
}

export interface TestRunBlock {
  name: string;
  command: 'plan' | 'apply';
  variables?: Record<string, unknown>;
  asserts: TestAssert[];
  expectFailures?: string[];
}

export interface RegoRuleResult {
  ruleName: string;
  allowed: boolean;
  violations: string[];
}

export interface CelExpression {
  expression: string;
  evaluate: (ctx: Record<string, unknown>) => boolean;
}

export interface KyvernoRule {
  name: string;
  matchResource: string;
  validate: (resource: Record<string, unknown>) => { valid: boolean; message?: string };
}

export interface Terraform117Policy {
  name: string;
  enforcementLevel: 'advisory' | 'mandatory';
  evaluate: (planJson: Record<string, unknown>) => { pass: boolean; message: string };
}

export class PolicyEvaluator {
  /**
   * Simulates OPA / Conftest Rego plan evaluation.
   */
  static evaluateRego(
    planResources: Array<{ address: string; type: string; attributes: Record<string, unknown> }>,
    rules: Array<{
      name: string;
      check: (res: {
        address: string;
        type: string;
        attributes: Record<string, unknown>;
      }) => string | null;
    }>,
  ): RegoRuleResult[] {
    const results: RegoRuleResult[] = [];

    for (const rule of rules) {
      const violations: string[] = [];
      for (const res of planResources) {
        const v = rule.check(res);
        if (v) violations.push(`${res.address}: ${v}`);
      }
      results.push({
        ruleName: rule.name,
        allowed: violations.length === 0,
        violations,
      });
    }

    return results;
  }

  /**
   * Simulates CEL admission policy.
   */
  static evaluateCel(
    ctx: Record<string, unknown>,
    celExprs: CelExpression[],
  ): { passed: boolean; failures: string[] } {
    const failures: string[] = [];
    for (const expr of celExprs) {
      if (!expr.evaluate(ctx)) {
        failures.push(`CEL assertion failed: ${expr.expression}`);
      }
    }
    return { passed: failures.length === 0, failures };
  }

  /**
   * Simulates Kyverno validate rules.
   */
  static evaluateKyverno(
    resources: Array<{ type: string; spec: Record<string, unknown> }>,
    rules: KyvernoRule[],
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const rule of rules) {
      for (const res of resources) {
        if (res.type === rule.matchResource) {
          const resCheck = rule.validate(res.spec);
          if (!resCheck.valid) {
            errors.push(`Kyverno rule '${rule.name}' failed on ${res.type}: ${resCheck.message}`);
          }
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Terraform 1.17 Policy GA evaluator (-policies flag).
   */
  static evaluateTerraform117Policies(
    planJson: Record<string, unknown>,
    policies: Terraform117Policy[],
  ): {
    allowedToApply: boolean;
    advisoryWarnings: string[];
    mandatoryFailures: string[];
  } {
    const advisoryWarnings: string[] = [];
    const mandatoryFailures: string[] = [];

    for (const policy of policies) {
      const outcome = policy.evaluate(planJson);
      if (!outcome.pass) {
        if (policy.enforcementLevel === 'mandatory') {
          mandatoryFailures.push(`[MANDATORY] ${policy.name}: ${outcome.message}`);
        } else {
          advisoryWarnings.push(`[ADVISORY] ${policy.name}: ${outcome.message}`);
        }
      }
    }

    return {
      allowedToApply: mandatoryFailures.length === 0,
      advisoryWarnings,
      mandatoryFailures,
    };
  }
}

// ============================================================================
// 11. Provider Plugin Framework (gRPC Schema & Lifecycle Simulator)
// ============================================================================

export interface ProviderSchema {
  providerAttributes: Record<string, HclType>;
  resources: Record<
    string,
    Record<string, { type: HclType; computed?: boolean; required?: boolean }>
  >;
}

export interface PlanModifier {
  attribute: string;
  modify: (priorVal: unknown, configVal: unknown) => unknown;
}

export class PluginFrameworkSimulator {
  readonly schema: ProviderSchema;
  readonly planModifiers: PlanModifier[];
  constructor(schema: ProviderSchema, planModifiers: PlanModifier[] = []) {
    this.schema = schema;
    this.planModifiers = planModifiers;
  }

  validateConfig(
    resourceType: string,
    config: Record<string, unknown>,
  ): { valid: boolean; diagnostics: string[] } {
    const resSchema = this.schema.resources[resourceType];
    if (!resSchema) {
      return {
        valid: false,
        diagnostics: [`Unknown resource type '${resourceType}' in provider schema`],
      };
    }

    const diagnostics: string[] = [];
    for (const [attr, attrSpec] of Object.entries(resSchema)) {
      if (attrSpec.required && !(attr in config)) {
        diagnostics.push(`Missing required attribute '${attr}' for resource '${resourceType}'`);
      } else if (attr in config) {
        const check = typeCheck(config[attr], attrSpec.type);
        if (!check.valid) {
          diagnostics.push(`Attribute '${attr}' type error: ${check.error}`);
        }
      }
    }

    return { valid: diagnostics.length === 0, diagnostics };
  }

  planResourceChange(
    resourceType: string,
    priorState: Record<string, unknown> | null,
    plannedConfig: Record<string, unknown>,
  ): Record<string, unknown> {
    const plannedState: Record<string, unknown> = { ...plannedConfig };

    // Apply plan modifiers (e.g. UseStateForUnknown)
    for (const modifier of this.planModifiers) {
      const priorVal = priorState ? priorState[modifier.attribute] : undefined;
      const configVal = plannedConfig[modifier.attribute];
      plannedState[modifier.attribute] = modifier.modify(priorVal, configVal);
    }

    return plannedState;
  }
}

// ============================================================================
// 12. OpenTofu 1.13 AES-256-GCM State Encryption & Dynamic Evaluation
// ============================================================================

export interface EncryptedStateEnvelope {
  format: 'opentofu.state.encrypted.v1';
  key_provider: 'pbkdf2';
  cipher: 'aes-256-gcm';
  salt: string; // hex
  iv: string; // hex (96-bit nonce)
  auth_tag: string; // hex (128-bit)
  ciphertext: string; // hex
}

export function encryptOpenTofuState(
  stateJson: string,
  passphrase: string,
): EncryptedStateEnvelope {
  const salt = crypto.randomBytes(16);
  const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(stateJson, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    format: 'opentofu.state.encrypted.v1',
    key_provider: 'pbkdf2',
    cipher: 'aes-256-gcm',
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    auth_tag: authTag.toString('hex'),
    ciphertext: encrypted.toString('hex'),
  };
}

export function decryptOpenTofuState(envelope: EncryptedStateEnvelope, passphrase: string): string {
  if (envelope.format !== 'opentofu.state.encrypted.v1') {
    throw new Error(`Unsupported encrypted state format: ${envelope.format}`);
  }

  const salt = Buffer.from(envelope.salt, 'hex');
  const iv = Buffer.from(envelope.iv, 'hex');
  const authTag = Buffer.from(envelope.auth_tag, 'hex');
  const ciphertext = Buffer.from(envelope.ciphertext, 'hex');

  const key = crypto.pbkdf2Sync(passphrase, salt, 100_000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}
