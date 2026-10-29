// Module 04: patterns are functions that return style objects; their output is atomic CSS.
// Container queries use the v2 `theme.containers` scale (`@<name>/<size>` conditions).
import { css } from '../styled-system/css'
import { cq, grid, hstack, linkOverlay, scrollable, stack } from '../styled-system/patterns'

export const toolbar = hstack({ gap: '3', justify: 'space-between' })
export const list = stack({ gap: '2' })
// Responsive pattern prop: the custom transform maps each breakpoint value.
export const tray = scrollable({ direction: { base: 'horizontal', md: 'vertical' }, hideScrollbar: true })
export const gallery = grid({ columns: { base: 1, md: 3 }, gap: '4' })
export const cardLink = linkOverlay()

// Declaring a container: native properties, or the `cq` pattern.
export const cardShell = css({ containerType: 'inline-size', containerName: 'card' })
export const sidebar = cq({ name: 'card' })
export const cardBody = css({
  flexDirection: 'column',
  '@card/wide': { flexDirection: 'row' },
  // unnamed container query against the nearest container, preset-panda scale
  fontSize: { base: 'sm', '@/md': 'md' },
})
