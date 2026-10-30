import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Track root (the directory holding package.json). */
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
export const fixturesDir = join(root, 'examples/fixtures')
const pandaBin = join(root, 'node_modules/.bin/panda')

export interface CssgenResult {
  css: string
  /** The human summary + diagnostics the CLI printed (stdout + stderr). */
  log: string
}

/**
 * Run the real CLI (`panda cssgen`) on one fixture and return the emitted stylesheet.
 * Using the CLI rather than internal compiler APIs keeps the tests honest: this is the
 * exact path a project's build takes.
 */
export function cssgen(options: { include?: string; config?: string; cwd?: string; extraArgs?: string[] } = {}): CssgenResult {
  const cwd = options.cwd ?? fixturesDir
  const out = mkdtempSync(join(tmpdir(), 'panda-css-'))
  const outfile = join(out, 'styles.css')
  const args = ['cssgen', '--no-color', '-o', outfile]
  if (options.include) args.push('--include', options.include)
  if (options.config) args.push('--config', options.config)
  if (options.extraArgs) args.push(...options.extraArgs)
  try {
    const run = spawnSync(pandaBin, args, { cwd, encoding: 'utf8' })
    if (run.status !== 0) throw new Error(`panda cssgen failed (${run.status}):\n${run.stdout}${run.stderr}`)
    const css = readFileSync(outfile, 'utf8')
    return { css, log: run.stdout + run.stderr }
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}

/** Run any panda subcommand and return stdout. */
export function panda(args: string[], cwd = fixturesDir): string {
  return execFileSync(pandaBin, [...args, '--no-color'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Class selectors present in a stylesheet, unescaped (`.c_red\.500` -> `c_red.500`). */
export function classNames(css: string): Set<string> {
  const names = new Set<string>()
  for (const m of css.matchAll(/\.((?:\\.|[\w-])+)/g)) names.add(m[1]!.replace(/\\(.)/g, '$1'))
  return names
}

export const snapshotPath = (name: string) => join(fixturesDir, '__snapshots__', `${name}.css`)
export const identity = [(v: unknown) => String(v)]
