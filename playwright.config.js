import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4197', viewport: { width: 430, height: 932 } },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
  webServer: { command: 'npm run preview -- --host 127.0.0.1 --port 4197 --strictPort', url: 'http://127.0.0.1:4197', reuseExistingServer: false },
})
