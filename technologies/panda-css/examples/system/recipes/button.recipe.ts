import { defineRecipe } from '@pandacss/dev'

/**
 * Config recipe (Module 07). Lives in the config, so Panda emits named classes into
 * `@layer recipes` only for variants it sees used (JIT), and generates a typed
 * `button()` function in `styled-system/recipes`.
 */
export const buttonRecipe = defineRecipe({
  className: 'button',
  description: 'Action trigger',
  jsx: ['Button'],
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2',
    borderRadius: 'control',
    fontWeight: 'medium',
    transitionDuration: 'snappy',
  },
  variants: {
    visual: {
      solid: { bg: 'accent.default', color: 'accent.fg' },
      outline: { borderWidth: '1px', borderColor: 'accent.default', color: 'accent.default' },
    },
    size: {
      sm: { px: '3', h: '8', textStyle: 'sm' },
      lg: { px: '5', h: '12', textStyle: 'lg' },
    },
  },
  compoundVariants: [
    // v2: emitted as its own class in @layer recipes.compound_variants (Module 07)
    { visual: 'outline', size: 'lg', css: { borderWidth: '2px' } },
  ],
  defaultVariants: { visual: 'solid', size: 'sm' },
})
