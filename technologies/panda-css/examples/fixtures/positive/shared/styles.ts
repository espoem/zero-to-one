import { css } from '../../styled-system/css'

// `css.raw()` returns the style object unchanged; v2 can resolve it across files.
export const focusRing = css.raw({ outlineWidth: '3px', outlineColor: 'brand.500', outlineStyle: 'solid' })
