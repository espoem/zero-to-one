import * as ES2024 from '#strata/es2024';
import * as ES6 from '#strata/es6';

export type SingleEvalResult =
  | {
      readonly tag: 'ok';
      readonly raw: unknown;
      readonly formatted: string;
      readonly typeLabel: string;
      readonly durationUs: number;
    }
  | {
      readonly tag: 'error';
      readonly message: string;
      readonly durationUs: number;
    };

export interface DualEvalReport {
  readonly es2024: SingleEvalResult;
  readonly es6: SingleEvalResult;
  readonly parity: 'identical' | 'delta' | 'error';
}

export function formatValue(value: unknown, indent = 0, seen = new WeakSet<object>()): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      if (Object.is(value, -0)) return '-0';
      if (Number.isNaN(value)) return 'NaN';
      return String(value);
    case 'boolean':
      return String(value);
    case 'bigint':
      return `${value.toString()}n`;
    case 'symbol':
      return value.toString();
    case 'function':
      return `[Function ${value.name || 'anonymous'}]`;
    case 'object': {
      const obj = value as object;
      if (seen.has(obj)) return '[Circular]';
      if (obj instanceof Date) return `Date(${obj.toISOString()})`;
      if (obj instanceof RegExp) return obj.toString();
      if (ES2024.isPlaceholder(obj) || ES6.isPlaceholder(obj)) return 'Placeholder(__)';
      if (ES2024.isReduced(obj) || ES6.isReduced(obj)) {
        const inner = (obj as { readonly value: unknown }).value;
        return `Reduced(${formatValue(inner, indent, seen)})`;
      }

      seen.add(obj);
      const pad = '  '.repeat(indent);
      const childPad = '  '.repeat(indent + 1);

      if (Array.isArray(obj)) {
        if (obj.length === 0) return '[]';
        const items = obj.map((v) => formatValue(v, indent + 1, seen));
        const inline = `[${items.join(', ')}]`;
        if (inline.length <= 68 && !inline.includes('\n')) return inline;
        return `[\n${items.map((x) => `${childPad}${x}`).join(',\n')}\n${pad}]`;
      }

      if (obj instanceof Map) {
        if (obj.size === 0) return 'Map(0) {}';
        const pairs = Array.from(obj.entries()).map(
          ([k, v]) =>
            `${childPad}${formatValue(k, indent + 1, seen)} => ${formatValue(v, indent + 1, seen)}`,
        );
        return `Map(${obj.size}) {\n${pairs.join(',\n')}\n${pad}}`;
      }

      if (obj instanceof Set) {
        if (obj.size === 0) return 'Set(0) {}';
        const items = Array.from(obj.values()).map((v) => formatValue(v, indent + 1, seen));
        return `Set(${obj.size}) { ${items.join(', ')} }`;
      }

      const rec = obj as Record<string, unknown>;
      const ks = Object.keys(rec);
      if (ks.length === 0) return '{}';
      const pairs = ks.map((k) => `${k}: ${formatValue(rec[k], indent + 1, seen)}`);
      const compact = `{ ${pairs.join(', ')} }`;
      if (compact.length <= 68 && !compact.includes('\n')) return compact;
      return `{\n${pairs.map((p) => `${childPad}${p}`).join(',\n')}\n${pad}}`;
    }
    default:
      return String(value);
  }
}

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    if (rec['tag'] === 'some') return 'Option<Some>';
    if (rec['tag'] === 'none') return 'Option<None>';
    if (rec['tag'] === 'ok') return 'Result<Ok>';
    if (rec['tag'] === 'err') return 'Result<Err>';
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (value instanceof Map) return `Map(${value.size})`;
    if (value instanceof Set) return `Set(${value.size})`;
  }
  return ES2024.typeOf(value);
}

function runSingle(source: string, scope: Record<string, unknown>): SingleEvalResult {
  const trimmed = source.trim();
  if (trimmed.length === 0) {
    return { tag: 'error', message: 'Expression is empty.', durationUs: 0 };
  }
  const argNames = Object.keys(scope);
  const argValues = argNames.map((k) => scope[k]);
  const start = performance.now();
  try {
    const hasExplicitReturn = /\breturn\b/.test(trimmed);
    const body = hasExplicitReturn ? trimmed : `return (\n${trimmed}\n);`;
    // Intentional interactive sandbox execution against local learning scope only
    const runner = new Function(...argNames, `"use strict";\n${body}`) as (
      ...args: unknown[]
    ) => unknown;
    const raw = runner(...argValues);
    const durationUs = Math.max(0.1, (performance.now() - start) * 1000);
    return {
      tag: 'ok',
      raw,
      formatted: formatValue(raw),
      typeLabel: describeType(raw),
      durationUs,
    };
  } catch (caught: unknown) {
    const durationUs = Math.max(0.1, (performance.now() - start) * 1000);
    return {
      tag: 'error',
      message: caught instanceof Error ? caught.message : String(caught),
      durationUs,
    };
  }
}

export function evaluateDual(source: string): DualEvalReport {
  const es2024Scope: Record<string, unknown> = {
    ...ES2024.strata,
    EDITION: ES2024.EDITION,
    S: ES2024.strata,
    _: ES2024.underscore,
    lodash: ES2024.lodash,
    R: ES2024.R,
  };
  const es6Scope: Record<string, unknown> = {
    ...ES6.strata,
    EDITION: ES6.EDITION,
    S: ES6.strata,
    _: ES6.underscore,
    lodash: ES6.lodash,
    R: ES6.R,
  };

  const es2024 = runSingle(source, es2024Scope);
  const es6 = runSingle(source, es6Scope);

  if (es2024.tag === 'error' || es6.tag === 'error') {
    return { es2024, es6, parity: 'error' };
  }

  const same = ES2024.isEqual(es2024.raw, es6.raw);
  return { es2024, es6, parity: same ? 'identical' : 'delta' };
}
