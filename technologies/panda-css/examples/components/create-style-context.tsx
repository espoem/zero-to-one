import React, {
  createContext,
  useContext,
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ForwardRefExoticComponent,
  type PropsWithoutRef,
  type RefAttributes,
} from 'react'
import { cx } from 'styled-system/css'

export { cx }

/**
 * Contract: A slot recipe function accepts variant props and returns an object
 * mapping each slot identifier to its compiled CSS class name string.
 */
export type SlotRecord<S extends string> = Record<S, string>

export interface SlotRecipeLike<P, S extends string> {
  (props?: P): Record<S, string>
  splitVariantProps?: (props: Record<string, any>) => [P, Record<string, any>]
}

/**
 * Extracts display name for higher-order component debugging.
 * Keeps cyclomatic complexity low (complexity = 3).
 */
function getComponentDisplayName(Component: ElementType): string {
  if (typeof Component === 'string') {
    return Component
  }
  return Component.displayName || Component.name || 'Component'
}

/**
 * Safely extracts variant props from component props using the recipe's metadata.
 * Keeps cyclomatic complexity low (complexity = 2).
 */
function extractVariantProps<P>(
  props: Record<string, any>,
  recipe: SlotRecipeLike<P, string>,
): [P, Record<string, any>] {
  if (typeof recipe.splitVariantProps === 'function') {
    return recipe.splitVariantProps(props)
  }
  return [{} as P, props]
}

/**
 * createStyleContext: A factory for building compound components styled with Panda CSS slot recipes.
 *
 * HOW IT DISTRIBUTES SLOT CLASSES:
 * 1. Multi-part UI primitives (like Alerts, Dialogs, and Tabs) are governed by slot recipes
 *    that evaluate all slot classes (`root`, `icon`, `title`, etc.) simultaneously in one pass.
 * 2. `withProvider` wraps the parent component (e.g. `Alert.Root`). It extracts recipe variant props
 *    (`status`, `variant`), evaluates the slot recipe once, and broadcasts the resulting class map
 *    via a lightweight React Context.
 * 3. `withContext` wraps child parts (e.g. `Alert.Title`). Each part subscribes to the context,
 *    retrieves its designated slot class (e.g. `classes.title`), and merges it with any local
 *    `className` supplied by the consumer.
 * 4. This pattern achieves zero prop-drilling, guarantees consistent variant styling across all parts,
 *    and supports full `ref` forwarding and standard JSX ergonomics.
 */
export function createStyleContext<P extends Record<string, any>, S extends string>(
  recipe: SlotRecipeLike<P, S>,
) {
  const StyleContext = createContext<SlotRecord<S> | null>(null)

  /**
   * withProvider: Wraps the root container.
   * Evaluates the slot recipe, renders the React Context Provider, and attaches the root slot class.
   */
  function withProvider<T extends ElementType>(
    Component: T,
    slot: S,
  ): ForwardRefExoticComponent<
    PropsWithoutRef<ComponentPropsWithoutRef<T> & P> & RefAttributes<any>
  > {
    const Comp = forwardRef<any, ComponentPropsWithoutRef<T> & P>((props, ref) => {
      const [variantProps, elementProps] = extractVariantProps(props, recipe)
      const slotStyles = recipe(variantProps)
      const rootSlotClass = slotStyles?.[slot]
      const combinedClass = cx(rootSlotClass, elementProps.className)

      return (
        <StyleContext.Provider value={slotStyles}>
          <Component ref={ref} {...(elementProps as any)} className={combinedClass} />
        </StyleContext.Provider>
      )
    })

    Comp.displayName = `withProvider(${getComponentDisplayName(Component)})`
    return Comp as any
  }

  /**
   * withContext: Wraps child parts of the compound component.
   * Retrieves the pre-evaluated slot class from Context and joins it with consumer classes.
   */
  function withContext<T extends ElementType>(
    Component: T,
    slot: S,
  ): ForwardRefExoticComponent<
    PropsWithoutRef<ComponentPropsWithoutRef<T>> & RefAttributes<any>
  > {
    const Comp = forwardRef<any, ComponentPropsWithoutRef<T>>((props, ref) => {
      const slotStyles = useContext(StyleContext)
      const partSlotClass = slotStyles?.[slot]
      const combinedClass = cx(partSlotClass, props.className)

      return <Component ref={ref} {...(props as any)} className={combinedClass} />
    })

    Comp.displayName = `withContext(${getComponentDisplayName(Component)})`
    return Comp as any
  }

  /**
   * Hook to directly access the current slot class dictionary within child elements.
   */
  function useSlotStyles(): SlotRecord<S> {
    const styles = useContext(StyleContext)
    if (!styles) {
      throw new Error(
        'useSlotStyles must be used within a component wrapped by withProvider',
      )
    }
    return styles
  }

  return {
    withProvider,
    withContext,
    useSlotStyles,
    StyleContext,
  }
}
