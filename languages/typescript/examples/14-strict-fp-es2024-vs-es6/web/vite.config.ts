import { resolve } from 'node:path';
import solid from '@solidjs/vite-plugin';
import { defineConfig } from 'vite';

const libRoot = resolve(import.meta.dirname, '../lib');

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: [
      { find: /^#strata\/es2024$/, replacement: resolve(libRoot, 'es2024/index.ts') },
      { find: /^#strata\/es2024\/(.+)$/, replacement: `${resolve(libRoot, 'es2024')}/$1.ts` },
      { find: /^#strata\/es6$/, replacement: resolve(libRoot, 'es6/index.ts') },
      { find: /^#strata\/es6\/(.+)$/, replacement: `${resolve(libRoot, 'es6')}/$1.ts` },
    ],
  },
  server: {
    fs: {
      allow: [resolve(import.meta.dirname, '..')],
    },
  },
  build: {
    target: 'esnext',
  },
});
