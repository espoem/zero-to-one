import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 11: Motion, Transitions & @starting-style', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates @starting-style defining initial entry transition states', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .fade-panel {
              display: none;
              opacity: 0;
              transition: opacity 0.5s ease-out, display 0.5s allow-discrete;
            }
            .fade-panel.visible {
              display: block;
              opacity: 1;
            }
            @starting-style {
              .fade-panel.visible {
                opacity: 0;
              }
            }
          </style>
        </head>
        <body>
          <div id="panel" class="fade-panel">Animated Entry Panel</div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. Initial display is none
      let display = await page.locator('#panel').evaluate((el) => window.getComputedStyle(el).display);
      assert.equal(display, 'none');

      // 2. Add class .visible to trigger entry transition
      await page.locator('#panel').evaluate((el) => el.classList.add('visible'));

      // The element must immediately have display: block enabled
      display = await page.locator('#panel').evaluate((el) => window.getComputedStyle(el).display);
      assert.equal(display, 'block', 'allow-discrete must transition display to block');
    } finally {
      await cleanup();
    }
  });
});
