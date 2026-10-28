import { defineSemanticTokens } from '@pandacss/dev'

/**
 * Semantic tokens: intent-named aliases whose value depends on a condition.
 * `base` is the default; `_dark` / `_osDark` are condition keys resolved at build time
 * into selector- or media-scoped redeclarations of the same CSS variable.
 */
export const semanticTokens = defineSemanticTokens({
  colors: {
    bg: {
      canvas: { value: { base: '{colors.white}', _dark: '{colors.ink.950}' } },
      subtle: { value: { base: '{colors.ink.100}', _dark: '{colors.ink.900}' } },
    },
    fg: {
      default: { value: { base: '{colors.ink.900}', _dark: '{colors.ink.50}' } },
      muted: { value: { base: '{colors.ink.700}', _dark: '{colors.ink.100}' } },
    },
    accent: {
      default: { value: { base: '{colors.brand.600}', _dark: '{colors.brand.500}' } },
      fg: { value: '{colors.white}' },
    },
  },
  spacing: {
    gutter: { value: { base: '{spacing.4}', md: '{spacing.6}' } },
  },
})
