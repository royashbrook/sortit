import adapter from '@sveltejs/adapter-static'
import { appVersion } from './tools/app-version.mjs'

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    // one prerendered page, no server: the whole game is a board and a localStorage save
    adapter: adapter({ pages: 'build', assets: 'build', precompress: false, strict: true }),
    // served from a subpath by the site build, so keep asset urls relative
    paths: { relative: true },
    // poll the deployed version so kit knows when an update exists (the honest
    // running-vs-deployed check the About screen reads). the same three-part
    // version the player sees, so version.json and the sw cache name match it
    version: { name: appVersion(), pollInterval: 300000 },
    // the worker is registered by hand in +layout.svelte so dev never gets a stale one
    serviceWorker: { register: false },
  },
}
