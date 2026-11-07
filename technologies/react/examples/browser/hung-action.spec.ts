import { expect, test } from '@playwright/test';
import { SETTLE_MS } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/?page=hung-action');
  await expect(page.locator('#todos')).toHaveText('a');
  await expect(page.locator('#second-root')).toHaveText('old');
});

test('control: with no pending Action, a transition commits on the real scheduler', async ({
  page,
}) => {
  await page.click('#transition');
  await expect(page.locator('#other')).toHaveText('transition', { timeout: SETTLE_MS });
  await page.click('#second-transition');
  await expect(page.locator('#second-root')).toHaveText('new', { timeout: SETTLE_MS });
});

test('a hung Action keeps optimistic state and holds back later transitions outside act()', async ({
  page,
}) => {
  await page.click('#hang');
  await expect(page.locator('#todos')).toHaveText('a,b (saving)');
  await expect(page.locator('#pending')).toHaveText('true');

  await page.click('#transition');
  await page.click('#second-transition');
  await page.waitForTimeout(SETTLE_MS);
  await expect(page.locator('#other')).toHaveText('old');
  await expect(page.locator('#second-root')).toHaveText('old'); // the scope is per-renderer, not per-root

  await page.click('#urgent');
  await expect(page.locator('#other')).toHaveText('urgent');
  await expect(page.locator('#todos')).toHaveText('a,b (saving)');
  await expect(page.locator('#pending')).toHaveText('true');

  await page.evaluate(() => window.settleAction());
  await expect(page.locator('#todos')).toHaveText('a');
  await expect(page.locator('#pending')).toHaveText('false');
  await expect(page.locator('#second-root')).toHaveText('new');
});
