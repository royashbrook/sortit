import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { compileModule } from 'svelte/compiler'

const root = resolve(process.env.SORTIT_SOURCE ?? '.')
registerHooks({ load(url, context, next) {
  const result = next(url, context)
  if (!/\.svelte\.[jt]s$/.test(url)) return result
  const source = url.endsWith('.ts') ? stripTypeScriptTypes(String(result.source)) : String(result.source)
  return { format: 'module', shortCircuit: true, source: compileModule(source, { generate: 'client', filename: url }).js.code }
} })
class MemoryStorage {
  values = new Map()
  blocked = false
  blockedReads = false
  blockedKeys = new Set()
  getItem(key) { if (this.blockedReads) throw new Error('storage denied'); return this.values.get(key) ?? null }
  setItem(key, value) { if (this.blocked || this.blockedKeys.has(key)) throw new Error('quota exceeded'); this.values.set(key, String(value)) }
  removeItem(key) { if (this.blocked) throw new Error('storage denied'); this.values.delete(key) }
}
const storage = new MemoryStorage()
globalThis.localStorage = storage
globalThis.window = globalThis
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.matchMedia = () => ({ matches: true })
let intervalId = 0
const intervals = new Set()
globalThis.setInterval = () => { intervals.add(++intervalId); return intervalId }
globalThis.clearInterval = id => intervals.delete(id)
const modulePath = ['src/lib/ui/store.svelte.ts', 'src/lib/ui/store.svelte.js'].find(file => existsSync(resolve(root, file)))
const { createStore } = await import(pathToFileURL(resolve(root, modulePath)).href)
const transfer = await import(pathToFileURL(resolve(root, 'src/lib/ui/save-transfer.ts')).href)
const { sound } = await import(pathToFileURL(resolve(root, 'src/lib/ui/sounds.ts')).href)
const { SAVE_GENERATION_KEY } = await import(pathToFileURL(resolve(root, 'src/lib/storage.ts')).href)
let failed = 0
async function check(name, run) {
  storage.values.clear(); storage.blocked = false; storage.blockedReads = false; storage.blockedKeys.clear()
  sound.reloadSettings()
  try { await run(); console.log(`ok   ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`) }
}
function played() {
  const store = createStore()
  store.startLevel(1); store.tap(0); store.tap(2)
  assert.equal(store.moves, 1)
  return store
}
await check('malformed undo never reaches the move handler and original bytes survive', () => {
  const old = played()
  const saved = JSON.parse(storage.getItem('sortit:game'))
  saved.history = [{ moves: 0, tubes: [null] }]
  const damaged = JSON.stringify(saved)
  storage.setItem('sortit:game', damaged)
  const store = createStore()
  assert.doesNotThrow(() => store.undo())
  assert.ok([...storage.values.values()].includes(damaged), 'unreadable bytes were discarded')
  old.dispose?.(); store.dispose?.()
})
await check('retiring the store retires progress merging as well as board writes', () => {
  const store = played()
  store.stopSaving()
  const incoming = JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: false })
  storage.setItem('sortit:progress', incoming)
  store.mergeExternalProgress()
  assert.equal(storage.getItem('sortit:progress'), incoming)
  store.dispose?.()
})
await check('blocked writes are visible and do not throw out of play', () => {
  const store = played()
  storage.blocked = true
  assert.doesNotThrow(() => store.startLevel(2))
  assert.match(store.storageMessage ?? '', /sav|storage/i)
  storage.blocked = false
  store.dispose?.()
})
await check('a replaced save is adopted without relying on browser reload', () => {
  const store = played()
  const other = createStore()
  other.startLevel(3)
  const incoming = storage.getItem('sortit:game')
  assert.equal(typeof store.reloadSave, 'function')
  store.reloadSave()
  assert.equal(store.board.n, 3)
  assert.equal(storage.getItem('sortit:game'), incoming)
  store.replay()
  assert.equal(JSON.parse(storage.getItem('sortit:game')).n, 3)
  store.dispose?.(); other.dispose?.()
})
await check('disposing a store removes its interval and revokes writes', () => {
  const count = intervals.size
  const store = played()
  assert.equal(intervals.size, count + 1)
  assert.equal(typeof store.dispose, 'function')
  const saved = storage.getItem('sortit:game')
  store.dispose()
  assert.equal(intervals.size, count)
  store.startLevel(2)
  assert.equal(storage.getItem('sortit:game'), saved)
})
await check('failed corrupt-save recovery protects the exact original bytes', () => {
  const damaged = '{broken puzzle bytes'
  storage.setItem('sortit:game', damaged)
  storage.blockedKeys.add('sortit:game:recovery')
  const store = createStore()
  try {
    store.startLevel(2)
    assert.equal(store.flushSave(), false)
    assert.equal(storage.getItem('sortit:game'), damaged)
    assert.match(store.storageMessage, /protected/)
  } finally { storage.blockedKeys.clear(); store.reloadSave(); store.dispose() }
})
await check('blocked export carries live progress, puzzle, and settings instead of old disk state', async () => {
  const store = played()
  try {
    storage.blocked = true
    store.startLevel(1)
    for (const move of store.board.solution) { store.tap(move.from); store.tap(move.to) }
    assert.ok(store.won, 'fixture must earn actual progress')
    store.startLevel(2)
    store.setSkin(store.skins.find(skin => skin.key === 'mine'))
    store.setShellTheme(store.shellThemes.find(theme => theme.key === 'dusk'))
    sound.toggle()
    // The fallback pins the old page's flush-then-read flow for baseline runs.
    const code = store.saveSnapshot
      ? await transfer.encodeSaveSlots(store.saveSnapshot())
      : (store.flushSave(), await transfer.encodeSave())
    const { slots } = await transfer.decodeSave(code)
    assert.equal(JSON.parse(slots.game).n, 2, 'exported the previous persisted puzzle')
    assert.deepEqual(JSON.parse(slots.progress), JSON.parse(JSON.stringify(store.progress)))
    assert.equal(JSON.parse(slots.progress).current, 2)
    assert.ok(JSON.parse(slots.progress).done[1] > 0)
    assert.equal(slots.skin, 'mine')
    assert.equal(slots.theme, 'dusk')
    assert.equal(slots.muted, '1')
  } finally { storage.blocked = false; store.dispose() }
})
await check('denied generation reads do not discard the live puzzle or prevent export', async () => {
  storage.setItem(SAVE_GENERATION_KEY, 'known generation')
  const store = played()
  try {
    storage.blockedReads = true
    store.startLevel(2)
    assert.equal(store.board.n, 2, 'storage denial was mistaken for a replacement')
    assert.equal(store.flushSave(), false)
    assert.equal(store.board.n, 2)
    const code = await transfer.encodeSaveSlots(store.saveSnapshot())
    assert.equal(JSON.parse((await transfer.decodeSave(code)).slots.game).n, 2)
  } finally { storage.blockedReads = false; store.dispose() }
})
await check('update preflight verifies every live save slot and refuses failed writes', () => {
  const store = played()
  try {
    assert.equal(store.flushSave(), true)
    for (const key of ['progress', 'game', 'skin', 'theme', 'muted']) {
      storage.blockedKeys.add(`sortit:${key}`)
      assert.equal(store.flushSave(), false, `failed ${key} write was reported safe to reload`)
      storage.blockedKeys.clear()
    }
    assert.equal(store.flushSave(), true)
    store.stopSaving()
    assert.equal(store.flushSave(), false)
  } finally { store.dispose() }
})
await check('a stale second tab cannot overwrite an imported puzzle or settings', async () => {
  const stale = played()
  const other = createStore()
  try {
    other.startLevel(3)
    other.setSkin(other.skins.find(skin => skin.key === 'mine'))
    const code = await transfer.encodeSave()
    await transfer.importSave(code)
    const replaced = new Map(storage.values)
    stale.setSkin(stale.skins.find(skin => skin.key === 'dice'))
    assert.equal(storage.getItem('sortit:skin'), replaced.get('sortit:skin'), 'stale tab overwrote the imported look')
    assert.equal(stale.board.n, 3, 'stale tab did not adopt the replacement')
    other.setVisible(false)
    assert.equal(storage.getItem('sortit:game'), replaced.get('sortit:game'), 'stale pagehide overwrote the imported puzzle')
    assert.equal(other.board.n, 3)
  } finally { stale.dispose(); other.dispose() }
})
await check('a stale sound toggle adopts the imported preference without overwriting it', async () => {
  const stale = played()
  try {
    storage.setItem('sortit:muted', '0')
    await transfer.importSave(await transfer.encodeSave())
    const muted = stale.toggleSound ? stale.toggleSound() : sound.toggle()
    assert.equal(muted, false)
    assert.equal(storage.getItem('sortit:muted'), '0', 'stale sound toggle overwrote the replacement')
  } finally { stale.dispose() }
})
if (failed) process.exitCode = 1
