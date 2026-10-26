import { defineConfig } from '@pandacss/dev'
import { coreTokens } from './theme/tokens'
import { semanticTokens } from './theme/semantic-tokens'
import { textStyles, layerStyles, keyframes } from './theme/text-and-layer-styles'
import { autoflexPattern, scrollablePattern } from './patterns/custom-patterns'
import { badgeConfigRecipe } from './recipes/badge.recipe'
import { alertSlotRecipe } from './recipes/alert.slot-recipe'
import { tabsSlotRecipe } from './recipes/tabs.slot-recipe'

/**
 * Production Panda CSS Configuration
 *
 * Demonstrates:
 * - Full design token integration (coreTokens, semanticTokens, textStyles, layerStyles, keyframes)
 * - Custom layout patterns (autoflex, scrollable)
 * - Single-element and multi-slot config recipes (badge, alert, tabs)
 * - Custom media and theme conditions (light, dark, supportHover)
 * - Multi-brand theme overrides (acme, cyberpunk)
 * - Static CSS pre-generation for production deployment
 * - Strict token enforcement
 */
export default defineConfig({
  // CSS Reset normalize rules injected into @layer reset
  preflight: true,

  // Generate JSX component wrappers and factory functions for React
  jsxFramework: 'react',

  // Source files scanned at build time by Panda's static AST parser
  include: [
    './src/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './examples/**/*.{js,jsx,ts,tsx}',
  ],

  // Excluded directories from static analysis
  exclude: ['node_modules', 'dist', 'styled-system'],

  // Target directory for the generated design engine
  outdir: 'styled-system',

  // Enforces that only tokens declared in the config can be passed to token-aware CSS properties
  strictTokens: true,

  // Custom selectors, media queries, and container queries
  conditions: {
    extend: {
      light: '&:is([data-theme="light"], .light, [data-color-mode="light"])',
      dark: '&:is([data-theme="dark"], .dark, [data-color-mode="dark"])',
      supportHover: '@media (hover: hover) and (pointer: fine)',
    },
  },

  // Primary design system theme specification
  theme: {
    extend: {
      tokens: coreTokens,
      semanticTokens,
      textStyles,
      layerStyles,
      keyframes,
      recipes: {
        badge: badgeConfigRecipe,
      },
      slotRecipes: {
        alert: alertSlotRecipe,
        tabs: tabsSlotRecipe,
      },
    },
  },

  // Multi-brand theme configurations switched via data-theme attribute
  themes: {
    acme: {
      tokens: {
        colors: {
          brand: {
            50: { value: '#f0f9ff' },
            100: { value: '#e0f2fe' },
            500: { value: '#0ea5e9' },
            600: { value: '#0284c7' },
            700: { value: '#0369a1' },
          },
        },
      },
    },
    cyberpunk: {
      tokens: {
        colors: {
          brand: {
            50: { value: '#fff1f2' },
            100: { value: '#ffe4e6' },
            500: { value: '#f43f5e' },
            600: { value: '#e11d48' },
            700: { value: '#be123c' },
          },
        },
      },
    },
  },

  // Reusable utility layout patterns generated into styled-system/patterns
  patterns: {
    extend: {
      autoflex: autoflexPattern,
      scrollable: scrollablePattern,
    },
  },

  // Guarantees static extraction of dynamic combinations at build time
  staticCss: {
    recipes: {
      badge: ['*'],
      alert: [{ status: ['*'], variant: ['*'] }],
      tabs: [{ variant: ['*'], orientation: ['*'] }],
    },
  },
})
