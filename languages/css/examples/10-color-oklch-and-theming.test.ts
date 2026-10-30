import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 10: Color Spaces, OKLCH & Theming', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates OKLCH color parsing and relative color syntax opacity extraction', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              --base-color: oklch(0.60 0.25 140);
            }
            .target {
              /* Relative Color Syntax extracting channels and applying 50% alpha */
              background-color: oklch(from var(--base-color) l c h / 0.5);
            }
          </style>
        </head>
        <body>
          <div id="target" class="target">OKLCH Test</div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const bg = await page.locator('#target').evaluate((el) => window.getComputedStyle(el).backgroundColor);
      // Modern engines parse OKLCH and return an rgba() or oklch() color with alpha 0.5
      assert(
        bg.includes('0.5') || bg.includes('128'),
        `Background color must reflect 50% opacity from Relative Color Syntax: ${bg}`
      );
    } finally {
      await cleanup();
    }
  });

  it('proves light-dark() adapts dynamically to color-scheme settings', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            :root {
              color-scheme: light dark;
            }
            .themed-box {
              background-color: light-dark(rgb(255, 255, 255), rgb(0, 0, 0));
              color: light-dark(rgb(0, 0, 0), rgb(255, 255, 255));
            }
          </style>
        </head>
        <body>
          <div id="box" class="themed-box">Themed Box</div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. Force light scheme via emulation
      await page.emulateMedia({ colorScheme: 'light' });
      let bg = await page.locator('#box').evaluate((el) => window.getComputedStyle(el).backgroundColor);
      assert.equal(bg, 'rgb(255, 255, 255)', 'light-dark() must evaluate to white in light mode');

      // 2. Force dark scheme via emulation
      await page.emulateMedia({ colorScheme: 'dark' });
      bg = await page.locator('#box').evaluate((el) => window.getComputedStyle(el).backgroundColor);
      assert.equal(bg, 'rgb(0, 0, 0)', 'light-dark() must evaluate to black in dark mode');
    } finally {
      await cleanup();
    }
  });
});
