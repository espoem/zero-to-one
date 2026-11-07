/**
 * A structural validator for Elasticsearch search request bodies (a subset of what the
 * server's parser enforces), plus a minimal Mustache renderer for search templates.
 * It lets the track keep Query DSL examples as JSON fixtures and fail fast on typos,
 * unknown query types, multi-field term queries and illegal pagination combinations.
 */

const TOP_LEVEL = new Set([
  'query',
  'from',
  'size',
  'sort',
  'search_after',
  'track_total_hits',
  '_source',
  'fields',
  'highlight',
  'aggs',
  'aggregations',
  'post_filter',
  'pit',
  'knn',
  'retriever',
  'runtime_mappings',
  'collapse',
  'suggest',
  'timeout',
  'min_score',
  'explain',
  'profile',
  'rescore',
  'stored_fields',
  'docvalue_fields',
  'script_fields',
  'track_scores',
  'indices_boost',
  'terminate_after',
  'seq_no_primary_term',
  'version',
  'stats',
  'rank',
]);

/** Query types and whether they take a single field name as their only key. */
const SINGLE_FIELD = new Set([
  'term',
  'match',
  'match_phrase',
  'match_phrase_prefix',
  'match_bool_prefix',
  'prefix',
  'wildcard',
  'regexp',
  'fuzzy',
  'range',
]);
const OTHER = new Set([
  'match_all',
  'match_none',
  'terms',
  'ids',
  'exists',
  'bool',
  'constant_score',
  'dis_max',
  'function_score',
  'boosting',
  'multi_match',
  'query_string',
  'simple_query_string',
  'combined_fields',
  'nested',
  'has_child',
  'has_parent',
  'parent_id',
  'script',
  'script_score',
  'knn',
  'semantic',
  'sparse_vector',
  'rank_feature',
  'distance_feature',
  'geo_distance',
  'geo_bounding_box',
  'geo_shape',
  'terms_set',
  'intervals',
  'more_like_this',
  'percolate',
  'pinned',
  'rule',
  'span_term',
  'span_near',
  'span_or',
  'span_not',
  'span_first',
  'span_multi',
  'span_containing',
  'span_within',
  'field_masking_span',
  'wrapper',
]);
const BOOL_KEYS = new Set([
  'must',
  'should',
  'filter',
  'must_not',
  'minimum_should_match',
  'boost',
  '_name',
]);

export interface ValidationOptions {
  maxResultWindow?: number;
}

export function validateQuery(q: unknown, path = 'query'): string[] {
  const errs: string[] = [];
  if (q === null || typeof q !== 'object' || Array.isArray(q))
    return [`${path}: query must be an object`];
  const keys = Object.keys(q);
  if (keys.length !== 1)
    return [
      `${path}: [${keys.join(',')}] a query must have exactly one type, found ${keys.length}`,
    ];
  const type = keys[0]!;
  const body = (q as Record<string, unknown>)[type];
  if (!SINGLE_FIELD.has(type) && !OTHER.has(type))
    return [`${path}: parsing_exception: unknown query [${type}]`];
  if (SINGLE_FIELD.has(type)) {
    if (body === null || typeof body !== 'object') return [`${path}.${type}: expected an object`];
    const fields = Object.keys(body).filter((k) => k !== 'boost' && k !== '_name');
    if (fields.length !== 1)
      errs.push(
        `${path}.${type}: parsing_exception: [${type}] query doesn't support multiple fields, found [${fields.join('] and [')}]`,
      );
    if (type === 'range') {
      const spec = (body as Record<string, unknown>)[fields[0]!];
      const allowed = new Set([
        'gte',
        'gt',
        'lte',
        'lt',
        'format',
        'time_zone',
        'relation',
        'boost',
      ]);
      for (const k of Object.keys((spec ?? {}) as object))
        if (!allowed.has(k)) errs.push(`${path}.range.${fields[0]}: unknown key [${k}]`);
    }
  }
  if (type === 'bool') {
    const b = body as Record<string, unknown>;
    for (const k of Object.keys(b)) {
      if (!BOOL_KEYS.has(k)) {
        errs.push(`${path}.bool: parsing_exception: [bool] query does not support [${k}]`);
        continue;
      }
      if (['must', 'should', 'filter', 'must_not'].includes(k)) {
        const clauses = Array.isArray(b[k]) ? (b[k] as unknown[]) : [b[k]];
        clauses.forEach((c, i) => errs.push(...validateQuery(c, `${path}.bool.${k}[${i}]`)));
      }
    }
  }
  if (type === 'constant_score')
    errs.push(
      ...validateQuery(
        (body as Record<string, unknown>)['filter'],
        `${path}.constant_score.filter`,
      ),
    );
  if (type === 'nested') {
    const n = body as Record<string, unknown>;
    if (typeof n['path'] !== 'string') errs.push(`${path}.nested: [nested] requires 'path' field`);
    errs.push(...validateQuery(n['query'], `${path}.nested.query`));
  }
  if (type === 'function_score') {
    const f = body as Record<string, unknown>;
    if (f['query'] !== undefined)
      errs.push(...validateQuery(f['query'], `${path}.function_score.query`));
    const modes = new Set(['multiply', 'sum', 'avg', 'first', 'max', 'min']);
    if (f['score_mode'] !== undefined && !modes.has(String(f['score_mode'])))
      errs.push(`${path}.function_score: illegal score_mode`);
    if (
      f['boost_mode'] !== undefined &&
      !new Set([...modes, 'replace']).has(String(f['boost_mode']))
    )
      errs.push(`${path}.function_score: illegal boost_mode`);
  }
  if (type === 'dis_max')
    ((body as { queries?: unknown[] }).queries ?? []).forEach((c, i) =>
      errs.push(...validateQuery(c, `${path}.dis_max.queries[${i}]`)),
    );
  if (type === 'multi_match') {
    const t = (body as Record<string, unknown>)['type'];
    const types = new Set([
      'best_fields',
      'most_fields',
      'cross_fields',
      'phrase',
      'phrase_prefix',
      'bool_prefix',
    ]);
    if (t !== undefined && !types.has(String(t)))
      errs.push(`${path}.multi_match: unknown type [${String(t)}]`);
  }
  return errs;
}

export function validateSearchBody(
  body: Record<string, unknown>,
  opts: ValidationOptions = {},
): string[] {
  const errs: string[] = [];
  const window = opts.maxResultWindow ?? 10000;
  for (const k of Object.keys(body))
    if (!TOP_LEVEL.has(k)) errs.push(`parsing_exception: Unknown key for a START_OBJECT in [${k}]`);
  if (body['query'] !== undefined) errs.push(...validateQuery(body['query']));
  if (body['post_filter'] !== undefined)
    errs.push(...validateQuery(body['post_filter'], 'post_filter'));
  const from = Number(body['from'] ?? 0);
  const size = Number(body['size'] ?? 10);
  if (from + size > window)
    errs.push(
      `illegal_argument_exception: Result window is too large, from + size must be less than or equal to: [${window}] but was [${from + size}]`,
    );
  if (body['search_after'] !== undefined) {
    if (!Array.isArray(body['sort']))
      errs.push('illegal_argument_exception: search_after requires an explicit sort');
    else if ((body['search_after'] as unknown[]).length !== (body['sort'] as unknown[]).length)
      errs.push(
        'illegal_argument_exception: search_after has a different number of sort values than sort',
      );
    if (from !== 0)
      errs.push(
        'illegal_argument_exception: [from] parameter must be set to 0 when [search_after] is used',
      );
  }
  if (body['pit'] !== undefined && body['pit'] !== null) {
    const pit = body['pit'] as Record<string, unknown>;
    if (typeof pit['id'] !== 'string') errs.push('pit: requires an id');
  }
  if (
    body['collapse'] !== undefined &&
    body['search_after'] !== undefined &&
    body['rescore'] !== undefined
  ) {
    errs.push('illegal_argument_exception: cannot use [collapse] in conjunction with [rescore]');
  }
  return errs;
}

/**
 * Minimal Mustache for search templates: {{var}}, {{#toJson}}var{{/toJson}},
 * {{#join}}var{{/join}}, {{var}}{{^var}}default{{/var}} is NOT supported (kept small).
 * Values are inserted raw, as the server does before JSON parsing, which is why
 * templates that splice strings must quote them in the template source.
 */
export function renderTemplate(source: string, params: Record<string, unknown>): unknown {
  let out = source.replace(/\{\{#toJson\}\}(\w+)\{\{\/toJson\}\}/g, (_, k: string) =>
    JSON.stringify(params[k]),
  );
  out = out.replace(/\{\{#join\}\}(\w+)\{\{\/join\}\}/g, (_, k: string) =>
    (params[k] as unknown[]).join(','),
  );
  out = out.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (!(k in params)) return '';
    return String(params[k]);
  });
  return JSON.parse(out);
}
