import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { delimiter, dirname, extname, join, normalize } from 'node:path'

const types: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
}

/** Minimal static file server for a Vite `dist/` folder (module scripts need http://). */
export async function serve(dir: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '')
    let file = join(dir, path)
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(dir, 'index.html')
    res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream')
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(() => r())) }
}

type Chromium = { launch: () => Promise<any> }

/** Which Playwright build the e2e suites ended up using (printed once per run). */
export let playwrightInfo = ''

/**
 * Resolve Playwright and launch Chromium, or return a reason string so suites skip cleanly.
 *
 * The track pins `playwright` (package.json devDependency) for reproducible setups:
 *   npm install && npx playwright install chromium
 * Browser binaries are tied to the Playwright build that downloaded them. If the pinned build
 * has no browser on this machine (e.g. a CI image that preinstalled browsers for an older
 * Playwright on NODE_PATH), fall back to every other `playwright` that `require` can resolve
 * from the NODE_PATH entries, and use the first one that actually launches.
 */
export async function loadChromium(): Promise<Chromium | string> {
  const require = createRequire(import.meta.url)
  const candidates: string[] = []
  try {
    candidates.push(require.resolve('playwright'))
  } catch {}
  for (const dir of (process.env.NODE_PATH ?? '').split(delimiter).filter(Boolean)) {
    try {
      const resolved = require.resolve('playwright', { paths: [dir] })
      if (!candidates.includes(resolved)) candidates.push(resolved)
    } catch {}
  }
  const errors: string[] = []
  for (const entry of candidates) {
    try {
      const mod = require(entry) as { chromium: Chromium }
      const version = (require(join(dirname(entry), 'package.json')) as { version: string }).version
      const browser = await mod.chromium.launch()
      const browserVersion = browser.version?.() ?? '?'
      await browser.close()
      playwrightInfo = `playwright ${version} (${entry}), chromium ${browserVersion}`
      return mod.chromium
    } catch (error) {
      errors.push(`${entry}: ${(error as Error).message.split('\n')[0]}`)
    }
  }
  return `Playwright/Chromium unavailable (${errors.join(' | ') || 'playwright not installed'}); run: npm install && npx playwright install chromium`
}
