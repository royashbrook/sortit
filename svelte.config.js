import adapter from '@sveltejs/adapter-static'
import { releaseIdentity } from './tools/app-version.mjs'

const release = releaseIdentity()

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // one prerendered page, no server: the whole game is a board and a localStorage save
    adapter: adapter({ pages: 'build', assets: 'build', precompress: false, strict: true }),
    // served from a subpath by the site build, so keep asset urls relative
    paths: { relative: true },
    // Fingerprints detect same-version rebuilds and intentional rollbacks too.
    // UI metadata, Kit's version manifest and the worker share this identity.
    version: { name: release.fingerprint },
    // The mounted update controller owns registration, polling and consent.
    serviceWorker: { register: false },
  },
}
