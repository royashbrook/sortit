import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { levelBoard } from '../src/lib/engine/levels.js'
import {
  ROLLBACK_KEY,
  decodeSave,
  encodeSave,
  importSave,
  restoreRollback,
  saveLink,
} from '../src/lib/ui/save-transfer.js'

class MemoryStorage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)) }
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}

class FailingStorage extends MemoryStorage {
  constructor(values, blockedKey, blockedValue) {
    super(values)
    this.blockedKey = blockedKey
    this.blockedValue = blockedValue
  }
  setItem(key, value) {
    if (key === this.blockedKey && String(value) === this.blockedValue) throw new Error('blocked write')
    super.setItem(key, value)
  }
}

const board = levelBoard(12)
let uid = 0
const game = JSON.stringify({
  kind: 'level',
  n: 12,
  tubes: board.tubes.map(tube => tube.map(c => ({ uid: uid++, c, hid: false }))),
  moves: 3,
  history: [],
  elapsed: 1234,
  seen: [],
})
const oldProgress = JSON.stringify({ current: 2, done: { 1: 14 }, stars: { 1: 2 } })
const newProgress = JSON.stringify({ current: 12, done: { 1: 10, 11: 18 }, stars: { 1: 3, 11: 2 } })
const source = new MemoryStorage({
  'sortit:progress': newProgress,
  'sortit:game': game,
  'sortit:skin': 'mine',
  'sortit:theme': 'dusk',
  'sortit:muted': '1',
})
const target = new MemoryStorage({
  'sortit:progress': oldProgress,
  'sortit:skin': 'bolts',
  'sortit:theme': 'daylight',
  'sortit:muted': '0',
})

const code = await encodeSave(source)
assert.match(code, /^si1\.[01]\./)
assert.equal((await decodeSave(code)).slots.game, game)
await importSave(code, target, () => 123)
for (const key of ['progress', 'game', 'skin', 'theme', 'muted']) {
  const storageKey = `sortit:${key}`
  assert.equal(target.getItem(storageKey), source.getItem(storageKey))
}
assert.ok(target.getItem(ROLLBACK_KEY))

restoreRollback(target)
assert.equal(target.getItem('sortit:progress'), oldProgress)
assert.equal(target.getItem('sortit:skin'), 'bolts')
assert.equal(target.getItem('sortit:theme'), 'daylight')
assert.equal(target.getItem('sortit:muted'), '0')
assert.equal(target.getItem('sortit:game'), null)
assert.equal(target.getItem(ROLLBACK_KEY), null)

const done = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [index + 1, 20 + index % 30]))
const stars = Object.fromEntries(Array.from({ length: 600 }, (_, index) => [index + 1, 1 + index % 3]))
const fullCampaign = new MemoryStorage({
  'sortit:progress': JSON.stringify({ current: 600, done, stars }),
  'sortit:game': JSON.stringify({
    ...JSON.parse(game),
    history: Array(200).fill({ tubes: JSON.parse(game).tubes, moves: 2 }),
  }),
})
const fullCode = await encodeSave(fullCampaign)
QRCode.create(saveLink(fullCode, 'https://sortit.royashbrook.com/'), { errorCorrectionLevel: 'L' })

const damaged = new MemoryStorage({ 'sortit:progress': '{"current":9999,"done":{},"stars":{}}' })
await assert.rejects(encodeSave(damaged), /valid Sort It save/)

const blocked = new FailingStorage({ 'sortit:progress': oldProgress }, 'sortit:game', game)
await assert.rejects(importSave(code, blocked), /blocked write/)
assert.equal(blocked.getItem('sortit:progress'), oldProgress)
assert.equal(blocked.getItem('sortit:game'), null)
assert.equal(blocked.getItem(ROLLBACK_KEY), null)

// A save code can stay under MAX_CODE_LENGTH while its decompressed output does not:
// 64 MB of zeros packs into an 87 KB code, which is a dead tab on the cheap phones this
// targets. Both the bounded and the unbounded version reject this code with the same
// message, so the message proves nothing. Counting the bytes actually pulled through the
// stream is what tells them apart: bound the work, do not measure the result afterwards.
const RealDecompressionStream = globalThis.DecompressionStream
let inflatedBytesPulled = 0
globalThis.DecompressionStream = class extends RealDecompressionStream {
  constructor(format) {
    super(format)
    const counted = super.readable.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          inflatedBytesPulled += chunk.byteLength
          controller.enqueue(chunk)
        },
      }),
    )
    Object.defineProperty(this, 'readable', { value: counted })
  }
}
try {
  const bomb = new Uint8Array(64 * 1024 * 1024)
  const packed = new Uint8Array(
    await new Response(
      new Blob([bomb]).stream().pipeThrough(new CompressionStream('deflate-raw')),
    ).arrayBuffer(),
  )
  let packedBinary = ''
  for (const byte of packed) packedBinary += String.fromCharCode(byte)
  const bombCode = `si1.1.${btoa(packedBinary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`
  assert.ok(bombCode.length < 100_000, 'the bomb must pass the encoded-length gate to reach the inflation gate')
  await assert.rejects(decodeSave(bombCode), /too large/)
  assert.ok(
    inflatedBytesPulled < 4 * 1024 * 1024,
    `the cap must stop the inflation rather than measure it afterwards, but ${inflatedBytesPulled} bytes were pulled`,
  )
} finally {
  globalThis.DecompressionStream = RealDecompressionStream
}

console.log('save transfer: export, import, validation, rollback, and 600-level QR verified')
