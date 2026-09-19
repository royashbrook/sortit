import assert from 'node:assert/strict'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { compileModule } from 'svelte/compiler'
import { SKINS, loadSkin } from '../src/lib/engine/skins.ts'
import { landingTimes } from '../src/lib/ui/flight.ts'

registerHooks({ load(url, context, next) {
  const loaded = next(url, context)
  if (!url.endsWith('.svelte.ts')) return loaded
  return { format: 'module', shortCircuit: true, source: compileModule(stripTypeScriptTypes(String(loaded.source)), { generate: 'client', filename: url }).js.code }
} })
const saved = new Map()
const contexts = []
const param = () => ({ value: 0, values: [], setValueAtTime(value, at) { this.values.push([value, at]) }, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} })
class TestAudio {
  state = 'running'; currentTime = 10; sampleRate = 48_000; destination = {}; sources = []
  constructor() { contexts.push(this) }
  node(kind) {
    const node = { kind, frequency: param(), gain: param(), Q: {}, disconnected: false, starts: [], stops: [],
      connect(next) { this.next = next; return next }, disconnect() { this.disconnected = true },
      start(at) { this.starts.push(at) }, stop(at) { this.stops.push(at) } }
    if (kind === 'oscillator' || kind === 'noise') this.sources.push(node)
    return node
  }
  createOscillator() { return this.node('oscillator') }
  createGain() { return this.node('gain') }
  createBiquadFilter() { return this.node('filter') }
  createBufferSource() { return this.node('noise') }
  createBuffer() { return { getChannelData: () => new Float32Array(12_000) } }
  close() { this.state = 'closed'; return Promise.resolve() }
}
Object.assign(globalThis, {
  localStorage: { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
  document: { hidden: false, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {} } } },
  addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false }),
  setInterval: () => 0, AudioContext: TestAudio,
})
globalThis.window = globalThis
const { sound } = await import('../src/lib/ui/sounds.ts')
const { createStore } = await import('../src/lib/ui/store.svelte.ts')
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`)
const bolts = SKINS.find(skin => skin.key === 'bolts')

let failures = 0
async function check(name, fn) {
  try { await fn(); console.log(`ok   ${name}`) }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`) }
  await sound.dispose()
}
await check('metal seats when the nut reaches the stack', () => near(landingTimes(bolts.motion, 1)[0], bolts.motion.seconds))
for (const count of [1, 3]) await check(`mine: one timed strike and one set-down per block (${count})`, () => {
  const store = createStore()
  store.setSkin(SKINS.find(skin => skin.key === 'mine'))
  store.startLevel(1)
  // Sound API gets the real store path for one move. The convoy uses its public schedule.
  if (count === 1) { store.tap(0); store.tap(2) }
  else sound.move('stone', [.792, .852, .912], [.24624, .30624, .36624])
  const audio = contexts.at(-1)
  const clinks = audio.sources.filter(source => source.kind === 'noise' && source.next.frequency.value >= 3000)
  assert.equal(clinks.length, count, 'one pickaxe impact per block')
  clinks.forEach((source, index) => near(source.starts[0] - 10, .24624 + index * .06))
  const thuds = audio.sources.filter(source => source.kind === 'oscillator' && source.frequency.values[0]?.[0] === 150)
  assert.equal(thuds.length, count)
  thuds.forEach((source, index) => near(source.starts[0] - 10, .792 + index * .06))
  store.dispose()
})
for (const action of ['undo', 'replay', 'openLevels', 'setSkin', 'hidden', 'dispose']) await check(`cancel move audio on ${action}`, () => {
  const store = createStore()
  store.setSkin(bolts)
  store.startLevel(1)
  store.tap(0); store.tap(2)
  const scheduled = contexts.at(-1).sources.filter(source => source.starts[0] > 10)
  assert(scheduled.length > 0, 'control must include future sound')
  if (action === 'setSkin') store.setSkin(SKINS.find(skin => skin.key === 'dice'))
  else if (action === 'hidden') store.setVisible(false)
  else store[action]()
  assert(scheduled.every(source => source.disconnected && source.stops.at(-1) === undefined), 'outgoing flight still owns scheduled audio')
  store.dispose()
})
await check('new installs get glass, existing choices and unlabelled saves keep their look', () => {
  saved.clear()
  assert.equal(loadSkin().key, 'glass')
  saved.set('sortit:progress', JSON.stringify({ current: 93 }))
  assert.equal(loadSkin().key, 'bolts')
  for (const skin of SKINS) {
    saved.set('sortit:skin', skin.key)
    assert.equal(loadSkin().key, skin.key)
  }
  saved.set('sortit:skin', 'retired-look')
  assert.equal(loadSkin().key, 'bolts')
})

await check('landing particles have the same position at 30, 60 and 120 Hz', async () => {
  const { fx } = await import('../src/lib/ui/fx.ts')
  let frame, calls = [], now = 0, removed = false
  const context = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]) })
  Object.assign(globalThis, {
    performance: { now: () => now }, innerWidth: 430, innerHeight: 932, devicePixelRatio: 3,
    requestAnimationFrame: fn => { frame = fn; return 1 }, cancelAnimationFrame: () => { frame = null },
    document: { createElement: () => ({ style: {}, setAttribute() {}, getContext: () => context, remove() { removed = true } }), body: { appendChild() {} } },
  })
  const random = Math.random
  Math.random = () => .5
  try {
    const renders = [30, 60, 120].map(hz => {
      fx.dispose(); now = 0
      fx.land({ left: 20, top: 100, width: 40, height: 40 }, 'drop')
      for (let n = 1; n <= hz / 5; n++) {
        calls = []; now = n * 1000 / hz; frame(now)
      }
      return calls.filter(call => call[0] === 'arc')
    })
    assert.equal(renders[0].length, 8, 'live particles must actually render')
    assert.deepEqual(renders[1], renders[0])
    assert.deepEqual(renders[2], renders[0])
    fx.dispose()
    assert.equal(frame, null)
    assert.equal(removed, true)
  } finally { Math.random = random; fx.dispose() }
})
if (failures) process.exitCode = 1
