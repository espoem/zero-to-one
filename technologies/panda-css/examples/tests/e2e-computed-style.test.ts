// Playwright computed-style tests (Modules 01, 03, 04, 06, 07, 08, 09).
// Builds the React and Solid apps with Vite + @pandacss/vite, with and without source
// transforms, serves each build, and asserts what the browser actually computes.
// Skips (does not fail) when Playwright or Chromium is not installed.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'vite'
import { loadChromium, playwrightInfo, serve } from './helpers/browser.ts'
import { root } from './helpers/panda.ts'

const chromium = await loadChromium()
const skip = typeof chromium === 'string' ? chromium : false
if (!skip) console.log(`# e2e using ${playwrightInfo}`)

const builds = [
  { app: 'react', transform: false },
  { app: 'react', transform: true },
  { app: 'solid', transform: false },
  { app: 'solid', transform: true },
] as const

const rgb = { brand600: 'rgb(79, 70, 229)', brand500: 'rgb(99, 102, 241)', brand900: 'rgb(49, 46, 129)', brand100: 'rgb(224, 231, 255)' }

async function buildApp(app: string, transform: boolean): Promise<string> {
  const outDir = join(root, 'examples', app, transform ? 'dist-transform' : 'dist')
  process.env.PANDA_TRANSFORM = transform ? '1' : '0'
  process.env.PANDA_OUT_DIR = outDir
  await build({ configFile: join(root, 'examples', app, 'vite.config.ts'), logLevel: 'silent' })
  return outDir
}

const jsOf = (dir: string) =>
  readdirSync(join(dir, 'assets'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dir, 'assets', f), 'utf8'))
    .join('\n')

// The css() runtime carries this utility-name map; transformed bundles must not.
const RUNTIME_MARKER = 'WebkitTextFillColor:wktf-c'

describe('vanilla app: every call site static', { skip }, () => {
  test('transform: true removes the css() runtime and shrinks the bundle', async () => {
    const plain = jsOf(await buildApp('vanilla', false))
    const transformed = jsOf(await buildApp('vanilla', true))
    assert.ok(plain.includes(RUNTIME_MARKER))
    assert.ok(!transformed.includes(RUNTIME_MARKER))
    // Class order inside the literal may differ from the runtime's; order is irrelevant to the cascade.
    assert.ok(transformed.includes('bg_teal.100 bdr_xl p_6 hover:bg_teal.200'))
    assert.ok(transformed.length * 5 < plain.length, `${transformed.length} vs ${plain.length} bytes`)
  })
})

for (const { app, transform } of builds) {
  describe(`${app}${transform ? ' + transform' : ''}`, { skip }, () => {
    let browser: any
    let page: any
    let server: Awaited<ReturnType<typeof serve>>
    let dist: string

    before(async () => {
      dist = await buildApp(app, transform)
      server = await serve(dist)
      browser = await (chromium as Exclude<typeof chromium, string>).launch()
      page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
      await page.goto(server.url)
      await page.getByTestId('page').waitFor()
    })

    after(async () => {
      await browser?.close()
      await server?.close()
    })

    const style = (testId: string, prop: string) =>
      page.getByTestId(testId).evaluate((el: Element, p: string) => getComputedStyle(el).getPropertyValue(p), prop)

    test(transform ? 'transform: static css() calls become string literals' : 'default: css() calls stay calls', () => {
      const js = jsOf(dist)
      assert.equal(js.includes('d_flex flex-d_column @card/wide:flex-d_row'), transform)
      // Dynamic call sites (Badge's css(badge.raw({ tone }), cssProp), the styled factory)
      // keep the runtime alive, so the transform does NOT remove it in this app.
      assert.ok(js.includes(RUNTIME_MARKER))
    })

    test('config recipe base + default variants apply (recipes layer)', async () => {
      assert.equal(await style('solid', 'background-color'), rgb.brand600)
      assert.equal(await style('solid', 'height'), '32px')
    })

    test('semantic token switches under the .dark condition', async () => {
      // The recipe sets transition-duration, so poll until the transition settles.
      const settle = (expected: string) =>
        page.waitForFunction(
          ([sel, want]: [string, string]) => getComputedStyle(document.querySelector(sel)!).backgroundColor === want,
          ['[data-testid=solid]', expected],
          { timeout: 2000 },
        )
      await page.getByTestId('solid').click()
      await settle(rgb.brand500)
      await page.getByTestId('solid').click()
      await settle(rgb.brand600)
      assert.equal(await style('solid', 'background-color'), rgb.brand600)
    })

    test('v2 compound variant beats the plain variant (recipes.compound_variants)', async () => {
      assert.equal(await style('outline-lg', 'border-top-width'), '2px')
    })

    test('css prop (utilities layer) beats recipe, variant and compound', async () => {
      assert.equal(await style('override', 'border-top-width'), '4px')
      assert.equal(await style('override', 'background-color'), rgb.brand900)
    })

    test('cva + css prop merge: caller style wins per property', async () => {
      assert.equal(await style('badge', 'background-color'), rgb.brand100)
      assert.equal(await style('badge', 'font-weight'), '700')
    })

    test('slot recipe context: parts get their slot class and data-slot', async () => {
      assert.equal(await style('alert-title', 'font-weight'), '600')
      assert.equal(await page.getByTestId('alert').getAttribute('data-slot'), 'root')
      assert.equal(await page.getByTestId('alert').getAttribute('role'), 'status')
      assert.match(await style('alert', 'background-color'), /^oklch\(/)
    })

    test('container query: named container + theme.containers threshold', async () => {
      assert.equal(await style('cq-narrow', 'flex-direction'), 'column')
      assert.equal(await style('cq-wide', 'flex-direction'), 'row')
    })

    test('NEGATIVE: concatenated classes resolve by stylesheet order, css() merge by object order', async () => {
      const concat = await style('concat', 'color')
      const merged = await style('merged', 'color')
      assert.notEqual(concat, merged, 'string order is ignored by the cascade')
      const orange700 = await page.evaluate(() => {
        const el = document.createElement('p')
        el.className = 'c_orange.700'
        document.body.append(el)
        return getComputedStyle(el).color
      })
      assert.equal(concat, orange700, 'the atom later in the sheet wins, regardless of class order')
    })
  })
}
