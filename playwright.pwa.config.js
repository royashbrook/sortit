import { defineConfig } from '@playwright/test'
import { join } from 'node:path'

export default defineConfig({
  testDir: './tests',
  testMatch: 'pwa.spec.js',
  outputDir: process.env.SORTIT_PWA_OUTPUT ?? 'test-results/pwa',
  reporter: [['list'], ['json', { outputFile: join(process.env.SORTIT_PWA_OUTPUT ?? 'test-results/pwa', 'report.json') }]],
  workers: 1,
  timeout: 45_000,
  use: { baseURL: 'http://127.0.0.1:4198', viewport: { width: 430, height: 932 }, serviceWorkers: 'allow' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }],
})
