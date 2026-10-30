// Module 09 bench: identical source, only jsxStyleProps differs. Compared by examples/tests/type-cost.test.ts.
import { defineConfig } from '@pandacss/dev'
export default defineConfig({ presets: ['@pandacss/preset-base','@pandacss/preset-panda'], jsxFramework: 'react', jsxStyleProps: 'minimal', include: ['./src/**/*.tsx'], outdir: 'styled-system' })
