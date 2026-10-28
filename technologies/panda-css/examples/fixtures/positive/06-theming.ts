// Module 06: semantic tokens switch per condition; text styles, layer styles and
// keyframes are referenced by name and only emitted when used.
import { css } from '../styled-system/css'

export const page = css({ bg: 'bg.canvas', color: 'fg.default', textStyle: 'body' })
export const title = css({ textStyle: 'heading' })
export const tile = css({ layerStyle: 'card', animation: 'fadeIn 200ms ease-out' })
