// @ts-nocheck -- a deliberately v1-era config used as input for the upgrade audit (Module 12).
import { defineConfig } from '@pandacss/dev'

export default defineConfig({
  presets: ['@acme/preset'],
  emitPackage: true,
  lightningcss: true,
  hooks: {
    'tokens:created': () => {},
  },
  conditions: {
    extend: { supportHover: ['@media (hover: hover)', '&:hover'] },
  },
  theme: {
    extend: { containerSizes: { sm: '24rem' } },
  },
})
