// Module 04: patterns are functions that return style objects; their output is atomic CSS.
// Container queries use the v2 `theme.containers` scale (`@<name>/<size>` conditions).
import { css } from '../styled-system/css'
import { hstack, scrollable, stack } from '../styled-system/patterns'

export const toolbar = hstack({ gap: '3', justify: 'space-between' })
export const list = stack({ gap: '2' })
export const tray = scrollable({ direction: 'horizontal', hideScrollbar: true })

export const cardShell = css({ containerType: 'inline-size', containerName: 'card' })
export const cardBody = css({
  flexDirection: 'column',
  '@card/wide': { flexDirection: 'row' },
})
