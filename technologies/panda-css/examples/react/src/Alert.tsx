import { createSlotRecipeContext } from '../styled-system/jsx'
import { alert } from '../styled-system/recipes'

/**
 * Module 08: compound component from a config slot recipe. v2 replaces the removed
 * `createStyleContext` with `createSlotRecipeContext`. The root splits variant props and
 * provides the per-slot classes; children read their slot from context.
 */
const { withProvider, withContext } = createSlotRecipeContext(alert)

export const Alert = {
  Root: withProvider('div', 'root', { defaultProps: { role: 'status' } }),
  Title: withContext('p', 'title'),
  Description: withContext('p', 'description'),
}
