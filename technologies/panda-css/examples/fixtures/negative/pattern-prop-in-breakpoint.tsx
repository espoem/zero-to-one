// NEGATIVE (Module 04): a pattern prop nested inside a breakpoint key is never passed to the
// pattern's transform, so `columns: 3` at `md` produces no grid-template-columns rule.
import { Grid } from '../styled-system/jsx'

export const Wrong = () => <Grid columns={1} md={{ columns: 3 }} />
