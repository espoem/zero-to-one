// CSS snapshot fixtures: every positive fixture is compiled on its own with the real CLI and
// compared byte-for-byte with examples/fixtures/__snapshots__/<name>.css.
// Regenerate deliberately with `npm run test:update-snapshots` and review the diff.
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'node:test'
import { cssgen, fixturesDir, identity, snapshotPath } from './helpers/panda.ts'

const fixtures = readdirSync(join(fixturesDir, 'positive')).filter((f) => /\.tsx?$/.test(f))

describe('positive fixtures produce the snapshotted CSS', () => {
  for (const file of fixtures) {
    test(file, (t) => {
      const { css, log } = cssgen({ include: `positive/${file}` })
      t.assert.match(log, /diagnostics: 0/, `unexpected diagnostics:\n${log}`)
      t.assert.fileSnapshot(css, snapshotPath(file.replace(/\.tsx?$/, '')), { serializers: identity })
    })
  }
})
