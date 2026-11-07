import { defineConfig } from '@playwright/test';

const port = 41731;

export default defineConfig({
  testDir: 'examples/browser',
  outputDir: 'examples/browser/.generated/results',
  fullyParallel: true,
  forbidOnly: true,
  reporter: 'list',
  use: { baseURL: `http://127.0.0.1:${port}`, browserName: 'chromium' },
  webServer: {
    command: `vite build --config examples/browser/vite.config.ts && vite preview --config examples/browser/vite.config.ts --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/?page=hung-action`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
