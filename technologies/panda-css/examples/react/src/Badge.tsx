import type { ComponentProps } from 'react'
import { css, cva, cx, type RecipeVariantProps } from '../styled-system/css'
import type { SystemStyleObject } from '../styled-system/types'

/**
 * Module 07: an atomic recipe in component code. The `css` prop pattern merges the
 * caller's style object *after* the recipe's, so the caller wins per property.
 */
export const badge = cva({
  base: { display: 'inline-flex', alignItems: 'center', px: '2', borderRadius: 'full', fontSize: 'xs' },
  variants: {
    tone: {
      neutral: { bg: 'bg.subtle', color: 'fg.default' },
      brand: { bg: 'brand.100', color: 'brand.900' },
    },
  },
  defaultVariants: { tone: 'neutral' },
})

type BadgeProps = RecipeVariantProps<typeof badge> &
  Omit<ComponentProps<'span'>, 'color'> & { css?: SystemStyleObject }

export function Badge({ tone, css: cssProp, className, ...rest }: BadgeProps) {
  return <span className={cx(css(badge.raw({ tone }), cssProp), className)} {...rest} />
}
