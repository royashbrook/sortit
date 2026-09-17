import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { levelBoard } from '../src/lib/engine/levels.ts'
import { SAVE_GENERATION_KEY } from '../src/lib/storage.ts'
import { normalizeGame } from '../src/lib/save-schema.ts'
import {
  ROLLBACK_KEY,
  decodeSave,
  encodeSave,
  encodeSaveSlots,
  readSaveSlots,
  importSave,
  restoreRollback,
  saveLink,
} from '../src/lib/ui/save-transfer.ts'

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
assert.equal(JSON.parse(target.getItem(ROLLBACK_KEY)).savedAt, 123, 'the existing third positional clock argument stays compatible')

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

for (const field of ['moves', 'elapsed', 'history', 'seen']) {
  for (const missing of ['absent', 'null']) {
    const incomplete = JSON.parse(game)
    if (missing === 'absent') delete incomplete[field]
    else incomplete[field] = null
    const resumed = normalizeGame(incomplete)
    assert.deepEqual(resumed[field], ['moves', 'elapsed'].includes(field) ? 0 : [], 'local legacy resume retains its defaults')
    const storage = new MemoryStorage({ 'sortit:game': JSON.stringify(incomplete) })
    await assert.rejects(encodeSave(storage), /valid Sort It save/, `stored transfer rejects ${missing} ${field}`)
    await assert.rejects(encodeSaveSlots(readSaveSlots(storage)), /valid Sort It save/, `slot transfer rejects ${missing} ${field}`)
    const payload = { v: 1, p: null, g: incomplete, k: null, t: null, m: null }
    const rawCode = `si1.0.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`
    await assert.rejects(decodeSave(rawCode), /valid Sort It save/, `incoming v1 transfer rejects ${missing} ${field}`)
  }
}

for (const field of ['done', 'stars']) {
  for (const missing of ['absent', 'null']) {
    const incomplete = JSON.parse(newProgress)
    if (missing === 'absent') delete incomplete[field]
    else incomplete[field] = null
    const storage = new MemoryStorage({ 'sortit:progress': JSON.stringify(incomplete) })
    await assert.rejects(encodeSave(storage), /valid Sort It save/, `stored transfer rejects ${missing} ${field}`)
    await assert.rejects(encodeSaveSlots(readSaveSlots(storage)), /valid Sort It save/, `slot transfer rejects ${missing} ${field}`)
  }
}

const blocked = new FailingStorage({ 'sortit:progress': oldProgress }, 'sortit:game', game)
await assert.rejects(importSave(code, blocked), /blocked write/)
assert.equal(blocked.getItem('sortit:progress'), oldProgress)
assert.equal(blocked.getItem('sortit:game'), null)
assert.equal(blocked.getItem(ROLLBACK_KEY), null)

for (const silent of [false, true]) {
  const before = {
    'sortit:progress': oldProgress,
    'sortit:skin': 'bolts',
    [SAVE_GENERATION_KEY]: 'previous generation',
    [ROLLBACK_KEY]: 'previous rollback bytes',
  }
  class FailedGenerationStorage extends MemoryStorage {
    setItem(key, value) {
      if (key === SAVE_GENERATION_KEY && value !== before[SAVE_GENERATION_KEY]) {
        if (silent) return
        throw new Error('generation write failed')
      }
      super.setItem(key, value)
    }
  }
  const target = new FailedGenerationStorage(before)
  await assert.rejects(importSave(code, target), /generation write failed|handoff could not be verified/)
  assert.deepEqual(Object.fromEntries(target.values), before, 'failed generation handoff did not restore every old byte')
}

for (const alreadyAborted of [false, true]) {
  const controller = new AbortController()
  const target = new MemoryStorage({
    'sortit:progress': oldProgress,
    [SAVE_GENERATION_KEY]: 'untouched generation',
    [ROLLBACK_KEY]: 'untouched rollback',
  })
  const before = new Map(target.values)
  if (alreadyAborted) controller.abort()
  const importing = importSave(code, target, undefined, controller.signal)
  if (!alreadyAborted) controller.abort()
  await assert.rejects(importing, { name: 'AbortError' })
  assert.deepEqual(target.values, before, 'canceled transfer changed storage')
}

// A save code can stay under MAX_CODE_LENGTH while its decompressed output does not:
// 73 MiB of zeros still fits in a 99,225 character code (64 MiB in 86,982), a dead tab on the
// targets. Both the bounded and the unbounded version reject this code with the same
// message, so the message proves nothing. Counting the bytes actually pulled through the
// stream is what tells them apart: bound the work, do not measure the result afterwards.
let oversizedCode
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
  oversizedCode = bombCode
  assert.ok(bombCode.length < 100_000, 'the bomb must pass the encoded-length gate to reach the inflation gate')
  await assert.rejects(decodeSave(bombCode), /too large/)
  assert.ok(
    inflatedBytesPulled < 4 * 1024 * 1024,
    `the cap must stop the inflation rather than measure it afterwards, but ${inflatedBytesPulled} bytes were pulled`,
  )
} finally {
  globalThis.DecompressionStream = RealDecompressionStream
}

// Bounding the read is only half the fix: the reader has to be released too. Deleting the cancel
// from decompress()'s finally left every assertion above green, so count cancellations as well,
// and on all three outcomes rather than only the oversized one.
const StreamReader = globalThis.ReadableStreamDefaultReader
const realCancel = StreamReader.prototype.cancel
let cancels = 0
StreamReader.prototype.cancel = function (...args) {
  cancels += 1
  return realCancel.apply(this, args)
}
try {
  cancels = 0
  await assert.rejects(decodeSave(oversizedCode), /too large/)
  assert.equal(cancels, 1, 'an oversized save must cancel its reader, got ' + cancels)
  cancels = 0
  await decodeSave(code)
  assert.equal(cancels, 1, 'a valid save must cancel its reader, got ' + cancels)
  cancels = 0
  await assert.rejects(decodeSave('si1.1.bm90LWRlZmxhdGU'), /damaged/)
  assert.equal(cancels, 1, 'a corrupt save must cancel its reader, got ' + cancels)
} finally {
  StreamReader.prototype.cancel = realCancel
}

console.log('save transfer: export, import, validation, rollback, and 600-level QR verified')
