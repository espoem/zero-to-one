// Module 05: v2 registers the internal variables that composed utilities use (translate,
// filter, ...) with @property, and ships each registration only when used. v1 instead reset
// ~34 variables on every element. An axis utility alone only sets its variable; the
// composing property must opt in with 'auto'.
import { css } from '../styled-system/css'

export const lifted = css({ translate: 'auto', translateY: '-1', filter: 'auto', blur: 'sm' })
