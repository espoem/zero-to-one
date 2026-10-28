import { defineConfig } from '@pandacss/dev'
import { acmePreset } from '../system/preset.ts'

/**
 * Solid app config (Modules 02, 09). Same preset as React; only `jsxFramework` differs. Presets are explicit in v2: base (utilities,
 * conditions, patterns) + panda (default tokens, breakpoints) + our design language.
 * String specifiers and imported objects are both accepted.
 */
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', acmePreset],
  preflight: true,
  jsxFramework: 'solid',
  // Only these props are style props on <Box>/<styled.*>; everything else goes through `css`.
  jsxStyleProps: 'all',
  // Reject raw values for token-backed properties at the type level (Module 05).
  strictTokens: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
})
