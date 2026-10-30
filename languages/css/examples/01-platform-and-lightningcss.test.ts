import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { transform } from 'lightningcss';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 01: Platform, Baseline & Lightning CSS', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('compiles and lowers native nesting using Lightning CSS', () => {
    const modernCSS = `
      .card {
        color: black;
        & .title {
          font-weight: bold;
        }
        &:hover {
          color: red;
        }
      }
    `;

    const { code } = transform({
      filename: 'test.css',
      code: Buffer.from(modernCSS),
      minify: false,
    });

    const output = code.toString();
    // Verify that Lightning CSS parses and preserves or lowers nesting correctly
    assert(output.includes('.card'), 'Output must contain .card');
    assert(output.includes('.title'), 'Output must contain .title');
    assert(output.includes(':hover'), 'Output must contain :hover rule');
  });

  it('verifies @supports conditional queries in Chromium', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .target {
              color: black;
            }
            @supports (display: grid) {
              .target {
                color: rgb(0, 128, 0); /* Green if grid supported */
              }
            }
            @supports selector(:has(> span)) {
              .target {
                background-color: rgb(0, 0, 255); /* Blue if :has supported */
              }
            }
          </style>
        </head>
        <body>
          <div class="target">Test Element</div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const color = await page.locator('.target').evaluate((el) => window.getComputedStyle(el).color);
      const bg = await page.locator('.target').evaluate((el) => window.getComputedStyle(el).backgroundColor);

      assert.equal(color, 'rgb(0, 128, 0)', 'Engine must evaluate @supports (display: grid) as true');
      assert.equal(bg, 'rgb(0, 0, 255)', 'Engine must evaluate @supports selector(:has(...)) as true');
    } finally {
      await cleanup();
    }
  });
});
