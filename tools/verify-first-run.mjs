// The first-run card shows once, on the very first board, and never again.
//
// the real store on a fake page: a fresh save shows the card and flags it
// at once, a second boot of the same save does not, a save with progress
// from before the flag counts as welcomed, and the first move takes it down.
import { registerHooks } from 'node:module'
import { compileModule } from 'svelte/compiler'

const fail = message => { console.error(`FAIL ${message}`); process.exitCode = 1 }

registerHooks({
  load(url, context, next) {
    const loaded = next(url, context)
    if (!url.endsWith('.svelte.js')) return loaded
    return { format: 'module', shortCircuit: true, source: compileModule(String(loaded.source), { generate: 'client', filename: url }).js.code }
  },
})
const stored = new Map()
globalThis.localStorage = {
  getItem: key => stored.get(key) ?? null,
  setItem: (key, value) => { stored.set(key, String(value)) },
  removeItem: key => { stored.delete(key) },
}
globalThis.document = { hidden: false, addEventListener() {}, documentElement: { style: { setProperty() {} } } }
globalThis.addEventListener = () => {}
globalThis.matchMedia = () => ({ matches: true }) // reduced motion: no confetti canvas to build
globalThis.window = globalThis
const { createStore } = await import('../src/lib/ui/store.svelte.js')

let store = createStore()
if (store.welcome !== true) fail('a fresh save did not show the first-run card')
if (JSON.parse(stored.get('sortit:progress') ?? '{}').welcomed !== true) fail('showing the card did not flag the save')

store = createStore()
if (store.welcome !== false) fail('a second boot showed the first-run card again')

stored.clear()
stored.set('sortit:progress', JSON.stringify({ current: 4, done: { 1: 6, 2: 7, 3: 8 }, stars: {} }))
store = createStore()
if (store.welcome !== false) fail('a save with progress from before the flag showed the card')

stored.clear()
store = createStore()
store.tap(0); store.tap(2)
if (store.welcome !== false) fail('the first move did not take the card down')

stored.clear()
store = createStore()
store.dismissWelcome()
if (store.welcome !== false) fail('GOT IT did not take the card down')

if (!process.exitCode) console.log('first run ok: the card shows once on a fresh save, is flagged at once, and goes on GOT IT or the first move')
process.exit() // the store's tick interval would keep node up
