import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 06: Layout: Flexbox, Grid & Subgrid', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('proves the flexbox min-width: auto overflow trap and its min-width: 0 fix', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .container {
              width: 300px;
              display: flex;
              border: 1px solid black;
            }
            .fixed-col {
              width: 100px;
              flex-shrink: 0;
            }
            /* Buggy flex item: min-width defaults to auto */
            .buggy-flex-item {
              flex: 1;
            }
            /* Fixed flex item: min-width explicitly 0 */
            .fixed-flex-item {
              flex: 1;
              min-width: 0;
              overflow: hidden;
            }
            .unbreakable-long-text {
              width: 400px; /* Wider than container */
            }
          </style>
        </head>
        <body>
          <div id="c-bug" class="container">
            <div class="fixed-col">Sidebar</div>
            <div id="item-bug" class="buggy-flex-item">
              <div class="unbreakable-long-text">LongContent</div>
            </div>
          </div>

          <div id="c-fix" class="container">
            <div class="fixed-col">Sidebar</div>
            <div id="item-fix" class="fixed-flex-item">
              <div class="unbreakable-long-text">LongContent</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. In buggy item: width is clamped to 400px min-content, overflowing the 300px container!
      const itemBugBox = (await page.locator('#item-bug').boundingBox())!;
      assert(itemBugBox.width >= 400, 'Buggy flex item refused to shrink below 400px min-content');

      // 2. In fixed item: min-width: 0 allows it to shrink to the remaining 200px (300 - 100)
      const itemFixBox = (await page.locator('#item-fix').boundingBox())!;
      assert.equal(itemFixBox.width, 200, 'Fixed flex item with min-width: 0 shrinks to exact available space (200px)');
    } finally {
      await cleanup();
    }
  });

  it('demonstrates Subgrid alignment across nested card rows', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .deck {
              display: grid;
              grid-template-columns: 200px 200px;
              gap: 20px;
            }
            .card {
              display: grid;
              grid-row: span 3;
              grid-template-rows: subgrid;
            }
            .header { background: red; }
            .body { background: green; }
            .footer { background: blue; }
          </style>
        </head>
        <body>
          <div class="deck">
            <div class="card">
              <div id="h1" class="header">Short Header</div>
              <div id="b1" class="body">Single line body</div>
              <div id="f1" class="footer">Action 1</div>
            </div>
            <div class="card">
              <div id="h2" class="header">Very long multi-line header that wraps across several rows</div>
              <div id="b2" class="body">Multi line<br/>body content<br/>here</div>
              <div id="f2" class="footer">Action 2</div>
            </div>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const f1Box = (await page.locator('#f1').boundingBox())!;
      const f2Box = (await page.locator('#f2').boundingBox())!;

      // With subgrid, the footer of Card 1 and Card 2 must align to the exact same vertical y-coordinate
      assert.equal(
        Math.round(f1Box.y),
        Math.round(f2Box.y),
        'Subgrid must align footers of both cards to the exact same vertical y-coordinate'
      );
    } finally {
      await cleanup();
    }
  });
});
