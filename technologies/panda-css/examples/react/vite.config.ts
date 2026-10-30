import pandacss from '@pandacss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `pandacss()` goes before the framework plugin: it runs codegen, replaces the CSS file that
// declares the layer order with the generated stylesheet, and keeps both fresh in dev.
// PANDA_TRANSFORM=1 turns on source transforms (Module 01, Module 10).
export default defineConfig({
  root: import.meta.dirname,
  logLevel: 'warn',
  plugins: [pandacss({ transform: process.env.PANDA_TRANSFORM === '1' }), react()],
  build: { outDir: process.env.PANDA_OUT_DIR ?? 'dist', emptyOutDir: true },
})
