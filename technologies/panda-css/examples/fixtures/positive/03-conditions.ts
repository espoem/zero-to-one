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
