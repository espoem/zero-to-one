// @ts-nocheck -- v1-era component, input for the upgrade audit (Module 12).
import { createStyleContext } from '../styled-system/jsx'
import theme from './theme-tokens'
import { card } from '../styled-system/recipes'

const { withProvider, withContext } = createStyleContext(card)
export const Card = { Root: withProvider('div', 'root'), Body: withContext('div', 'body') }
export const accent = theme.accent

// v1 template-literal authoring (syntax: 'template-literal'), removed in v2
import { css } from '../styled-system/css'
export const legacy = css`color: red;`
