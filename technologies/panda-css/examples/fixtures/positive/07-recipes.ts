// Module 07: an atomic recipe (`cva`) next to a config recipe (`button`).
// cva variants become atomic utilities; config recipe variants become named classes
// in @layer recipes, and its compound variant gets its own class in
// @layer recipes.compound_variants.
import { cva } from '../styled-system/css'
import { button } from '../styled-system/recipes'

export const badge = cva({
  base: { display: 'inline-flex', px: '2', borderRadius: 'full' },
  variants: {
    tone: { neutral: { bg: 'ink.100' }, brand: { bg: 'brand.100', color: 'brand.900' } },
    size: { sm: { fontSize: 'xs' }, md: { fontSize: 'sm' } },
  },
  compoundVariants: [{ tone: 'brand', size: 'md', css: { fontWeight: 'semibold' } }],
  defaultVariants: { tone: 'neutral', size: 'sm' },
})

export const cta = button({ visual: 'outline', size: 'lg' })
