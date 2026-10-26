import { defineSemanticTokens } from '@pandacss/dev'

/**
 * Semantic Tokens: Intent-driven design tokens mapped to underlying core tokens.
 *
 * Panda CSS Contract:
 * - Semantic tokens define values using conditions such as `{ base, _dark }`.
 * - Panda compiles these to conditional CSS custom properties that switch automatically
 *   when dark mode or a theme class (`.dark` or `[data-theme="dark"]`) is active.
 * - Components reference semantic paths (e.g. `bg: 'bg.surface'`, `color: 'fg.muted'`)
 *   so UI code remains agnostic to current light or dark modes.
 */
export const semanticTokens = defineSemanticTokens({
  colors: {
    bg: {
      canvas: {
        value: {
          base: '{colors.neutral.50}',
          _dark: '{colors.neutral.950}',
        },
      },
      surface: {
        value: {
          base: '#ffffff',
          _dark: '{colors.neutral.900}',
        },
      },
      subtle: {
        value: {
          base: '{colors.neutral.100}',
          _dark: '{colors.neutral.800}',
        },
      },
      muted: {
        value: {
          base: '{colors.neutral.200}',
          _dark: '{colors.neutral.700}',
        },
      },
      emphasized: {
        value: {
          base: '{colors.neutral.300}',
          _dark: '{colors.neutral.600}',
        },
      },
    },
    fg: {
      default: {
        value: {
          base: '{colors.neutral.900}',
          _dark: '{colors.neutral.50}',
        },
      },
      muted: {
        value: {
          base: '{colors.neutral.600}',
          _dark: '{colors.neutral.400}',
        },
      },
      subtle: {
        value: {
          base: '{colors.neutral.500}',
          _dark: '{colors.neutral.500}',
        },
      },
      onAccent: {
        value: {
          base: '#ffffff',
          _dark: '{colors.neutral.950}',
        },
      },
    },
    border: {
      default: {
        value: {
          base: '{colors.neutral.200}',
          _dark: '{colors.neutral.800}',
        },
      },
      subtle: {
        value: {
          base: '{colors.neutral.100}',
          _dark: '{colors.neutral.900}',
        },
      },
      accent: {
        value: {
          base: '{colors.brand.500}',
          _dark: '{colors.brand.400}',
        },
      },
    },
    status: {
      info: {
        bg: {
          value: {
            base: '{colors.info.50}',
            _dark: 'rgba(59, 130, 246, 0.15)',
          },
        },
        fg: {
          value: {
            base: '{colors.info.700}',
            _dark: '{colors.info.200}',
          },
        },
        border: {
          value: {
            base: '{colors.info.500}',
            _dark: '{colors.info.600}',
          },
        },
      },
      success: {
        bg: {
          value: {
            base: '{colors.success.50}',
            _dark: 'rgba(34, 197, 94, 0.15)',
          },
        },
        fg: {
          value: {
            base: '{colors.success.700}',
            _dark: '{colors.success.200}',
          },
        },
        border: {
          value: {
            base: '{colors.success.500}',
            _dark: '{colors.success.600}',
          },
        },
      },
      warning: {
        bg: {
          value: {
            base: '{colors.warning.50}',
            _dark: 'rgba(245, 158, 11, 0.15)',
          },
        },
        fg: {
          value: {
            base: '{colors.warning.700}',
            _dark: '{colors.warning.200}',
          },
        },
        border: {
          value: {
            base: '{colors.warning.500}',
            _dark: '{colors.warning.600}',
          },
        },
      },
      danger: {
        bg: {
          value: {
            base: '{colors.danger.50}',
            _dark: 'rgba(239, 68, 68, 0.15)',
          },
        },
        fg: {
          value: {
            base: '{colors.danger.700}',
            _dark: '{colors.danger.200}',
          },
        },
        border: {
          value: {
            base: '{colors.danger.500}',
            _dark: '{colors.danger.600}',
          },
        },
      },
    },
  },
})
