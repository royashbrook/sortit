import adapter from '@sveltejs/adapter-static'
import { execSync } from 'node:child_process'

// major.minor from the last git tag, patch = commits since it (craftrush's rule,
// so the version in the menu corner counts from where the vanilla stamp left off)
function appVersion() {
  try {
    const tag = execSync('git describe --tags --abbrev=0', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const since = execSync(`git rev-list ${tag}..HEAD --count`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    return `${tag.replace(/^v/, '')}.${since}`
  } catch {
    return '0.0.0-dev'
  }
}

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // one prerendered page, no server: the whole game is a board and a localStorage save
    adapter: adapter({ pages: 'build', assets: 'build', precompress: false, strict: true }),
    // served from a subpath by the site build, so keep asset urls relative
    paths: { relative: true },
    version: { name: appVersion() },
    // the worker is registered by hand in +layout.svelte so dev never gets a stale one
    serviceWorker: { register: false },
  },
}
