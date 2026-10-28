// NEGATIVE (Module 07): a config recipe is JIT. A variant chosen at runtime is invisible,
// so only the default variant's classes are emitted (and Panda warns
// `recipe_variant_dynamic`). Fix: pass literals, or list the combinations in `staticCss`.
import { button } from '../styled-system/recipes'

export function action(size: 'sm' | 'lg') {
  return button({ size })
}
