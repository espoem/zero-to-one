// The v2 CLI as a test oracle (Modules 02, 10, 11): doctor, analyze, debug and codegen --check
// all have machine-readable output, which makes them usable as CI gates.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { fixturesDir, panda, root } from './helpers/panda.ts'

const reactDir = join(root, 'examples/react')
const solidDir = join(root, 'examples/solid')

describe('panda doctor --json', () => {
  for (const [name, cwd] of [['react', reactDir], ['solid', solidDir]] as const) {
    test(`${name}: setup is valid and v2 recipe-context artifacts exist`, () => {
      const report = JSON.parse(panda(['doctor', '--json'], cwd))
      assert.equal(report.ok, true)
      assert.equal(report.errors, 0)
      assert.ok(report.artifactIds.includes('jsx-create-slot-recipe-context'))
      assert.ok(report.artifactIds.includes('jsx-create-recipe-context'))
      // v1's createStyleContext artifact is gone in v2
      assert.ok(!report.artifactIds.some((id: string) => id.includes('style-context')))
    })
  }
})

describe('panda analyze --json', () => {
  test('reports recipe and token usage across sources', () => {
    const report = JSON.parse(panda(['analyze', '--json'], reactDir))
    assert.equal(report.summary.recipes.total, 2, 'button + alert')
    assert.equal(report.summary.recipes.unique, 2, 'both are used by the app')
    assert.ok(report.summary.tokens.unique > 0 && report.summary.tokens.unique < report.summary.tokens.total)
  })
})

describe('panda debug', () => {
  const dump = (include: string) => {
    const out = mkdtempSync(join(tmpdir(), 'panda-debug-'))
    try {
      panda(['debug', '--include', include, '--outdir', out, '--json'], fixturesDir)
      const file = include.replace('/', '__') + '.extract.json'
      return JSON.parse(readFileSync(join(out, file), 'utf8'))
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  }

  test('cross-file values are folded into the extracted literal', () => {
    const extract = dump('positive/10-cross-file.ts')
    assert.deepEqual(extract.calls[0].data.map((d: { value: unknown }) => d.value)[1], { p: '8' })
  })

  test('a default-imported value leaves nothing to extract', () => {
    assert.deepEqual(dump('negative/default-import.ts').calls, [])
  })
})

describe('panda codegen --check', () => {
  test('generated styled-system is in sync with the config (CI drift gate)', () => {
    // Throws (non-zero exit) when the output is missing or stale.
    panda(['codegen', '--check'], reactDir)
  })
})

describe('panda codegen --spec (Module 05)', () => {
  test('writes a machine-readable design-system spec that keeps token references', () => {
    const out = mkdtempSync(join(tmpdir(), 'panda-spec-'))
    try {
      // --spec=<path> must be relative and inside the project; bare --spec writes <outdir>/specs/
      panda(['codegen', '--spec', '--outdir', out], fixturesDir)
      const file = join(out, 'specs', 'design-system.json')
      const spec = JSON.parse(readFileSync(file, 'utf8'))
      assert.equal(spec.schemaVersion, 1)
      assert.deepEqual(
        { ...spec.tokens['colors.accent.default'], source: undefined },
        { category: 'colors', cssVar: '--colors-accent-default', originalValue: '{colors.brand.600}', semantic: true, source: undefined },
      )
    } finally {
      rmSync(out, { recursive: true, force: true })
    }
  })
})
