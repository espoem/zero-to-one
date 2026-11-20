import { hasOwn } from './core.ts';

const ES6_WORD_REGEX = /[A-Z]{2,}(?=[A-Z][a-z]|\b)|[A-Z]?[a-z]+|[A-Z]|[0-9]+/g;
const COMBINING_DIACRITICS_REGEX = /[\u0300-\u036f]/g;

const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_UNESCAPE_MAP: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function buildRepeatPad(count: number, chars: string): string {
  if (count <= 0 || chars.length === 0) return '';
  return chars.repeat(Math.ceil(count / chars.length)).slice(0, count);
}

export function deburr(input: string): string {
  return input.normalize('NFD').replace(COMBINING_DIACRITICS_REGEX, '');
}

export function words(input: string, pattern?: RegExp): string[] {
  if (input.length === 0) return [];
  const regex = pattern ?? ES6_WORD_REGEX;
  const matches = input.match(regex);
  return matches === null ? [] : matches;
}

export function upperFirst(input: string): string {
  if (input.length === 0) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function lowerFirst(input: string): string {
  if (input.length === 0) return '';
  return input.charAt(0).toLowerCase() + input.slice(1);
}

export function capitalize(input: string): string {
  if (input.length === 0) return '';
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

export function camelCase(input: string): string {
  const tokens = words(deburr(input));
  if (tokens.length === 0) return '';
  let result = tokens[0]!.toLowerCase();
  for (let i = 1; i < tokens.length; i++) {
    result += capitalize(tokens[i]!);
  }
  return result;
}

export function pascalCase(input: string): string {
  const tokens = words(deburr(input));
  let result = '';
  for (let i = 0; i < tokens.length; i++) {
    result += capitalize(tokens[i]!);
  }
  return result;
}

export function kebabCase(input: string): string {
  const tokens = words(deburr(input));
  const out: string[] = new Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    out[i] = tokens[i]!.toLowerCase();
  }
  return out.join('-');
}

export function snakeCase(input: string): string {
  const tokens = words(deburr(input));
  const out: string[] = new Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    out[i] = tokens[i]!.toLowerCase();
  }
  return out.join('_');
}

export function startCase(input: string): string {
  const tokens = words(deburr(input));
  const out: string[] = new Array(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    out[i] = upperFirst(tokens[i]!);
  }
  return out.join(' ');
}

export interface TruncateOptions {
  readonly length?: number;
  readonly omission?: string;
  readonly separator?: string | RegExp;
}

export function truncate(input: string, options: TruncateOptions = {}): string {
  const maxLen = options.length !== undefined ? options.length : 30;
  const omission = options.omission !== undefined ? options.omission : '...';
  if (input.length <= maxLen) return input;
  const end = maxLen - omission.length;
  if (end < 1) return omission.slice(0, maxLen);

  let slice = input.slice(0, end);
  if (options.separator !== undefined) {
    if (typeof options.separator === 'string') {
      const idx = slice.lastIndexOf(options.separator);
      if (idx > -1) slice = slice.slice(0, idx);
    } else {
      const flags =
        options.separator.flags.indexOf('g') !== -1
          ? options.separator.flags
          : `${options.separator.flags}g`;
      const re = new RegExp(options.separator.source, flags);
      let lastIdx = -1;
      let match = re.exec(slice);
      while (match !== null) {
        lastIdx = match.index;
        if (match[0].length === 0) re.lastIndex++;
        match = re.exec(slice);
      }
      if (lastIdx > -1) slice = slice.slice(0, lastIdx);
    }
  }
  return slice + omission;
}

export function pad(input: string, length: number, chars = ' '): string {
  if (input.length >= length || chars.length === 0) return input;
  const totalPad = length - input.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return buildRepeatPad(leftPad, chars) + input + buildRepeatPad(rightPad, chars);
}

export function padStart(input: string, length: number, chars = ' '): string {
  if (input.length >= length || chars.length === 0) return input;
  return buildRepeatPad(length - input.length, chars) + input;
}

export function padEnd(input: string, length: number, chars = ' '): string {
  if (input.length >= length || chars.length === 0) return input;
  return input + buildRepeatPad(length - input.length, chars);
}

export function trim(input: string, chars?: string): string {
  if (chars === undefined) return input.trim();
  const escaped = escapeRegExp(chars);
  return input.replace(new RegExp(`^[${escaped}]+|[${escaped}]+$`, 'g'), '');
}

export function trimStart(input: string, chars?: string): string {
  if (chars === undefined) return input.replace(/^\s+/, '');
  const escaped = escapeRegExp(chars);
  return input.replace(new RegExp(`^[${escaped}]+`, 'g'), '');
}

export function trimEnd(input: string, chars?: string): string {
  if (chars === undefined) return input.replace(/\s+$/, '');
  const escaped = escapeRegExp(chars);
  return input.replace(new RegExp(`[${escaped}]+$`, 'g'), '');
}

export function repeat(input: string, count: number): string {
  if (count <= 0 || !Number.isFinite(count)) return '';
  return input.repeat(Math.floor(count));
}

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

export function unescapeHtml(input: string): string {
  return input.replace(
    /&(?:amp|lt|gt|quot|#39);/g,
    (entity) => HTML_UNESCAPE_MAP[entity] ?? entity,
  );
}

export function escapeRegExp(input: string): string {
  return input.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

export function split(separator: string | RegExp, input: string): string[] {
  return input.split(separator);
}

export function join(separator: string, items: readonly unknown[]): string {
  return items.join(separator);
}

export function replace(pattern: string | RegExp, replacement: string, input: string): string {
  return input.replace(pattern, replacement);
}

export function startsWith(prefix: string, input: string): boolean {
  return input.startsWith(prefix);
}

export function endsWith(suffix: string, input: string): boolean {
  return input.endsWith(suffix);
}

export function template(
  source: string,
  data: Readonly<Record<string, unknown>>,
  options: { readonly escape?: boolean } = {},
): string {
  const shouldEscape = options.escape !== undefined ? options.escape : false;
  return source.replace(
    /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}|<%=\s*([a-zA-Z0-9_.-]+)\s*%>/g,
    (_full: string, k1?: string, k2?: string): string => {
      const keyPath = (k1 !== undefined ? k1 : k2 !== undefined ? k2 : '').split('.');
      let cursor: unknown = data;
      for (let i = 0; i < keyPath.length; i++) {
        const seg = keyPath[i]!;
        if (typeof cursor === 'object' && cursor !== null && hasOwn(cursor, seg)) {
          cursor = (cursor as Record<string, unknown>)[seg];
        } else {
          return '';
        }
      }
      const raw = cursor === null || cursor === undefined ? '' : String(cursor);
      return shouldEscape ? escapeHtml(raw) : raw;
    },
  );
}
