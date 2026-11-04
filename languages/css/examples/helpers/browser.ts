import { createRequire } from 'node:module';
import { delimiter, dirname, join } from 'node:path';
import type { Browser, BrowserType, Page } from 'playwright';

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'];

/**
 * Resolve a Playwright whose Chromium actually launches on this machine.
 *
 * The track pins `playwright` in package.json (run `npx playwright install chromium` once).
 * Browser binaries belong to the Playwright build that downloaded them, so if the pinned build
 * has no browser here (e.g. an image that preinstalled browsers for another Playwright on
 * NODE_PATH), try every other `playwright` resolvable from NODE_PATH. If none launches, browser
 * tests are skipped with a clear reason instead of failing (AGENTS.md: skip cleanly).
 */
async function probe(): Promise<{ chromium: BrowserType; info: string } | string> {
  const require = createRequire(import.meta.url);
  const candidates: string[] = [];
  try { candidates.push(require.resolve('playwright')); } catch {}
  for (const dir of (process.env.NODE_PATH ?? '').split(delimiter).filter(Boolean)) {
    try {
      const resolved = require.resolve('playwright', { paths: [dir] });
      if (!candidates.includes(resolved)) candidates.push(resolved);
    } catch {}
  }
  const errors: string[] = [];
  for (const entry of candidates) {
    try {
      const mod = require(entry) as { chromium: BrowserType };
      const version = (require(join(dirname(entry), 'package.json')) as { version: string }).version;
      const browser = await mod.chromium.launch({ headless: true, args: LAUNCH_ARGS });
      const info = `playwright ${version}, chromium ${browser.version()}`;
      await browser.close();
      return { chromium: mod.chromium, info };
    } catch (err) {
      errors.push(`${entry}: ${String((err as Error).message).split('\n')[0]}`);
    }
  }
  return `no launchable Chromium (run \`npx playwright install chromium\`): ${errors.join(' | ') || 'playwright not installed'}`;
}

const resolved = await probe();
/** `false` when a browser is available, otherwise the skip reason. Use as `it(name, { skip: browserSkip }, fn)`. */
export const browserSkip: string | false = typeof resolved === 'string' ? resolved : false;
if (typeof resolved !== 'string') console.log(`# browser tests using ${resolved.info}`);

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!cachedBrowser) {
    if (typeof resolved === 'string') throw new Error(resolved);
    cachedBrowser = await resolved.chromium.launch({ headless: true, args: LAUNCH_ARGS });
  }
  return cachedBrowser;
}

export async function createPage(htmlContent: string): Promise<{ page: Page; cleanup: () => Promise<void> }> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });
  return {
    page,
    cleanup: async () => {
      await context.close();
    },
  };
}

export async function closeSharedBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}
