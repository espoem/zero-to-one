import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'
import { acmePreset } from '../../system/preset.ts'

// Module 07: config recipes are JIT. With only a runtime-chosen `size` in source
// (negative/config-recipe-dynamic.ts), `staticCss` pre-generates the variants Panda cannot see,
// Observed in 2.4.0: a `'*'` staticCss rule still pulls in compounds involving that key,
// even with smartCompoundVariants on.
export default defineConfig({
  presets: [basePreset, pandaPreset, acmePreset],
  preflight: false,
  include: ['./negative/config-recipe-dynamic.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true, smartCompoundVariants: true },
  staticCss: {
    recipes: { button: [{ size: ['*'] }] },
  },
})
