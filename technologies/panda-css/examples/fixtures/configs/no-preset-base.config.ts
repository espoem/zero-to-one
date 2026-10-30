import { defineConfig } from '@pandacss/dev'
import pandaPreset from '@pandacss/preset-panda'

// NEGATIVE (Module 02, gotcha 1): v1 added @pandacss/preset-base implicitly; v2 adds nothing.
// Without it there are no utilities (`color`, `p`), no `_hover` and no breakpoints conditions.
export default defineConfig({
  presets: [pandaPreset],
  preflight: false,
  include: ['./configs/legacy-usage.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true },
})
