import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/* この開発環境には Chromium が /opt/pw-browsers に入っている。無ければ Playwright 同梱のものを使う */
const CHROME = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 60_000,
  retries: 1,        /* バトルの テンキーは 時間に敏感で、CPU が 混むと まれに 落ちる */
  workers: 2,
  use: {
    baseURL: 'http://localhost:4173/oyako-game/',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    launchOptions: existsSync(CHROME) ? { executablePath: CHROME } : {},
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/oyako-game/',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
