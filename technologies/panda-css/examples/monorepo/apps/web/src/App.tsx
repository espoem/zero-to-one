import { Badge, Button } from '@acme/ds'
import { css } from '../styled-system/css'

export function App() {
  return (
    <main className={css({ color: 'app', p: '6' })}>
      <Button size="lg">Save</Button>
      <Badge>new</Badge>
    </main>
  )
}
