// Source used by the legacy/misconfigured configs in this folder.
import { css } from '../styled-system/css'

export const hover = css({ color: 'red.500', _hover: { color: 'red.700' } })
export const responsive = css({ p: { base: '2', sm: '3', md: '4' } })
export const query = css({ containerType: 'inline-size', '@card/wide': { flexDirection: 'row' } })
