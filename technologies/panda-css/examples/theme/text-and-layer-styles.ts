import {
  defineTextStyles,
  defineLayerStyles,
  defineKeyframes,
} from '@pandacss/dev'

/**
 * Text Styles: Composite typography definitions.
 *
 * Panda CSS Contract:
 * - Text styles bundle `fontFamily`, `fontSize`, `lineHeight`, `fontWeight`, and `letterSpacing`
 *   into a single utility property: `textStyle: 'heading.1'` or `textStyle: 'body.md'`.
 * - This prevents scattered typography utilities and ensures consistent vertical rhythm.
 */
export const textStyles = defineTextStyles({
  heading: {
    1: {
      description: 'Page title level 1',
      value: {
        fontFamily: 'heading',
        fontSize: { base: '2rem', md: '2.5rem' },
        lineHeight: '1.2',
        fontWeight: '700',
        letterSpacing: '-0.025em',
      },
    },
    2: {
      description: 'Section header level 2',
      value: {
        fontFamily: 'heading',
        fontSize: { base: '1.5rem', md: '1.875rem' },
        lineHeight: '1.25',
        fontWeight: '600',
        letterSpacing: '-0.02em',
      },
    },
    3: {
      description: 'Subsection header level 3',
      value: {
        fontFamily: 'heading',
        fontSize: '1.25rem',
        lineHeight: '1.3',
        fontWeight: '600',
        letterSpacing: '-0.015em',
      },
    },
  },
  body: {
    xs: {
      value: {
        fontFamily: 'sans',
        fontSize: '0.75rem',
        lineHeight: '1rem',
        fontWeight: '400',
      },
    },
    sm: {
      value: {
        fontFamily: 'sans',
        fontSize: '0.875rem',
        lineHeight: '1.25rem',
        fontWeight: '400',
      },
    },
    md: {
      value: {
        fontFamily: 'sans',
        fontSize: '1rem',
        lineHeight: '1.5rem',
        fontWeight: '400',
      },
    },
    lg: {
      value: {
        fontFamily: 'sans',
        fontSize: '1.125rem',
        lineHeight: '1.75rem',
        fontWeight: '400',
      },
    },
    xl: {
      value: {
        fontFamily: 'sans',
        fontSize: '1.25rem',
        lineHeight: '1.75rem',
        fontWeight: '400',
      },
    },
    '2xl': {
      value: {
        fontFamily: 'sans',
        fontSize: '1.5rem',
        lineHeight: '2rem',
        fontWeight: '500',
      },
    },
  },
  code: {
    value: {
      fontFamily: 'mono',
      fontSize: '0.875em',
      lineHeight: '1.4',
    },
  },
})

/**
 * Layer Styles: Composite box-model and visual surface treatments.
 *
 * Panda CSS Contract:
 * - Layer styles combine background, border, shadow, and color properties into one
 *   reusable preset applied via `layerStyle: 'card'` or `layerStyle: 'glass'`.
 * - They cleanly separate structural surface decisions from local layout concerns.
 */
export const layerStyles = defineLayerStyles({
  card: {
    description: 'Standard contained container surface',
    value: {
      backgroundColor: 'bg.surface',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border.default',
      borderRadius: 'lg',
      boxShadow: 'xs',
    },
  },
  elevated: {
    description: 'Elevated floating surface such as modals, popovers, or floating menus',
    value: {
      backgroundColor: 'bg.surface',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border.subtle',
      borderRadius: 'xl',
      boxShadow: 'lg',
    },
  },
  surfaceSubtle: {
    description: 'Toned down secondary container background',
    value: {
      backgroundColor: 'bg.subtle',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border.subtle',
      borderRadius: 'md',
    },
  },
  glass: {
    description: 'Translucent frosted glass layer with backdrop blur',
    value: {
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      _dark: {
        backgroundColor: 'rgba(9, 9, 11, 0.75)',
      },
      backdropFilter: 'blur(12px)',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border.subtle',
    },
  },
  interactive: {
    description: 'Surface with hover and focus-visible feedback',
    value: {
      backgroundColor: 'bg.surface',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border.default',
      _hover: {
        borderColor: 'border.accent',
        boxShadow: 'sm',
      },
      _focusVisible: {
        borderColor: 'border.accent',
        boxShadow: 'sm',
      },
    },
  },
})

/**
 * Keyframes: Reusable CSS animations generated into the `@layer tokens` stylesheet.
 */
export const keyframes = defineKeyframes({
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  slideDown: {
    '0%': { opacity: '0', transform: 'translateY(-8px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  pulseGlow: {
    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
    '50%': { opacity: '0.6', transform: 'scale(0.98)' },
  },
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
})
