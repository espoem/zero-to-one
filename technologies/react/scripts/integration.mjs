// Real-browser proofs (Playwright against a production `vite preview` build). Skips when Chromium is absent.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

if (!existsSync(chromium.executablePath())) {
  console.log(
    '[SKIP] test:integration: Chromium is not installed. Run `mise exec -- npx playwright install chromium`.',
  );
  process.exit(0);
}

const { status } = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(status ?? 1);
