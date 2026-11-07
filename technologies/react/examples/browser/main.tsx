/** Mounts one fixture, chosen by `?page=`, so every spec starts from a fresh document. */
import { createRoot } from 'react-dom/client';
import type { ComponentType } from 'react';

const pages: Record<string, () => Promise<{ default: ComponentType }>> = {
  'view-transitions': () => import('./pages/view-transitions.tsx'),
  'fragment-refs': () => import('./pages/fragment-refs.tsx'),
  stylesheets: () => import('./pages/stylesheets.tsx'),
  'trusted-types': () => import('./pages/trusted-types.tsx'),
  'hung-action': () => import('./pages/hung-action.tsx'),
};

const name = new URLSearchParams(location.search).get('page') ?? '';
const load = pages[name];
if (!load) throw new Error(`Unknown fixture page: ${name}`);
const { default: Page } = await load();
createRoot(document.getElementById('root')!).render(<Page />);
