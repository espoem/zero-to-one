/**
 * A teaching model of the Lucene/Elasticsearch analysis chain:
 *   char filters (string -> string, with offset correction)
 *   -> exactly one tokenizer (string -> token stream)
 *   -> token filters (token stream -> token stream)
 *
 * It models the observable contract of `POST _analyze`: each token carries
 * `token`, `start_offset`, `end_offset`, `type` and `position`. Positions are derived
 * from position increments, exactly as in Lucene's `PositionIncrementAttribute`:
 * a stop filter leaves a gap (increment > 1), a synonym filter stacks a token at the
 * same position (increment 0).
 */

export interface Token {
  token: string;
  start_offset: number;
  end_offset: number;
  type: string;
  position: number;
}

/** Internal stream element: positionIncrement instead of absolute position. */
export interface StreamToken {
  term: string;
  start: number;
  end: number;
  type: string;
  posInc: number;
}

/** A char filter output: the new text plus, for every output index, the original offset. */
export interface CharFiltered {
  text: string;
  /** map[i] = offset in the ORIGINAL input of output char i; map[text.length] = original length. */
  map: number[];
}

export type CharFilter = (input: CharFiltered) => CharFiltered;
export type Tokenizer = (text: string) => StreamToken[];
export type TokenFilter = (tokens: StreamToken[]) => StreamToken[];

export interface Analyzer {
  charFilters: CharFilter[];
  tokenizer: Tokenizer;
  filters: TokenFilter[];
}

function identity(text: string): CharFiltered {
  const map = Array.from({ length: text.length + 1 }, (_, i) => i);
  return { text, map };
}

// ---------------------------------------------------------------------------
// Char filters
// ---------------------------------------------------------------------------

/** `html_strip` (simplified): removes tags and decodes a few entities. */
export const htmlStrip: CharFilter = ({ text, map }) => {
  const out: string[] = [];
  const outMap: number[] = [];
  const entities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&nbsp;': ' ',
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '<') {
      const close = text.indexOf('>', i);
      if (close !== -1) {
        // Block-level tags become whitespace so words on either side do not fuse.
        const tag = text
          .slice(i + 1, close)
          .replace('/', '')
          .split(/\s/)[0]!
          .toLowerCase();
        if (['p', 'br', 'div', 'li', 'h1', 'h2', 'h3'].includes(tag)) {
          out.push(' ');
          outMap.push(map[i]!);
        }
        i = close + 1;
        continue;
      }
    }
    if (ch === '&') {
      const semi = text.indexOf(';', i);
      const ent = semi === -1 ? '' : text.slice(i, semi + 1);
      const decoded = entities[ent];
      if (decoded !== undefined) {
        out.push(decoded);
        outMap.push(map[i]!);
        i = semi + 1;
        continue;
      }
    }
    out.push(ch);
    outMap.push(map[i]!);
    i++;
  }
  outMap.push(map[text.length]!);
  return { text: out.join(''), map: outMap };
};

/** `mapping` char filter: longest-match replacement of keys by values. */
export function mappingCharFilter(mappings: Record<string, string>): CharFilter {
  const keys = Object.keys(mappings).sort((a, b) => b.length - a.length);
  return ({ text, map }) => {
    const out: string[] = [];
    const outMap: number[] = [];
    let i = 0;
    outer: while (i < text.length) {
      for (const k of keys) {
        if (k.length > 0 && text.startsWith(k, i)) {
          const rep = mappings[k]!;
          for (let j = 0; j < rep.length; j++) {
            out.push(rep[j]!);
            // the last replacement char maps to the last replaced char, so end offsets cover the key
            outMap.push(map[j === rep.length - 1 ? i + k.length - 1 : i]!);
          }
          i += k.length;
          continue outer;
        }
      }
      out.push(text[i]!);
      outMap.push(map[i]!);
      i++;
    }
    outMap.push(map[text.length]!);
    return { text: out.join(''), map: outMap };
  };
}

// ---------------------------------------------------------------------------
// Tokenizers
// ---------------------------------------------------------------------------

const segmenter = new Intl.Segmenter('und', { granularity: 'word' });

/**
 * `standard` tokenizer: Unicode Text Segmentation (UAX #29) word boundaries.
 * Lucene implements UAX #29 with a JFlex grammar; we use ICU via Intl.Segmenter,
 * which implements the same annex. Tokens longer than maxTokenLength are split,
 * like Lucene's `max_token_length` (default 255).
 */
export function standardTokenizer(maxTokenLength = 255): Tokenizer {
  return (text) => {
    const out: StreamToken[] = [];
    for (const seg of segmenter.segment(text)) {
      if (!seg.isWordLike) continue;
      const type = /^\p{N}+([.,]\p{N}+)*$/u.test(seg.segment) ? '<NUM>' : '<ALPHANUM>';
      for (let s = 0; s < seg.segment.length; s += maxTokenLength) {
        const piece = seg.segment.slice(s, s + maxTokenLength);
        out.push({
          term: piece,
          start: seg.index + s,
          end: seg.index + s + piece.length,
          type,
          posInc: 1,
        });
      }
    }
    return out;
  };
}

/** `whitespace` tokenizer: splits on whitespace only (punctuation stays attached). */
export const whitespaceTokenizer: Tokenizer = (text) => {
  const out: StreamToken[] = [];
  for (const m of text.matchAll(/\S+/gu)) {
    out.push({ term: m[0], start: m.index, end: m.index + m[0].length, type: 'word', posInc: 1 });
  }
  return out;
};

/** `keyword` tokenizer: the whole input is one token. */
export const keywordTokenizer: Tokenizer = (text) =>
  text.length === 0 ? [] : [{ term: text, start: 0, end: text.length, type: 'word', posInc: 1 }];

/** `letter` tokenizer: maximal runs of letters. */
export const letterTokenizer: Tokenizer = (text) => {
  const out: StreamToken[] = [];
  for (const m of text.matchAll(/\p{L}+/gu)) {
    out.push({ term: m[0], start: m.index, end: m.index + m[0].length, type: 'word', posInc: 1 });
  }
  return out;
};

/**
 * `edge_ngram` tokenizer: for each run of `token_chars` (letters and digits here),
 * emit prefixes of length min..max. In Lucene's tokenizer form every gram gets its own
 * position (posInc 1), unlike the `edge_ngram` token filter which stacks them.
 */
export function edgeNgramTokenizer(minGram: number, maxGram: number): Tokenizer {
  if (minGram < 1 || maxGram < minGram)
    throw new Error('illegal_argument_exception: min_gram/max_gram');
  return (text) => {
    const out: StreamToken[] = [];
    for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
      for (let n = minGram; n <= Math.min(maxGram, m[0].length); n++) {
        out.push({
          term: m[0].slice(0, n),
          start: m.index,
          end: m.index + n,
          type: 'word',
          posInc: 1,
        });
      }
    }
    return out;
  };
}

/**
 * `ngram` tokenizer. Elasticsearch rejects max_gram - min_gram > index.max_ngram_diff (default 1).
 */
export function ngramTokenizer(minGram: number, maxGram: number, maxNgramDiff = 1): Tokenizer {
  if (maxGram - minGram > maxNgramDiff) {
    throw new Error(
      `illegal_argument_exception: The difference between max_gram and min_gram in NGram Tokenizer must be less than or equal to: [${maxNgramDiff}]`,
    );
  }
  return (text) => {
    const out: StreamToken[] = [];
    for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
      const w = m[0];
      for (let i = 0; i < w.length; i++) {
        for (let n = minGram; n <= maxGram && i + n <= w.length; n++) {
          out.push({
            term: w.slice(i, i + n),
            start: m.index + i,
            end: m.index + i + n,
            type: 'word',
            posInc: 1,
          });
        }
      }
    }
    return out;
  };
}

// ---------------------------------------------------------------------------
// Token filters
// ---------------------------------------------------------------------------

export const lowercase: TokenFilter = (ts) => ts.map((t) => ({ ...t, term: t.term.toLowerCase() }));

/** `asciifolding`: NFD-decompose, then drop combining marks (č -> c, é -> e). */
export const asciifolding: TokenFilter = (ts) =>
  ts.map((t) => ({ ...t, term: t.term.normalize('NFD').replace(/\p{M}+/gu, '') }));

export const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'if',
  'in',
  'into',
  'is',
  'it',
  'no',
  'not',
  'of',
  'on',
  'or',
  'such',
  'that',
  'the',
  'their',
  'then',
  'there',
  'these',
  'they',
  'this',
  'to',
  'was',
  'will',
  'with',
]);

/**
 * `stop` filter. Removed tokens leave a position gap: their increment is added to the
 * next surviving token. This is why `match_phrase: "quick fox"` does NOT match
 * "quick the fox" after stop-word removal unless slop >= 1.
 */
export function stop(words: Set<string> = ENGLISH_STOP_WORDS): TokenFilter {
  return (ts) => {
    const out: StreamToken[] = [];
    let carried = 0;
    for (const t of ts) {
      if (words.has(t.term)) {
        carried += t.posInc;
        continue;
      }
      out.push({ ...t, posInc: t.posInc + carried });
      carried = 0;
    }
    return out;
  };
}

/**
 * Lucene `EnglishMinimalStemmer` (Harman's "S" stemmer), exposed in Elasticsearch as
 * the `stemmer` filter with `language: minimal_english`. It only strips plurals.
 */
export function minimalEnglishStem(word: string): string {
  const s = word;
  const len = s.length;
  if (len < 3 || s[len - 1] !== 's') return s;
  switch (s[len - 2]) {
    case 'u':
    case 's':
      return s;
    case 'e':
      if (len > 3 && s[len - 3] === 'i' && s[len - 4] !== 'a' && s[len - 4] !== 'e') {
        return s.slice(0, len - 3) + 'y';
      }
      if (s[len - 3] === 'i' || s[len - 3] === 'a' || s[len - 3] === 'o' || s[len - 3] === 'e') {
        return s;
      }
      return s.slice(0, len - 1);
    default:
      return s.slice(0, len - 1);
  }
}

export const minimalEnglish: TokenFilter = (ts) =>
  ts.map((t) => ({ ...t, term: minimalEnglishStem(t.term) }));

/** `english_possessive` stemmer: strips trailing 's. */
export const englishPossessive: TokenFilter = (ts) =>
  ts.map((t) => ({ ...t, term: t.term.replace(/['’][sS]$/u, '') }));

/**
 * Single-token `synonym` filter in Solr format "a, b, c" (equivalent synonyms, expand=true).
 * Each synonym is emitted at the SAME position (posInc 0) with type SYNONYM.
 * Multi-word synonyms need `synonym_graph` and are out of scope for this model.
 */
export function synonyms(rules: string[]): TokenFilter {
  const groups = new Map<string, string[]>();
  for (const rule of rules) {
    if (rule.includes('=>')) throw new Error('explicit mappings not modelled');
    const words = rule
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean);
    if (words.some((w) => /\s/.test(w))) throw new Error('multi-word synonyms need synonym_graph');
    for (const w of words) groups.set(w, words);
  }
  return (ts) => {
    const out: StreamToken[] = [];
    for (const t of ts) {
      out.push(t);
      for (const syn of groups.get(t.term) ?? []) {
        if (syn !== t.term) out.push({ ...t, term: syn, type: 'SYNONYM', posInc: 0 });
      }
    }
    return out;
  };
}

/** `edge_ngram` token filter: prefixes are stacked at the same position (posInc 0). */
export function edgeNgramFilter(minGram: number, maxGram: number): TokenFilter {
  return (ts) => {
    const out: StreamToken[] = [];
    for (const t of ts) {
      let first = true;
      for (let n = minGram; n <= Math.min(maxGram, t.term.length); n++) {
        out.push({ ...t, term: t.term.slice(0, n), posInc: first ? t.posInc : 0 });
        first = false;
      }
    }
    return out;
  };
}

/** `truncate`, used in normalizers and to keep keyword terms below Lucene's 32766-byte limit. */
export function truncate(length: number): TokenFilter {
  return (ts) => ts.map((t) => ({ ...t, term: t.term.slice(0, length) }));
}

// ---------------------------------------------------------------------------
// Running an analyzer
// ---------------------------------------------------------------------------

export function analyze(analyzer: Analyzer, text: string): Token[] {
  let cf = identity(text);
  for (const f of analyzer.charFilters) cf = f(cf);
  let stream = analyzer.tokenizer(cf.text);
  // Offset correction: map filtered offsets back to the original input (CharFilter.correctOffset).
  // The end offset is (original offset of the token's last char) + 1, so removed markup
  // after the token (e.g. a closing tag) is not included.
  stream = stream.map((t) => ({
    ...t,
    start: cf.map[t.start]!,
    end: t.end > t.start ? cf.map[t.end - 1]! + 1 : cf.map[t.start]!,
  }));
  for (const f of analyzer.filters) stream = f(stream);
  const out: Token[] = [];
  let position = -1;
  for (const t of stream) {
    position += t.posInc;
    out.push({ token: t.term, start_offset: t.start, end_offset: t.end, type: t.type, position });
  }
  return out;
}

export function terms(analyzer: Analyzer, text: string): string[] {
  return analyze(analyzer, text).map((t) => t.token);
}

// ---------------------------------------------------------------------------
// Built-in analyzers (the Elasticsearch defaults, modelled)
// ---------------------------------------------------------------------------

/** `standard` analyzer: standard tokenizer + lowercase. No stop words by default (since ES 5). */
export const standardAnalyzer: Analyzer = {
  charFilters: [],
  tokenizer: standardTokenizer(),
  filters: [lowercase],
};

/** `simple` analyzer: letter tokenizer + lowercase (Lucene's LowerCaseTokenizer behaviour). */
export const simpleAnalyzer: Analyzer = {
  charFilters: [],
  tokenizer: letterTokenizer,
  filters: [lowercase],
};

export const whitespaceAnalyzer: Analyzer = {
  charFilters: [],
  tokenizer: whitespaceTokenizer,
  filters: [],
};

/** `keyword` analyzer: no-op, the whole string is one term. */
export const keywordAnalyzer: Analyzer = {
  charFilters: [],
  tokenizer: keywordTokenizer,
  filters: [],
};

/**
 * A simplified `english` analyzer: possessive -> lowercase -> stop -> stem.
 * The real one uses the Porter stemmer; minimal_english keeps results predictable.
 */
export const englishLikeAnalyzer: Analyzer = {
  charFilters: [],
  tokenizer: standardTokenizer(),
  filters: [englishPossessive, lowercase, stop(), minimalEnglish],
};

/**
 * A normalizer is an analyzer restricted to the keyword tokenizer and per-character
 * filters. Elasticsearch rejects token filters that are not "multi-term aware"
 * (for example `stemmer`, `synonym`, `edge_ngram`) in a normalizer.
 */
export function normalizer(filters: TokenFilter[]): Analyzer {
  const allowed = new Set<TokenFilter>([lowercase, asciifolding]);
  for (const f of filters) {
    if (!allowed.has(f))
      throw new Error('illegal_argument_exception: Custom normalizer may not use filter');
  }
  return { charFilters: [], tokenizer: keywordTokenizer, filters };
}
