// NEGATIVE (Module 10): Panda reports js_parse_error instead of failing. Oxc returns a partial
// AST, but for this error (unclosed object at EOF) nothing usable remains: even the valid first
// call is lost. Treat js_parse_error as fatal in CI (panda --max-warnings 0).
// Excluded from tsconfig.json because it is deliberately invalid TypeScript.
import { css } from '../styled-system/css'

export const ok = css({ color: 'cyan.700' })
export const broken = css({ color: 'cyan.300' 
