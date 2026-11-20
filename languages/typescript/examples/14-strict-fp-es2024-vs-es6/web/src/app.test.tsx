import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { flush, resetErrorHalt } from 'solid-js';
import { App } from './App.tsx';
import { API_CATALOG, MODULE_SOURCES } from './data/catalog.ts';
import { evaluateDual } from './lib/dual-evaluator.ts';
import { runLiveAuditSuite } from './lib/live-audit.ts';
import {
  extractSymbolSnippet,
  listExportedFunctions,
  parseTopLevelDecls,
} from './lib/source-extractor.ts';

// Minimal jsdom polyfills for matchMedia & HTMLDialogElement modal methods
if (typeof window !== 'undefined') {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}

afterEach(() => {
  cleanup();
  resetErrorHalt();
  localStorage.clear();
});

describe('Strata FP SolidJS 2.x Learning Lab', () => {
  it('evaluates expressions across both #strata/es2024 and #strata/es6 with parity detection', () => {
    const identical = evaluateDual("groupBy(['ant', 'ape', 'bear'], (w) => w[0])");
    expect(identical.parity).toBe('identical');
    expect(identical.es2024.tag).toBe('ok');
    expect(identical.es6.tag).toBe('ok');

    const delta = evaluateDual("words('ΑλφαΒητα 42')");
    expect(delta.parity).toBe('delta');
    expect(delta.es2024.tag).toBe('ok');
    expect(delta.es6.tag).toBe('ok');
  });

  it('passes every check in the live in-browser verification & defect audit suite', () => {
    const results = runLiveAuditSuite();
    expect(results.length).toBeGreaterThanOrEqual(10);
    for (const item of results) {
      expect(item.passed, `${item.id}: ${item.detail}`).toBe(true);
    }
  });

  it('extracts exact focused ES2024 vs ES6 function snippets with line spans and private helpers', () => {
    const arraySrc = MODULE_SOURCES.find((m) => m.key === 'array')!;
    const g24 = extractSymbolSnippet(arraySrc.es2024, 'groupBy');
    const g6 = extractSymbolSnippet(arraySrc.es6, 'groupBy', ['groupByMap']);
    expect(g24?.code).toContain('Object.groupBy');
    expect(g24?.code).not.toContain('export function sortBy');
    expect(g6?.code).toContain('new Map<K, T[]>()');
    expect(g6?.startLine).toBeGreaterThan(0);

    const coreSrc = MODULE_SOURCES.find((m) => m.key === 'core')!;
    const eq24 = extractSymbolSnippet(coreSrc.es2024, 'isEqual');
    expect(eq24?.code).toContain('function equalInternal');
    expect(eq24?.helpers).toContain('equalInternal');

    const stringSrc = MODULE_SOURCES.find((m) => m.key === 'string')!;
    const pad6 = extractSymbolSnippet(stringSrc.es6, 'padStart');
    expect(pad6?.code).toContain('function buildRepeatPad');
    const esc24 = extractSymbolSnippet(stringSrc.es2024, 'escapeHtml');
    expect(esc24?.code).toContain('HTML_ESCAPE_MAP');
    expect(esc24?.code).not.toContain('export function unescapeHtml');
    const tpl24 = extractSymbolSnippet(stringSrc.es2024, 'template');
    expect(tpl24?.code).toContain('Object.hasOwn');

    const objectSrc = MODULE_SOURCES.find((m) => m.key === 'object')!;
    const toPath24 = extractSymbolSnippet(objectSrc.es2024, 'toPath');
    expect(toPath24?.code).toContain('export function toPath');
    expect(toPath24?.code).not.toContain('export function getPath');

    for (const mod of MODULE_SOURCES) {
      for (const edition of [mod.es2024, mod.es6]) {
        const decls = parseTopLevelDecls(edition);
        expect(decls.length).toBeGreaterThan(10);
        for (const decl of decls) {
          const innerExports = decl.code
            .split('\n')
            .slice(1)
            .filter((line) => {
              const m =
                /^export\s+(?:function|const|type|interface|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(
                  line,
                );
              return m !== null && m[1] !== decl.name;
            });
          expect(innerExports, `${mod.filename} ${decl.name}`).toEqual([]);
        }
      }
    }

    for (const entry of API_CATALOG) {
      const mod = MODULE_SOURCES.find((m) => m.key === entry.module)!;
      for (const sym of entry.symbols) {
        const extras = entry.companionTypes?.[sym] ?? [];
        const s24 = extractSymbolSnippet(mod.es2024, sym, extras);
        const s6 = extractSymbolSnippet(mod.es6, sym, extras);
        expect(s24, `ES2024 ${entry.module}.${sym}`).not.toBeNull();
        expect(s6, `ES6 ${entry.module}.${sym}`).not.toBeNull();
      }
    }

    expect(listExportedFunctions(arraySrc.es2024).length).toBeGreaterThan(40);
  });

  it('renders the SolidJS 2.0 Explorer with exact function snippets, TanStack Parity Matrix, Dual Playground, and Verification Lab', () => {
    const { getByRole, getByText, queryByText } = render(() => <App />);
    flush();

    expect(getByText('Strata FP Lab')).toBeTruthy();
    expect(getByText('Exact Function Implementation (ES2024 vs ES6)')).toBeTruthy();
    expect(queryByText(/Full Module Source/i)).toBeNull();

    fireEvent.click(getByRole('button', { name: 'tryResult' }));
    flush();
    expect(getByText(/ES2024 · core\.ts:L/)).toBeTruthy();
    expect(getByText(/ES6 · core\.ts:L/)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Parity Matrix' }));
    flush();
    expect(getByText(/ES2024 vs ES6 Parity Matrix/i)).toBeTruthy();
    expect(getByText('groupBy / groupByMap')).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Dual Playground' }));
    flush();
    expect(getByText(/Dual-Edition Interactive Playground/i)).toBeTruthy();

    fireEvent.click(getByRole('button', { name: 'Verification Lab' }));
    flush();
    expect(getByText(/Live Verification & Defect Audit Lab/i)).toBeTruthy();
  });
});
