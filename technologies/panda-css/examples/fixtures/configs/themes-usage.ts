// @ts-nocheck -- typed against configs/themes.config.ts (its own outdir). The import path must match that outdir:
// the default importMap is derived from `outdir`, so '../styled-system/css' would NOT be extracted.
import { css } from '../styled-system-themes/css'

export const cta = css({ bg: 'accent.default', _themeForest: { textTransform: 'uppercase' } })
