import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 07: Positioning, Stacking Contexts & Top Layer', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('proves the transformed ancestor trap on position: fixed', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; }
            .card {
              position: relative;
              top: 100px;
              left: 100px;
              width: 200px;
              height: 200px;
              /* TRANSFORM MAKES THIS THE CONTAINING BLOCK FOR FIXED DESCENDANTS! */
              transform: scale(1);
            }
            .fixed-modal {
              position: fixed;
              top: 0;
              left: 0;
              width: 50px;
              height: 50px;
              background: red;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div id="modal" class="fixed-modal">Fixed</div>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const box = (await page.locator('#modal').boundingBox())!;
      // Because .card has transform: scale(1), the "fixed" element's top:0, left:0
      // is relative to .card (x=100, y=100), NOT viewport (0, 0)!
      assert.equal(box.x, 100, 'Fixed modal was trapped at x=100 by transformed ancestor');
      assert.equal(box.y, 100, 'Fixed modal was trapped at y=100 by transformed ancestor');
    } finally {
      await cleanup();
    }
  });

  it('demonstrates that native Popovers render in the Top Layer above high z-indexes', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; }
            .high-z-index-blocker {
              position: fixed;
              top: 0;
              left: 0;
              width: 100vw;
              height: 100vh;
              background: blue;
              z-index: 999999; /* Massive z-index attempting to cover everything */
            }
            [popover] {
              position: fixed;
              inset: auto;
              margin: 0;
              top: 50px;
              left: 50px;
              width: 200px;
              height: 100px;
              background: green;
              border: none;
            }
          </style>
        </head>
        <body>
          <div id="blocker" class="high-z-index-blocker">Blocker</div>
          <div id="my-popover" popover="auto">Popover in Top Layer</div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // Open the popover via browser API
      await page.locator('#my-popover').evaluate((el: any) => el.showPopover());

      const isOpen = await page.locator('#my-popover').evaluate((el: any) => el.matches(':popover-open'));
      assert.equal(isOpen, true, 'Popover must match :popover-open');

      // Query which element is hit-tested at point (60, 60)
      const topElementId = await page.evaluate(() => {
        const el = document.elementFromPoint(60, 60);
        return el ? (el.closest('#my-popover') ? 'my-popover' : el.id) : null;
      });

      // The popover in the top layer must be on top of the z-index: 999999 blocker!
      assert.equal(topElementId, 'my-popover', 'Native Popover in Top Layer must render above z-index: 999999');
    } finally {
      await cleanup();
    }
  });
});
