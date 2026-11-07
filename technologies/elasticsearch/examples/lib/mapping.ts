/**
 * A teaching model of Elasticsearch mappings: field types, dynamic mapping inference,
 * the `dynamic` setting, mapping-merge rules (no in-place type change), the
 * total_fields / depth / nested limits, and object-vs-nested flattening.
 */

export type LeafType =
  | 'text'
  | 'keyword'
  | 'long'
  | 'integer'
  | 'double'
  | 'float'
  | 'date'
  | 'boolean'
  | 'flattened'
  | 'dense_vector';

export interface LeafMapping {
  type: LeafType;
  analyzer?: string;
  search_analyzer?: string;
  normalizer?: string;
  ignore_above?: number;
  index?: boolean;
  doc_values?: boolean;
  fielddata?: boolean;
  fields?: Record<string, LeafMapping>;
}

export interface ObjectMapping {
  type: 'object' | 'nested';
  dynamic?: Dynamic;
  properties: Record<string, FieldMapping>;
}

export type FieldMapping = LeafMapping | ObjectMapping;
export type Dynamic = true | false | 'strict' | 'runtime';

export interface RuntimeField {
  type: 'keyword' | 'long' | 'double' | 'date' | 'boolean';
}

export interface Mapping {
  dynamic?: Dynamic;
  date_detection?: boolean;
  numeric_detection?: boolean;
  properties: Record<string, FieldMapping>;
  runtime?: Record<string, RuntimeField>;
}

export interface Limits {
  totalFields: number; // index.mapping.total_fields.limit (default 1000)
  depth: number; // index.mapping.depth.limit (default 20)
  nestedFields: number; // index.mapping.nested_fields.limit (default 50)
  nestedObjects: number; // index.mapping.nested_objects.limit (default 10000)
}

export const DEFAULT_LIMITS: Limits = {
  totalFields: 1000,
  depth: 20,
  nestedFields: 50,
  nestedObjects: 10000,
};

export class MappingError extends Error {
  readonly type: string;
  constructor(type: string, reason: string) {
    super(`${type}: ${reason}`);
    this.type = type;
  }
}

export function isObject(m: FieldMapping): m is ObjectMapping {
  return m.type === 'object' || m.type === 'nested';
}

/** Default `dynamic_date_formats`: strict_date_optional_time || yyyy/MM/dd HH:mm:ss Z || yyyy/MM/dd Z. */
const DATE_RE = [
  /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?)?$/,
  /^\d{4}\/\d{2}\/\d{2}( \d{2}:\d{2}:\d{2})?$/,
];

/**
 * Dynamic field mapping for `dynamic: true` (the documented JSON -> ES type table):
 *  - string  -> date (if date_detection matches) | long/double (only if numeric_detection) | text + keyword subfield (ignore_above 256)
 *  - integer -> long, other number -> float, boolean -> boolean, object -> object
 */
export function inferDynamic(
  value: unknown,
  mapping: Pick<Mapping, 'date_detection' | 'numeric_detection'>,
): FieldMapping | null {
  if (value === null || value === undefined) return null; // null adds no field
  if (Array.isArray(value)) {
    const first = value.find((v) => v !== null && v !== undefined);
    return first === undefined ? null : inferDynamic(first, mapping);
  }
  switch (typeof value) {
    case 'boolean':
      return { type: 'boolean' };
    case 'number':
      return Number.isInteger(value) ? { type: 'long' } : { type: 'float' };
    case 'string':
      if ((mapping.date_detection ?? true) && DATE_RE.some((r) => r.test(value)))
        return { type: 'date' };
      if (mapping.numeric_detection === true && /^-?\d+$/.test(value)) return { type: 'long' };
      if (mapping.numeric_detection === true && /^-?\d+\.\d+$/.test(value))
        return { type: 'float' };
      return { type: 'text', fields: { keyword: { type: 'keyword', ignore_above: 256 } } };
    case 'object':
      return { type: 'object', properties: {} };
    default:
      return null;
  }
}

/** `dynamic: runtime` maps new fields as runtime fields instead of indexed fields. */
function inferRuntime(value: unknown): RuntimeField | null {
  const m = inferDynamic(value, {});
  if (!m || isObject(m)) return null;
  switch (m.type) {
    case 'text':
      return { type: 'keyword' };
    case 'long':
      return { type: 'long' };
    case 'float':
      return { type: 'double' };
    case 'date':
      return { type: 'date' };
    case 'boolean':
      return { type: 'boolean' };
    default:
      return null;
  }
}

/** Count mappers the way total_fields.limit does: leaves, multi-fields, object mappers and runtime fields. */
export function countFields(mapping: Mapping): number {
  const walk = (props: Record<string, FieldMapping>): number => {
    let n = 0;
    for (const m of Object.values(props)) {
      n += 1;
      if (isObject(m)) n += walk(m.properties);
      else n += Object.keys(m.fields ?? {}).length;
    }
    return n;
  };
  return walk(mapping.properties) + Object.keys(mapping.runtime ?? {}).length;
}

function depthOf(props: Record<string, FieldMapping>, level = 1): number {
  let max = level;
  for (const m of Object.values(props))
    if (isObject(m)) max = Math.max(max, depthOf(m.properties, level + 1));
  return max;
}

function countNestedFields(props: Record<string, FieldMapping>): number {
  let n = 0;
  for (const m of Object.values(props))
    if (isObject(m)) n += (m.type === 'nested' ? 1 : 0) + countNestedFields(m.properties);
  return n;
}

export function checkLimits(mapping: Mapping, limits: Limits = DEFAULT_LIMITS): void {
  const total = countFields(mapping);
  if (total > limits.totalFields) {
    throw new MappingError(
      'illegal_argument_exception',
      `Limit of total fields [${limits.totalFields}] has been exceeded`,
    );
  }
  if (depthOf(mapping.properties) > limits.depth) {
    throw new MappingError(
      'illegal_argument_exception',
      `Limit of mapping depth [${limits.depth}] has been exceeded`,
    );
  }
  if (countNestedFields(mapping.properties) > limits.nestedFields) {
    throw new MappingError(
      'illegal_argument_exception',
      `Limit of nested fields [${limits.nestedFields}] has been exceeded`,
    );
  }
}

/**
 * Merge a mapping update into an existing mapping. New fields and new multi-fields are
 * allowed; changing a field's type is rejected (the inverted index for the old type
 * already exists in immutable segments). The cure is a new index + _reindex + alias swap.
 */
export function mergeMapping(
  existing: Mapping,
  update: Mapping,
  limits: Limits = DEFAULT_LIMITS,
): Mapping {
  const mergeProps = (
    a: Record<string, FieldMapping>,
    b: Record<string, FieldMapping>,
    path: string,
  ): Record<string, FieldMapping> => {
    const out: Record<string, FieldMapping> = structuredClone(a);
    for (const [name, nb] of Object.entries(b)) {
      const full = path ? `${path}.${name}` : name;
      const na = out[name];
      if (!na) {
        out[name] = structuredClone(nb);
        continue;
      }
      if (na.type !== nb.type) {
        throw new MappingError(
          'illegal_argument_exception',
          `mapper [${full}] cannot be changed from type [${na.type}] to [${nb.type}]`,
        );
      }
      if (isObject(na) && isObject(nb)) {
        out[name] = { ...na, properties: mergeProps(na.properties, nb.properties, full) };
      } else if (!isObject(na) && !isObject(nb)) {
        if ((na.analyzer ?? 'default') !== (nb.analyzer ?? na.analyzer ?? 'default')) {
          throw new MappingError(
            'illegal_argument_exception',
            `Cannot update parameter [analyzer] from [${na.analyzer ?? 'default'}] to [${nb.analyzer}]`,
          );
        }
        out[name] = { ...na, fields: { ...na.fields, ...nb.fields } };
      }
    }
    return out;
  };
  const merged: Mapping = {
    ...existing,
    properties: mergeProps(existing.properties, update.properties, ''),
    runtime: { ...existing.runtime, ...update.runtime },
  };
  checkLimits(merged, limits);
  return merged;
}

export interface DynamicResult {
  mapping: Mapping;
  /** Fields in _source that were NOT indexed (dynamic: false). */
  unmapped: string[];
}

/**
 * Apply a document to a mapping under the `dynamic` setting in force at each object level:
 * true -> add indexed fields; runtime -> add runtime fields; false -> ignore (kept in _source
 * only); strict -> reject the document.
 */
export function applyDocument(
  mapping: Mapping,
  doc: Record<string, unknown>,
  limits: Limits = DEFAULT_LIMITS,
): DynamicResult {
  const next: Mapping = structuredClone(mapping);
  next.runtime ??= {};
  const unmapped: string[] = [];
  const walk = (
    props: Record<string, FieldMapping>,
    obj: Record<string, unknown>,
    dyn: Dynamic,
    path: string,
  ): void => {
    for (const [k, v] of Object.entries(obj)) {
      const full = path ? `${path}.${k}` : k;
      const existing = props[k];
      if (existing) {
        if (isObject(existing)) {
          const children = Array.isArray(v) ? v : [v];
          for (const c of children) {
            if (c && typeof c === 'object')
              walk(
                existing.properties,
                c as Record<string, unknown>,
                existing.dynamic ?? dyn,
                full,
              );
          }
        }
        continue;
      }
      if (next.runtime![full]) continue;
      if (dyn === 'strict') {
        throw new MappingError(
          'strict_dynamic_mapping_exception',
          `mapping set to strict, dynamic introduction of [${k}] within [${path || '_doc'}] is not allowed`,
        );
      }
      if (dyn === false) {
        unmapped.push(full);
        continue;
      }
      if (dyn === 'runtime') {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          walk({}, v as Record<string, unknown>, dyn, full);
        } else {
          const rf = inferRuntime(v);
          if (rf) next.runtime![full] = rf;
        }
        continue;
      }
      const inferred = inferDynamic(v, next);
      if (!inferred) continue;
      props[k] = inferred;
      if (isObject(inferred)) {
        const children = Array.isArray(v) ? v : [v];
        for (const c of children)
          walk(inferred.properties, c as Record<string, unknown>, dyn, full);
      }
    }
  };
  walk(next.properties, doc, next.dynamic ?? true, '');
  checkLimits(next, limits);
  return { mapping: next, unmapped };
}

/** Resolve a dotted path to its leaf mapping (including multi-fields like `title.keyword`). */
export function resolveField(mapping: Mapping, path: string): LeafMapping | undefined {
  const parts = path.split('.');
  let props: Record<string, FieldMapping> | undefined = mapping.properties;
  for (let i = 0; i < parts.length; i++) {
    const m: FieldMapping | undefined = props?.[parts[i]!];
    if (!m) return undefined;
    if (isObject(m)) {
      props = m.properties;
      continue;
    }
    if (i === parts.length - 1) return m;
    if (i === parts.length - 2) return m.fields?.[parts[i + 1]!];
    return undefined;
  }
  return undefined;
}

/**
 * Flatten a JSON document into Lucene documents.
 * - `object` arrays are flattened into multi-valued dotted fields: the association between
 *   `first` and `last` of the same array element is LOST.
 * - `nested` objects become separate hidden Lucene documents, indexed in the same block
 *   immediately before their parent, so the association is preserved.
 */
export interface LuceneDoc {
  path: string; // '' for the root document, else the nested path
  fields: Map<string, unknown[]>;
}

export function flatten(
  mapping: Mapping,
  doc: Record<string, unknown>,
  limits: Limits = DEFAULT_LIMITS,
): LuceneDoc[] {
  const nestedDocs: LuceneDoc[] = [];
  const root: LuceneDoc = { path: '', fields: new Map() };
  const put = (d: LuceneDoc, k: string, v: unknown) => {
    const arr = d.fields.get(k) ?? [];
    arr.push(v);
    d.fields.set(k, arr);
  };
  const walk = (
    props: Record<string, FieldMapping>,
    obj: Record<string, unknown>,
    path: string,
    target: LuceneDoc,
  ): void => {
    for (const [k, raw] of Object.entries(obj)) {
      const full = path ? `${path}.${k}` : k;
      const m = props[k];
      const values = Array.isArray(raw) ? raw : [raw];
      if (m && m.type === 'nested') {
        for (const v of values) {
          const nd: LuceneDoc = { path: full, fields: new Map() };
          walk(m.properties, v as Record<string, unknown>, full, nd);
          nestedDocs.push(nd);
        }
      } else if (m && m.type === 'object') {
        for (const v of values) walk(m.properties, v as Record<string, unknown>, full, target);
      } else {
        for (const v of values) if (v !== null && v !== undefined) put(target, full, v);
      }
    }
  };
  walk(mapping.properties, doc, '', root);
  if (nestedDocs.length > limits.nestedObjects) {
    throw new MappingError(
      'illegal_argument_exception',
      `The number of nested documents has exceeded the allowed limit of [${limits.nestedObjects}]`,
    );
  }
  // Block join order: children first, parent last.
  return [...nestedDocs, root];
}
