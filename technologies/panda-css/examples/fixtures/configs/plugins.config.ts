import { defineConfig, definePlugin } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'
import { writeFileSync } from 'node:fs'

// Module 10: v2 plugins. Hooks live on named plugin objects in `plugins`, not on a root `hooks`.
// - config:resolved removes a built-in pattern (the documented way to remove preset entries)
// - parser:before (with a Rust-evaluated filter) rewrites source before Oxc parses it
// - codegen:prepare can rewrite generated artifacts; cssgen:done only observes the CSS
const report = definePlugin({
  name: 'report',
  hooks: {
    'config:resolved': ({ config, utils }) => utils.omit(config, ['patterns.spacer']),
    'parser:before': {
      filter: { id: /plugins-usage\.ts$/ },
      // Expand a home-grown shorthand `tone: 'x'` into a real Panda property before parsing.
      handler: ({ content }) => content.replaceAll("tone: 'alarm'", "color: 'red.700'"),
    },
    'cssgen:done': ({ content }) => {
      if (process.env.PANDA_PLUGIN_REPORT) writeFileSync(process.env.PANDA_PLUGIN_REPORT, String(content.length))
    },
  },
})

export default defineConfig({
  presets: [basePreset, pandaPreset],
  preflight: false,
  include: ['./configs/plugins-usage.ts'],
  outdir: 'styled-system',
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true },
  plugins: [report],
})
