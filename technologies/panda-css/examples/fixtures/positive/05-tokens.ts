// Module 05: token references. Category values, `token()` / `token.var()` folded at build
// time, the `/opacity` color modifier, and a curly reference inside a composite value.
import { css } from '../styled-system/css'
import { token } from '../styled-system/tokens'

export const swatch = css({
  bg: 'brand.500/40',
  color: 'fg.default',
  borderColor: token('colors.brand.700'),
  boxShadow: '0 0 0 2px {colors.brand.100}',
  px: 'gutter',
})

export const raw = token.var('colors.brand.600')

// token() inside a string keeps the variable and takes a fallback; token.var() folds to var().
export const fallback = css({ border: '1px solid token(colors.brand.600, crimson)', color: token.var('colors.brand.700') })
