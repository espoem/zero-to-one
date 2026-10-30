import { defineConfig } from '@pandacss/dev'
import base from './panda.config.ts'

// Module 11: hydrate only the design-system modules the app actually imports.
export default defineConfig({ ...base, include: ['./src/ButtonOnly.tsx'], optimize: { treeshakeDesignSystem: true } })
