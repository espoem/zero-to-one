// NEGATIVE (Module 03): concatenating class strings does not merge styles. Both atoms
// exist in the stylesheet, and the winner is decided by stylesheet order, not by the
// order of the strings. `css(a, b)` or `cx()` merges the objects so the last key wins.
import { css } from '../styled-system/css'

const base = css({ color: 'orange.700' })
const override = css({ color: 'orange.300' })
export const concatenated = `${override} ${base}`
export const merged = css(css.raw({ color: 'orange.700' }), css.raw({ color: 'orange.300' }))
