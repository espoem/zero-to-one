// Type-level tests (Module 05, Module 09). `npm run typecheck` fails if any
// `@ts-expect-error` below stops being an error, so these are negative tests for tsc.
import { css, cva, type RecipeVariantProps } from '../styled-system/css'
import { button, type ButtonVariantProps } from '../styled-system/recipes'
import { token } from '../styled-system/tokens'

// strictTokens: token-backed properties accept tokens only...
export const ok = css({ color: 'brand.600', p: '4', bg: 'bg.subtle' })
// @ts-expect-error -- raw hex is not a `colors` token
export const rawColor = css({ color: '#ff0000' })
// @ts-expect-error -- raw length is not a `spacing` token
export const rawSpace = css({ p: '13px' })
// ...unless you opt out explicitly with the [escape hatch], which is visible in review.
export const escaped = css({ color: '[#ff0000]', p: '[13px]' })

// token() paths are a string-literal union.
export const t = token('colors.brand.600')
// @ts-expect-error -- unknown token path
export const missing = token('colors.brand.650')

// Recipe variant props are generated unions.
export const b: ButtonVariantProps = { visual: 'outline', size: 'lg' }
// @ts-expect-error -- `xl` is not a size variant
export const badSize = button({ size: 'xl' })

const pill = cva({ variants: { tone: { info: { color: 'brand.600' }, muted: { color: 'ink.700' } } } })
type PillProps = RecipeVariantProps<typeof pill>
export const p: PillProps = { tone: 'muted' }
// @ts-expect-error -- `loud` is not a tone
export const badTone: PillProps = { tone: 'loud' }
