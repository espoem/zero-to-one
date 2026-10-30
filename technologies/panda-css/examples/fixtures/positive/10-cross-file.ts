// Module 10: v2 resolves static values imported from other files: named imports,
// re-exports through barrels, imported pure helpers and imported css.raw() results.
import { css } from '../styled-system/css'
import { pad, ring, surface } from './shared/index.ts'
import { focusRing } from './shared/styles.ts'

export const box = css(surface, pad(8), { borderWidth: ring, _focusVisible: focusRing })
