import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, closeSharedBrowser } from './helpers/browser.ts';

describe('Module 08: Containment & Container Queries', () => {
  after(async () => {
    await closeSharedBrowser();
  });

  it('demonstrates size container queries adapting layout based on container width', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .container-root {
              container-type: inline-size;
              width: 300px;
            }
            .child-card {
              color: rgb(255, 0, 0); /* Red when container < 500px */
            }
            @container (min-width: 500px) {
              .child-card {
                color: rgb(0, 128, 0); /* Green when container >= 500px */
              }
            }
          </style>
        </head>
        <body>
          <div id="c-root" class="container-root">
            <div id="card" class="child-card">Responsive Card</div>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. Initial container width is 300px -> color is red
      let color = await page.locator('#card').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(255, 0, 0)', 'Child card must be red when container is 300px');

      // 2. Expand container width to 600px -> container query triggers green!
      await page.locator('#c-root').evaluate((el) => {
        el.style.width = '600px';
      });

      color = await page.locator('#card').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(0, 128, 0)', 'Child card must switch to green when container expands past 500px');
    } finally {
      await cleanup();
    }
  });

  it('demonstrates style container queries querying ancestor custom properties', async () => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            .card-wrapper {
              --theme: light;
            }
            .title {
              color: rgb(0, 0, 0);
            }
            /* Style query on ancestor custom property */
            @container style(--theme: dark) {
              .title {
                color: rgb(255, 255, 255);
              }
            }
          </style>
        </head>
        <body>
          <div id="wrapper" class="card-wrapper">
            <h1 id="title" class="title">Theme Title</h1>
          </div>
        </body>
      </html>
    `;

    const { page, cleanup } = await createPage(html);
    try {
      // 1. Light theme -> black text
      let color = await page.locator('#title').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(0, 0, 0)');

      // 2. Switch ancestor custom property to dark
      await page.locator('#wrapper').evaluate((el) => {
        el.style.setProperty('--theme', 'dark');
      });

      color = await page.locator('#title').evaluate((el) => window.getComputedStyle(el).color);
      assert.equal(color, 'rgb(255, 255, 255)', 'Style query must update text to white when --theme: dark');
    } finally {
      await cleanup();
    }
  });
});
