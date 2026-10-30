import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'

// NEGATIVE (Module 10/12): the v1 root `hooks` object is an error in v2 (config_hooks_removed).
export default defineConfig({
  presets: [basePreset],
  include: ['./configs/legacy-usage.ts'],
  outdir: 'styled-system',
  // Still type-checks (the config type is open-ended); only the compiler rejects it.
  hooks: { 'config:resolved': () => {} },
})
