// The phone clock measures visible play, and RESET stays one tap from a game.
//
// three layers: the raw clock, the session rule (first move starts it, any
// gate holds it), and the real store driven with a fake time, so the
// dialog + hidden-tab overlap is proved on the code the phone runs.
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { compileModule } from 'svelte/compiler'
import { createPlayClock, createSessionClock, formatPlayTime } from '../src/lib/ui/play-clock.js'

let now = 1_000
const clock = createPlayClock(() => now)
const fail = message => { console.error(`FAIL ${message}`); process.exitCode = 1 }

clock.start()
now += 5_000
if (clock.elapsed() !== 5_000 || formatPlayTime(clock.elapsed()) !== '0:05') fail('visible play did not advance five seconds')

clock.pause()
now += 120_000
if (clock.elapsed() !== 5_000) fail('background time leaked into elapsed play')

clock.resume()
now += 3_000
if (clock.elapsed() !== 8_000) fail('resumed play did not continue from the paused value')

clock.stop()
now += 60_000
if (clock.elapsed() !== 8_000) fail('finished game clock kept advancing')

clock.start(42_000, true)
now += 90_000
if (clock.elapsed() !== 42_000) fail('restored background game advanced before becoming visible')
clock.resume()
now += 1_000
if (clock.elapsed() !== 43_000 || formatPlayTime(clock.elapsed()) !== '0:43') fail('restored game did not resume honestly')

clock.clear()
now += 1_000
if (clock.elapsed() !== 0) fail('a cleared clock still reads time')

// the session rule
const session = createSessionClock(() => now)
session.reset()
now += 30_000
if (session.elapsed() !== 0) fail('session clock ran before the first move')
session.begin()
now += 2_000
if (session.elapsed() !== 2_000) fail('session clock did not start on the first move')
session.hold('overlay', true)
now += 10_000
if (session.elapsed() !== 2_000) fail('a dialog did not hold the session clock')
session.hold('hidden', true)
session.hold('hidden', false)
session.hold('overlay', false)
now += 1_000
if (session.elapsed() !== 3_000) fail('session clock did not resume once every gate cleared')
session.hold('hidden', true)
session.hold('overlay', true)
session.hold('overlay', false)
now += 10_000
if (session.elapsed() !== 3_000) fail('closing a dialog resumed a hidden session')
session.hold('hidden', false)
session.finish()
now += 10_000
if (session.elapsed() !== 3_000) fail('a finished session kept counting')
session.hold('overlay', true)
session.hold('overlay', false)
if (session.elapsed() !== 3_000) fail('closing a dialog restarted a finished session')
session.reset()
session.restore(7_000)
now += 1_000
if (session.elapsed() !== 8_000) fail('a restored session did not carry its time')

// the store itself: compiled the way the app compiles it, run on a fake clock
// (the store reads Date.now) and a fake page (document.hidden and localStorage)
Date.now = () => now
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

// level 1 is two colours, capacity 3, two empties: tube 0 to an empty tube is
// always a legal first move, and its proof solution is a legal win
const open = () => { now += 1_000; return createStore() }
const solveOut = store => { for (const m of store.board.solution) { store.tap(m.from); store.tap(m.to) } }

let store = open()
store.startLevel(1)
now += 30_000
store.setVisible(true) // any tick refreshes the text
if (store.clock !== '0:00') fail(`store clock ran before the first move: ${store.clock}`)
store.tap(0); store.tap(2)
now += 2_000
store.setVisible(true) // any tick
if (store.clock !== '0:02') fail(`store clock did not start on the first move: ${store.clock}`)

// the overlap: open help, hide the tab, show the tab, close help
store.openDialog('howto')
now += 5_000
store.setVisible(false)
now += 5_000
store.setVisible(true)
now += 5_000
store.closeDialog()
if (store.clock !== '0:02') fail(`dialog + hidden tab leaked into the clock: ${store.clock}`)
now += 1_000
store.setVisible(true)
if (store.clock !== '0:03') fail(`clock did not resume after the last gate cleared: ${store.clock}`)

// closing a dialog over a hidden tab does not resume
store.setVisible(false)
store.openDialog('more')
store.closeDialog()
now += 10_000
store.setVisible(true)
if (store.clock !== '0:03') fail(`closing a dialog resumed a hidden game: ${store.clock}`)

// nor over the levels screen
store.openLevels()
store.openDialog('looks')
store.closeDialog()
now += 10_000
store.goGame()
if (store.clock !== '0:03') fail(`closing a dialog resumed a game behind the levels screen: ${store.clock}`)

// nor a finished board
store.startLevel(1)
solveOut(store)
if (!store.won) fail('the proof solution did not win level 1')
const finished = store.clock
store.openDialog('about')
store.closeDialog()
now += 10_000
store.setVisible(true)
if (store.clock !== finished) fail(`closing a dialog restarted a finished game: ${store.clock} after ${finished}`)

// an untouched board saved and reopened has no time on it; a moved one keeps its time
store.startLevel(1)
now += 20_000
store.setVisible(false)
store = open()
if (store.moves !== 0 || store.clock !== '0:00') fail(`an untouched board reloaded with time on it: ${store.clock}`)
store.tap(0); store.tap(2)
now += 4_000
store.setVisible(false)
store = open()
now += 60_000
store.setVisible(true)
if (store.moves !== 1 || store.clock !== '1:04') fail(`a moved board did not reload with its time: ${store.clock}`)

const page = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8')
if (!page.includes('<button onclick={() => store.replay()}>RESET</button>')) fail('RESET is not a direct game control')
if (!page.includes('store.setVisible(!document.hidden)')) fail('visibility is not wired to the play clock')
if (!page.includes("addEventListener('pagehide', onPageHide)")) fail('page suspension does not save a paused clock')

if (!process.exitCode) console.log('play clock ok: starts on the first move, every dialog and hidden tab holds it, restore/resume honest, RESET direct')
process.exit() // the store's tick interval would keep node up
