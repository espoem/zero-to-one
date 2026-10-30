import { defineLayerStyles, defineTextStyles } from '@pandacss/dev'

export const textStyles = defineTextStyles({
  heading: {
    value: { fontSize: '2xl', fontWeight: 'bold', lineHeight: 'tight', letterSpacing: 'tight' },
  },
  body: {
    value: { fontSize: 'md', lineHeight: 'relaxed' },
  },
})

// Layer styles accept only a fixed set of visual CSS properties, spelled as longhand
// CSS names (`background`, not the `bg` shorthand). The type rejects anything else.
export const layerStyles = defineLayerStyles({
  card: {
    value: { background: 'bg.canvas', borderWidth: '1px', borderColor: 'bg.subtle', borderRadius: 'lg' },
  },
})
