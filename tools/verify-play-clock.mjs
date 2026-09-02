// The phone clock measures visible play, and RESET stays one tap from a game.
import { readFileSync } from 'node:fs'
import { createPlayClock, formatPlayTime } from '../src/lib/ui/play-clock.js'

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

const page = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8')
if (!page.includes('<button onclick={() => store.replay()}>RESET</button>')) fail('RESET is not a direct game control')
if (!page.includes('store.setVisible(!document.hidden)')) fail('visibility is not wired to the play clock')
if (!page.includes("addEventListener('pagehide', onPageHide)")) fail('page suspension does not save a paused clock')

if (!process.exitCode) console.log('play clock ok: hidden time excluded, restore/resume honest, RESET direct')
