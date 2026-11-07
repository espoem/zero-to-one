import { expect, test } from '@playwright/test';
import { recordViewTransitions, SETTLE_MS } from './helpers.ts';

test.beforeEach(async ({ page }) => {
  await recordViewTransitions(page);
  await page.goto('/?page=view-transitions');
  await expect(page.locator('#counter')).toHaveText('0');
});

const transitions = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.transitions);

test('a Transition update runs a real view transition with live pseudo-element animations', async ({
  page,
}) => {
  await page.click('#transition');
  await expect.poll(() => transitions(page).then((t) => t.length)).toBe(1);
  await expect(page.locator('#counter')).toHaveText('1');
  await expect
    .poll(() => transitions(page).then((t) => t[0]!.pseudoElements.length))
    .toBeGreaterThan(0);
  const [recorded] = await transitions(page);
  expect(recorded!.pseudoElements.join()).toContain('::view-transition-');
  await expect.poll(() => transitions(page).then((t) => t[0]!.finished)).toBe('finished');
});

test('an urgent update commits without a view transition', async ({ page }) => {
  await page.click('#urgent');
  await expect(page.locator('#counter')).toHaveText('1');
  await page.waitForTimeout(SETTLE_MS);
  expect(await transitions(page)).toEqual([]);
});

test('addTransitionType reaches CSS and selects the per-type View Transition Class', async ({
  page,
}) => {
  await page.click('#forward');
  await expect
    .poll(() => transitions(page).then((t) => t[0]?.animationNames.length ?? 0))
    .toBeGreaterThan(0);
  const [forward] = await transitions(page);
  expect(forward!.types).toEqual(['forward']);
  expect(forward!.matchesForward).toBe(true);
  expect(forward!.animationNames).toContain('forward-kf');
  expect(forward!.animationNames).not.toContain('back-kf');
  await expect.poll(() => transitions(page).then((t) => t[0]!.finished)).toBe('finished');

  await page.click('#back');
  await expect
    .poll(() => transitions(page).then((t) => t[1]?.animationNames.length ?? 0))
    .toBeGreaterThan(0);
  const back = (await transitions(page))[1]!;
  expect(back.types).toEqual(['back']);
  expect(back.matchesForward).toBe(false);
  expect(back.animationNames).toContain('back-kf');
});

test('event props receive the instance and the types for enter, exit, update and share', async ({
  page,
}) => {
  const events = () => page.evaluate(() => window.vtEvents);
  for (const button of ['#toggle', '#toggle', '#transition', '#move']) {
    const before = (await transitions(page)).length;
    await page.click(button);
    await expect.poll(() => transitions(page).then((t) => t[before]?.finished)).toBe('finished');
  }
  await expect
    .poll(() => events().then((e) => e.map((x) => x.prop)))
    .toEqual(['onEnter', 'onExit', 'onUpdate', 'onShare']);
  for (const event of await events()) {
    expect(event.instanceKeys).toEqual(
      expect.arrayContaining(['name', 'group', 'imagePair', 'old', 'new']),
    );
    expect(event.types).toEqual([]);
  }
});

test('Suspense: the fallback appears and then the reveal animates', async ({ page }) => {
  await page.click('#suspend');
  await expect(page.locator('#fallback')).toBeVisible();
  await expect.poll(() => transitions(page).then((t) => t.length)).toBe(1);

  await page.evaluate(() => window.resolveData());
  await expect(page.locator('#content')).toHaveText('loaded');
  await expect.poll(() => transitions(page).then((t) => t.length)).toBe(2);
  await expect.poll(() => transitions(page).then((t) => t[1]?.finished)).toBe('finished');
});

test('a competing view transition skips the active transition, and the update still commits', async ({
  page,
}) => {
  await page.click('#transition');
  await expect.poll(() => transitions(page).then((t) => t.length)).toBe(1);
  await page.evaluate(() => document.startViewTransition(() => {}));
  await expect(page.locator('#counter')).toHaveText('1');
  await expect.poll(() => transitions(page).then((t) => t[0]?.finished)).toBe('finished');
});
