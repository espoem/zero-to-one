// NEGATIVE (Module 10): v2 follows named imports only. A default import is not resolved,
// so `teal.300` never reaches the stylesheet.
import { css } from '../styled-system/css'
import defaults from './shared-values.ts'

export const fromDefault = css({ color: defaults.color })
