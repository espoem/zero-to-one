import { defineSlotRecipe } from '@pandacss/dev'

/**
 * Alert Slot Recipe: Multi-part component recipe for accessible notification banners.
 *
 * HOW COLOR PALETTE PROPAGATION WORKS IN SLOT RECIPES:
 * The `status` variant assigns `colorPalette` on the `root` slot. In Panda CSS, setting
 * `colorPalette: 'danger'` injects the `--colors-color-palette-*` CSS custom properties
 * into the `.alert__root` container element.
 *
 * All descendant slots (`icon`, `title`, `description`, `closeTrigger`) consume tokens
 * like `colorPalette.600` or `colorPalette.50`. This completely decouples slot visual styling
 * (`subtle`, `solid`, `leftAccent`) from the specific status color family.
 */
export const alertSlotRecipe = defineSlotRecipe({
  className: 'alert',
  description: 'Multi-slot recipe for status banners with compound variants and palette inheritance',
  slots: ['root', 'icon', 'content', 'title', 'description', 'closeTrigger'],
  base: {
    root: {
      position: 'relative',
      display: 'flex',
      alignItems: 'flex-start',
      gap: '3',
      width: '100%',
      p: '4',
      borderRadius: 'lg',
      overflow: 'hidden',
    },
    icon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      w: '5',
      h: '5',
      mt: '0.5',
    },
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '1',
      flex: '1',
    },
    title: {
      fontFamily: 'sans',
      fontSize: 'sm',
      fontWeight: 'semibold',
      lineHeight: '1.25',
    },
    description: {
      fontFamily: 'sans',
      fontSize: 'sm',
      lineHeight: '1.5',
      opacity: '0.9',
    },
    closeTrigger: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      p: '1',
      borderRadius: 'md',
      cursor: 'pointer',
      opacity: '0.7',
      transition: 'opacity 150ms ease, background-color 150ms ease',
      _hover: {
        opacity: '1',
      },
      _focusVisible: {
        outline: '2px solid',
        outlineColor: 'colorPalette.500',
        outlineOffset: '2px',
      },
    },
  },
  variants: {
    status: {
      info: {
        root: { colorPalette: 'info' },
      },
      success: {
        root: { colorPalette: 'success' },
      },
      warning: {
        root: { colorPalette: 'warning' },
      },
      error: {
        root: { colorPalette: 'danger' },
      },
    },
    variant: {
      subtle: {
        root: {
          bg: 'colorPalette.50',
          borderWidth: '1px',
          borderColor: 'colorPalette.200',
          _dark: {
            bg: 'colorPalette.950/40',
            borderColor: 'colorPalette.900',
          },
        },
        icon: {
          color: 'colorPalette.600',
          _dark: { color: 'colorPalette.400' },
        },
        title: {
          color: 'colorPalette.900',
          _dark: { color: 'colorPalette.100' },
        },
        description: {
          color: 'colorPalette.800',
          _dark: { color: 'colorPalette.200' },
        },
        closeTrigger: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
          _hover: { bg: 'colorPalette.100', _dark: { bg: 'colorPalette.900' } },
        },
      },
      solid: {
        root: {
          bg: 'colorPalette.600',
          color: 'white',
        },
        icon: { color: 'white' },
        title: { color: 'white' },
        description: { color: 'white/90' },
        closeTrigger: {
          color: 'white',
          _hover: { bg: 'white/15' },
        },
      },
      outline: {
        root: {
          bg: 'transparent',
          borderWidth: '1px',
          borderColor: 'colorPalette.500',
        },
        icon: {
          color: 'colorPalette.600',
          _dark: { color: 'colorPalette.400' },
        },
        title: {
          color: 'colorPalette.900',
          _dark: { color: 'colorPalette.100' },
        },
        description: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
        },
        closeTrigger: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
          _hover: { bg: 'colorPalette.50', _dark: { bg: 'colorPalette.950' } },
        },
      },
      leftAccent: {
        root: {
          bg: 'colorPalette.50',
          borderLeftWidth: '4px',
          borderLeftColor: 'colorPalette.600',
          borderRightWidth: '1px',
          borderTopWidth: '1px',
          borderBottomWidth: '1px',
          borderColor: 'colorPalette.200',
          _dark: {
            bg: 'colorPalette.950/30',
            borderLeftColor: 'colorPalette.500',
            borderColor: 'colorPalette.900',
          },
        },
        icon: {
          color: 'colorPalette.600',
          _dark: { color: 'colorPalette.400' },
        },
        title: {
          color: 'colorPalette.900',
          _dark: { color: 'colorPalette.100' },
        },
        description: {
          color: 'colorPalette.800',
          _dark: { color: 'colorPalette.200' },
        },
        closeTrigger: {
          color: 'colorPalette.700',
          _dark: { color: 'colorPalette.300' },
          _hover: { bg: 'colorPalette.100', _dark: { bg: 'colorPalette.900' } },
        },
      },
    },
  },
  compoundVariants: [
    // Condition 1: Error solid alerts receive a prominent glow shadow
    {
      status: 'error',
      variant: 'solid',
      css: {
        root: {
          boxShadow: '0 4px 14px -2px rgba(239, 68, 68, 0.35)',
        },
      },
    },
    // Condition 2: Warning solid alerts require dark text for accessible contrast
    {
      status: 'warning',
      variant: 'solid',
      css: {
        root: {
          bg: 'colorPalette.500',
          color: 'neutral.950',
        },
        icon: { color: 'neutral.950' },
        title: { color: 'neutral.950' },
        description: { color: 'neutral.900' },
        closeTrigger: { color: 'neutral.950', _hover: { bg: 'black/10' } },
      },
    },
  ],
  defaultVariants: {
    status: 'info',
    variant: 'subtle',
  },
})
