// NEGATIVE (Module 10): the resolver checks bindings, not names. The inner `css`
// parameter shadows the Panda import, so this call is not extracted.
import { css } from '../styled-system/css'

export function local(css: (s: object) => string) {
  return css({ color: 'pink.300' })
}

export const real = css({ color: 'pink.700' })
