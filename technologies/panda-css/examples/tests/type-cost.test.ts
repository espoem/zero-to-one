// Module 09: the type-check cost of `jsxStyleProps`. Same component source, two configs
// ('all' vs 'minimal'); TypeScript's --extendedDiagnostics counts are deterministic.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { panda, root } from './helpers/panda.ts'

const tsc = join(root, 'node_modules/.bin/tsc')

function measure(mode: 'all' | 'minimal') {
  const cwd = join(root, 'examples/bench/jsx-style-props', mode)
  panda(['codegen'], cwd)
  const out = execFileSync(tsc, ['-p', 'tsconfig.json', '--extendedDiagnostics'], { cwd, encoding: 'utf8' })
  const num = (label: string) => Number(out.match(new RegExp(`${label}:\\s+(\\d+)`))![1])
  return { types: num('Types'), instantiations: num('Instantiations') }
}

test("jsxStyleProps: 'minimal' type-checks with fewer types and instantiations than 'all'", () => {
  const all = measure('all')
  const minimal = measure('minimal')
  // 2026-10-29, TS 7.0.2: all = 4967 types / 8587 instantiations; minimal = 4172 / 5073.
  assert.ok(minimal.types < all.types, JSON.stringify({ all, minimal }))
  assert.ok(minimal.instantiations < all.instantiations * 0.8, JSON.stringify({ all, minimal }))
})
