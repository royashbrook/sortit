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
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { if (this.blocked) throw new Error('quota exceeded'); this.values.set(key, String(value)) }
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
const modulePath = ['src/lib/ui/store.svelte.ts', 'src/lib/ui/store.svelte.ts'].find(file => existsSync(resolve(root, file)))
const { createStore } = await import(pathToFileURL(resolve(root, modulePath)).href)
let failed = 0
function check(name, run) {
  storage.values.clear(); storage.blocked = false
  try { run(); console.log(`ok   ${name}`) }
  catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`) }
}
function played() {
  const store = createStore()
  store.startLevel(1); store.tap(0); store.tap(2)
  assert.equal(store.moves, 1)
  return store
}
check('malformed undo never reaches the move handler and original bytes survive', () => {
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
check('retiring the store retires progress merging as well as board writes', () => {
  const store = played()
  store.stopSaving()
  const incoming = JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: false })
  storage.setItem('sortit:progress', incoming)
  store.mergeExternalProgress()
  assert.equal(storage.getItem('sortit:progress'), incoming)
  store.dispose?.()
})
check('blocked writes are visible and do not throw out of play', () => {
  const store = played()
  storage.blocked = true
  assert.doesNotThrow(() => store.startLevel(2))
  assert.match(store.storageMessage ?? '', /sav|storage/i)
  storage.blocked = false
  store.dispose?.()
})
check('a replaced save is adopted without relying on browser reload', () => {
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
check('disposing a store removes its interval and revokes writes', () => {
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
if (failed) process.exitCode = 1
