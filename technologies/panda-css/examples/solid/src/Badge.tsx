import { splitProps, type ComponentProps } from 'solid-js'
import { css, cva, cx, type RecipeVariantProps } from '../styled-system/css'
import type { SystemStyleObject } from '../styled-system/types'

/**
 * Module 07 (Solid): the `css` prop pattern. Never destructure props in Solid: it reads
 * them once and loses reactivity. `splitProps` keeps each group as a reactive proxy, and
 * the class expression re-runs when `tone` or `css` change.
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

export function Badge(props: BadgeProps) {
  const [local, rest] = splitProps(props, ['tone', 'css', 'class'])
  return <span class={cx(css(badge.raw({ tone: local.tone }), local.css), local.class)} {...rest} />
}
