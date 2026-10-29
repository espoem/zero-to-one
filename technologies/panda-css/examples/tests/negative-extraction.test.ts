// Negative fixtures: code that LOOKS styled but produces no CSS (Module 10), plus
// misconfigurations that silently drop CSS after a v1 -> v2 upgrade (Module 12).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { classNames, cssgen } from './helpers/panda.ts'

const utilities = (css: string) => css.slice(css.indexOf('@layer utilities')).trim()

describe('static extraction cannot see runtime values', () => {
  test('dynamic values (props, Math.random) emit nothing; a CSS variable reference does', () => {
    const { css } = cssgen({ include: 'negative/dynamic-value.ts' })
    const names = [...classNames(css)]
    assert.deepEqual(names.filter((n) => n.startsWith('c_') || n.startsWith('op_')), ['c_var(--badge-tone)'])
  })

  test('default imports are not followed', () => {
    const { css } = cssgen({ include: 'negative/default-import.ts' })
    assert.ok(!css.includes('teal'), css)
    assert.ok(!css.includes('@layer utilities'), 'no utilities at all')
  })

  test('namespace imports are not followed', () => {
    const { css } = cssgen({ include: 'negative/namespace-import.ts' })
    assert.ok(!css.includes('lime'), css)
  })

  test('helpers whose body calls an unknown function are skipped silently', () => {
    const { css, log } = cssgen({ include: 'negative/helper-unsupported.ts' })
    assert.ok(!classNames(css).has('m_9'))
    assert.match(log, /diagnostics: 0/)
  })

  test('a local binding that shadows `css` is not a Panda call', () => {
    const { css } = cssgen({ include: 'negative/shadowed-css.ts' })
    const names = classNames(css)
    assert.ok(names.has('c_pink.700'))
    assert.ok(!names.has('c_pink.300'))
  })

  test('config recipe with a runtime variant: only defaults (+ eager compounds) are emitted', () => {
    const { css } = cssgen({ include: 'negative/config-recipe-dynamic.ts' })
    const names = classNames(css)
    assert.ok(names.has('button--size_sm'), 'default variant emitted')
    assert.ok(!names.has('button--size_lg'), 'runtime-chosen variant is invisible')
  })

  test('string concatenation: both conflicting atoms exist, stylesheet order decides', () => {
    const { css } = cssgen({ include: 'negative/string-concat.ts' })
    const u = utilities(css)
    const i300 = u.indexOf('.c_orange\\.300')
    const i700 = u.indexOf('.c_orange\\.700')
    assert.ok(i300 > -1 && i700 > -1)
    // Atoms of the same property sort by value, not by usage order, so `orange.700`
    // (later in the sheet) beats `orange.300` no matter how the strings are concatenated.
    assert.ok(i700 > i300)
  })
})

describe('v1 -> v2 misconfigurations', () => {
  test('without @pandacss/preset-base: unknown_condition + raw, unresolved token values', () => {
    const { css, log } = cssgen({ config: 'configs/no-preset-base.config.ts' })
    assert.match(log, /warning unknown_condition .*`_hover`/)
    assert.match(css, /color: red\.500;/, 'token path leaks into CSS as an invalid value')
    // Shorthands are utilities from preset-base, so `p` leaks as an invalid property.
    // (Breakpoints still work: they come from preset-panda's theme, not preset-base.)
    assert.match(css, /\bp: 2px;/)
    assert.match(css, /@card\/wide \{/, 'container condition leaks as an invalid at-rule')
  })

  test('legacy theme.containerSizes is ignored: no @container rule', () => {
    const { css, log } = cssgen({ config: 'configs/container-sizes.config.ts' })
    assert.ok(!css.includes('@container'), css)
    assert.match(log, /diagnostics: 0/, 'and nothing warns about it')
  })

  test('theme.breakpoints without extend replaces the whole set', () => {
    const { css, log } = cssgen({ config: 'configs/breakpoints-replace.config.ts' })
    assert.match(log, /nested_property/)
    assert.ok(!/@media \(width >= 48rem\)/.test(css), 'md breakpoint is gone')
  })

  test('@property registrations ship only when used; propertyFallback re-adds plain initial values', () => {
    const plain = cssgen({ include: 'positive/05-property-registration.ts' }).css
    assert.match(plain, /@property --translate-y \{/)
    assert.ok(!plain.includes('*, ::before, ::after'), 'no universal variable reset by default')
    const fallback = cssgen({ config: 'configs/property-fallback.config.ts' }).css
    assert.match(fallback, /\*, ::before, ::after, ::backdrop \{[^}]*--translate-y: 0;/)
  })
})
