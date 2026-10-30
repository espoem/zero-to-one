import type { ComponentProps } from 'react'
import { button, type ButtonVariantProps } from '../styled-system/recipes'

export function Button({ visual, size, className, ...rest }: ButtonVariantProps & ComponentProps<'button'>) {
  // Literal call so the `lg` variant used by consumers is part of the package's build info.
  void button({ size: 'lg' })
  return <button className={[button({ visual, size }), className].filter(Boolean).join(' ')} {...rest} />
}
