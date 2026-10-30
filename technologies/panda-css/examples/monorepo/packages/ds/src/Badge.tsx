import type { ComponentProps } from 'react'
import { css } from '../styled-system/css'

export function Badge(props: ComponentProps<'span'>) {
  return <span className={css({ px: '2', bg: 'brand.100', color: 'brand.900', borderRadius: 'full' })} {...props} />
}
