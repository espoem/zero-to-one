import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 02: Syntax, Selectors & Specificity', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates that :where() has strictly zero specificity (0, 0, 0)', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            /* :where() with multiple IDs and classes has zero specificity (0, 0, 0) */
            :where(#super-id.mega-class) p {
              color: rgb(255, 0, 0); /* Red */
            }
            /* A simple type selector has specificity (0, 0, 1), beating :where()! */
            p {
              color: rgb(0, 0, 255); /* Blue */
            }
          </style>
        </head>
        <body>
          <div id="super-id" class="mega-class">
            <p id="target">I should be blue because p (0,0,1) beats :where(...) (0,0,0)</p>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('#target').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(0, 0, 255)', ':where() must have 0 specificity and lose to element selector');
    } finally {
      await cleanup();
    }
  });

  it('proves that :has() selects parents conditionally based on child elements', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .card {
              border-color: rgb(128, 128, 128); /* Gray default */
            }
            /* Select card ONLY if it contains an image */
            .card:has(> img) {
              border-color: rgb(0, 128, 0); /* Green */
            }
          </style>
        </head>
        <body>
          <div id="card-with-img" class="card">
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="test" />
          </div>
          <div id="card-text-only" class="card">
            <p>No image</p>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const borderColorImg = await page
        .locator('#card-with-img')
        .evaluate((el) => window.getComputedStyle(el).borderColor);
      const borderColorText = await page
        .locator('#card-text-only')
        .evaluate((el) => window.getComputedStyle(el).borderColor);

      assert.equal(borderColorImg, 'rgb(0, 128, 0)', 'Card with img must match :has(> img)');
      assert.equal(borderColorText, 'rgb(128, 128, 128)', 'Card without img must retain default border');
    } finally {
      await cleanup();
    }
  });
});
