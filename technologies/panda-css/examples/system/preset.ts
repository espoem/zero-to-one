import { definePreset } from '@pandacss/dev'
import { alertRecipe } from './recipes/alert.slot-recipe.ts'
import { buttonRecipe } from './recipes/button.recipe.ts'
import { scrollablePattern } from './patterns/scrollable.pattern.ts'
import { semanticTokens } from './semantic-tokens.ts'
import { layerStyles, textStyles } from './text-styles.ts'
import { tokens } from './tokens.ts'

/**
 * The "acme" design language, shared by the React app, the Solid app and the fixtures
 * (Module 11). A preset carries tokens, recipes, conditions and patterns, not components.
 */
export const acmePreset = definePreset({
  name: 'acme',
  conditions: {
    extend: {
      // Class/attribute-driven dark mode (Module 06). `&` is the element being styled.
      dark: '.dark &, [data-color-mode=dark] &',
      supportsHover: '@media (hover: hover) and (pointer: fine)',
    },
  },
  theme: {
    extend: {
      tokens,
      semanticTokens,
      textStyles,
      layerStyles,
      // v2 name for the container-query size scale; `containerSizes` is silently ignored
      // (Module 04, Module 12). Names only scope which ancestor is queried.
      containers: { narrow: '20rem', wide: '40rem' },
      containerNames: ['card'],
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      recipes: { button: buttonRecipe },
      slotRecipes: { alert: alertRecipe },
    },
  },
  patterns: {
    extend: { scrollable: scrollablePattern },
  },
})
