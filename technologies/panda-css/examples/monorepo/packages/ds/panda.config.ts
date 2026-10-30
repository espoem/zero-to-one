import { defineConfig } from '@pandacss/dev'
import { acmePreset } from '../../../system/preset.ts'

// Module 11: a design-system package. `panda lib` writes dist/panda/{lib.json,preset.mjs,
// buildinfo.json} and syncs package.json exports for the generated styled-system.
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda', acmePreset],
  preflight: false,
  include: ['./src/**/*.{ts,tsx}'],
  outdir: 'styled-system',
  jsxFramework: 'react',
})
