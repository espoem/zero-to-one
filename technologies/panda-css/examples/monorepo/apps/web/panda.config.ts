import { defineConfig } from '@pandacss/dev'

// Module 11: an app consuming the design system. No preset, no importMap, no include of the
// package: `designSystem` loads its manifest, merges its preset and replays its build info.
export default defineConfig({
  designSystem: '@acme/ds',
  preflight: false,
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  theme: {
    extend: {
      tokens: { colors: { app: { value: '#0f766e' } } },
    },
  },
})
