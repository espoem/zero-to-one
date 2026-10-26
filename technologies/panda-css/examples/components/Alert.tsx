import React, {
  forwardRef,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { alert, type AlertVariantProps } from 'styled-system/recipes'
import { createStyleContext } from './create-style-context'

export type { AlertVariantProps }

/**
 * Registered slot names matching the alert slot recipe definition.
 */
export type AlertSlot = keyof ReturnType<typeof alert>

/**
 * Style context initialized for the Alert compound component.
 * Distributes slot classes from Alert.Root down to child subcomponents via React Context.
 */
const { withProvider, withContext, useSlotStyles } = createStyleContext<
  AlertVariantProps,
  AlertSlot
>(alert)

export interface AlertRootProps
  extends HTMLAttributes<HTMLDivElement>,
    AlertVariantProps {
  children?: ReactNode
}

/**
 * Alert.Root: The outer container and context provider.
 * Evaluates the slot recipe with status and visual variant props, broadcasting
 * compiled slot class names to all compound descendants.
 */
const AlertRoot = withProvider(
  forwardRef<HTMLDivElement, AlertRootProps>(function AlertRoot(props, ref) {
    return <div ref={ref} role="alert" aria-live="polite" {...props} />
  }),
  'root',
)

export interface AlertIconProps extends HTMLAttributes<HTMLSpanElement> {
  children?: ReactNode
}

/**
 * Alert.Icon: Visual status icon slot.
 */
const AlertIcon = withContext(
  forwardRef<HTMLSpanElement, AlertIconProps>(function AlertIcon(props, ref) {
    return <span ref={ref} aria-hidden="true" {...props} />
  }),
  'icon',
)

export interface AlertContentProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode
}

/**
 * Alert.Content: Flex container grouping title and description.
 */
const AlertContent = withContext(
  forwardRef<HTMLDivElement, AlertContentProps>(function AlertContent(props, ref) {
    return <div ref={ref} {...props} />
  }),
  'content',
)

export interface AlertTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children?: ReactNode
}

/**
 * Alert.Title: Primary headline text for the alert banner.
 */
const AlertTitle = withContext(
  forwardRef<HTMLHeadingElement, AlertTitleProps>(function AlertTitle(props, ref) {
    return <h5 ref={ref} {...props} />
  }),
  'title',
)

export interface AlertDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children?: ReactNode
}

/**
 * Alert.Description: Secondary detailed text for the alert banner.
 */
const AlertDescription = withContext(
  forwardRef<HTMLParagraphElement, AlertDescriptionProps>(
    function AlertDescription(props, ref) {
      return <p ref={ref} {...props} />
    },
  ),
  'description',
)

export interface AlertCloseTriggerProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode
}

/**
 * Alert.CloseTrigger: Interactive button to dismiss the alert banner.
 */
const AlertCloseTrigger = withContext(
  forwardRef<HTMLButtonElement, AlertCloseTriggerProps>(
    function AlertCloseTrigger(props, ref) {
      return (
        <button
          ref={ref}
          type="button"
          aria-label="Close alert"
          {...props}
        />
      )
    },
  ),
  'closeTrigger',
)

/**
 * Compound Alert Component
 *
 * Example Usage:
 * ```tsx
 * <Alert.Root status="warning" variant="leftAccent">
 *   <Alert.Icon>⚠️</Alert.Icon>
 *   <Alert.Content>
 *     <Alert.Title>System Notice</Alert.Title>
 *     <Alert.Description>Scheduled maintenance at 00:00 UTC.</Alert.Description>
 *   </Alert.Content>
 *   <Alert.CloseTrigger onClick={handleClose}>×</Alert.CloseTrigger>
 * </Alert.Root>
 * ```
 */
export const Alert = Object.assign(AlertRoot, {
  Root: AlertRoot,
  Icon: AlertIcon,
  Content: AlertContent,
  Title: AlertTitle,
  Description: AlertDescription,
  CloseTrigger: AlertCloseTrigger,
})

export {
  AlertRoot,
  AlertIcon,
  AlertContent,
  AlertTitle,
  AlertDescription,
  AlertCloseTrigger,
  useSlotStyles,
}
