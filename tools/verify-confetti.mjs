import assert from 'node:assert/strict'
import { confetti, clearConfetti } from '../src/lib/ui/confetti.ts'
import { drawConfettiPiece } from '../src/lib/ui/confetti-art.ts'
import { SKINS } from '../src/lib/engine/skins.ts'

let now = 0, id = 0, reduced = false
const frames = new Map(), attached = new Set(), calls = []
const context = new Proxy({}, { get: (_, key) => (...args) => calls.push([key, ...args]) })
Object.assign(globalThis, {
  innerWidth: 430, innerHeight: 932, devicePixelRatio: 3,
  performance: { now: () => now },
  matchMedia: () => ({ matches: reduced }),
  requestAnimationFrame: fn => { frames.set(++id, fn); return id },
  cancelAnimationFrame: n => frames.delete(n),
  document: {
    createElement: () => ({ style: {}, dataset: {}, setAttribute() {}, getContext: () => context, remove() { attached.delete(this) } }),
    body: { append: canvas => attached.add(canvas) },
  },
})
function advance(ms) {
  for (let t = 0; t < ms; t += 50) {
    now += 50
    const pending = [...frames.values()]
    frames.clear()
    for (const fn of pending) fn(now)
  }
}

const signatures = new Set()
for (const { key } of SKINS) {
  calls.length = 0
  for (let variant = 0; variant < 3; variant++) drawConfettiPiece(context, key, '#AA44BB', variant)
  signatures.add(JSON.stringify(calls))
  const has = (name, ...args) => calls.some(c => c[0] === name && args.every((v, i) => c[i + 1] === v))
  if (key === 'bolts') { assert(has('fill', 'evenodd'), 'nuts need a hole'); assert(has('strokeRect'), 'screws need a shaft') }
  if (key === 'mine') { assert(has('moveTo', -8, -4), 'cubes need projected faces'); assert(has('fillRect', -6, -1, 2, 2), 'cubes need pixel grain') }
  if (key === 'dash') assert(has('moveTo', -1, -9), 'neon needs lightning')
  if (key === 'kawaii') { assert(has('bezierCurveTo'), 'hearts need their lobes'); assert(has('lineTo'), 'stars need their points') }
  if (key === 'dice') {
    assert(has('roundRect'), 'dice need rounded bodies')
    assert.equal(calls.filter(c => c[0] === 'arc').length, 9, 'one, three and five pips')
    assert.equal(calls.filter(c => c[0] === 'stroke').length, 12, 'outlined pips stay visible on pale dice')
  }
  if (key === 'tubes') { assert(has('arc'), 'classic bubbles'); assert(has('fillRect'), 'classic paper') }

  confetti(['#AA44BB'], key)
  assert.equal(attached.size, 1)
  const canvas = [...attached][0]
  assert.equal(canvas.dataset.skin, key)
  assert.equal(canvas.width, 860, 'DPR capped at two')
  calls.length = 0
  advance(100)
  assert.equal(calls.filter(c => c[0] === 'drawImage').length, 192, '96 stamps per frame')
  assert.equal(calls.some(c => ['beginPath', 'arc', 'roundRect', 'fillRect'].includes(c[0])), false, 'no per-frame path construction')
  assert.equal(frames.size, 1)
  clearConfetti()
  assert.equal(frames.size, 0)
  assert.equal(attached.size, 0)
}
assert.equal(signatures.size, SKINS.length, 'every look has its own geometry')

confetti(['#AA44BB'], 'bolts')
const old = [...attached][0]
confetti(['#AA44BB'], 'dice')
assert.equal(attached.has(old), false, 'a second win retires the first burst')
assert.equal(frames.size, 1)
advance(2700)
assert.equal(attached.size, 0, 'the burst expires')
assert.equal(frames.size, 0, 'no orphan animation frame')

confetti(['#AA44BB'], 'bolts')
const staleFrame = [...frames.values()][0]
confetti(['#AA44BB'], 'dice')
now += 2700
staleFrame(now)
clearConfetti()
assert.equal(attached.size, 0, 'an old completion cannot retire ownership of a newer burst')
assert.equal(frames.size, 0)

confetti(['#AA44BB'], 'mine')
reduced = true
confetti(['#AA44BB'], 'mine')
assert.equal(attached.size, 0, 'reduced motion clears any previous burst')
assert.equal(frames.size, 0)
console.log('confetti: six material families, bounded lifecycle and reduced motion pass')
