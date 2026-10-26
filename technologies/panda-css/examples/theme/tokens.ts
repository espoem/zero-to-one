import { defineTokens } from '@pandacss/dev'

/**
 * Core Tokens: The foundational, immutable design scale for the design system.
 *
 * Panda CSS Contract:
 * - Core tokens are exported to CSS custom properties under the `@layer tokens` cascade layer.
 * - Raw token values do not switch with dark mode or themes by default; semantic tokens and
 *   theme overrides layer on top of these raw values to handle conditional appearance.
 */
export const coreTokens = defineTokens({
  colors: {
    // Brand green scale (50-950)
    brand: {
      50: { value: '#f0fdf4' },
      100: { value: '#dcfce7' },
      200: { value: '#bbf7d0' },
      300: { value: '#86efac' },
      400: { value: '#4ade80' },
      500: { value: '#22c55e' },
      600: { value: '#16a34a' },
      700: { value: '#15803d' },
      800: { value: '#166534' },
      900: { value: '#14532d' },
      950: { value: '#052e16' },
    },
    // Neutral zinc scale (50-950)
    neutral: {
      50: { value: '#fafafa' },
      100: { value: '#f4f4f5' },
      200: { value: '#e4e4e7' },
      300: { value: '#d4d4d8' },
      400: { value: '#a1a1aa' },
      500: { value: '#71717a' },
      600: { value: '#52525b' },
      700: { value: '#3f3f46' },
      800: { value: '#27272a' },
      900: { value: '#18181b' },
      950: { value: '#09090b' },
    },
    // Status color families used by recipes and virtual color palettes
    info: {
      50: { value: '#eff6ff' },
      100: { value: '#dbeafe' },
      200: { value: '#bfdbfe' },
      300: { value: '#93c5fd' },
      400: { value: '#60a5fa' },
      500: { value: '#3b82f6' },
      600: { value: '#2563eb' },
      700: { value: '#1d4ed8' },
      800: { value: '#1e40af' },
      900: { value: '#1e3a8a' },
      950: { value: '#172554' },
    },
    success: {
      50: { value: '#f0fdf4' },
      100: { value: '#dcfce7' },
      200: { value: '#bbf7d0' },
      300: { value: '#86efac' },
      400: { value: '#4ade80' },
      500: { value: '#22c55e' },
      600: { value: '#16a34a' },
      700: { value: '#15803d' },
      800: { value: '#166534' },
      900: { value: '#14532d' },
      950: { value: '#052e16' },
    },
    warning: {
      50: { value: '#fffbeb' },
      100: { value: '#fef3c7' },
      200: { value: '#fde68a' },
      300: { value: '#fcd34d' },
      400: { value: '#fbbf24' },
      500: { value: '#f59e0b' },
      600: { value: '#d97706' },
      700: { value: '#b45309' },
      800: { value: '#92400e' },
      900: { value: '#78350f' },
      950: { value: '#451a03' },
    },
    danger: {
      50: { value: '#fef2f2' },
      100: { value: '#fee2e2' },
      200: { value: '#fecaca' },
      300: { value: '#fca5a5' },
      400: { value: '#f87171' },
      500: { value: '#ef4444' },
      600: { value: '#dc2626' },
      700: { value: '#b91c1c' },
      800: { value: '#991b1b' },
      900: { value: '#7f1d1d' },
      950: { value: '#450a0a' },
    },
  },
  fonts: {
    sans: {
      value:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    heading: {
      value:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    mono: {
      value:
        'JetBrains Mono, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    },
  },
  radii: {
    none: { value: '0px' },
    xs: { value: '0.125rem' },
    sm: { value: '0.25rem' },
    md: { value: '0.375rem' },
    lg: { value: '0.5rem' },
    xl: { value: '0.75rem' },
    '2xl': { value: '1rem' },
    full: { value: '9999px' },
  },
  shadows: {
    xs: { value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
    sm: {
      value: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    },
    md: {
      value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    },
    lg: {
      value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    },
    xl: {
      value: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
    outline: { value: '0 0 0 2px rgba(34, 197, 94, 0.4)' },
  },
  easings: {
    default: { value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    in: { value: 'cubic-bezier(0.4, 0, 1, 1)' },
    out: { value: 'cubic-bezier(0, 0, 0.2, 1)' },
    inOut: { value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    emphasized: { value: 'cubic-bezier(0.2, 0, 0, 1)' },
  },
  durations: {
    fastest: { value: '50ms' },
    fast: { value: '100ms' },
    normal: { value: '200ms' },
    slow: { value: '300ms' },
    slowest: { value: '500ms' },
  },
  animations: {
    fadeIn: { value: 'fadeIn 200ms cubic-bezier(0, 0, 0.2, 1)' },
    slideDown: { value: 'slideDown 250ms cubic-bezier(0.2, 0, 0, 1)' },
    pulseGlow: { value: 'pulseGlow 2s infinite' },
    spin: { value: 'spin 1s linear infinite' },
  },
})
