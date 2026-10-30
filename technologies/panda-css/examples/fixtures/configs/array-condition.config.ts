import { defineConfig } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'

// Module 03 (Then vs now): v1 array condition definitions still work in v2 but warn
// (`config_condition_array_unsupported`). The v2 form nests each rule and ends with '@slot'.
export default defineConfig({
  presets: [basePreset, pandaPreset],
  preflight: false,
  include: ['./configs/array-condition-usage.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true },
  conditions: {
    extend: {
      // @ts-expect-error -- deprecated array form, kept to prove the warning and conversion
      hoverV1: ['@media (hover: hover)', '&:hover'],
      hoverV2: { '@media (hover: hover)': { '&:hover': '@slot' } },
    },
  },
})
