// The generated runtime (styled-system/css, /recipes) without a DOM: what class strings
// do css(), cx(), cva(), sva() and config recipes return? Module 03, 07, 08.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { css, cva, cx, sva } from '../fixtures/styled-system/css/index.js'
import { alert, button } from '../fixtures/styled-system/recipes/index.js'

describe('css() / cx() merging (Module 03)', () => {
  test('css() hashes nothing by default: class = <shorthand>_<value>', () => {
    assert.equal(css({ color: 'brand.600', p: '4' }), 'c_brand.600 p_4')
  })

  test('later style objects win per property: css(a, b) merges objects, not strings', () => {
    assert.equal(css({ color: 'orange.700' }, { color: 'orange.300' }), 'c_orange.300')
    assert.equal(css(css.raw({ color: 'orange.700' }), css.raw({ color: 'orange.300' })), 'c_orange.300')
  })

  test('NEGATIVE: string concatenation keeps both conflicting atoms', () => {
    const concatenated = `${css({ color: 'orange.300' })} ${css({ color: 'orange.700' })}`
    assert.deepEqual(concatenated.split(' '), ['c_orange.300', 'c_orange.700'])
  })

  test('cx() only joins truthy class strings: no de-duplication, no conflict resolution', () => {
    assert.equal(cx('a', false, undefined, 'b', 'a'), 'a b a')
    assert.equal(cx(css({ color: 'red.500' }), css({ color: 'blue.500' })), 'c_red.500 c_blue.500')
  })

  test('shorthands and longhands normalise to the same atom', () => {
    assert.equal(css({ paddingInline: '2' }), css({ px: '2' }))
  })
})

describe('cva() atomic recipes (Module 07)', () => {
  const badge = cva({
    base: { display: 'inline-flex', px: '2' },
    variants: {
      tone: { neutral: { bg: 'ink.100' }, brand: { bg: 'brand.100', color: 'brand.900' } },
      size: { sm: { fontSize: 'xs' }, md: { fontSize: 'sm' } },
    },
    compoundVariants: [{ tone: 'brand', size: 'md', css: { fontWeight: 'semibold' } }],
    defaultVariants: { tone: 'neutral', size: 'sm' },
  })

  test('defaults apply when no props are given', () => {
    assert.equal(badge(), 'd_inline-flex px_2 bg_ink.100 fs_xs')
  })

  test('compound variant adds its atoms only for the matching combination', () => {
    assert.equal(badge({ tone: 'brand', size: 'md' }), 'd_inline-flex px_2 bg_brand.100 c_brand.900 fs_sm fw_semibold')
    assert.ok(!badge({ tone: 'brand', size: 'sm' }).includes('fw_semibold'))
  })

  test('splitVariantProps separates recipe props from the rest', () => {
    const [variants, rest] = badge.splitVariantProps({ tone: 'brand', id: 'x', 'aria-label': 'y' })
    assert.deepEqual(variants, { tone: 'brand' })
    assert.deepEqual(rest, { id: 'x', 'aria-label': 'y' })
  })

  test('variantMap lists every variant value', () => {
    assert.deepEqual(badge.variantMap, { tone: ['neutral', 'brand'], size: ['sm', 'md'] })
  })
})

describe('config recipes return named classes (Module 07)', () => {
  test('button() returns base + variant classes', () => {
    // variant classes are ordered by variant name (size < visual), not by declaration order
    assert.equal(button(), 'button button--size_sm button--visual_solid')
  })

  test('v2: a matching compound variant contributes its own named class', () => {
    assert.equal(
      button({ visual: 'outline', size: 'lg' }),
      'button button--size_lg button--visual_outline button--compound__size_lg__visual_outline',
    )
  })

  test('button.variantMap and splitVariantProps are generated', () => {
    assert.deepEqual(button.variantMap, { visual: ['solid', 'outline'], size: ['sm', 'lg'] })
    const [v, rest] = button.splitVariantProps({ size: 'lg', type: 'submit' })
    assert.deepEqual(v, { size: 'lg' })
    assert.deepEqual(rest, { type: 'submit' })
  })
})

describe('slot recipes (Module 08)', () => {
  test('config slot recipe returns one class string per slot', () => {
    assert.deepEqual(alert({ status: 'danger' }), {
      root: 'alert__root alert__root--status_danger',
      title: 'alert__title alert__title--status_danger',
      description: 'alert__description alert__description--status_danger',
    })
  })

  test('sva returns atomic classes per slot', () => {
    const field = sva({
      slots: ['root', 'label'],
      base: { root: { display: 'grid' }, label: { fontWeight: 'medium' } },
      variants: { invalid: { true: { label: { color: 'red.600' } } } },
    })
    assert.deepEqual(field({ invalid: true }), { root: 'd_grid', label: 'fw_medium c_red.600' })
  })
})
