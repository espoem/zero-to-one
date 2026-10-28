import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'

// NEGATIVE (Module 05, gotcha 14): a theme key without `extend` replaces only that entry,
// except `breakpoints`, which replaces the whole set. `md` is gone, so `md:` styles vanish.
export default defineConfig({
  presets: [basePreset, pandaPreset],
  preflight: false,
  include: ['./configs/legacy-usage.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true },
  theme: {
    breakpoints: { sm: '30rem' },
  },
})
