import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

function appVersion() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const since = execSync(`git rev-list ${tag}..HEAD --count`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return `${tag.replace(/^v/, '')}.${since}`
  } catch {
    return '0.0.0-dev'
  }
}

export default defineConfig({
  plugins: [sveltekit()],
  build: { sourcemap: true },
  define: { __APP_VERSION__: JSON.stringify(appVersion()) },
  server: { port: 8130, strictPort: false },
})
