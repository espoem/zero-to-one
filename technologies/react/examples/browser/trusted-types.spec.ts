import { expect, test, type Page } from '@playwright/test';

const CSP = "require-trusted-types-for 'script'; trusted-types app";

/** Serves the fixture with a real CSP response header. */
async function enforce(page: Page) {
  const violations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') violations.push(message.text());
  });
  await page.route('**/?page=trusted-types', async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': CSP },
    });
  });
  await page.goto('/?page=trusted-types');
  await expect(page.locator('#trusted')).toBeVisible();
  return violations;
}

test('control: without the CSP, a plain string reaches innerHTML', async ({ page }) => {
  await page.goto('/?page=trusted-types');
  await page.click('#string');
  await expect(page.locator('#inner')).toHaveText('hello');
});

test('enforced: TrustedHTML passes through dangerouslySetInnerHTML', async ({ page }) => {
  const violations = await enforce(page);
  await page.click('#trusted');
  await expect(page.locator('#inner')).toHaveText('hello');
  expect(violations).toEqual([]);
});

test('enforced: a plain string is rejected by the browser, not by React', async ({ page }) => {
  await enforce(page);
  await page.click('#string');
  await expect(page.locator('#failed')).toBeVisible();
  await expect(page.locator('#inner')).toHaveCount(0);
  const [caught] = await page.evaluate(() => window.caught);
  expect(caught).toContain('TypeError');
  expect(caught).toContain('TrustedHTML');
});

test('observe: rendering <script> under enforcement', async ({ page }) => {
  await enforce(page);
  await page.click('#script');
  await page.waitForTimeout(300);
  console.log(
    'script',
    await page.locator('#main, main').innerHTML(),
    await page.evaluate(() => window.caught),
  );
});

test('observe: async <script src> under enforcement', async ({ page }) => {
  await enforce(page);
  await page.click('#async-script');
  await page.waitForTimeout(300);
  console.log(
    'async',
    await page.locator('head').innerHTML(),
    await page.evaluate(() => window.caught),
  );
});
