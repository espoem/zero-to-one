import React, { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { css, cx } from 'styled-system/css'
import { badge, type BadgeVariantProps } from 'styled-system/recipes'
import type { SystemStyleObject } from 'styled-system/types'

export type { BadgeVariantProps, SystemStyleObject }

/**
 * Props accepted by the Badge component.
 */
export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    BadgeVariantProps {
  /**
   * Style overrides passed as a raw Panda CSS SystemStyleObject.
   *
   * WHY css.raw() IS USED:
   * Calling `css()` returns a compiled class name string (e.g. "bg_red.500 p_2").
   * In contrast, `css.raw()` returns the uncompiled style object.
   * Passing raw objects into the atomic style merger ensures that conflicting CSS
   * declarations (such as padding or background overrides) are merged deterministically
   * in AST order (last-argument-wins) before class names are emitted, preventing specificity
   * conflicts between recipe defaults and caller overrides.
   */
  css?: SystemStyleObject
  /** Badge content */
  children?: ReactNode
}

/**
 * Production Badge Component
 *
 * Demonstrates:
 * 1. Clean prop separation via official `badge.splitVariantProps(props)` to prevent invalid DOM attributes.
 * 2. Predictable override merging using `css.raw(customCss)` with `css()`.
 * 3. Class name composition with official `cx()`.
 * 4. Forwarding refs to native `HTMLSpanElement`.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(props, ref) {
  const [variantProps, elementProps] = badge.splitVariantProps(props)
  const { css: customCss, className, children, ...htmlProps } = elementProps

  // 1. Evaluate recipe base and variant classes
  const recipeClass = badge(variantProps)

  // 2. Resolve custom style override with css.raw() if supplied
  const overrideClass = customCss ? css(css.raw(customCss)) : undefined

  // 3. Compose all classes deterministically: recipe -> overrides -> user className
  const combinedClassName = cx(recipeClass, overrideClass, className)

  return (
    <span ref={ref} className={combinedClassName} {...htmlProps}>
      {children}
    </span>
  )
})

Badge.displayName = 'Badge'
