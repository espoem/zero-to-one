import { expect, test, type Page } from '@playwright/test';
import { SETTLE_MS } from './helpers.ts';

/** Holds a stylesheet response open until the returned function is called. */
async function holdStylesheet(page: Page, path: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(`**${path}`, async (route) => {
    await released;
    await route.fulfill({
      contentType: 'text/css',
      body: '.styled { color: rgb(1, 2, 3); }',
    });
  });
  return release;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?page=stylesheets');
  await expect(page.locator('#old')).toBeVisible();
});

test('Transition: the old screen stays until the stylesheet loads, with no fallback', async ({
  page,
}) => {
  const release = await holdStylesheet(page, '/slow-a.css');
  await page.click('#transition');
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator('#old')).toBeVisible();
  await expect(page.locator('#transition-fallback')).toHaveCount(0);
  await expect(page.locator('#transition-content')).toHaveCount(0);

  release();
  await expect(page.locator('#transition-content')).toHaveCSS('color', 'rgb(1, 2, 3)');
  await expect(page.locator('#old')).toHaveCount(0);
});

test('urgent update: the boundary shows its fallback until the stylesheet loads', async ({
  page,
}) => {
  const release = await holdStylesheet(page, '/slow-b.css');
  await page.click('#urgent');
  await expect(page.locator('#urgent-fallback')).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator('#urgent-content')).toHaveCount(0);

  release();
  await expect(page.locator('#urgent-content')).toHaveCSS('color', 'rgb(1, 2, 3)');
  await expect(page.locator('#urgent-fallback')).toHaveCount(0);
});
