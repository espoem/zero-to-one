import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'
import { acmePreset } from '../system/preset.ts'

/**
 * Fixture config. Tests run `panda cssgen --cwd examples/fixtures --include <one file>`
 * and snapshot the CSS, so the output must be small and deterministic:
 * - no preflight (the reset is ~4 KB of noise for a snapshot);
 * - `optimize.removeUnusedTokens` / `removeUnusedKeyframes` keep only referenced variables.
 */
export default defineConfig({
  presets: [basePreset, pandaPreset, acmePreset],
  preflight: false,
  include: ['./positive/**/*.{ts,tsx}', './negative/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  jsxFramework: 'react',
  // Generated imports carry `.js` so Node can import the runtime directly in tests.
  forceImportExtension: true,
  optimize: {
    removeUnusedTokens: true,
    removeUnusedKeyframes: true,
  },
})
