import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'
import { acmePreset } from '../../system/preset.ts'

// Module 07: once a config recipe is used, Panda emits EVERY compound variant of it by default.
// `optimize.smartCompoundVariants` emits only compounds matching extracted combinations.
export default defineConfig({
  presets: [basePreset, pandaPreset, acmePreset],
  preflight: false,
  include: ['./negative/config-recipe-dynamic.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true, smartCompoundVariants: true },
})
