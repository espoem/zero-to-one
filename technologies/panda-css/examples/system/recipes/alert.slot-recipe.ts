import { defineSlotRecipe } from '@pandacss/dev'

/**
 * Config slot recipe (Module 08): one recipe, several parts. Each slot gets its own
 * class (`alert__root`, `alert__title`, ...), emitted into `@layer recipes.slots`.
 */
export const alertRecipe = defineSlotRecipe({
  className: 'alert',
  description: 'Inline status message',
  slots: ['root', 'title', 'description'],
  jsx: ['Alert', 'Alert.Root'],
  base: {
    root: { display: 'grid', gap: '1', p: '4', borderRadius: 'md', borderWidth: '1px' },
    title: { fontWeight: 'semibold' },
    description: { color: 'fg.muted' },
  },
  variants: {
    status: {
      info: { root: { colorPalette: 'blue', bg: 'colorPalette.50', borderColor: 'colorPalette.200' } },
      danger: { root: { colorPalette: 'red', bg: 'colorPalette.50', borderColor: 'colorPalette.200' } },
    },
  },
  defaultVariants: { status: 'info' },
})
