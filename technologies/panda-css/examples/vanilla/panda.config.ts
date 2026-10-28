import { defineConfig } from '@pandacss/dev'

// Framework-free app used to prove the source-transform claim (Module 01, Module 10):
// when every call site is static, `transform: true` removes the css() runtime entirely.
export default defineConfig({
  presets: ['@pandacss/preset-base', '@pandacss/preset-panda'],
  preflight: false,
  include: ['./src/**/*.ts'],
  outdir: 'styled-system',
})
