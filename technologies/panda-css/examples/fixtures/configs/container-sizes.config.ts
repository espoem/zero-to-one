import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'

// NEGATIVE (Module 04, gotcha 3): `theme.containerSizes` is the v1 key. v2 ignores it
// silently, so `@card/wide` has no threshold and emits no @container rule.
export default defineConfig({
  presets: [basePreset, pandaPreset],
  preflight: false,
  include: ['./configs/legacy-usage.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true },
  theme: {
    extend: {
      // Removed in v2, yet it still type-checks: the theme type is open-ended, so neither
      // tsc nor the compiler catches it. Only the missing @container rule tells you.
      containerSizes: { wide: '40rem' },
      containerNames: ['card'],
    },
  },
})
