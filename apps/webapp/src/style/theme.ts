import { defaultConfig, createSystem, defineSlotRecipe, defineRecipe } from '@chakra-ui/react';
import {
  cardAnatomy,
  checkboxAnatomy,
  comboboxAnatomy,
  emptyStateAnatomy,
  menuAnatomy,
  selectAnatomy,
  tableAnatomy,
  tabsAnatomy,
  toastAnatomy,
} from '@chakra-ui/react/anatomy';

export const vemetricTheme = createSystem(defaultConfig, {
  globalCss: {
    html: {
      colorPalette: 'gray',
      bg: 'bg.muted',
    },
    '*': {
      '&::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
        borderRadius: '8px',
        backgroundColor: `rgba(0, 0, 0, 0.05)`,
        _dark: {
          backgroundColor: `rgba(255, 255, 255, 0.05)`,
        },
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: `rgba(0, 0, 0, 0.15)`,
        borderRadius: '8px',
        _dark: {
          backgroundColor: `rgba(255, 255, 255, 0.15)`,
        },
      },
    },
    '*::selection': {
      _dark: {
        bg: 'gray.300/50',
      },
    },
    '.simplebar-content-wrapper': {
      outline: 'none!important',
    },
    '.simplebar-scrollbar::before': {
      bg: 'gray.600!important',
    },
    '#crisp-chatbox > div > a': {
      display: 'none!important',
    },
    '.vault-overlay': {
      position: 'fixed',
      inset: 0,
      backgroundColor: 'black/50',
      zIndex: 'modal',
    },
    '.vault-content': {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      outline: 'none',
      height: 'fit',
      bg: 'bg.card',
      zIndex: 'modal',
      roundedTop: 'xl',
      p: 3,
    },
  },
  theme: {
    tokens: {
      colors: {
        purple: {
          50: { value: '#f4f2ff' },
          100: { value: '#ebe8ff' },
          200: { value: '#dad4ff' },
          300: { value: '#bfb2ff' },
          400: { value: '#a086ff' },
          500: { value: '#8458fd' },
          600: { value: '#7232f5' },
          700: { value: '#6420e1' },
          800: { value: '#541abd' },
          900: { value: '#46189a' },
          950: { value: '#290c69' },
        },
      },
    },
    semanticTokens: {
      colors: {
        logo: { value: { _light: '#101D26', _dark: 'white' } },

        purple: {
          subtle: { value: { _light: '{colors.purple.100/50}', _dark: '{colors.purple.900/30}' } },
          muted: { value: { _light: '{colors.purple.200}', _dark: '{colors.purple.800/50}' } },
          emphasized: { value: { _light: '{colors.purple.300}', _dark: '{colors.purple.500/40}' } },
        },

        bg: {
          card: { value: { _light: 'white', _dark: '{colors.gray.800}' } },
          content: { value: { _light: '#fbfaff', _dark: '#2a2931' } },
        },
      },
    },
    recipes: {
      button: defineRecipe({
        base: {
          rounded: 'lg',
        },
        variants: {
          variant: {
            surface: {
              bg: 'bg.card',
              shadowColor: 'colorPalette.emphasized',
              _hover: {
                bg: 'colorPalette.subtle',
              },
              _expanded: {
                bg: 'colorPalette.subtle',
              },
            },
          },
        },
      }),
      input: defineRecipe({
        variants: {
          variant: {
            outline: {
              bg: 'bg.card',
              borderColor: 'colorPalette.emphasized',
              focusRingWidth: '0px',
            },
          },
        },
      }),
      skeleton: defineRecipe({
        base: {
          rounded: 'lg',
        },
        variants: {
          variant: {
            pulse: {
              bg: 'gray.emphasized/90',
              _dark: {
                bg: 'gray.emphasized/50',
              },
            },
          },
        },
      }),
    },
    slotRecipes: {
      card: defineSlotRecipe({
        slots: cardAnatomy.keys(),
        variants: {
          size: {
            xs: {
              root: {
                '--card-padding': 'spacing.3',
              },
              title: {
                textStyle: 'sm',
              },
            },
          },
          variant: {
            outline: {
              root: {
                bg: 'bg.card',
                borderWidth: '1px',
                borderColor: 'gray.emphasized',
              },
            },
          },
        },
        defaultVariants: {
          size: 'xs',
        },
      }),
      checkbox: defineSlotRecipe({
        slots: checkboxAnatomy.keys(),
        base: {
          control: {
            base: {
              rounded: 'l2',
            },
          },
        },
      }),
      combobox: defineSlotRecipe({
        slots: comboboxAnatomy.keys(),
        variants: {
          variant: {
            outline: {
              input: {
                borderColor: 'colorPalette.emphasized',
              },
            },
          },
          size: {
            '2xs': {
              root: {
                '--combobox-input-height': 'sizes.7',
                '--combobox-input-padding-x': 'spacing.2',
                '--combobox-indicator-size': 'sizes.3.5',
              },
              input: {
                textStyle: 'xs',
                px: '2',
              },
              content: {
                '--combobox-item-padding-x': 'spacing.1.5',
                '--combobox-item-padding-y': 'spacing.1',
                '--combobox-indicator-size': 'sizes.3.5',
                p: '1',
                textStyle: 'xs',
              },
              trigger: {
                textStyle: 'xs',
                gap: '1',
              },
              item: {
                minH: 6,
              },
            },
          },
        },
        base: {
          input: {
            focusRingWidth: '0px',
            pr: 6,
            textOverflow: 'ellipsis',
          },
          content: {
            minW: '350px',
          },
          item: {
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: 'flex',
            justifyContent: 'flex-start',
            gap: 4,
          },
        },
      }),
      emptyState: defineSlotRecipe({
        slots: emptyStateAnatomy.keys(),
        base: {
          title: {
            color: 'fg.muted',
            textAlign: 'center',
            fontWeight: 'medium',
          },
        },
        variants: {
          size: {
            sm: {
              root: {
                py: 3,
              },
              indicator: {
                fontSize: '40px',
              },
              title: {
                fontSize: 'md',
              },
            },
            md: {
              indicator: {
                fontSize: '80px',
              },
            },
            lg: {
              indicator: {
                fontSize: '120px',
              },
            },
          },
        },
        defaultVariants: {
          size: 'sm',
        },
      }),
      menu: defineSlotRecipe({
        slots: menuAnatomy.keys(),
        base: {
          content: {
            bg: 'bg',
          },
          item: {
            _hover: {
              bg: { _light: '{colors.gray.200}', _dark: '{colors.gray.700}' },
            },
          },
        },
        variants: {
          size: {
            sm: {
              content: {
                p: 0,
              },
              item: {
                py: 2,
                px: 2.5,
              },
            },
            md: {
              content: {
                p: 0,
              },
              item: {
                py: 2.5,
                px: 3,
              },
            },
          },
        },
      }),
      select: defineSlotRecipe({
        slots: selectAnatomy.keys(),
        variants: {
          variant: {
            outline: {
              trigger: {
                bg: 'bg.card',
                borderColor: 'colorPalette.emphasized',
                focusRingWidth: '0px',
                _expanded: {
                  borderColor: 'colorPalette.focusRing',
                },
              },
            },
          },
        },
      }),
      table: defineSlotRecipe({
        slots: tableAnatomy.keys(),
        variants: {
          variant: {
            outline: {
              root: {
                boxShadow: '0 0 0 1px {colors.gray.emphasized}',
              },
              columnHeader: {
                borderColor: 'gray.emphasized',
              },
              row: {
                borderColor: 'gray.emphasized',
              },
            },
            line: {
              columnHeader: {
                fontWeight: 'semibold',
                _dark: {
                  bg: 'gray.900',
                },
              },
              cell: {
                borderColor: 'gray.emphasized',
              },
              row: {
                bg: 'bg.card',
              },
            },
          },
        },
      }),
      tabs: defineSlotRecipe({
        slots: tabsAnatomy.keys(),
        variants: {
          variant: {
            enclosed: {
              root: {
                border: '1px solid',
                borderColor: 'gray.emphasized/50!important',
                borderRadius: 'lg!important',
              },
              list: {
                '--segment-radius': 'radii.l2',
                display: 'inline-flex',
                minW: 'max-content',
                textAlign: 'center',
                position: 'relative',
                isolation: 'isolate',
                bg: 'gray.emphasized/30',
                w: '100%',
                p: 1.5,
                borderBottom: '1px solid',
                borderBottomColor: 'gray.emphasized/50',
                _dark: {
                  bg: 'gray.subtle',
                },
              },
              trigger: {
                display: 'flex',
                alignItems: 'center',
                userSelect: 'none',
                fontSize: 'sm',
                position: 'relative',
                color: 'fg',
                bg: 'bg.muted',
                shadow: 'sm',
                ml: -1,
                opacity: 0.8,
                _disabled: {
                  opacity: '0.5',
                },
                '&:has(input:focus-visible)': {
                  focusRing: 'outside',
                },
                _first: {
                  borderLeftRadius: 'var(--segment-radius)',
                  ml: 0,
                  _before: {
                    opacity: '0',
                  },
                },

                _selected: {
                  opacity: 1,
                  shadow: 'sm',
                  bg: 'bg.card',
                  borderRadius: 'var(--segment-radius)',
                  zIndex: 1,
                },

                _dark: {
                  bg: 'bg.card/60',
                  _selected: {
                    bg: 'bg.card',
                  },
                },
              },
            },
            outline: {
              trigger: {
                _horizontal: {
                  roundedTop: 'lg',
                  _first: {
                    ml: 3,
                  },
                  _selected: {
                    borderColor: 'gray.emphasized/70',
                  },
                },
              },
              list: {
                _horizontal: {
                  _before: {
                    content: '""',
                    position: 'absolute',
                    bottom: '-9px',
                    width: '100%',
                    height: '10px',
                    borderTopWidth: 'var(--line-thickness)',
                    borderTopColor: 'gray.emphasized/70',
                    borderBottomWidth: '0px',
                    borderTopRadius: 'lg',
                  },
                },
              },
              content: {
                p: '3!important',
                border: '1px solid',
                borderColor: 'gray.emphasized/70',
                rounded: 'lg',
                borderTop: 'none',
              },
            },
          },
        },
      }),
      toast: defineSlotRecipe({
        slots: toastAnatomy.keys(),
        base: {
          root: {
            rounded: 'lg',
            '&[data-type=error]': {
              bg: 'red.500',
              color: 'red.contrast',
            },
            '&[data-type=warning]': {
              bg: 'orange.400',
              color: 'black',
            },
          },
        },
      }),
    },
  },
});
export default vemetricTheme;
