import { For, createEffect, createMemo, createSignal } from 'solid-js';
import { PLAYGROUND_PRESETS } from '../data/catalog.ts';
import { evaluateDual, type SingleEvalResult } from '../lib/dual-evaluator.ts';

function formatMeta(res: SingleEvalResult): string {
  return res.tag === 'ok' ? `${res.typeLabel} · ${res.durationUs.toFixed(0)}µs` : 'Runtime Error';
}

function formatBody(res: SingleEvalResult): string {
  return res.tag === 'ok' ? res.formatted : res.message;
}

interface PlaygroundViewProps {
  readonly initialCode: () => string | null;
}

export function PlaygroundView(props: PlaygroundViewProps) {
  const [code, setCode] = createSignal<string>(PLAYGROUND_PRESETS[0]!.code);
  const [runTick, setRunTick] = createSignal(0);

  createEffect(
    () => props.initialCode(),
    (incoming) => {
      if (incoming !== null) {
        setCode(incoming);
        setRunTick((n) => n + 1);
      }
    },
  );

  const report = createMemo(() => {
    runTick();
    return evaluateDual(code());
  });

  return (
    <section class="panel">
      <h1 style={{ margin: '0 0 0.25rem', 'font-size': '1.2rem' }}>
        Dual-Edition Interactive Playground (#strata/es2024 vs #strata/es6)
      </h1>
      <p style={{ margin: '0 0 0.85rem', 'font-size': '0.86rem', color: 'var(--text-muted)' }}>
        Every expression runs simultaneously against both internal libraries. All primitives plus{' '}
        <code>S</code>, <code>_</code>, <code>lodash</code>, <code>R</code>, and{' '}
        <code>EDITION</code> are in scope.
      </p>

      <div class="filter-group" style={{ 'margin-bottom': '0.85rem' }}>
        <For each={PLAYGROUND_PRESETS}>
          {(preset) => (
            <button
              type="button"
              class="chip"
              title={preset.description}
              onClick={() => {
                setCode(preset.code);
                setRunTick((n) => n + 1);
              }}
            >
              {preset.label}
            </button>
          )}
        </For>
      </div>

      <label for="playground-editor" class="sr-only">
        Playground code editor
      </label>
      <textarea
        id="playground-editor"
        class="editor-area"
        style={{ 'min-height': '11rem' }}
        value={code()}
        onInput={(e) => setCode(e.currentTarget.value)}
      />

      <div
        style={{
          display: 'flex',
          'align-items': 'center',
          'justify-content': 'space-between',
          'margin-block': '0.75rem',
        }}
      >
        <button type="button" class="btn btn-primary" onClick={() => setRunTick((n) => n + 1)}>
          Evaluate Both Editions
        </button>
        <span
          class={
            report().parity === 'identical'
              ? 'badge badge-es2024'
              : report().parity === 'delta'
                ? 'badge badge-es6'
                : 'badge badge-danger'
          }
        >
          Parity Verdict: {report().parity.toUpperCase()}
        </span>
      </div>

      <div class="compare-grid">
        <div class="code-card">
          <div class="code-card-head">
            <span class="badge badge-es2024">#strata/es2024</span>
            <span>{formatMeta(report().es2024)}</span>
          </div>
          <pre class="code-block">
            <code>{formatBody(report().es2024)}</code>
          </pre>
        </div>
        <div class="code-card">
          <div class="code-card-head">
            <span class="badge badge-es6">#strata/es6</span>
            <span>{formatMeta(report().es6)}</span>
          </div>
          <pre class="code-block">
            <code>{formatBody(report().es6)}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
