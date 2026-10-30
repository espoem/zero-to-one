// Module 10: compiler internals observed from the outside: conditional folding, parse-error
// recovery, plugins and hooks, split output and the Rust tracing spans of --profile.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { classNames, cssgen, fixturesDir, panda, root } from './helpers/panda.ts'

const tmp = () => mkdtempSync(join(tmpdir(), 'panda-compiler-'))

describe('literal folding', () => {
  test('open ternary -> both branches; `&&` -> right operand; `??` -> fallback', () => {
    const names = classNames(cssgen({ include: 'positive/10-conditional-values.ts' }).css)
    for (const n of ['c_green.700', 'c_gray.500', 'fw_semibold', 'ls_tight']) assert.ok(names.has(n), n)
  })

  test('parse errors are diagnostics, not failures; this one loses the whole file', () => {
    const { css, log } = cssgen({ include: 'negative/parse-error.ts' })
    assert.match(log, /warning js_parse_error negative\/parse-error\.ts/)
    assert.ok(!css.includes('cyan'), 'even the valid first call is gone')
  })
})

describe('plugins (v2 hook model)', () => {
  test('parser:before rewrites source; config:resolved removes a preset pattern; cssgen:done observes', () => {
    const dir = tmp()
    try {
      const report = join(dir, 'report.txt')
      const outfile = join(dir, 'styles.css')
      const run = spawnSync(join(root, 'node_modules/.bin/panda'), ['cssgen', '--config', 'configs/plugins.config.ts', '-o', outfile], {
        cwd: fixturesDir,
        encoding: 'utf8',
        env: { ...process.env, PANDA_PLUGIN_REPORT: report },
      })
      assert.equal(run.status, 0, run.stderr)
      const css = readFileSync(outfile, 'utf8')
      assert.ok(classNames(css).has('c_red.700'), 'tone: alarm was rewritten before parsing')
      assert.ok(Number(readFileSync(report, 'utf8')) > 0, 'cssgen:done received the CSS')

      panda(['codegen', '--config', 'configs/plugins.config.ts', '--outdir', join(dir, 'ss')])
      const patterns = readdirSync(join(dir, 'ss', 'patterns'))
      assert.ok(patterns.includes('stack.js') && !patterns.includes('spacer.js'), 'spacer removed by config:resolved')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('NEGATIVE: a v1 root `hooks` object fails with config_hooks_removed', () => {
    const run = spawnSync(join(root, 'node_modules/.bin/panda'), ['cssgen', '--config', 'configs/hooks-removed.config.ts', '--no-color'], {
      cwd: fixturesDir,
      encoding: 'utf8',
    })
    assert.equal(run.status, 1)
    assert.match(run.stdout + run.stderr, /error config_hooks_removed/)
  })
})

describe('output and observability', () => {
  test('cssgen --splitting writes one file per layer and per recipe', () => {
    const dir = tmp()
    try {
      panda(['cssgen', '--splitting', '--outdir', dir, '--include', 'positive/07-recipes.ts'])
      const files: string[] = []
      const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(join(d, e.name)) : files.push(relative(dir, join(d, e.name)))))
      walk(dir)
      for (const f of ['styles.css', 'styles/tokens.css', 'styles/recipes/button.css', 'styles/utilities.css']) assert.ok(files.includes(f), f)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('--profile writes Rust tracing spans named after the pipeline stages', () => {
    const traceDir = join(fixturesDir, '.panda')
    rmSync(traceDir, { recursive: true, force: true })
    cssgen({ include: 'positive/01-atomic-dedupe.ts', extraArgs: ['--profile'] })
    assert.ok(existsSync(join(traceDir, 'trace.json')))
    const timings = JSON.parse(readFileSync(join(traceDir, 'timings.json'), 'utf8'))
    const spans = new Set(timings.spans.map((s: { name: string }) => s.name))
    for (const s of ['compile_config', 'file_parse', 'emit_css']) assert.ok(spans.has(s), s)
    const events = JSON.parse(readFileSync(join(traceDir, 'trace.json'), 'utf8')) as { name: string }[]
    const names = new Set(events.map((e) => e.name))
    for (const s of ['oxc_parse', 'match_imports', 'extract_calls', 'encode_atoms', 'stylesheet']) assert.ok(names.has(s), s)
  })
})
