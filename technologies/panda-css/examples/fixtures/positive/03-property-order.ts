// Module 03: inside @layer utilities, atoms are sorted by property breadth, not by source or
// merge order. Broader properties are emitted first, so a longhand always beats a shorthand.
// v2 change (gotcha 8): all border shorthands share one tier, so the all-sides `borderWidth`
// beats the per-side shorthand `borderInlineEnd` regardless of merge order. Only the longhand
// `borderInlineEndWidth` reliably overrides it.
import { css, cx } from '../styled-system/css'

export const padded = css({ paddingTop: '20px', padding: '10px' })
const box = css({ borderWidth: '1px', borderStyle: 'solid' })
export const openBracketV1 = cx(box, css({ borderInlineEnd: '0' }))
export const openBracketV2 = cx(box, css({ borderInlineEndWidth: '0' }))
