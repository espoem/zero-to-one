// NEGATIVE (Module 10): runtime values never produce CSS. Panda reads source text at
// build time; `props.tone` and `Math.random()` do not exist until the browser runs.
import { css } from '../styled-system/css'

export function badge(props: { tone: string }) {
  return css({ color: props.tone })
}

export const random = css({ zIndex: Math.random() > 0.5 ? undefined : undefined, opacity: String(Math.random()) })

// The documented escape hatch: a static style that reads a CSS variable set at runtime.
export const viaVariable = css({ color: 'var(--badge-tone)' })
