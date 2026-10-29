import { definePattern } from '@pandacss/dev'

/**
 * Custom pattern (Module 04): a typed layout function generated into
 * `styled-system/patterns/scrollable` (+ a `<Scrollable>` JSX component).
 *
 * `transform` runs at BUILD time inside the compiler host, and again at runtime in the
 * generated pattern function. A responsive prop arrives as an object
 * (`{ base: 'horizontal', md: 'vertical' }`), so branch with `map`, never with `===`.
 */
export const scrollablePattern = definePattern({
  description: 'A scroll container with an optional hidden scrollbar',
  properties: {
    direction: { type: 'enum', value: ['horizontal', 'vertical'] },
    hideScrollbar: { type: 'boolean' },
  },
  defaultValues: { direction: 'vertical', hideScrollbar: false },
  // The pattern owns overflow; callers may not override it (type-level only).
  blocklist: ['overflow', 'overflowX', 'overflowY'],
  transform(props, { map }) {
    const { direction, hideScrollbar, ...rest } = props
    return {
      overflowX: map(direction, (d) => (d === 'horizontal' ? 'auto' : 'hidden')),
      overflowY: map(direction, (d) => (d === 'vertical' ? 'auto' : 'hidden')),
      scrollbarWidth: hideScrollbar ? 'none' : undefined,
      ...rest,
    }
  },
})
