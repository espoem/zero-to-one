import { defineRecipe } from '@pandacss/dev'

/**
 * Badge Config Recipe: Defined in config and emitted into the `@layer recipes` stylesheet.
 *
 * HOW colorPalette WORKS:
 * Instead of generating separate variants for every brand color (e.g. `visual: 'solid-blue'`,
 * `visual: 'solid-green'`, `visual: 'solid-red'`), we reference virtual tokens under the
 * `colorPalette` namespace, such as `colorPalette.500` or `colorPalette.100`.
 *
 * At runtime, passing `colorPalette="brand"` sets `--colors-color-palette-*: var(--colors-brand-*)`
 * on the element. This eliminates the combinatorial explosion of ($N$ visual styles $\times M$ color scales),
 * keeping bundle size static regardless of how many theme colors are introduced.
 */
export const badgeConfigRecipe = defineRecipe({
  className: 'badge',
  description: 'Production badge recipe with orthogonal visual variants and dynamic color palettes',
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'medium',
    fontFamily: 'sans',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    borderRadius: 'md',
    transitionProperty: 'background-color, border-color, color, box-shadow',
    transitionDuration: 'fast',
    transitionTimingFunction: 'default',
  },
  variants: {
    visual: {
      solid: {
        bg: 'colorPalette.500',
        color: 'white',
        _hover: {
          bg: 'colorPalette.600',
        },
      },
      subtle: {
        bg: 'colorPalette.100',
        color: 'colorPalette.800',
        _dark: {
          bg: 'colorPalette.950/40',
          color: 'colorPalette.200',
        },
      },
      outline: {
        bg: 'transparent',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'colorPalette.500',
        color: 'colorPalette.700',
        _dark: {
          borderColor: 'colorPalette.400',
          color: 'colorPalette.300',
        },
      },
      surface: {
        bg: 'bg.surface',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'colorPalette.200',
        color: 'colorPalette.800',
        boxShadow: 'xs',
        _dark: {
          bg: 'bg.surface',
          borderColor: 'colorPalette.800',
          color: 'colorPalette.200',
        },
      },
    },
    size: {
      sm: {
        px: '2',
        py: '0.5',
        fontSize: 'xs',
        gap: '1',
      },
      md: {
        px: '2.5',
        py: '1',
        fontSize: 'sm',
        gap: '1.5',
      },
      lg: {
        px: '3',
        py: '1.5',
        fontSize: 'md',
        gap: '2',
      },
    },
    pill: {
      true: {
        borderRadius: 'full',
      },
      false: {
        borderRadius: 'md',
      },
    },
  },
  compoundVariants: [
    // Condition: Increase border thickness for outline badges at larger sizes
    {
      visual: 'outline',
      size: 'lg',
      css: {
        borderWidth: '2px',
      },
    },
    // Condition: Add subtle surface ring when pill and surface variants collide
    {
      visual: 'surface',
      pill: true,
      css: {
        boxShadow: '0 0 0 1px token(colors.border.subtle)',
      },
    },
  ],
  defaultVariants: {
    visual: 'subtle',
    size: 'md',
    pill: false,
  },
})

/**
 * Badge Atomic Recipe (`cva` structure):
 *
 * Difference from Config Recipe:
 * - Config recipes (`defineRecipe`) are compiled at build time into named CSS classes
 *   (e.g., `badge badge--visual_solid`) inside `@layer recipes`.
 * - Atomic recipes (`cva`) are evaluated into atomic utility classes inside `@layer utilities`.
 * - In a running project, this structure can be passed directly to `cva(...)` imported
 *   from `styled-system/css`.
 */
export const badgeAtomicRecipe = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'medium',
    fontFamily: 'sans',
    lineHeight: '1',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle',
    borderRadius: 'md',
    transitionProperty: 'background-color, border-color, color',
    transitionDuration: 'fast',
  },
  variants: {
    visual: {
      solid: {
        bg: 'colorPalette.500',
        color: 'white',
        _hover: { bg: 'colorPalette.600' },
      },
      subtle: {
        bg: 'colorPalette.100',
        color: 'colorPalette.800',
        _dark: { bg: 'colorPalette.950/40', color: 'colorPalette.200' },
      },
      outline: {
        bg: 'transparent',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'colorPalette.500',
        color: 'colorPalette.700',
        _dark: { borderColor: 'colorPalette.400', color: 'colorPalette.300' },
      },
      surface: {
        bg: 'bg.surface',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'colorPalette.200',
        color: 'colorPalette.800',
        boxShadow: 'xs',
      },
    },
    size: {
      sm: { px: '2', py: '0.5', fontSize: 'xs', gap: '1' },
      md: { px: '2.5', py: '1', fontSize: 'sm', gap: '1.5' },
      lg: { px: '3', py: '1.5', fontSize: 'md', gap: '2' },
    },
    pill: {
      true: { borderRadius: 'full' },
      false: { borderRadius: 'md' },
    },
  },
  compoundVariants: [
    {
      visual: 'outline',
      size: 'lg',
      css: { borderWidth: '2px' },
    },
  ],
  defaultVariants: {
    visual: 'subtle',
    size: 'md',
    pill: false,
  },
} as const
