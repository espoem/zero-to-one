import { For, Match, Switch, createEffect, createMemo, createSignal } from 'solid-js';
import { usePrefersDark } from '@solid-primitives/media';
import { makePersisted, storageSync } from '@solid-primitives/storage';
import { AuditLabView } from './components/AuditLabView.tsx';
import { ExplorerView } from './components/ExplorerView.tsx';
import { ImportGuideDialog } from './components/ImportGuideDialog.tsx';
import { ParityMatrixView } from './components/ParityMatrixView.tsx';
import { PlaygroundView } from './components/PlaygroundView.tsx';

type RouteKey = 'explorer' | 'matrix' | 'playground' | 'audit';
type StoredScheme = '' | 'light' | 'dark';

const NAV_ITEMS: readonly { readonly key: RouteKey; readonly label: string }[] = [
  { key: 'explorer', label: 'ES2024 vs ES6 Explorer' },
  { key: 'matrix', label: 'Parity Matrix' },
  { key: 'playground', label: 'Dual Playground' },
  { key: 'audit', label: 'Verification Lab' },
];

export function App() {
  const [route, setRoute] = createSignal<RouteKey>('explorer');
  const [playgroundCode, setPlaygroundCode] = createSignal<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = createSignal(false);

  const prefersDark = usePrefersDark();
  const [storedScheme, setStoredScheme] = makePersisted(createSignal<StoredScheme>(''), {
    name: 'strata-color-scheme',
    sync: storageSync,
    serialize: (val) => val,
    deserialize: (raw) => (raw === 'light' || raw === 'dark' ? raw : ''),
  });

  const effectiveDark = createMemo(() => {
    const override = storedScheme();
    if (override === 'dark') return true;
    if (override === 'light') return false;
    return prefersDark();
  });

  createEffect(
    () => storedScheme(),
    (override) => {
      const meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) {
        meta.setAttribute('content', override === '' ? 'light dark' : override);
      }
    },
  );

  // Check divergence only on toggle so a pinned scheme survives OS auto-switches.
  const handleToggleScheme = (): void => {
    const target: 'light' | 'dark' = effectiveDark() ? 'light' : 'dark';
    const system: 'light' | 'dark' = prefersDark() ? 'dark' : 'light';
    setStoredScheme(target === system ? '' : target);
  };

  const handleOpenInPlayground = (code: string): void => {
    setPlaygroundCode(code);
    setRoute('playground');
  };

  return (
    <div class="app-shell">
      <header class="topbar">
        <button type="button" class="brand" onClick={() => setRoute('explorer')}>
          <span>Strata FP Lab</span>
          <span class="brand-pill">ES2024 ↔ ES6</span>
        </button>

        <nav class="primary-nav" aria-label="Primary navigation">
          <For each={NAV_ITEMS}>
            {(item) => (
              <button
                type="button"
                class="nav-btn"
                aria-current={route() === item.key ? 'page' : undefined}
                onClick={() => setRoute(item.key)}
              >
                {item.label}
              </button>
            )}
          </For>
        </nav>

        <div class="topbar-actions">
          <button
            type="button"
            class="btn"
            onClick={handleToggleScheme}
            aria-label={effectiveDark() ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {effectiveDark() ? 'Light theme' : 'Dark theme'}
          </button>
          <button type="button" class="btn btn-primary" onClick={() => setImportDialogOpen(true)}>
            #strata Imports
          </button>
        </div>
      </header>

      <main class="main-content">
        <Switch>
          <Match when={route() === 'explorer'}>
            <ExplorerView onOpenInPlayground={handleOpenInPlayground} />
          </Match>
          <Match when={route() === 'matrix'}>
            <ParityMatrixView />
          </Match>
          <Match when={route() === 'playground'}>
            <PlaygroundView initialCode={playgroundCode} />
          </Match>
          <Match when={route() === 'audit'}>
            <AuditLabView />
          </Match>
        </Switch>
      </main>

      <ImportGuideDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
    </div>
  );
}
