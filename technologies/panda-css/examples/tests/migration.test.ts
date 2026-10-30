// Module 12: the v1 -> v2 upgrade audit script against a deliberately v1-era project.
import { join } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { audit } from '../scripts/v2-upgrade-audit.ts'
import { root } from './helpers/panda.ts'

test('upgrade audit finds every v1 idiom in the fixture project', () => {
  const findings = audit(join(root, 'examples/fixtures/v1-project'))
  const rules = new Set(findings.map((f) => f.rule))
  for (const r of [
    'preset-base-missing', 'containerSizes', 'root-hooks', 'emitPackage', 'removed-options', 'array-condition',
    'panda-ship', 'cpu-prof', 'createStyleContext', 'default-import-of-styles', 'template-literal',
  ]) assert.ok(rules.has(r), r)
  // The silent ones are the dangerous ones: v2 neither fails nor warns.
  assert.deepEqual(
    [...new Set(findings.filter((f) => f.severity === 'silent').map((f) => f.rule))].sort(),
    ['containerSizes', 'default-import-of-styles', 'emitPackage', 'preset-base-missing', 'removed-options'],
  )
})

test('the v2 track itself passes the audit', () => {
  for (const dir of ['examples/react', 'examples/solid', 'examples/system', 'examples/monorepo']) {
    assert.deepEqual(audit(join(root, dir)), [], dir)
  }
})
