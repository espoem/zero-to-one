import { For, createMemo, createSignal } from 'solid-js';
import { runLiveAuditSuite, type AuditCaseResult } from '../lib/live-audit.ts';

type AuditFilter = 'all' | AuditCaseResult['category'];

const AUDIT_FILTERS: readonly AuditFilter[] = [
  'all',
  'Defect Fix',
  'Algebraic Law',
  'ES2024 vs ES6 Parity',
  'Intentional Delta',
];

export function AuditLabView() {
  const [results, setResults] = createSignal<readonly AuditCaseResult[]>(runLiveAuditSuite());
  const [category, setCategory] = createSignal<AuditFilter>('all');

  const filtered = createMemo(() => {
    const cat = category();
    return cat === 'all' ? results() : results().filter((r) => r.category === cat);
  });

  const passedCount = createMemo(() => results().filter((r) => r.passed).length);

  return (
    <section>
      <div class="kpi-strip">
        <div class="kpi-card">
          <div class="kpi-label">Checks Passing</div>
          <div class="kpi-value" style={{ color: 'var(--es2024)' }}>
            {passedCount()} / {results().length}
          </div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Compiler Profiles</div>
          <div class="kpi-value">ES2024 + ES6</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">TypeScript Strict Flags</div>
          <div class="kpi-value">isolatedDecl</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Reference Defects Fixed</div>
          <div class="kpi-value">5 / 5</div>
        </div>
      </div>

      <div class="panel">
        <div
          style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            gap: '0.75rem',
            'flex-wrap': 'wrap',
            'margin-bottom': '0.9rem',
          }}
        >
          <div>
            <h1 style={{ margin: '0 0 0.2rem', 'font-size': '1.2rem' }}>
              Live Verification &amp; Defect Audit Lab
            </h1>
            <p style={{ margin: 0, 'font-size': '0.86rem', color: 'var(--text-muted)' }}>
              Executes live parity, algebraic law, and defect-fix checks directly in the browser
              against both internal library builds.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-primary"
            onClick={() => setResults(runLiveAuditSuite())}
          >
            Re-run All Checks
          </button>
        </div>

        <div class="filter-group" style={{ 'margin-bottom': '0.9rem' }}>
          <For each={AUDIT_FILTERS}>
            {(cat) => (
              <button
                type="button"
                class="chip"
                aria-pressed={category() === cat ? 'true' : 'false'}
                onClick={() => setCategory(cat)}
              >
                {cat === 'all' ? 'All Categories' : cat}
              </button>
            )}
          </For>
        </div>

        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '0.65rem' }}>
          <For each={filtered()}>
            {(item) => (
              <article
                style={{
                  border: '1px solid var(--border)',
                  'border-radius': '0.6rem',
                  padding: '0.75rem 0.9rem',
                  background: 'var(--surface-code)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    'justify-content': 'space-between',
                    'align-items': 'center',
                    gap: '0.5rem',
                    'flex-wrap': 'wrap',
                  }}
                >
                  <strong style={{ 'font-size': '0.92rem' }}>{item.title}</strong>
                  <div class="badge-row">
                    <span class="badge">{item.category}</span>
                    <span class={item.passed ? 'badge badge-es2024' : 'badge badge-danger'}>
                      {item.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                </div>
                <p
                  style={{
                    margin: '0.35rem 0',
                    'font-size': '0.84rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  {item.explanation}
                </p>
                <code style={{ 'font-size': '0.78rem' }}>{item.detail}</code>
              </article>
            )}
          </For>
        </div>
      </div>
    </section>
  );
}
