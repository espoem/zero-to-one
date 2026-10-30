// Module 02: the PostCSS plugin. Any CSS file whose content declares the Panda layer order
// is the "root" and gets replaced with the generated stylesheet for the configured sources.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import postcss from 'postcss'
import pandacss from '@pandacss/dev/postcss'
import { classNames, root } from './helpers/panda.ts'

describe('@pandacss/dev/postcss', () => {
  test('replaces the layer-order root file with the extracted stylesheet', async () => {
    const cwd = join(root, 'examples/react')
    const input = '@layer reset, base, tokens, recipes, utilities;\n'
    const result = await postcss([pandacss({ cwd })]).process(input, { from: join(cwd, 'src/index.css') })
    const names = classNames(result.css)
    assert.ok(result.css.length > 10_000, 'preflight + tokens + utilities emitted')
    assert.ok(names.has('button'), 'config recipe base class from <Button>')
    assert.ok(names.has('button--compound__size_lg__visual_outline'), 'compound variant class')
    assert.ok(names.has('alert__title'), 'slot recipe class from <Alert.Title>')
    assert.match(result.css, /@layer reset \{/, 'preflight: true emits the reset layer')
  })

  test('a CSS file without the layer declaration passes through untouched', async () => {
    const cwd = join(root, 'examples/react')
    const input = '.legacy { color: red; }\n'
    const result = await postcss([pandacss({ cwd })]).process(input, { from: join(cwd, 'src/legacy.css') })
    assert.equal(result.css, input)
  })
})
