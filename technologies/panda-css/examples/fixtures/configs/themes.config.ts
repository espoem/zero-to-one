import { defineConfig, defineThemeContract } from '@pandacss/dev'
import basePreset from '@pandacss/preset-base'
import pandaPreset from '@pandacss/preset-panda'
import { acmePreset } from '../../system/preset.ts'

// Module 06: multi-brand theming. A theme overrides semantic tokens behind
// `data-panda-theme="<name>"`; dark mode composes with it. `defineThemeContract` makes a
// theme that forgets a token a type error instead of a silent fallback.
const defineTheme = defineThemeContract({
  semanticTokens: { colors: { accent: { default: { value: { base: '', _dark: '' } } } } },
})

// Type-level negative test: a theme that omits the contracted token does not compile.
// @ts-expect-error -- missing colors.accent.default
export const brokenTheme = defineTheme({ semanticTokens: { colors: {} } })

export default defineConfig({
  presets: [basePreset, pandaPreset, acmePreset],
  preflight: false,
  include: ['./configs/themes-usage.ts'],
  outdir: 'styled-system-themes',
  forceImportExtension: true,
  optimize: { removeUnusedTokens: true, removeUnusedKeyframes: true },
  themes: {
    forest: defineTheme({
      semanticTokens: {
        colors: { accent: { default: { value: { base: '{colors.green.700}', _dark: '{colors.green.300}' } } } },
      },
    }),
    contrast: defineTheme({
      semanticTokens: { colors: { accent: { default: { value: { base: '{colors.black}', _dark: '{colors.white}' } } } } },
    }),
  },
  // Ship `forest` in the main stylesheet; `contrast` stays on-demand via styled-system/themes.
  staticCss: { themes: ['forest'] },
})
