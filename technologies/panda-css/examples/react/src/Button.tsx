import { styled } from '../styled-system/jsx'
import { button } from '../styled-system/recipes'

/**
 * Module 09: a config recipe bound to an element with the JSX factory. Variant props
 * (`visual`, `size`) pick recipe classes; style props and `css` become utilities, which
 * sit in a later cascade layer and therefore win over any recipe class.
 */
export const Button = styled('button', button)
