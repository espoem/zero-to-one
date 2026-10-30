// Module 08: an inline slot recipe (`sva`) and a config slot recipe (`alert`).
import { sva } from '../styled-system/css'
import { alert } from '../styled-system/recipes'

export const field = sva({
  slots: ['root', 'label', 'input'],
  base: {
    root: { display: 'grid', gap: '1' },
    label: { fontWeight: 'medium' },
    input: { borderWidth: '1px', px: '2' },
  },
  variants: {
    invalid: { true: { input: { borderColor: 'red.500' }, label: { color: 'red.600' } } },
  },
})

export const danger = alert({ status: 'danger' })
