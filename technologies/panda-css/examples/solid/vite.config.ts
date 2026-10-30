import pandacss from '@pandacss/vite'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  root: import.meta.dirname,
  logLevel: 'warn',
  plugins: [pandacss({ transform: process.env.PANDA_TRANSFORM === '1' }), solid()],
  build: {
    outDir: process.env.PANDA_OUT_DIR ?? 'dist',
    emptyOutDir: true,
    // Panda 2.4.0's Solid codegen writes `/* @__PURE__ */ function X() {}`, a position
    // Rolldown (Vite 8) ignores and warns about. The warning is cosmetic: the annotation
    // only matters for tree-shaking unused components.
    rolldownOptions: { checks: { invalidAnnotation: false } },
  },
})
