// Module 08: recipe contexts (v2 replacement for createStyleContext), rendered on the server
// for both React (react-dom/server) and Solid (solid-js/web renderToString) without JSX,
// straight from the generated styled-system runtime.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createComponent, renderToString } from 'solid-js/web'
import * as reactJsx from '../fixtures/styled-system/jsx/index.js'
import * as reactRecipes from '../fixtures/styled-system/recipes/index.js'
import * as solidJsx from '../solid/styled-system/jsx/index.js'
import * as solidRecipes from '../solid/styled-system/recipes/index.js'

const classOf = (html: string, slot: string) =>
  html.match(new RegExp(`data-slot="${slot}"[^>]*class="([^"]*)"`))?.[1]?.trim()

describe('React: createSlotRecipeContext(alert)', () => {
  const { withProvider, withContext } = reactJsx.createSlotRecipeContext(reactRecipes.alert)
  const Root = withProvider('div', 'root', { defaultProps: { role: 'status' } })
  const Title = withContext('p', 'title')

  test('root splits variant props and provides per-slot classes to children', () => {
    const html = renderToStaticMarkup(h(Root, { status: 'danger', id: 'a' }, h(Title, null, 'T')))
    assert.equal(classOf(html, 'root'), 'alert__root alert__root--status_danger')
    assert.equal(classOf(html, 'title'), 'alert__title alert__title--status_danger')
    assert.match(html, /role="status"/)
    assert.doesNotMatch(html, /status="danger"/, 'variant prop is not forwarded to the DOM')
  })

  test('unstyled skips only that element; children keep their slot classes', () => {
    const html = renderToStaticMarkup(h(Root, { unstyled: true }, h(Title, null, 'T')))
    assert.equal(classOf(html, 'root'), '')
    assert.equal(classOf(html, 'title'), 'alert__title alert__title--status_info')
  })

  test('NEGATIVE: a withContext part outside its provider throws', () => {
    assert.throws(() => renderToStaticMarkup(h(Title, null, 'x')), /missing its Provider/)
  })
})

describe('React: createRecipeContext(button)', () => {
  const { withContext, PropsProvider } = reactJsx.createRecipeContext(reactRecipes.button)
  const Button = withContext('button', { defaultProps: { type: 'button' } })

  test('PropsProvider shares variant props; incoming props and css win', () => {
    const html = renderToStaticMarkup(
      h(PropsProvider, { value: { size: 'lg' } }, h(Button, null, 'a'), h(Button, { size: 'sm', css: { color: 'red.500' } }, 'b')),
    )
    assert.match(html, /<button type="button" class="button button--size_lg button--visual_solid">a<\/button>/)
    assert.match(html, /class="button button--size_sm button--visual_solid c_red\.500">b</)
  })
})

describe('Solid: createSlotRecipeContext(alert)', () => {
  const { withProvider, withContext } = solidJsx.createSlotRecipeContext(solidRecipes.alert)
  const Root = withProvider('div', 'root')
  const Title = withContext('p', 'title')

  test('same slot classes as React, rendered by Solid SSR', () => {
    const html = renderToString(() =>
      createComponent(Root, {
        status: 'danger',
        get children() {
          return createComponent(Title, { children: 'T' })
        },
      }),
    )
    assert.equal(classOf(html, 'root'), 'alert__root alert__root--status_danger')
    assert.equal(classOf(html, 'title'), 'alert__title alert__title--status_danger')
  })

  test('NEGATIVE: outside the provider it throws', () => {
    assert.throws(() => renderToString(() => createComponent(Title, { children: 'x' })), /missing its Provider/)
  })
})
