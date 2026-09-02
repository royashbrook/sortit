import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { appVersion } from './tools/app-version.mjs'

export default defineConfig({
  plugins: [sveltekit()],
  build: { sourcemap: true },
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  server: { port: 8130, strictPort: false },
})
