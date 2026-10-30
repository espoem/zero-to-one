import { defineConfig } from '@pandacss/dev'

// NEGATIVE (Module 11): a design system must not be scanned through `include`.
export default defineConfig({
  designSystem: '@acme/ds',
  preflight: false,
  include: ['./src/**/*.{ts,tsx}', '@acme/ds'],
  outdir: 'styled-system',
})
