import { For, createMemo, createSignal } from 'solid-js';
import {
  columnFilteringFeature,
  constructTable,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFns,
  globalFilteringFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  type ColumnDef,
  type SortingState,
} from '@tanstack/table-core';
import { API_CATALOG, type CatalogEntry } from '../data/catalog.ts';

/**
 * Pure value-atom reactivity binding for TanStack Table v9 driven by SolidJS 2.0 `createMemo`.
 * Avoids writing to Solid signals inside owned computation scopes (`REACTIVE_WRITE_IN_OWNED_SCOPE`).
 */
const memoDrivenReactivity = {
  createOptionsStore: false,
  wrapExternalAtoms: false,
  addSubscription: () => (): void => {},
  unmount: (): void => {},
  batch: <T,>(fn: () => T): T => fn(),
  schedule: (fn: () => void): void => queueMicrotask(fn),
  untrack: <T,>(fn: () => T): T => fn(),
  createReadonlyAtom: <T,>(fn: () => T) => ({
    get: fn,
    subscribe: () => ({ unsubscribe: (): void => {} }),
  }),
  createWritableAtom: <T,>(initial: T) => {
    let current = initial;
    return {
      get: (): T => current,
      set: (updater: T | ((prev: T) => T)): void => {
        current = typeof updater === 'function' ? (updater as (p: T) => T)(current) : updater;
      },
      subscribe: () => ({ unsubscribe: (): void => {} }),
    };
  },
};

const matrixFeatures = tableFeatures({
  coreReactivityFeature: memoDrivenReactivity,
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortFns,
  filterFns,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
});

const columnHelper = createColumnHelper<typeof matrixFeatures, CatalogEntry>();

const COLUMNS: readonly ColumnDef<typeof matrixFeatures, CatalogEntry, unknown>[] = [
  columnHelper.accessor('name', {
    header: 'API Group',
  }),
  columnHelper.accessor('moduleLabel', {
    header: 'Domain',
  }),
  columnHelper.accessor('es2024Primitive', {
    header: 'ES2024 Implementation',
  }),
  columnHelper.accessor('es6Strategy', {
    header: 'ES6 (ES2015) Counterpart',
  }),
  columnHelper.accessor('safetyModel', {
    header: 'Type / Safety Guarantee',
  }),
  columnHelper.accessor('complexity', {
    header: 'Complexity',
  }),
] as readonly ColumnDef<typeof matrixFeatures, CatalogEntry, unknown>[];

export function ParityMatrixView() {
  const [sorting, setSorting] = createSignal<SortingState>([]);
  const [globalFilter, setGlobalFilter] = createSignal('');

  const table = createMemo(() => {
    const currentSorting = sorting();
    const currentFilter = globalFilter();
    return constructTable<typeof matrixFeatures, CatalogEntry>({
      features: matrixFeatures,
      data: API_CATALOG as CatalogEntry[],
      columns: COLUMNS,
      state: {
        sorting: currentSorting,
        globalFilter: currentFilter,
      },
      onSortingChange: (updater) => {
        setSorting((prev) => (typeof updater === 'function' ? updater(prev) : updater));
      },
      onGlobalFilterChange: (updater) => {
        setGlobalFilter((prev) => (typeof updater === 'function' ? updater(prev) : updater));
      },
    });
  });

  const rows = createMemo(() => table().getRowModel().rows);

  const toggleSort = (colId: string): void => {
    setSorting((prev) => {
      const existing = prev.find((s) => s.id === colId);
      if (!existing) return [{ id: colId, desc: false }];
      if (!existing.desc) return [{ id: colId, desc: true }];
      return [];
    });
  };

  const sortIndicator = (colId: string): string => {
    const found = sorting().find((s) => s.id === colId);
    if (!found) return '↕';
    return found.desc ? '↓' : '↑';
  };

  return (
    <section class="panel">
      <div
        style={{
          display: 'flex',
          'justify-content': 'space-between',
          'align-items': 'center',
          gap: '1rem',
          'flex-wrap': 'wrap',
          'margin-bottom': '0.9rem',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 0.25rem', 'font-size': '1.2rem' }}>
            ES2024 vs ES6 Parity Matrix (TanStack Table v9)
          </h1>
          <p style={{ margin: 0, 'font-size': '0.86rem', color: 'var(--text-muted)' }}>
            Sortable comparison of native ES2023/ES2024 primitives against their verified ES2015
            counterparts.
          </p>
        </div>
        <div style={{ width: 'min(320px, 100%)' }}>
          <label for="matrix-filter" class="sr-only">
            Filter parity matrix rows
          </label>
          <input
            id="matrix-filter"
            type="search"
            class="search-input"
            placeholder="Filter matrix (e.g. groupBy, Lens, ES2023)..."
            value={globalFilter()}
            onInput={(e) => setGlobalFilter(e.currentTarget.value)}
          />
        </div>
      </div>

      <div tabindex={0} role="region" aria-labelledby="parity-matrix-caption" class="table-wrapper">
        <table class="matrix-table">
          <caption id="parity-matrix-caption">
            Showing {rows().length} of {API_CATALOG.length} API groups backed by #strata/es2024 and
            #strata/es6
          </caption>
          <thead>
            <tr>
              <For each={table().getAllLeafColumns()}>
                {(col) => (
                  <th scope="col">
                    <button
                      type="button"
                      class="sort-btn"
                      onClick={() => toggleSort(col.id)}
                      aria-label={`Sort by ${String(col.columnDef.header)}`}
                    >
                      <span>{String(col.columnDef.header)}</span>
                      <span aria-hidden="true">{sortIndicator(col.id)}</span>
                    </button>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <tbody>
            <For each={rows()}>
              {(row) => {
                const item = row.original;
                return (
                  <tr>
                    <th scope="row">{item.name}</th>
                    <td data-label="Domain">{item.moduleLabel}</td>
                    <td data-label="ES2024 Implementation">
                      <span class="badge badge-es2024">{item.es2024Primitive}</span>
                    </td>
                    <td data-label="ES6 Counterpart">
                      <span class="badge badge-es6">{item.es6Strategy}</span>
                    </td>
                    <td data-label="Safety">{item.safetyModel}</td>
                    <td data-label="Complexity">
                      <code>{item.complexity}</code>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </div>
    </section>
  );
}
