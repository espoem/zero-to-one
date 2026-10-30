// Module 11: shipping a design system with `panda lib` and consuming it with `designSystem`.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { classNames, cssgen, panda, root } from './helpers/panda.ts'

const ds = join(root, 'examples/monorepo/packages/ds')
const web = join(root, 'examples/monorepo/apps/web')

describe('panda lib (design-system package)', () => {
  test('writes the manifest, preset and build info, and keeps package.json exports in sync', () => {
    const before = readFileSync(join(ds, 'package.json'), 'utf8')
    panda(['codegen'], ds)
    panda(['lib'], ds)
    for (const f of ['lib.json', 'preset.mjs', 'buildinfo.json']) assert.ok(existsSync(join(ds, 'dist/panda', f)), f)
    const lib = JSON.parse(readFileSync(join(ds, 'dist/panda/lib.json'), 'utf8'))
    assert.equal(lib.name, '@acme/ds')
    assert.equal(lib.importMap.recipes, '@acme/ds/recipes')
    assert.deepEqual(lib.files, ['../src/Badge.tsx', '../src/Button.tsx', '../src/index.ts'])
    // `panda lib` owns every export except ".". The committed file must already be its output.
    assert.equal(readFileSync(join(ds, 'package.json'), 'utf8'), before)
    const exportsMap = JSON.parse(before).exports
    assert.equal(exportsMap['.'], './src/index.ts')
    assert.ok(exportsMap['./panda/*'] && exportsMap['./recipes'] && exportsMap['./jsx'])
  })
})

describe('designSystem (consuming app)', () => {
  test("app scans only its own files, yet ships the package's styles from build info", () => {
    const { css, log } = cssgen({ cwd: web })
    assert.match(log, /parsed 2 files/, 'App.tsx + ButtonOnly.tsx; none of the package sources')
    const names = classNames(css)
    for (const n of ['button', 'button--size_lg', 'bg_brand.100', 'c_app', 'p_6']) assert.ok(names.has(n), n)
    assert.match(css, /--colors-app: #0f766e/, 'app token extends the package theme')
  })

  test('app styled-system re-exports what the package owns', () => {
    panda(['codegen'], web)
    assert.match(readFileSync(join(web, 'styled-system/recipes/index.js'), 'utf8'), /from '@acme\/ds\/recipes\/button'/)
  })

  test('stale or missing build info falls back to re-extracting the package files, with a warning', () => {
    const bi = join(ds, 'dist/panda/buildinfo.json')
    renameSync(bi, `${bi}.bak`)
    try {
      const { css, log } = cssgen({ cwd: web })
      assert.match(log, /warning design_system_buildinfo_stale/)
      assert.ok(classNames(css).has('button--size_lg'))
    } finally {
      renameSync(`${bi}.bak`, bi)
    }
  })

  test('NEGATIVE: listing the design system in include is an error', () => {
    const run = spawnSync(join(root, 'node_modules/.bin/panda'), ['cssgen', '--config', 'panda.in-include.config.ts', '--no-color'], {
      cwd: web,
      encoding: 'utf8',
    })
    assert.notEqual(run.status, 0)
    assert.match(run.stdout + run.stderr, /error design_system_in_include/)
  })

  test('optimize.treeshakeDesignSystem hydrates only the modules the app imports', () => {
    const all = classNames(cssgen({ cwd: web, config: 'panda.no-treeshake.config.ts' }).css)
    const shaken = classNames(cssgen({ cwd: web, config: 'panda.treeshake.config.ts' }).css)
    assert.ok(all.has('bg_brand.100'), 'Badge atoms hydrated by default')
    assert.ok(!shaken.has('bg_brand.100'), 'Badge is never imported, so its atoms are dropped')
    assert.ok(shaken.has('button--size_lg'), 'Button is imported and stays')
  })
})
