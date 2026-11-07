/**
 * A teaching interpreter for a subset of ES|QL: a piped, columnar query language.
 *
 *   source-command | processing-command | processing-command ...
 *
 * Supported: FROM, ROW, WHERE, EVAL, STATS ... BY, SORT (ASC/DESC, NULLS FIRST/LAST),
 * KEEP, DROP, RENAME, LIMIT, MV_EXPAND, LOOKUP JOIN ... ON. Expressions: arithmetic,
 * comparisons, AND/OR/NOT with SQL three-valued logic, IS [NOT] NULL, a few functions.
 * Semantics follow the ES|QL reference: implicit LIMIT 1000 (max 10000), integer division
 * truncates, NULLs sort last ascending, unnamed aggregate columns are named by their text,
 * STATS outputs aggregates first then the BY columns, LOOKUP JOIN is a left join that
 * emits one row per match.
 */

export type Value = string | number | boolean | null | Value[];
export type Row = Record<string, Value>;
export interface Table {
  columns: string[];
  rows: Row[];
}
export interface Catalog {
  indices: Record<string, Row[]>;
  /** indices created with index.mode: lookup */
  lookup?: Record<string, Row[]>;
}

export const DEFAULT_LIMIT = 1000;
export const MAX_LIMIT = 10000;

export class EsqlError extends Error {
  constructor(msg: string) {
    super(`verification_exception: ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

type Tok = { t: 'num' | 'str' | 'id' | 'op' | 'pipe' | 'eof'; v: string };

function lex(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '|') {
      out.push({ t: 'pipe', v: '|' });
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== '"') {
        if (src[j] === '\\') j++;
        s += src[j];
        j++;
      }
      if (j >= src.length) throw new EsqlError('unterminated string');
      out.push({ t: 'str', v: s });
      i = j + 1;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(src.slice(i));
    if (num) {
      out.push({ t: 'num', v: num[0] });
      i += num[0].length;
      continue;
    }
    // identifiers and unquoted index patterns (logs-web-*); in this model binary minus needs spaces
    const id = /^[A-Za-z_@][\w.*@]*(-[A-Za-z*][\w.*@]*)*/.exec(src.slice(i));
    if (id) {
      out.push({ t: 'id', v: id[0] });
      i += id[0].length;
      continue;
    }
    const op = /^(==|!=|<=|>=|[<>=+\-*/%(),])/.exec(src.slice(i));
    if (op) {
      out.push({ t: 'op', v: op[0] });
      i += op[0].length;
      continue;
    }
    throw new EsqlError(`unexpected character [${c}]`);
  }
  out.push({ t: 'eof', v: '' });
  return out;
}

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

type Expr =
  | { k: 'lit'; v: Value }
  | { k: 'col'; name: string }
  | { k: 'bin'; op: string; l: Expr; r: Expr }
  | { k: 'not'; e: Expr }
  | { k: 'neg'; e: Expr }
  | { k: 'isnull'; e: Expr; not: boolean }
  | { k: 'call'; fn: string; args: Expr[]; star?: boolean };

class Parser {
  i = 0;
  readonly toks: Tok[];
  constructor(toks: Tok[]) {
    this.toks = toks;
  }
  peek(): Tok {
    return this.toks[this.i]!;
  }
  next(): Tok {
    return this.toks[this.i++]!;
  }
  kw(word: string): boolean {
    const p = this.peek();
    if (p.t === 'id' && p.v.toUpperCase() === word) {
      this.i++;
      return true;
    }
    return false;
  }
  expectKw(word: string): void {
    if (!this.kw(word)) throw new EsqlError(`expected ${word} but found [${this.peek().v}]`);
  }
  op(o: string): boolean {
    const p = this.peek();
    if (p.t === 'op' && p.v === o) {
      this.i++;
      return true;
    }
    return false;
  }
  ident(): string {
    const p = this.next();
    if (p.t !== 'id') throw new EsqlError(`expected identifier but found [${p.v}]`);
    return p.v;
  }
  atCommandEnd(): boolean {
    const p = this.peek();
    return p.t === 'pipe' || p.t === 'eof';
  }

  expr(): Expr {
    return this.or();
  }
  or(): Expr {
    let l = this.and();
    while (this.kw('OR')) l = { k: 'bin', op: 'OR', l, r: this.and() };
    return l;
  }
  and(): Expr {
    let l = this.notE();
    while (this.kw('AND')) l = { k: 'bin', op: 'AND', l, r: this.notE() };
    return l;
  }
  notE(): Expr {
    return this.kw('NOT') ? { k: 'not', e: this.notE() } : this.cmp();
  }
  cmp(): Expr {
    const l = this.add();
    if (this.kw('IS')) {
      const not = this.kw('NOT');
      this.expectKw('NULL');
      return { k: 'isnull', e: l, not };
    }
    for (const o of ['==', '!=', '<=', '>=', '<', '>'])
      if (this.op(o)) return { k: 'bin', op: o, l, r: this.add() };
    if (this.op('=')) throw new EsqlError('use == for equality, = is assignment');
    return l;
  }
  add(): Expr {
    let l = this.mul();
    for (;;) {
      if (this.op('+')) l = { k: 'bin', op: '+', l, r: this.mul() };
      else if (this.op('-')) l = { k: 'bin', op: '-', l, r: this.mul() };
      else return l;
    }
  }
  mul(): Expr {
    let l = this.unary();
    for (;;) {
      const o = ['*', '/', '%'].find((x) => this.op(x));
      if (!o) return l;
      l = { k: 'bin', op: o, l, r: this.unary() };
    }
  }
  unary(): Expr {
    return this.op('-') ? { k: 'neg', e: this.unary() } : this.atom();
  }
  atom(): Expr {
    const p = this.next();
    if (p.t === 'num') return { k: 'lit', v: Number(p.v) };
    if (p.t === 'str') return { k: 'lit', v: p.v };
    if (p.t === 'op' && p.v === '(') {
      const e = this.expr();
      if (!this.op(')')) throw new EsqlError('expected )');
      return e;
    }
    if (p.t === 'id') {
      const up = p.v.toUpperCase();
      if (up === 'NULL') return { k: 'lit', v: null };
      if (up === 'TRUE' || up === 'FALSE') return { k: 'lit', v: up === 'TRUE' };
      if (this.op('(')) {
        if (this.peek().v === '*') {
          this.next();
          if (!this.op(')')) throw new EsqlError('expected )');
          return { k: 'call', fn: up, args: [], star: true };
        }
        const args: Expr[] = [];
        if (!this.op(')')) {
          do args.push(this.expr());
          while (this.op(','));
          if (!this.op(')')) throw new EsqlError('expected )');
        }
        return { k: 'call', fn: up, args };
      }
      return { k: 'col', name: p.v };
    }
    throw new EsqlError(`unexpected [${p.v}]`);
  }
}

function text(e: Expr): string {
  switch (e.k) {
    case 'lit':
      return typeof e.v === 'string' ? `"${e.v}"` : String(e.v);
    case 'col':
      return e.name;
    case 'bin':
      return `${text(e.l)} ${e.op} ${text(e.r)}`;
    case 'not':
      return `NOT ${text(e.e)}`;
    case 'neg':
      return `-${text(e.e)}`;
    case 'isnull':
      return `${text(e.e)} IS ${e.not ? 'NOT ' : ''}NULL`;
    case 'call':
      return `${e.fn}(${e.star ? '*' : e.args.map(text).join(', ')})`;
  }
}

const isInt = (v: Value) => typeof v === 'number' && Number.isInteger(v);

function evalExpr(e: Expr, row: Row, columns: Set<string>): Value {
  switch (e.k) {
    case 'lit':
      return e.v;
    case 'col':
      if (!columns.has(e.name)) throw new EsqlError(`Unknown column [${e.name}]`);
      return row[e.name] ?? null;
    case 'neg': {
      const v = evalExpr(e.e, row, columns);
      return v === null ? null : -(v as number);
    }
    case 'isnull': {
      const v = evalExpr(e.e, row, columns);
      return e.not ? v !== null : v === null;
    }
    case 'not': {
      const v = evalExpr(e.e, row, columns);
      return v === null ? null : !v;
    }
    case 'bin': {
      const l = evalExpr(e.l, row, columns);
      if (e.op === 'AND') {
        const r = evalExpr(e.r, row, columns);
        if (l === false || r === false) return false;
        return l === null || r === null ? null : true;
      }
      if (e.op === 'OR') {
        const r = evalExpr(e.r, row, columns);
        if (l === true || r === true) return true;
        return l === null || r === null ? null : false;
      }
      const r = evalExpr(e.r, row, columns);
      if (l === null || r === null) return null; // NULL propagates
      if (Array.isArray(l) || Array.isArray(r)) return null; // multi-values: null (+ a warning in ES|QL)
      switch (e.op) {
        case '+':
          return (l as number) + (r as number);
        case '-':
          return (l as number) - (r as number);
        case '*':
          return (l as number) * (r as number);
        case '/':
          if (r === 0) return null;
          return isInt(l) && isInt(r)
            ? Math.trunc((l as number) / (r as number))
            : (l as number) / (r as number);
        case '%':
          if (r === 0) return null;
          return (l as number) % (r as number);
        case '==':
          return l === r;
        case '!=':
          return l !== r;
        case '<':
          return l < r;
        case '<=':
          return l <= r;
        case '>':
          return l > r;
        case '>=':
          return l >= r;
      }
      throw new EsqlError(`operator ${e.op}`);
    }
    case 'call': {
      const a = e.args.map((x) => evalExpr(x, row, columns));
      switch (e.fn) {
        case 'TO_UPPER':
          return a[0] === null ? null : String(a[0]).toUpperCase();
        case 'TO_LOWER':
          return a[0] === null ? null : String(a[0]).toLowerCase();
        case 'LENGTH':
          return a[0] === null ? null : [...String(a[0])].length;
        case 'CONCAT':
          return a.some((x) => x === null) ? null : a.join('');
        case 'COALESCE':
          return a.find((x) => x !== null) ?? null;
        case 'ROUND': {
          if (a[0] === null) return null;
          const f = 10 ** Number(a[1] ?? 0);
          return Math.round((a[0] as number) * f) / f;
        }
        case 'MV_COUNT':
          return a[0] === null ? null : Array.isArray(a[0]) ? a[0].length : 1;
        case 'CASE': {
          for (let i = 0; i + 1 < a.length; i += 2) if (a[i] === true) return a[i + 1]!;
          return a.length % 2 === 1 ? a.at(-1)! : null;
        }
      }
      throw new EsqlError(`Unknown function [${e.fn}]`);
    }
  }
}

const AGGS = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT', 'VALUES']);

function aggregate(e: Expr, rows: Row[], columns: Set<string>): Value {
  if (e.k !== 'call' || !AGGS.has(e.fn))
    throw new EsqlError(`expected an aggregate function but found [${text(e)}]`);
  if (e.star) return rows.length;
  const vals = rows.flatMap((r) => {
    const v = evalExpr(e.args[0]!, r, columns);
    return v === null ? [] : Array.isArray(v) ? v : [v];
  });
  switch (e.fn) {
    case 'COUNT':
      return vals.length; // counts values, nulls skipped (multi-values count each)
    case 'SUM':
      return vals.length ? vals.reduce((x, y) => (x as number) + (y as number), 0) : null;
    case 'AVG':
      return vals.length ? (vals as number[]).reduce((x, y) => x + y, 0) / vals.length : null;
    case 'MIN':
      return vals.length ? vals.reduce((x, y) => (y! < x! ? y : x)) : null;
    case 'MAX':
      return vals.length ? vals.reduce((x, y) => (y! > x! ? y : x)) : null;
    case 'COUNT_DISTINCT':
      return new Set(vals.map((v) => JSON.stringify(v))).size; // HyperLogLog++ in ES|QL
    case 'VALUES':
      return [...new Set(vals)] as Value[];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function globToRe(g: string): RegExp {
  return new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
}

function compare(a: Value, b: Value): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

export function run(query: string, catalog: Catalog): Table {
  const p = new Parser(lex(query));
  let table: Table | null = null;
  let explicitLimit = false;
  const cols = () => new Set(table!.columns);
  let first = true;
  for (;;) {
    const cmd = p.ident().toUpperCase();
    if (first) {
      if (cmd === 'FROM') {
        const names: string[] = [];
        do names.push(p.ident());
        while (p.op(','));
        const rows: Row[] = [];
        for (const n of names) {
          const matched = Object.keys(catalog.indices).filter((k) => globToRe(n).test(k));
          if (matched.length === 0) throw new EsqlError(`Unknown index [${n}]`);
          for (const m of matched) rows.push(...catalog.indices[m]!.map((r) => ({ ...r })));
        }
        const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
        if (p.kw('METADATA')) {
          do {
            const md = p.ident();
            if (md !== '_index' && md !== '_id' && md !== '_score')
              throw new EsqlError(`unsupported metadata field [${md}]`);
          } while (p.op(','));
        }
        table = { columns, rows };
      } else if (cmd === 'ROW') {
        const row: Row = {};
        const columns: string[] = [];
        do {
          const n = p.ident();
          if (!p.op('=')) throw new EsqlError('expected =');
          row[n] = evalExpr(p.expr(), {}, new Set());
          columns.push(n);
        } while (p.op(','));
        table = { columns, rows: [row] };
      } else {
        throw new EsqlError(
          `a query must start with a source command (FROM, ROW, SHOW, TS), found [${cmd}]`,
        );
      }
      first = false;
    } else {
      const t: Table = table!;
      switch (cmd) {
        case 'WHERE': {
          const e = p.expr();
          const c = cols();
          t.rows = t.rows.filter((r) => evalExpr(e, r, c) === true);
          break;
        }
        case 'EVAL': {
          do {
            let name: string;
            let e: Expr;
            const save = p.i;
            const id = p.peek();
            if (id.t === 'id' && p.toks[p.i + 1]?.v === '=') {
              p.i += 2;
              name = id.v;
              e = p.expr();
            } else {
              p.i = save;
              e = p.expr();
              name = text(e);
            }
            const c = cols();
            t.rows = t.rows.map((r) => ({ ...r, [name]: evalExpr(e, r, c) }));
            t.columns = [...t.columns.filter((x) => x !== name), name];
          } while (p.op(','));
          break;
        }
        case 'STATS': {
          const aggs: { name: string; e: Expr }[] = [];
          do {
            const id = p.peek();
            if (id.t === 'id' && p.toks[p.i + 1]?.v === '=') {
              p.i += 2;
              aggs.push({ name: id.v, e: p.expr() });
            } else {
              const e = p.expr();
              aggs.push({ name: text(e), e });
            }
          } while (p.op(','));
          const by: string[] = [];
          if (p.kw('BY'))
            do by.push(p.ident());
            while (p.op(','));
          const c = cols();
          for (const b of by) if (!c.has(b)) throw new EsqlError(`Unknown column [${b}]`);
          const groups = new Map<string, Row[]>();
          for (const r of t.rows) {
            const k = JSON.stringify(by.map((b) => r[b] ?? null));
            groups.set(k, [...(groups.get(k) ?? []), r]);
          }
          if (by.length === 0 && groups.size === 0) groups.set('[]', []);
          const rows: Row[] = [];
          for (const [k, rs] of groups) {
            const keyVals = JSON.parse(k) as Value[];
            const row: Row = {};
            for (const a of aggs) row[a.name] = aggregate(a.e, rs, c);
            by.forEach((b, i) => (row[b] = keyVals[i]!));
            rows.push(row);
          }
          table = { columns: [...aggs.map((a) => a.name), ...by], rows };
          break;
        }
        case 'SORT': {
          const keys: { col: string; dir: 1 | -1; nullsFirst: boolean }[] = [];
          do {
            const col = p.ident();
            if (!cols().has(col)) throw new EsqlError(`Unknown column [${col}]`);
            const dir = p.kw('DESC') ? -1 : (p.kw('ASC'), 1);
            let nullsFirst = dir === -1; // NULLs are "larger" than any value
            if (p.kw('NULLS')) nullsFirst = p.kw('FIRST') ? true : (p.expectKw('LAST'), false);
            keys.push({ col, dir, nullsFirst });
          } while (p.op(','));
          t.rows = [...t.rows].sort((a, b) => {
            for (const k of keys) {
              const x = a[k.col] ?? null;
              const y = b[k.col] ?? null;
              if (x === null && y === null) continue;
              if (x === null) return k.nullsFirst ? -1 : 1;
              if (y === null) return k.nullsFirst ? 1 : -1;
              const c = compare(x, y) * k.dir;
              if (c !== 0) return c;
            }
            return 0;
          });
          break;
        }
        case 'KEEP': {
          const pats: string[] = [];
          do pats.push(p.op('*') ? '*' : p.ident());
          while (p.op(','));
          const keep: string[] = [];
          for (const pat of pats) {
            const m = t.columns.filter((c) => globToRe(pat).test(c));
            if (m.length === 0) throw new EsqlError(`Unknown column [${pat}]`);
            for (const c of m) if (!keep.includes(c)) keep.push(c);
          }
          table = {
            columns: keep,
            rows: t.rows.map((r) => Object.fromEntries(keep.map((c) => [c, r[c] ?? null]))),
          };
          break;
        }
        case 'DROP': {
          const pats: string[] = [];
          do pats.push(p.ident());
          while (p.op(','));
          const drop = new Set(t.columns.filter((c) => pats.some((pat) => globToRe(pat).test(c))));
          t.columns = t.columns.filter((c) => !drop.has(c));
          t.rows = t.rows.map((r) => Object.fromEntries(t.columns.map((c) => [c, r[c] ?? null])));
          break;
        }
        case 'RENAME': {
          do {
            const from = p.ident();
            p.expectKw('AS');
            const to = p.ident();
            if (!cols().has(from)) throw new EsqlError(`Unknown column [${from}]`);
            t.columns = t.columns.filter((c) => c !== to).map((c) => (c === from ? to : c));
            t.rows = t.rows.map((r) => {
              const { [from]: v, ...rest } = r;
              return { ...rest, [to]: v ?? null };
            });
          } while (p.op(','));
          break;
        }
        case 'LIMIT': {
          const n = Number(p.next().v);
          if (!Number.isInteger(n) || n < 0)
            throw new EsqlError('LIMIT requires a non-negative integer');
          t.rows = t.rows.slice(0, Math.min(n, MAX_LIMIT));
          explicitLimit = true;
          break;
        }
        case 'MV_EXPAND': {
          const col = p.ident();
          t.rows = t.rows.flatMap((r) => {
            const v = r[col] ?? null;
            return Array.isArray(v) ? v.map((x) => ({ ...r, [col]: x })) : [r];
          });
          break;
        }
        case 'LOOKUP': {
          p.expectKw('JOIN');
          const idx = p.ident();
          const lookupRows = catalog.lookup?.[idx];
          if (!lookupRows)
            throw new EsqlError(
              `invalid [${idx}] resolution in lookup mode to an index in [standard] mode`,
            );
          p.expectKw('ON');
          const keys: string[] = [];
          do keys.push(p.ident());
          while (p.op(','));
          for (const k of keys)
            if (!cols().has(k)) throw new EsqlError(`Unknown column [${k}] in right side of join`);
          const lookupCols = [...new Set(lookupRows.flatMap((r) => Object.keys(r)))].filter(
            (c) => !keys.includes(c),
          );
          t.rows = t.rows.flatMap((r) => {
            const matches = lookupRows.filter((l) =>
              keys.every((k) => r[k] !== null && r[k] !== undefined && l[k] === r[k]),
            );
            if (matches.length === 0)
              return [{ ...r, ...Object.fromEntries(lookupCols.map((c) => [c, null])) }];
            // lookup fields override same-named columns
            return matches.map((m) => ({
              ...r,
              ...Object.fromEntries(lookupCols.map((c) => [c, m[c] ?? null])),
            }));
          });
          t.columns = [...t.columns.filter((c) => !lookupCols.includes(c)), ...lookupCols];
          break;
        }
        default:
          throw new EsqlError(`unknown processing command [${cmd}]`);
      }
    }
    const tok = p.peek();
    if (tok.t === 'eof') break;
    if (tok.t !== 'pipe')
      throw new EsqlError(`mismatched input [${tok.v}], expected | or end of query`);
    p.next();
  }
  if (!explicitLimit) table!.rows = table!.rows.slice(0, DEFAULT_LIMIT);
  return table!;
}
