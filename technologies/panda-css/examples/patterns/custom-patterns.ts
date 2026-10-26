import { definePattern } from '@pandacss/dev'

/**
 * Autoflex Pattern: Responsive flex layout that wraps children with automatic flex-basis.
 *
 * Panda CSS Contract:
 * - When configured under `patterns.extend` in `panda.config.ts`, Panda generates
 *   both a function `autoflex({ gap, minItemWidth })` and a JSX component `<Autoflex>`
 *   in `styled-system/patterns`.
 * - The `transform` function returns a raw style object without runtime DOM operations.
 */
export const autoflexPattern = definePattern({
  description: 'A responsive flex grid layout that wraps items based on a minimum item width',
  properties: {
    gap: { type: 'property', value: 'gap' },
    minItemWidth: { type: 'token', value: 'sizes' },
    justify: { type: 'property', value: 'justifyContent' },
    align: { type: 'property', value: 'alignItems' },
  },
  defaultValues: {
    gap: '4',
    minItemWidth: '240px',
    justify: 'flex-start',
    align: 'stretch',
  },
  transform(props) {
    const { gap, minItemWidth, justify, align, ...rest } = props

    return {
      display: 'flex',
      flexWrap: 'wrap',
      gap,
      justifyContent: justify,
      alignItems: align,
      '& > *': {
        flexGrow: '1',
        flexShrink: '1',
        flexBasis: minItemWidth,
        minWidth: '0',
      },
      ...rest,
    }
  },
})

/**
 * Resolves CSS overflow values based on the scroll direction axis.
 * Keeps cyclomatic complexity low (3 branches).
 */
function resolveOverflowAxes(direction: 'horizontal' | 'vertical' | 'both' = 'vertical') {
  if (direction === 'horizontal') {
    return { overflowX: 'auto' as const, overflowY: 'hidden' as const }
  }
  if (direction === 'both') {
    return { overflowX: 'auto' as const, overflowY: 'auto' as const }
  }
  return { overflowX: 'hidden' as const, overflowY: 'auto' as const }
}

/**
 * Resolves scrollbar suppression rules.
 * Keeps cyclomatic complexity low (1 branch).
 */
function resolveScrollbarStyles(hideScrollbar: boolean) {
  if (!hideScrollbar) {
    return {}
  }

  return {
    scrollbarWidth: '[none]' as const,
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  }
}

/**
 * Scrollable Pattern: A container with managed overflow and optional scrollbar hiding.
 *
 * Panda CSS Contract:
 * - Emits hardware-accelerated scrolling (`-webkit-overflow-scrolling: touch`)
 *   and cross-browser scrollbar hiding styles when `hideScrollbar` is enabled.
 */
export const scrollablePattern = definePattern({
  description: 'A container with scrollable overflow and customizable scrollbar display',
  properties: {
    direction: { type: 'enum', value: ['horizontal', 'vertical', 'both'] },
    hideScrollbar: { type: 'boolean' },
  },
  defaultValues: {
    direction: 'vertical',
    hideScrollbar: true,
  },
  transform(props) {
    const { direction = 'vertical', hideScrollbar = true, ...rest } = props
    const overflowRules = resolveOverflowAxes(direction)
    const scrollbarRules = resolveScrollbarStyles(hideScrollbar)

    return {
      WebkitOverflowScrolling: 'touch',
      ...overflowRules,
      ...scrollbarRules,
      ...rest,
    }
  },
})
