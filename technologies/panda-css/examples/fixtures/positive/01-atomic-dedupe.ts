// Module 01: atomic CSS. Two call sites share `p: '4'` and `color: 'brand.600'`;
// the stylesheet contains each (property, value, condition) atom exactly once.
import { css } from '../styled-system/css'

export const card = css({ p: '4', color: 'brand.600', borderRadius: 'lg' })
export const panel = css({ p: '4', color: 'brand.600', bg: 'ink.100' })
