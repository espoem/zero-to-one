import { defineConfig } from '@pandacss/dev'
import { acmePreset } from '../system/preset.ts'

/**
 * React app config (Modules 02, 09). Presets are explicit in v2: base (utilities,
 * conditions, patterns) + panda (default tokens, breakpoints) + our design language.
 * String specifiers and imported objects are both accepted.
 */
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', acmePreset],
  preflight: true,
  jsxFramework: 'react',
  // Only these props are style props on <Box>/<styled.*>; everything else goes through `css`.
  jsxStyleProps: 'all',
  // Reject raw values for token-backed properties at the type level (Module 05).
  strictTokens: true,
  // Reject values outside the keyword list of enumerable properties (display, position, …).
  strictPropertyValues: true,
  include: ['./src/**/*.{ts,tsx}'],
  exclude: [],
  outdir: 'styled-system',
})
