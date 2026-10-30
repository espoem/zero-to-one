// Module 10: an open ternary folds to a Conditional literal; the encoder emits BOTH branches.
// `cond && X` contributes X. `size ?? 'md'` with an unknown left side contributes the fallback.
import { css } from '../styled-system/css'

export function chip(active: boolean, tone?: string) {
  return css({
    color: active ? 'green.700' : 'gray.500',
    fontWeight: (active && 'semibold') as 'semibold', // `as` is a syntactic no-op for the fold
    letterSpacing: (tone as 'wide' | undefined) ?? 'tight',
  })
}
