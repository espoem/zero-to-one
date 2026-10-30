// Playwright on bare fixture stylesheets: compile one fixture with the CLI, inject the CSS
// into a blank page with hand-written markup, and read computed styles. No bundler involved,
// so each test isolates one cascade rule (Modules 03, 04, 05).
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { loadChromium, playwrightInfo } from './helpers/browser.ts'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cssgen, fixturesDir, panda } from './helpers/panda.ts'

const chromium = await loadChromium()
const skip = typeof chromium === 'string' ? chromium : false
if (!skip) console.log(`# e2e using ${playwrightInfo}`)

describe('fixture stylesheets in Chromium', { skip }, () => {
  let browser: any
  let page: any
  before(async () => {
    browser = await (chromium as Exclude<typeof chromium, string>).launch()
    page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  })
  after(async () => browser?.close())

  const load = async (fixture: string, body: string, config?: string) => {
    const { css } = config ? cssgen({ config }) : cssgen({ include: fixture })
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${body}</body></html>`)
  }
  const style = (sel: string, prop: string) =>
    page.locator(sel).evaluate((el: Element, p: string) => getComputedStyle(el).getPropertyValue(p), prop)

  test('property breadth: longhand beats shorthand regardless of source order', async () => {
    await load('positive/03-property-order.ts', `<div id="p" class="p_10px pt_20px"></div>`)
    assert.equal(await style('#p', 'padding-top'), '20px')
    assert.equal(await style('#p', 'padding-left'), '10px')
  })

  test('v2 border tiers: all-sides borderWidth beats the per-side borderInlineEnd shorthand', async () => {
    await load(
      'positive/03-property-order.ts',
      `<div id="v1" class="bd-w_1px border-style_solid bd-e_0"></div>
       <div id="v2" class="bd-w_1px border-style_solid bd-e-w_0"></div>`,
    )
    assert.equal(await style('#v1', 'border-right-width'), '1px', 'side re-closed: per-side shorthand lost')
    assert.equal(await style('#v2', 'border-right-width'), '0px', 'longhand override wins')
  })

  test('group and peer conditions match through ancestor/sibling selectors', async () => {
    await load(
      'positive/03-conditions.ts',
      `<div class="group" id="g"><span id="item" class="groupHover:bg_bg.subtle">x</span></div>
       <input class="peer" aria-invalid="true"><label id="lbl" class="peerInvalid:c_red.600">l</label>`,
    )
    const before = await style('#item', 'background-color')
    await page.hover('#g')
    assert.notEqual(await style('#item', 'background-color'), before)
    assert.match(await style('#lbl', 'color'), /^oklch\(/)
  })

  test('responsive object syntax maps to min-width media queries', async () => {
    await load('positive/03-conditions.ts', `<p id="t" class="fs_sm md:fs_md lg:fs_lg">t</p>`)
    for (const [width, size] of [[500, '14px'], [800, '16px'], [1100, '18px']] as const) {
      await page.setViewportSize({ width, height: 600 })
      assert.equal(await style('#t', 'font-size'), size, `at ${width}px`)
    }
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('semantic token chain resolves through var() references', async () => {
    await load('positive/05-tokens.ts', `<div id="s" class="c_fg.default bg_brand.500/40"></div>`)
    assert.equal(await style('#s', 'color'), 'rgb(24, 24, 27)')
    // color-mix(in oklab, …) with 40% of brand.500 over transparent
    assert.match(await style('#s', 'background-color'), /^(oklab|color\(srgb)/)
  })

  test('themes: static theme block, dark composition, theme condition, on-demand theme CSS', async () => {
    panda(['codegen', '--config', 'configs/themes.config.ts'])
    const contrast = JSON.parse(readFileSync(join(fixturesDir, 'styled-system-themes/themes/theme-contrast.json'), 'utf8'))
    assert.equal(contrast.id, 'panda-theme-contrast')
    await load(
      '',
      `<div id="def" class="bg_accent.default"></div>
       <section data-panda-theme="forest">
         <div id="forest" class="bg_accent.default themeForest:tt_uppercase">x</div>
         <div class="dark"><div id="forestDark" class="bg_accent.default"></div></div>
       </section>
       <section data-panda-theme="contrast"><div id="contrast" class="bg_accent.default"></div></section>`,
      'configs/themes.config.ts',
    )
    assert.equal(await style('#def', 'background-color'), 'rgb(79, 70, 229)')
    const forest = await style('#forest', 'background-color')
    const forestDark = await style('#forestDark', 'background-color')
    assert.match(forest, /^oklch\(0\.527/)
    assert.match(forestDark, /^oklch\(0\.871/)
    assert.equal(await style('#forest', 'text-transform'), 'uppercase')
    // `contrast` is not in staticCss.themes: no CSS until its JSON is injected
    assert.equal(await style('#contrast', 'background-color'), 'rgb(79, 70, 229)')
    await page.addStyleTag({ content: contrast.css })
    // GOTCHA: the on-demand theme references --colors-black, which removeUnusedTokens pruned
    // from the main sheet (nothing static used it). var() of an undefined variable makes the
    // declaration invalid at computed-value time -> background falls back to transparent.
    assert.equal(await style('#contrast', 'background-color'), 'rgba(0, 0, 0, 0)')
    await page.addStyleTag({ content: ':root { --colors-black: #000; }' })
    assert.equal(await style('#contrast', 'background-color'), 'rgb(0, 0, 0)')
  })

  test('compositions (text/layer styles) lose to plain utilities: nested layer', async () => {
    await load('positive/06-theming.ts', `<h2 id="h" class="textStyle_heading fs_sm">t</h2><h2 id="h2" class="textStyle_heading">t</h2>`)
    assert.equal(await style('#h2', 'font-size'), '24px')
    assert.equal(await style('#h', 'font-size'), '14px')
    assert.equal(await style('#h', 'font-weight'), '700', 'other composition properties still apply')
  })

  test('migration bridge: a static class reading a CSS variable set inline at runtime', async () => {
    await load('negative/dynamic-value.ts', `<span id="v" class="c_var(--badge-tone)" style="--badge-tone: rgb(1, 2, 3)">x</span>`)
    assert.equal(await style('#v', 'color'), 'rgb(1, 2, 3)')
  })
})
