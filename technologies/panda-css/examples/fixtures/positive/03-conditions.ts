// Module 03: conditions. Pseudo, data-attribute, group/peer, responsive object syntax,
// a custom condition from the acme preset, and an arbitrary selector.
import { css } from '../styled-system/css'

export const link = css({
  color: 'fg.default',
  _hover: { color: 'accent.default' },
  _focusVisible: { outlineWidth: '2px', outlineStyle: 'solid' },
  _supportsHover: { textDecoration: 'underline' },
  fontSize: { base: 'sm', md: 'md', lg: 'lg' },
  '&[data-state=open]': { fontWeight: 'bold' },
})

export const groupItem = css({ _groupHover: { bg: 'bg.subtle' } })
export const peerLabel = css({ _peerInvalid: { color: 'red.600' } })

// Responsive *array values* are still supported in v2 (index = breakpoint order: base, sm, md, lg…).
// What v2 deprecates are *array condition definitions* in the config (see configs/array-condition.config.ts).
export const weight = css({ fontWeight: ['medium', undefined, undefined, 'bold'] })
