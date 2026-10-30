import { defineTokens } from '@pandacss/dev'

/**
 * Primitive (core) tokens: the raw scale. They never change with color mode or theme.
 * Module 05 teaches the tier model; Module 06 layers semantic tokens and themes on top.
 */
export const tokens = defineTokens({
  colors: {
    brand: {
      50: { value: '#eef2ff' },
      100: { value: '#e0e7ff' },
      500: { value: '#6366f1' },
      600: { value: '#4f46e5' },
      700: { value: '#4338ca' },
      900: { value: '#312e81' },
    },
    ink: {
      50: { value: '#fafafa' },
      100: { value: '#f4f4f5' },
      700: { value: '#3f3f46' },
      900: { value: '#18181b' },
      950: { value: '#09090b' },
    },
  },
  radii: {
    control: { value: '{radii.md}' },
  },
  durations: {
    snappy: { value: '120ms' },
  },
})
