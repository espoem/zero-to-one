import { defineConfig } from '@pandacss/dev'
import base from './panda.config.ts'

// Baseline for the treeshake comparison: same sources, every design-system module hydrated.
export default defineConfig({ ...base, include: ['./src/ButtonOnly.tsx'] })
