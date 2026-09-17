import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { releaseIdentity } from './tools/app-version.mjs'
import { licensePlugin } from './tools/license-inventory.mjs'

const release = releaseIdentity()

export default defineConfig({
  plugins: [sveltekit(), licensePlugin(release)],
  build: { sourcemap: true },
  define: { __APP_VERSION__: JSON.stringify(release.version), __RELEASE__: JSON.stringify(release) },
  server: { port: 8130, strictPort: false },
})
