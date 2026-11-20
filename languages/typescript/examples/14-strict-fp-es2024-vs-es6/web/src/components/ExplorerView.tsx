import { For, Show, createMemo, createSignal } from 'solid-js';
import { writeClipboard } from '@solid-primitives/clipboard';
import {
  API_CATALOG,
  MODULE_META,
  MODULE_SOURCES,
  type CatalogEntry,
  type ModuleKey,
  type OriginKey,
} from '../data/catalog.ts';
import { evaluateDual, type SingleEvalResult } from '../lib/dual-evaluator.ts';
import {
  extractSymbolSnippet,
  listExportedFunctions,
  type ExtractedSnippet,
} from '../lib/source-extractor.ts';

function resultTypeLabel(res: SingleEvalResult): string {
  return res.tag === 'ok' ? res.typeLabel : 'Error';
}

function resultBody(res: SingleEvalResult): string {
  return res.tag === 'ok' ? res.formatted : res.message;
}

interface SnippetCardProps {
  readonly edition: 'es2024' | 'es6';
  readonly moduleName: string;
  readonly snippet: ExtractedSnippet | null;
  readonly copied: boolean;
  readonly fallbackComment: string;
  readonly onCopy: (code: string) => void;
}

function SnippetCard(props: SnippetCardProps) {
  const editionLabel = () => (props.edition === 'es2024' ? 'ES2024' : 'ES6');
  const badgeClass = () => (props.edition === 'es2024' ? 'badge badge-es2024' : 'badge badge-es6');

  return (
    <div class="code-card">
      <div class="code-card-head">
        <span class={badgeClass()}>
          {editionLabel()} · {props.moduleName}.ts
          {props.snippet ? `:L${props.snippet.startLine}–L${props.snippet.endLine}` : ''}
        </span>
        <div class="code-card-actions">
          <Show when={(props.snippet?.helpers.length ?? 0) > 0}>
            <span class="helper-list">+ {props.snippet!.helpers.join(', ')}</span>
          </Show>
          <Show when={props.snippet}>
            {(snip) => (
              <button
                type="button"
                class="btn btn-compact"
                onClick={() => props.onCopy(snip().code)}
              >
                {props.copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </Show>
        </div>
      </div>
      <pre class="code-block">
        <code>{props.snippet?.code ?? props.fallbackComment}</code>
      </pre>
    </div>
  );
}

interface ExplorerViewProps {
  readonly onOpenInPlayground: (code: string) => void;
}

type DetailTab = 'compare' | 'sandbox';

const ORIGIN_OPTIONS: readonly { readonly key: 'all' | OriginKey; readonly label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'core', label: 'Core ADT' },
  { key: 'underscore', label: 'Underscore' },
  { key: 'lodash', label: 'Lodash' },
  { key: 'ramda', label: 'Ramda' },
];

export function ExplorerView(props: ExplorerViewProps) {
  const [query, setQuery] = createSignal('');
  const [moduleFilter, setModuleFilter] = createSignal<'all' | ModuleKey>('all');
  const [originFilter, setOriginFilter] = createSignal<'all' | OriginKey>('all');
  const [selectedId, setSelectedId] = createSignal<string>(API_CATALOG[0]!.id);
  const [selectedSymbol, setSelectedSymbol] = createSignal<string>(API_CATALOG[0]!.symbols[0]!);
  const [activeTab, setActiveTab] = createSignal<DetailTab>('compare');
  const [draftCode, setDraftCode] = createSignal<string>(API_CATALOG[0]!.example);
  const [runCounter, setRunCounter] = createSignal(0);
  const [copiedEdition, setCopiedEdition] = createSignal<'es2024' | 'es6' | null>(null);

  const filtered = createMemo(() => {
    const q = query().trim().toLowerCase();
    const mod = moduleFilter();
    const orig = originFilter();
    return API_CATALOG.filter((entry) => {
      if (mod !== 'all' && entry.module !== mod) return false;
      if (orig !== 'all' && !entry.origins.includes(orig)) return false;
      if (q.length === 0) return true;
      const hay = [
        entry.name,
        entry.summary,
        entry.es2024Primitive,
        entry.es6Strategy,
        entry.symbols.join(' '),
        entry.aliases.underscore ?? '',
        entry.aliases.lodash ?? '',
        entry.aliases.ramda ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  });

  const activeEntry = createMemo<CatalogEntry | undefined>(() => {
    const list = filtered();
    return list.find((e) => e.id === selectedId()) ?? list[0];
  });

  const activeSourcePair = createMemo(() => {
    const entry = activeEntry();
    if (!entry) return undefined;
    return MODULE_SOURCES.find((m) => m.key === entry.module);
  });

  const allModuleSymbols = createMemo<readonly string[]>(() => {
    const pair = activeSourcePair();
    if (!pair) return [];
    const seen = new Set<string>([
      ...listExportedFunctions(pair.es2024),
      ...listExportedFunctions(pair.es6),
    ]);
    return Array.from(seen);
  });

  const currentSymbol = createMemo<string>(() => {
    const entry = activeEntry();
    if (!entry) return '';
    const chosen = selectedSymbol();
    const available = allModuleSymbols();
    if (available.includes(chosen)) return chosen;
    return entry.symbols[0] ?? available[0] ?? '';
  });

  const extractedPair = createMemo(() => {
    const pair = activeSourcePair();
    const entry = activeEntry();
    const sym = currentSymbol();
    if (!pair || !entry || !sym) return { es2024: null, es6: null };
    const extras = entry.companionTypes?.[sym] ?? [];
    return {
      es2024: extractSymbolSnippet(pair.es2024, sym, extras),
      es6: extractSymbolSnippet(pair.es6, sym, extras),
    };
  });

  const dualResult = createMemo(() => {
    runCounter();
    return evaluateDual(draftCode());
  });

  const handleSelect = (entry: CatalogEntry): void => {
    setSelectedId(entry.id);
    setSelectedSymbol(entry.symbols[0] ?? '');
    setDraftCode(entry.example);
    setRunCounter((n) => n + 1);
  };

  const handleCopySnippet = async (edition: 'es2024' | 'es6', code: string): Promise<void> => {
    try {
      await writeClipboard(code);
      setCopiedEdition(edition);
      setTimeout(() => setCopiedEdition(null), 1500);
    } catch {
      // Clipboard unavailable in headless environments
    }
  };

  return (
    <div class="explorer-grid">
      <aside class="panel sidebar" aria-label="API catalog filters">
        <div>
          <label for="api-search" class="sr-only">
            Search APIs, functions, or aliases
          </label>
          <input
            id="api-search"
            type="search"
            class="search-input"
            placeholder="Search functions, ES2024/ES6, aliases..."
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />
        </div>

        <div>
          <div
            style={{
              'font-size': '0.75rem',
              color: 'var(--text-muted)',
              'margin-bottom': '0.35rem',
            }}
          >
            Origin Facade
          </div>
          <div class="filter-group">
            <For each={ORIGIN_OPTIONS}>
              {(opt) => (
                <button
                  type="button"
                  class="chip"
                  aria-pressed={originFilter() === opt.key ? 'true' : 'false'}
                  onClick={() => setOriginFilter(opt.key)}
                >
                  {opt.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div>
          <div
            style={{
              'font-size': '0.75rem',
              color: 'var(--text-muted)',
              'margin-bottom': '0.35rem',
            }}
          >
            Domain Module
          </div>
          <div class="filter-group">
            <button
              type="button"
              class="chip"
              aria-pressed={moduleFilter() === 'all' ? 'true' : 'false'}
              onClick={() => setModuleFilter('all')}
            >
              All ({API_CATALOG.length})
            </button>
            <For each={MODULE_META}>
              {(mod) => (
                <button
                  type="button"
                  class="chip"
                  aria-pressed={moduleFilter() === mod.key ? 'true' : 'false'}
                  onClick={() => setModuleFilter(mod.key)}
                >
                  {mod.label}
                </button>
              )}
            </For>
          </div>
        </div>

        <div class="api-list" role="region" aria-label="Matching APIs">
          <For each={filtered()}>
            {(entry) => (
              <button
                type="button"
                class="api-item"
                aria-current={activeEntry()?.id === entry.id ? 'true' : undefined}
                onClick={() => handleSelect(entry)}
              >
                <span class="api-item-title">{entry.name}</span>
                <span class="api-item-meta">
                  {entry.moduleLabel} · {entry.complexity}
                </span>
              </button>
            )}
          </For>
        </div>
      </aside>

      <section class="panel" aria-live="polite">
        <Show
          when={activeEntry()}
          fallback={<p style={{ color: 'var(--text-muted)' }}>No matching API entries.</p>}
        >
          {(entry) => (
            <div>
              <div
                style={{
                  display: 'flex',
                  'justify-content': 'space-between',
                  'align-items': 'flex-start',
                  gap: '1rem',
                  'flex-wrap': 'wrap',
                }}
              >
                <div>
                  <h1
                    style={{
                      margin: '0 0 0.35rem',
                      'font-size': '1.25rem',
                      'font-family': 'var(--font-mono)',
                    }}
                  >
                    {entry().name}
                  </h1>
                  <p style={{ margin: 0, color: 'var(--text-muted)', 'font-size': '0.9rem' }}>
                    {entry().summary}
                  </p>
                </div>
                <button
                  type="button"
                  class="btn btn-primary"
                  onClick={() => props.onOpenInPlayground(draftCode())}
                >
                  Open in Playground
                </button>
              </div>

              <div class="badge-row" style={{ 'margin-top': '0.75rem' }}>
                <span class="badge">{entry().moduleLabel}</span>
                <span class="badge">{entry().complexity}</span>
                <span class="badge">{entry().safetyModel}</span>
                <Show when={entry().aliases.underscore}>
                  {(a) => <span class="badge">Underscore: {a()}</span>}
                </Show>
                <Show when={entry().aliases.lodash}>
                  {(a) => <span class="badge">Lodash: {a()}</span>}
                </Show>
                <Show when={entry().aliases.ramda}>
                  {(a) => <span class="badge">Ramda: {a()}</span>}
                </Show>
              </div>

              <div class="delta-callout">
                <strong>ES2024 vs ES6 Teaching Delta:</strong> {entry().deltaNote}
              </div>

              <div class="tablist" role="tablist" aria-label="Inspection mode">
                <button
                  type="button"
                  role="tab"
                  id="tab-compare"
                  class="tab-btn"
                  aria-selected={activeTab() === 'compare' ? 'true' : 'false'}
                  onClick={() => setActiveTab('compare')}
                >
                  Exact Function Implementation (ES2024 vs ES6)
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-sandbox"
                  class="tab-btn"
                  aria-selected={activeTab() === 'sandbox' ? 'true' : 'false'}
                  onClick={() => setActiveTab('sandbox')}
                >
                  Live Dual Sandbox
                </button>
              </div>

              <div role="tabpanel" aria-labelledby="tab-compare" hidden={activeTab() !== 'compare'}>
                <div class="symbol-toolbar">
                  <div class="filter-group" aria-label="Featured symbols in group">
                    <For each={entry().symbols}>
                      {(sym) => (
                        <button
                          type="button"
                          class="chip chip-mono"
                          aria-pressed={currentSymbol() === sym ? 'true' : 'false'}
                          onClick={() => setSelectedSymbol(sym)}
                        >
                          {sym}
                        </button>
                      )}
                    </For>
                  </div>

                  <label class="symbol-select-label">
                    <span>Any symbol in {entry().module}.ts:</span>
                    <select
                      class="symbol-select"
                      aria-label={`Select exported symbol in ${entry().module}.ts`}
                      value={currentSymbol()}
                      onChange={(e) => setSelectedSymbol(e.currentTarget.value)}
                    >
                      <For each={allModuleSymbols()}>
                        {(sym) => <option value={sym}>{sym}</option>}
                      </For>
                    </select>
                  </label>
                </div>

                <div class="compare-grid">
                  <SnippetCard
                    edition="es2024"
                    moduleName={entry().module}
                    snippet={extractedPair().es2024}
                    copied={copiedEdition() === 'es2024'}
                    fallbackComment={`// Symbol \`${currentSymbol()}\` is ES6-only (e.g. usingResource for try/finally disposal).`}
                    onCopy={(code) => handleCopySnippet('es2024', code)}
                  />
                  <SnippetCard
                    edition="es6"
                    moduleName={entry().module}
                    snippet={extractedPair().es6}
                    copied={copiedEdition() === 'es6'}
                    fallbackComment={`// Symbol \`${currentSymbol()}\` is ES2024-only (e.g. BigInt guard not present in ES2015).`}
                    onCopy={(code) => handleCopySnippet('es6', code)}
                  />
                </div>
              </div>

              <div role="tabpanel" aria-labelledby="tab-sandbox" hidden={activeTab() !== 'sandbox'}>
                <label for="explorer-sandbox-code" class="sr-only">
                  Editable dual-edition code snippet
                </label>
                <textarea
                  id="explorer-sandbox-code"
                  class="editor-area"
                  value={draftCode()}
                  onInput={(e) => setDraftCode(e.currentTarget.value)}
                />
                <div
                  style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                    'margin-block': '0.65rem',
                  }}
                >
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => setRunCounter((n) => n + 1)}
                  >
                    Run on ES2024 &amp; ES6
                  </button>
                  <span
                    class={
                      dualResult().parity === 'identical'
                        ? 'badge badge-es2024'
                        : dualResult().parity === 'delta'
                          ? 'badge badge-es6'
                          : 'badge badge-danger'
                    }
                  >
                    Parity: {dualResult().parity.toUpperCase()}
                  </span>
                </div>
                <div class="compare-grid">
                  <div class="code-card">
                    <div class="code-card-head">
                      <span class="badge badge-es2024">ES2024 Output</span>
                      <span>{resultTypeLabel(dualResult().es2024)}</span>
                    </div>
                    <pre class="code-block">
                      <code>{resultBody(dualResult().es2024)}</code>
                    </pre>
                  </div>
                  <div class="code-card">
                    <div class="code-card-head">
                      <span class="badge badge-es6">ES6 Output</span>
                      <span>{resultTypeLabel(dualResult().es6)}</span>
                    </div>
                    <pre class="code-block">
                      <code>{resultBody(dualResult().es6)}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Show>
      </section>
    </div>
  );
}
