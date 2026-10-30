import { chromium, type Browser, type Page } from 'playwright';

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!cachedBrowser) {
    cachedBrowser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });
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
