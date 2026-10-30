import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 03: The Cascade, Layers & Scope', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('proves that layer order beats selector specificity for normal declarations', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @layer base, utilities;

            @layer base {
              /* Very high specificity (1, 1, 1), but in lower priority base layer */
              #main .card.active {
                color: rgb(255, 0, 0); /* Red */
              }
            }

            @layer utilities {
              /* Low specificity (0, 1, 0), but in higher priority utilities layer! */
              .u-blue {
                color: rgb(0, 0, 255); /* Blue */
              }
            }
          </style>
        </head>
        <body>
          <div id="main">
            <p id="target" class="card active u-blue">Test text</p>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('#target').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(0, 0, 255)', 'Higher priority layer (utilities) must beat lower layer (base)');
    } finally {
      await cleanup();
    }
  });

  it('demonstrates the !important layer inversion rule', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @layer base, overrides;

            @layer base {
              /* !important in EARLIER layer inverts priority to the top! */
              p {
                color: rgb(0, 128, 0) !important; /* Green */
              }
            }

            @layer overrides {
              /* In normal rules, overrides beats base. But under !important, it loses! */
              p {
                color: rgb(255, 0, 0) !important; /* Red */
              }
            }
          </style>
        </head>
        <body>
          <p id="target">Inversion test</p>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('#target').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(0, 128, 0)', '!important in earlier layer must defeat !important in later layer');
    } finally {
      await cleanup();
    }
  });

  it('proves unlayered author styles beat all layered author styles', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            @layer framework {
              #target {
                color: rgb(255, 0, 0); /* Red with ID specificity (1, 0, 0) */
              }
            }

            /* Unlayered style with low specificity (0, 0, 1) */
            p {
              color: rgb(0, 0, 255); /* Blue */
            }
          </style>
        </head>
        <body>
          <p id="target">Unlayered test</p>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('#target').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(0, 0, 255)', 'Unlayered style must override layered style');
    } finally {
      await cleanup();
    }
  });
});
