import { Button } from '@acme/ds'

// Imports Button but not Badge: with treeshakeDesignSystem, Badge's atoms are not hydrated.
export const Save = () => <Button>Save</Button>
