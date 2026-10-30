import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'

// Module 05 (gotcha 9): browsers without @property (Safari < 16.4, Firefox < 128) drop
// utilities that rely on registered initial values. `optimize.propertyFallback` also emits
// the initial values as plain declarations.
export default defineConfig({
  presets: [basePreset, pandaPreset],
  preflight: false,
  include: ['./positive/05-property-registration.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true, propertyFallback: true },
})
