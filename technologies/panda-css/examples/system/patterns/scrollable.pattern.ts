import { definePattern } from '@pandacss/dev'

/**
 * Custom pattern (Module 04): a typed layout function generated into
 * `styled-system/patterns/scrollable` (+ a `<Scrollable>` JSX component).
 */
export const scrollablePattern = definePattern({
  description: 'A scroll container with an optional hidden scrollbar',
  properties: {
    direction: { type: 'enum', value: ['horizontal', 'vertical'] },
    hideScrollbar: { type: 'boolean' },
  },
  defaultValues: { direction: 'vertical' },
  transform(props) {
    const { direction, hideScrollbar, ...rest } = props
    return {
      overflowX: direction === 'horizontal' ? 'auto' : 'hidden',
      overflowY: direction === 'vertical' ? 'auto' : 'hidden',
      ...(hideScrollbar ? { scrollbarWidth: 'none' } : {}),
      ...rest,
    }
  },
})
