import pandacss from '@pandacss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  root: import.meta.dirname,
  logLevel: 'warn',
  plugins: [pandacss({ transform: process.env.PANDA_TRANSFORM === '1' })],
  build: { outDir: process.env.PANDA_OUT_DIR ?? 'dist', emptyOutDir: true },
})
