import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 05: Box Model & Block Formatting Contexts (BFC)', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates parent-child margin collapse and its resolution via display: flow-root', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 0; }
            .collapsing-parent {
              background: lightgray;
              /* No border, no padding, normal block flow */
            }
            .collapsing-parent .child {
              margin-top: 50px;
              height: 20px;
              background: blue;
            }

            .bfc-parent {
              background: lightgray;
              display: flow-root; /* Establishes a BFC! Isolates internal margins */
            }
            .bfc-parent .child {
              margin-top: 50px;
              height: 20px;
              background: green;
            }
          </style>
        </head>
        <body>
          <div id="p1" class="collapsing-parent">
            <div id="c1" class="child"></div>
          </div>
          <div id="p2" class="bfc-parent">
            <div id="c2" class="child"></div>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // In p1 (collapsing): child top margin collapses OUTSIDE the parent.
      // So parent top equals child top!
      const p1Box = (await page.locator('#p1').boundingBox())!;
      const c1Box = (await page.locator('#c1').boundingBox())!;
      assert.equal(p1Box.y, c1Box.y, 'Parent top margin collapsed with child: both start at y = 50px');

      // In p2 (flow-root BFC): child margin is CONTAINED INSIDE the parent.
      // Parent starts before child!
      const p2Box = (await page.locator('#p2').boundingBox())!;
      const c2Box = (await page.locator('#c2').boundingBox())!;
      assert.equal(c2Box.y - p2Box.y, 50, 'Child margin of 50px is contained cleanly inside BFC parent');
    } finally {
      await cleanup();
    }
  });

  it('proves that aspect-ratio derives cross-axis dimension deterministically', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .video-box {
              width: 320px;
              aspect-ratio: 16 / 9;
            }
          </style>
        </head>
        <body>
          <div id="video" class="video-box"></div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const box = (await page.locator('#video').boundingBox())!;
      assert.equal(box.width, 320);
      // 320 * (9 / 16) = 180
      assert.equal(box.height, 180, 'Height must be exactly 180px derived from 16/9 aspect-ratio');
    } finally {
      await cleanup();
    }
  });
});
