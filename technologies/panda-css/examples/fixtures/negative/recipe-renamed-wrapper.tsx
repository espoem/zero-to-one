// NEGATIVE (Module 07): config recipe JSX tracking matches tag NAMES. The recipe lists
// `jsx: ['Button']`, so `<Action size="lg">` is invisible even though Action renders button().
// Fixes: name the wrapper Button, add 'Action' to the recipe's `jsx`, or use staticCss.
import { button, type ButtonVariantProps } from '../styled-system/recipes'

function Action(props: ButtonVariantProps & { children?: unknown }) {
  return <button className={button(props)}>{String(props.children)}</button>
}

export const Toolbar = () => <Action size="lg">Save</Action>
