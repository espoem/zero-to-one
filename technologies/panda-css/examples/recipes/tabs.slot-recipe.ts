import { defineSlotRecipe } from '@pandacss/dev'

/**
 * Tabs Slot Recipe: Multi-part component recipe for tabbed navigation interfaces.
 *
 * Panda CSS Contract:
 * - Tabs contain multiple coordinated structural parts: `root`, `list`, `trigger`, `content`, and `indicator`.
 * - State selectors like `&[data-selected]`, `&[aria-selected="true"]`, and `&[data-orientation="vertical"]`
 *   allow declarative styling that binds cleanly to headless primitives (such as Ark UI, Radix, or custom hooks).
 */
export const tabsSlotRecipe = defineSlotRecipe({
  className: 'tabs',
  description: 'Compound slot recipe for multi-orientation tabs navigation with line, enclosed, and pill variants',
  slots: ['root', 'list', 'trigger', 'content', 'indicator'],
  base: {
    root: {
      display: 'flex',
      width: '100%',
      colorPalette: 'brand',
    },
    list: {
      display: 'flex',
      position: 'relative',
      isolation: 'isolate',
    },
    trigger: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'sans',
      fontWeight: 'medium',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transitionProperty: 'color, background-color, border-color, box-shadow',
      transitionDuration: 'normal',
      transitionTimingFunction: 'default',
      userSelect: 'none',
      _disabled: {
        opacity: '0.4',
        cursor: 'not-allowed',
      },
      _focusVisible: {
        outline: '2px solid',
        outlineColor: 'colorPalette.500',
        outlineOffset: '2px',
      },
    },
    content: {
      flex: '1',
      p: '4',
      _focusVisible: {
        outline: 'none',
      },
    },
    indicator: {
      position: 'absolute',
      transitionProperty: 'top, left, width, height',
      transitionDuration: 'normal',
      transitionTimingFunction: 'emphasized',
      pointerEvents: 'none',
    },
  },
  variants: {
    orientation: {
      horizontal: {
        root: {
          flexDirection: 'column',
        },
        list: {
          flexDirection: 'row',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderBottomColor: 'border.default',
        },
        indicator: {
          bottom: '-1px',
          height: '2px',
        },
      },
      vertical: {
        root: {
          flexDirection: 'row',
        },
        list: {
          flexDirection: 'column',
          borderRightWidth: '1px',
          borderRightStyle: 'solid',
          borderRightColor: 'border.default',
        },
        indicator: {
          right: '-1px',
          width: '2px',
        },
      },
    },
    variant: {
      line: {
        trigger: {
          color: 'fg.muted',
          bg: 'transparent',
          borderBottomWidth: '2px',
          borderBottomStyle: 'solid',
          borderBottomColor: 'transparent',
          mb: '-1px',
          _hover: {
            color: 'fg.default',
          },
          '&[data-selected], &[aria-selected="true"]': {
            color: 'colorPalette.600',
            borderBottomColor: 'colorPalette.600',
            _dark: {
              color: 'colorPalette.400',
              borderBottomColor: 'colorPalette.400',
            },
          },
        },
        indicator: {
          bg: 'colorPalette.600',
          _dark: {
            bg: 'colorPalette.400',
          },
        },
      },
      enclosed: {
        list: {
          gap: '1',
          p: '1',
          bg: 'bg.subtle',
          borderRadius: 'lg',
          borderWidth: '0px',
        },
        trigger: {
          borderRadius: 'md',
          color: 'fg.muted',
          '&[data-selected], &[aria-selected="true"]': {
            bg: 'bg.surface',
            color: 'fg.default',
            boxShadow: 'xs',
          },
        },
      },
      pill: {
        list: {
          gap: '2',
          borderWidth: '0px',
        },
        trigger: {
          borderRadius: 'full',
          color: 'fg.muted',
          bg: 'transparent',
          '&[data-selected], &[aria-selected="true"]': {
            bg: 'colorPalette.500',
            color: 'white',
          },
        },
      },
    },
    size: {
      sm: {
        trigger: {
          px: '2.5',
          py: '1.5',
          fontSize: 'xs',
        },
        content: {
          p: '2',
        },
      },
      md: {
        trigger: {
          px: '3.5',
          py: '2',
          fontSize: 'sm',
        },
        content: {
          p: '4',
        },
      },
      lg: {
        trigger: {
          px: '5',
          py: '2.5',
          fontSize: 'md',
        },
        content: {
          p: '6',
        },
      },
    },
  },
  defaultVariants: {
    orientation: 'horizontal',
    variant: 'line',
    size: 'md',
  },
})
