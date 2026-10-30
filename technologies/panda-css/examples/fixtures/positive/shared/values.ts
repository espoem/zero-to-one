// Plain module with static values; nothing here imports Panda.
export const brandRing = '3px'
export const surface = { bg: 'brand.50', color: 'brand.900' } as const
// A "pure helper": one expression body, template literal only. v2 lowers it to a
// closed descriptor and applies it at the call site with the folded argument.
export const pad = (n: number) => ({ p: `${n}` })
// Not foldable: `String()` is an unknown call inside the body (see negative/helper-unsupported.ts).
export const padUnsupported = (n: number) => ({ m: String(n) })
