// NEGATIVE (Module 10): a namespace import is not resolved either; `lime.300` is dropped.
import { css } from '../styled-system/css'
import * as values from './shared-values.ts'

export const fromNamespace = css({ color: values.sentinelColor })
