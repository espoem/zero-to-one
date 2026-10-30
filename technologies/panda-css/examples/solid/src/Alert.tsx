import { createSlotRecipeContext } from '../styled-system/jsx'
import { alert } from '../styled-system/recipes'

/** Module 08 (Solid): the Solid build of `createSlotRecipeContext` uses Solid context + memos. */
const { withProvider, withContext } = createSlotRecipeContext(alert)

export const Alert = {
  Root: withProvider('div', 'root', { defaultProps: { role: 'status' } }),
  Title: withContext('p', 'title'),
  Description: withContext('p', 'description'),
}
