import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Builds the production React fixtures served by `vite preview` for Playwright.
const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  build: { outDir: '.generated/dist', emptyOutDir: true },
});
