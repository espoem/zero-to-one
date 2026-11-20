export interface ExtractedSnippet {
  readonly symbol: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly code: string;
  readonly helpers: readonly string[];
}

interface TopLevelDecl {
  readonly name: string;
  readonly exported: boolean;
  readonly startLine: number;
  readonly endLine: number;
  readonly code: string;
}

interface ScanState {
  brace: number;
  paren: number;
  inBlockComment: boolean;
  inTemplate: boolean;
  templateBraces: number[];
  sawOpenBrace: boolean;
}

const DECL_START_RE =
  /^(export\s+)?(function|const|type|interface|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)\b/;

const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'case',
  'throw',
  'in',
  'of',
  'typeof',
  'void',
  'delete',
  'new',
  'else',
  'do',
  'yield',
  'await',
]);

function isIdentChar(ch: string): boolean {
  return /[A-Za-z0-9_$]/.test(ch);
}

function scanLine(line: string, state: ScanState): void {
  let inSingle = false;
  let inDouble = false;
  let regexOk = true;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    const next = line[i + 1];

    if (state.inBlockComment) {
      if (ch === '*' && next === '/') {
        state.inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (ch === '\\') i++;
      else if (ch === "'") {
        inSingle = false;
        regexOk = false;
      }
      continue;
    }

    if (inDouble) {
      if (ch === '\\') i++;
      else if (ch === '"') {
        inDouble = false;
        regexOk = false;
      }
      continue;
    }

    if (state.inTemplate) {
      if (ch === '\\') {
        i++;
      } else if (ch === '`') {
        state.inTemplate = false;
        regexOk = false;
      } else if (ch === '$' && next === '{') {
        state.templateBraces.push(state.brace);
        state.brace++;
        state.inTemplate = false;
        regexOk = true;
        i++;
      }
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') continue;

    if (ch === '/' && next === '/') break;
    if (ch === '/' && next === '*') {
      state.inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '/' && regexOk) {
      let inClass = false;
      i++;
      while (i < line.length) {
        const rc = line[i]!;
        if (rc === '\\') {
          i += 2;
          continue;
        }
        if (rc === '[') {
          inClass = true;
        } else if (rc === ']') {
          inClass = false;
        } else if (rc === '/' && !inClass) {
          break;
        }
        i++;
      }
      while (i + 1 < line.length && /[a-z]/i.test(line[i + 1]!)) {
        i++;
      }
      regexOk = false;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      continue;
    }
    if (ch === '`') {
      state.inTemplate = true;
      continue;
    }

    if (ch === '{') {
      state.brace++;
      state.sawOpenBrace = true;
      regexOk = true;
      continue;
    }
    if (ch === '}') {
      state.brace = Math.max(0, state.brace - 1);
      const resumeDepth = state.templateBraces[state.templateBraces.length - 1];
      if (resumeDepth !== undefined && state.brace === resumeDepth) {
        state.templateBraces.pop();
        state.inTemplate = true;
      } else {
        regexOk = false;
      }
      continue;
    }
    if (ch === '(') {
      state.paren++;
      regexOk = true;
      continue;
    }
    if (ch === ')') {
      state.paren = Math.max(0, state.paren - 1);
      regexOk = false;
      continue;
    }

    if (/[A-Za-z_$]/.test(ch)) {
      let end = i + 1;
      while (end < line.length && isIdentChar(line[end]!)) end++;
      const word = line.slice(i, end);
      regexOk = REGEX_PRECEDING_KEYWORDS.has(word);
      i = end - 1;
      continue;
    }

    if (/[0-9]/.test(ch) || ch === ']') {
      regexOk = false;
      continue;
    }

    regexOk = true;
  }
}

export function parseTopLevelDecls(source: string): readonly TopLevelDecl[] {
  const lines = source.split('\n');
  const raw: TopLevelDecl[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const match = DECL_START_RE.exec(line);
    if (!match) {
      i++;
      continue;
    }

    const exported = Boolean(match[1]);
    const kind = match[2]!;
    const name = match[3]!;

    let startIdx = i;
    if (startIdx > 0 && lines[startIdx - 1]!.trimEnd().endsWith('*/')) {
      let c = startIdx - 1;
      while (c >= 0 && !lines[c]!.trimStart().startsWith('/**')) {
        c--;
      }
      if (c >= 0 && lines[c]!.trimStart().startsWith('/**')) {
        startIdx = c;
      }
    }

    const state: ScanState = {
      brace: 0,
      paren: 0,
      inBlockComment: false,
      inTemplate: false,
      templateBraces: [],
      sawOpenBrace: false,
    };
    let endIdx = i;

    for (let j = i; j < lines.length; j++) {
      const cur = lines[j]!;
      scanLine(cur, state);

      const trimmed = cur.trimEnd();
      const closedBlock =
        state.sawOpenBrace && state.brace === 0 && state.paren === 0 && !state.inTemplate;
      const endedStatement =
        !state.sawOpenBrace &&
        state.brace === 0 &&
        state.paren === 0 &&
        !state.inTemplate &&
        trimmed.endsWith(';');

      if (kind === 'function' || kind === 'class' || kind === 'interface') {
        if (closedBlock || endedStatement) {
          endIdx = j;
          break;
        }
      } else if (
        (closedBlock && (trimmed.endsWith(';') || trimmed.endsWith('}'))) ||
        endedStatement
      ) {
        endIdx = j;
        break;
      }
      endIdx = j;
    }

    raw.push({
      name,
      exported,
      startLine: startIdx + 1,
      endLine: endIdx + 1,
      code: lines.slice(startIdx, endIdx + 1).join('\n'),
    });

    i = endIdx + 1;
  }

  const merged: TopLevelDecl[] = [];
  for (const decl of raw) {
    const prev = merged[merged.length - 1];
    if (prev && prev.name === decl.name && prev.exported === decl.exported) {
      merged[merged.length - 1] = {
        ...prev,
        endLine: decl.endLine,
        code: `${prev.code}\n${decl.code}`,
      };
    } else {
      merged.push(decl);
    }
  }

  return merged;
}

export function listExportedFunctions(source: string): readonly string[] {
  const decls = parseTopLevelDecls(source);
  return decls
    .filter(
      (d) =>
        d.exported &&
        /^(?:\/\*\*[\s\S]*?\*\/\s*)?export\s+(?:function|const|class)\s+/.test(d.code),
    )
    .map((d) => d.name);
}

export function extractSymbolSnippet(
  source: string,
  symbolName: string,
  extraSymbols: readonly string[] = [],
): ExtractedSnippet | null {
  const decls = parseTopLevelDecls(source);
  const byName = new Map<string, TopLevelDecl>();
  for (const d of decls) byName.set(d.name, d);

  const primary = byName.get(symbolName);
  if (!primary) return null;

  const included = new Map<string, TopLevelDecl>();
  const helpers: string[] = [];

  for (const extra of extraSymbols) {
    const found = byName.get(extra);
    if (found && found.name !== primary.name) {
      included.set(found.name, found);
      helpers.push(found.name);
    }
  }

  included.set(primary.name, primary);

  const queue: TopLevelDecl[] = [primary];
  let visited = 0;
  while (queue.length > 0 && visited < 12) {
    const current = queue.shift()!;
    visited++;

    const aliasMatch =
      /^export\s+const\s+[A-Za-z0-9_$]+(?::\s*typeof\s+([A-Za-z0-9_$]+))?\s*=\s*([A-Za-z0-9_$]+);$/.exec(
        current.code.trim(),
      );
    if (aliasMatch) {
      const targetName = aliasMatch[2]!;
      const targetDecl = byName.get(targetName);
      if (targetDecl && !included.has(targetDecl.name)) {
        included.set(targetDecl.name, targetDecl);
        helpers.push(targetDecl.name);
        queue.push(targetDecl);
      }
    }

    for (const candidate of decls) {
      if (candidate.exported || included.has(candidate.name)) continue;
      const identRe = new RegExp(`\\b${candidate.name}\\b`);
      if (identRe.test(current.code)) {
        included.set(candidate.name, candidate);
        helpers.push(candidate.name);
        queue.push(candidate);
      }
    }
  }

  const ordered = Array.from(included.values()).sort((a, b) => a.startLine - b.startLine);
  return {
    symbol: symbolName,
    startLine: primary.startLine,
    endLine: primary.endLine,
    code: ordered.map((d) => d.code).join('\n\n'),
    helpers,
  };
}
