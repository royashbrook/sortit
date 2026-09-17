import assert from 'node:assert/strict'

const docListeners = new Map(), pageListeners = new Map(), saved = new Map()
const listen = (map, type, callback) => {
  if (!map.has(type)) map.set(type, new Set())
  map.get(type).add(callback)
}
const dispatch = (map, type) => { for (const callback of map.get(type) ?? []) callback() }
const attached = new Set(), frames = new Map()
let frameId = 0
const paint = new Proxy({}, { get: () => () => {} })
Object.assign(globalThis, {
  localStorage: {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key),
  },
  document: {
    hidden: false,
    addEventListener: (type, callback) => listen(docListeners, type, callback),
    removeEventListener: (type, callback) => docListeners.get(type)?.delete(callback),
    createElement: () => ({ style: {}, setAttribute() {}, getContext: () => paint, remove() { attached.delete(this) } }),
    body: { appendChild: canvas => attached.add(canvas) },
  },
  addEventListener: (type, callback) => listen(pageListeners, type, callback),
  removeEventListener: (type, callback) => pageListeners.get(type)?.delete(callback),
  innerWidth: 430, innerHeight: 932, devicePixelRatio: 2,
  requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId },
  cancelAnimationFrame: id => frames.delete(id),
})

const contexts = []
const param = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} })
class TestAudioContext {
  state = 'running'
  currentTime = 10
  sampleRate = 48_000
  destination = {}
  nodes = []
  closes = 0
  resumes = 0
  constructor() { contexts.push(this) }
  node(source = false) {
    const node = {
      source, disconnected: false, frequency: param(), gain: param(), Q: {}, stops: [],
      connect(next) { return next },
      disconnect() { this.disconnected = true },
      start() {},
      stop(at) { this.stops.push(at) },
    }
    this.nodes.push(node)
    return node
  }
  createOscillator() { return this.node(true) }
  createGain() { return this.node() }
  createBiquadFilter() { return this.node() }
  createBufferSource() { return this.node(true) }
  createBuffer() { return { getChannelData: () => new Float32Array(12_000) } }
  resume() { this.state = 'running'; this.resumes++; return Promise.resolve() }
  close() { this.state = 'closed'; this.closes++; return Promise.resolve() }
}
globalThis.AudioContext = TestAudioContext
const { sound } = await import('../src/lib/ui/sounds.ts')
assert.equal(docListeners.size, 0, 'importing audio must not install lifecycle listeners')
assert.equal(contexts.length, 0, 'audio stays gesture-lazy')
sound.mount()
sound.mount()
assert.equal(docListeners.get('visibilitychange').size, 1, 'mount is idempotent')
assert.equal(pageListeners.get('pointerdown').size, 1)
sound.pick()
const first = contexts[0]
const ended = first.nodes.find(node => node.source)
ended.onended()
assert(first.nodes.every(node => node.disconnected), 'naturally ended sources release their audio graph')
sound.move('metal', [.52, .58])
assert(first.nodes.some(node => node.source && node.stops.at(-1) > first.currentTime), 'the test actually scheduled future audio')
document.hidden = true
dispatch(docListeners, 'visibilitychange')
assert(first.nodes.every(node => node.disconnected), 'backgrounding releases every scheduled source and attached node')
assert(first.nodes.filter(node => node.source && node !== ended).every(node => node.stops.at(-1) === undefined), 'backgrounding stops future audio now')
document.hidden = false
first.state = 'suspended'
dispatch(docListeners, 'visibilitychange')
assert.equal(first.resumes, 1, 'visibility resumes an interrupted context')
first.state = 'suspended'
dispatch(pageListeners, 'pointerdown')
assert.equal(first.resumes, 2, 'a gesture resumes an interrupted context')
sound.win()
assert.equal(sound.toggle(), true)
assert.equal(saved.get('sortit:muted'), '1', 'the existing preference key survives')
assert(first.nodes.every(node => node.disconnected), 'muting cancels the already scheduled phrase')
sound.toggle()
sound.win()
await sound.dispose()
await sound.dispose()
assert.equal(first.closes, 1, 'disposal closes the context exactly once')
assert(first.nodes.every(node => node.disconnected), 'disposal releases the complete audio graph')
assert.equal(docListeners.get('visibilitychange').size, 0)
assert.equal(pageListeners.get('pointerdown').size, 0)
sound.mount()
sound.pick()
assert.equal(contexts.length, 2, 'remount gets a working fresh context on the next gesture')
assert.equal(docListeners.get('visibilitychange').size, 1, 'remount does not duplicate listeners')
await sound.dispose()

const { fx } = await import('../src/lib/ui/fx.ts')
const rect = { left: 30, top: 50, width: 64, height: 64 }
fx.land(rect, 'mine')
assert.equal(attached.size, 1)
assert.equal(frames.size, 1)
fx.dispose()
fx.dispose()
assert.equal(attached.size, 0, 'effect disposal removes the shared canvas')
assert.equal(frames.size, 0, 'effect disposal cancels the particle frame')
fx.land(rect, 'screw')
assert.equal(attached.size, 1, 'a remounted board can create effects again')
assert.equal(frames.size, 1)
fx.dispose()

console.log('presentation lifecycle: gesture-lazy audio, cancellation, graph/listener disposal, remount and canvas cleanup pass')
