import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/?page=fragment-refs');
  await expect(page.locator('#a')).toBeAttached();
});

test('getClientRects returns real boxes for every first-level child, in order', async ({
  page,
}) => {
  const { rects, children } = await page.evaluate(() => ({
    rects: window.fragment.getClientRects().map((r) => ({ top: r.top, height: r.height })),
    children: ['a', 'b'].map((id) => {
      const r = document.getElementById(id)!.getBoundingClientRect();
      return { top: r.top, height: r.height };
    }),
  }));
  expect(rects).toEqual(children);
  expect(rects[0]!.height).toBe(80);
});

test('scrollIntoView moves a real viewport to the first or last child', async ({ page }) => {
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.evaluate(() => window.fragment.scrollIntoView());
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const top = () => page.evaluate(() => document.getElementById('a')!.getBoundingClientRect().top);
  await expect.poll(top).toBe(0);

  await page.evaluate(() => {
    window.scrollTo(0, 0);
    window.fragment.scrollIntoView(false);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getElementById('b')!.getBoundingClientRect().bottom - innerHeight,
      ),
    )
    .toBe(0);
});

test('observeUsing delivers real IntersectionObserver and ResizeObserver callbacks per child', async ({
  page,
}) => {
  const seen = () => page.evaluate(() => window.seen);
  await expect.poll(() => seen().then((s) => s.resized.sort())).toEqual(['a', 'b']);
  expect((await seen()).intersecting).toEqual([]); // below the fold
  await page.evaluate(() => window.fragment.scrollIntoView());
  await expect.poll(() => seen().then((s) => s.intersecting.sort())).toEqual(['a', 'b']);
});

test('a child added later joins existing observers and listeners', async ({ page }) => {
  await page.click('#add');
  await expect(page.locator('#c')).toBeAttached();
  await expect.poll(() => page.evaluate(() => window.seen.resized.sort())).toEqual(['a', 'b', 'c']);
  await page.click('#c-button');
  expect(await page.evaluate(() => window.seen.clicks)).toEqual(['c']);
});

test('focus and focusLast use the real focus model; position methods match the DOM', async ({
  page,
}) => {
  const active = () => page.evaluate(() => document.activeElement?.id);
  await page.evaluate(() => window.fragment.focus());
  expect(await active()).toBe('a-button');
  await page.evaluate(() => window.fragment.focusLast());
  expect(await active()).toBe('b-button');
  await page.evaluate(() => window.fragment.blur());
  expect(await active()).toBe('');

  const positions = await page.evaluate(() => ({
    root: window.fragment.getRootNode() === document,
    before:
      (window.fragment as any).compareDocumentPosition(document.getElementById('before')!) &
      Node.DOCUMENT_POSITION_PRECEDING,
  }));
  expect(positions.root).toBe(true);
  expect(positions.before).toBeTruthy();
});
