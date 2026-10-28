import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createRequire } from 'node:module'
import { extname, join, normalize } from 'node:path'

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

/**
 * Resolve Playwright without making it a dependency: browsers are tied to the Playwright
 * build that downloaded them, so we use whichever Playwright the machine provides
 * (a global install on NODE_PATH, or `npm i -D playwright && npx playwright install chromium`).
 * Returns a reason string when unavailable so the suite can skip cleanly.
 */
export async function loadChromium(): Promise<Chromium | string> {
  try {
    const require = createRequire(import.meta.url)
    const { chromium } = require('playwright') as { chromium: Chromium }
    const browser = await chromium.launch()
    await browser.close()
    return chromium
  } catch (error) {
    return `Playwright/Chromium unavailable (${(error as Error).message.split('\n')[0]}); install with: npm i -D playwright && npx playwright install chromium`
  }
}
