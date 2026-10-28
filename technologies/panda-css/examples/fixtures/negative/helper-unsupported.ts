// NEGATIVE (Module 10): a helper whose body calls an unknown function (`String`) cannot be
// lowered to a pure descriptor, so `m: '9'` is silently skipped. Compare with `pad()` in
// positive/10-cross-file.ts, which uses a template literal and is folded.
import { css } from '../styled-system/css'
import { padUnsupported } from '../positive/shared/values.ts'

export const spaced = css(padUnsupported(9))
