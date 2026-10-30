import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 04: Value Processing & Units', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('proves the IACVT (Invalid at Computed-Value Time) unset trap', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              /* A variable that is an invalid value for the color property */
              --invalid-color: 42px;
            }

            .container {
              color: rgb(0, 128, 0); /* Green on parent */
            }

            .target {
              color: rgb(255, 0, 0); /* Intended fallback: Red */
              color: var(--invalid-color); /* Invalid at computed-time -> treated as unset! */
            }
          </style>
        </head>
        <body>
          <div class="container">
            <p id="test-node" class="target">Testing IACVT</p>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('#test-node').evaluate((el) => window.getComputedStyle(el).color);
      // Because color is an inherited property, unset means INHERIT from parent (.container = green)
      // It does NOT fall back to red!
      assert.equal(
        color,
        'rgb(0, 128, 0)',
        'IACVT must treat property as unset (inheriting green from parent, not red)'
      );
    } finally {
      await cleanup();
    }
  });

  it('demonstrates mathematical clamp(min, val, max) evaluation', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .clamped-box {
              /* clamp(100px, 50vw, 300px) */
              width: clamp(100px, 50vw, 300px);
              height: 50px;
            }
          </style>
        </head>
        <body>
          <div id="box" class="clamped-box"></div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. On narrow 150px viewport: 50vw = 75px < 100px min -> clamps to 100px
      await page.setViewportSize({ width: 150, height: 600 });
      let width = await page.locator('#box').evaluate((el) => parseFloat(window.getComputedStyle(el).width));
      assert.equal(width, 100, 'Width must clamp to 100px minimum on narrow viewport');

      // 2. On wide 800px viewport: 50vw = 400px > 300px max -> clamps to 300px
      await page.setViewportSize({ width: 800, height: 600 });
      width = await page.locator('#box').evaluate((el) => parseFloat(window.getComputedStyle(el).width));
      assert.equal(width, 300, 'Width must clamp to 300px maximum on wide viewport');

      // 3. On 400px viewport: 50vw = 200px (between 100 and 300) -> evaluates to 200px
      await page.setViewportSize({ width: 400, height: 600 });
      width = await page.locator('#box').evaluate((el) => parseFloat(window.getComputedStyle(el).width));
      assert.equal(width, 200, 'Width must scale dynamically to 200px (50vw)');
    } finally {
      await cleanup();
    }
  });
});
