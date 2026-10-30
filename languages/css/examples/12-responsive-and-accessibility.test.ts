import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 12: Responsive & Accessible CSS', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates :focus-visible matching keyboard navigation', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            button {
              outline: 2px solid transparent;
            }
            button:focus-visible {
              outline-color: rgb(0, 0, 255); /* Blue only on keyboard focus */
            }
          </style>
        </head>
        <body>
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. Mouse click does NOT trigger :focus-visible
      await page.locator('#btn1').click();
      let outlineColor = await page.locator('#btn1').evaluate((el) => window.getComputedStyle(el).outlineColor);
      assert.notEqual(outlineColor, 'rgb(0, 0, 255)', 'Mouse click must not trigger :focus-visible');

      // 2. Tab key navigation DOES trigger :focus-visible
      await page.keyboard.press('Tab');
      outlineColor = await page.locator('#btn2').evaluate((el) => window.getComputedStyle(el).outlineColor);
      assert.equal(outlineColor, 'rgb(0, 0, 255)', 'Keyboard Tab navigation must trigger :focus-visible blue outline');
    } finally {
      await cleanup();
    }
  });

  it('demonstrates field-sizing: content expanding textarea with typed text', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            textarea {
              field-sizing: content;
              font-family: monospace;
              line-height: 20px;
              padding: 5px;
            }
          </style>
        </head>
        <body>
          <textarea id="ta"></textarea>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      const initialBox = (await page.locator('#ta').boundingBox())!;

      // Type multiple lines of text
      await page.locator('#ta').fill('Line 1\nLine 2\nLine 3\nLine 4\nLine 5');
      const expandedBox = (await page.locator('#ta').boundingBox())!;

      assert(
        expandedBox.height > initialBox.height,
        `field-sizing: content must expand height from ${initialBox.height} to ${expandedBox.height}`
      );
    } finally {
      await cleanup();
    }
  });
});
