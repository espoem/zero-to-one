import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 09: Registered Custom Properties (@property)', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates @property type enforcement and initial-value fallback under invalid syntax', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @property --typed-color {
              syntax: "<color>";
              inherits: true;
              initial-value: rgb(0, 128, 0); /* Green initial default */
            }

            .test-box {
              /* Attempt to set an invalid value (a length instead of a color) */
              --typed-color: 42px;
              color: var(--typed-color);
            }
          </style>
        </head>
        <body>
          <div id="target" class="test-box">Typed Property Test</div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('#target').evaluate((el) => window.getComputedStyle(el).color);
      // Because --typed-color is registered as <color>, assigning 42px is rejected at parse time,
      // and the variable cleanly falls back to its registered initial-value: rgb(0, 128, 0)!
      assert.equal(
        color,
        'rgb(0, 128, 0)',
        'Registered @property must reject invalid type and fall back to initial-value'
      );
    } finally {
      await cleanup();
    }
  });

  it('proves that registered length property resolves to computed pixel units', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @property --box-width {
              syntax: "<length>";
              inherits: false;
              initial-value: 100px;
            }

            .test-box {
              --box-width: 15rem; /* 15 * 16 = 240px */
              width: var(--box-width);
              height: 50px;
            }
          </style>
        </head>
        <body>
          <div id="box" class="test-box"></div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const width = await page.locator('#box').evaluate((el) => parseFloat(window.getComputedStyle(el).width));
      assert.equal(width, 240, 'Registered length property must compute correctly to 240px');
    } finally {
      await cleanup();
    }
  });
});
