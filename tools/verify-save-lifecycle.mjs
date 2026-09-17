// Save transfer must survive the outgoing page's last write (refs #67).
// Compile the real rune store and execute the page's actual handlers, including
// pagehide on reload. Testing the storage helpers alone cannot catch this race.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { compileModule, parse } from 'svelte/compiler'
import { levelBoard } from '../src/lib/engine/levels.ts'
import { codeFromHash, decodeSave, encodeSave, encodeSaveSlots, hasRollback, importSave, restoreRollback } from '../src/lib/ui/save-transfer.ts'

registerHooks({
  load(url, context, next) {
    const loaded = next(url, context)
    if (!url.endsWith('.svelte.ts')) return loaded
    return { format: 'module', shortCircuit: true, source: compileModule(stripTypeScriptTypes(String(loaded.source)), { generate: 'client', filename: url }).js.code }
  },
})

class MemoryStorage {
  values = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) { this.values.set(key, String(value)) }
  removeItem(key) { this.values.delete(key) }
}
const storage = new MemoryStorage()
globalThis.localStorage = storage
globalThis.document = { hidden: false, addEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.addEventListener = () => {}
globalThis.matchMedia = () => ({ matches: true })
globalThis.window = globalThis
// No live intervals in this one-shot check; the real store still owns all state.
globalThis.setInterval = () => 0
let now = 1000
Date.now = () => now
const { createStore } = await import('../src/lib/ui/store.svelte.ts')

const page = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8')
const script = parse(page).instance.content
const functions = ['openTransfer', 'loadSave', 'clearSaveLink', 'useRollback'].map(name => {
  const node = script.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  assert.ok(node, `page handler ${name} is missing`)
  return stripTypeScriptTypes(page.slice(node.start, node.end))
}).join('\n')
const mount = script.body.find(node => node.type === 'ExpressionStatement' && node.expression.callee?.name === 'onMount')
const hide = mount.expression.arguments[0].body.body.flatMap(node => node.declarations ?? []).find(node => node.id.name === 'onPageHide')
assert.ok(hide, 'the actual pagehide callback is missing')
assert.match(page, /addEventListener\('pagehide', onPageHide\)/)
const makeHandlers = new Function('store', 'encodeSaveSlots', 'importSave', 'restoreRollback', 'hasRollback', 'codeFromHash', 'confirm', 'location', 'setTimeout', `
  let saveCode = '', saveImport = '', transferMsg = '', qrShown = false, rollbackReady = false, transferBusy = false, muted = true;
  let transferEpoch = 0, disposed = false, transferRequest;
  const sound = { muted: true, reloadSettings() {} };
  const history = { state: null, replaceState() { location.hash = '' } };
  ${functions}
  const onPageHide = ${page.slice(hide.init.start, hide.init.end)};
  return { openTransfer, loadSave, useRollback, onPageHide,
    setCode(code) { saveImport = code },
    get code() { return saveCode }, get message() { return transferMsg } };
`)

function pageHandlers(store, hash = '') {
  const scheduled = []
  const location = { hash, pathname: '/', search: '' }
  const handlers = makeHandlers(store, encodeSaveSlots, importSave, restoreRollback, hasRollback, codeFromHash,
    () => true, location, fn => scheduled.push(fn))
  location.reload = () => handlers.onPageHide()
  location.replace = () => handlers.onPageHide()
  return { handlers, reload: () => { assert.equal(scheduled.length, 0, 'save adoption must not depend on reload'); handlers.onPageHide() } }
}

function playedStore() {
  storage.values.clear()
  const store = createStore()
  store.startLevel(1)
  store.tap(0)
  store.tap(2)
  assert.equal(store.moves, 1)
  return store
}
const game = () => JSON.parse(storage.getItem('sortit:game'))
let failures = 0
async function check(name, run) {
  try { await run(); console.log(`ok   ${name}`) }
  catch (error) { failures += 1; console.error(`FAIL ${name}: ${error.message}`) }
}

await check('resume preserves the persisted board before any interaction', () => {
  playedStore()
  const before = storage.getItem('sortit:game')
  const resumed = createStore()
  assert.equal(resumed.moves, 1)
  assert.equal(storage.getItem('sortit:game'), before, 'resume overwrote the saved board')
})

await check('export after resume includes the live board and elapsed play', async () => {
  playedStore()
  const resumed = createStore()
  now += 5000
  const { handlers } = pageHandlers(resumed)
  await handlers.openTransfer()
  const exported = JSON.parse((await decodeSave(handlers.code)).slots.game)
  assert.equal(exported.moves, 1, 'export lost the resumed move')
  assert.deepEqual(exported.tubes, JSON.parse(JSON.stringify(resumed.tubes)))
  assert.equal(exported.elapsed, 5000, 'export omitted play since the last save')
})

const incoming = new MemoryStorage()
const board = levelBoard(12)
let uid = 0
incoming.setItem('sortit:progress', JSON.stringify({ current: 12, done: { 1: 10 }, stars: { 1: 3 } }))
incoming.setItem('sortit:game', JSON.stringify({ kind: 'level', n: 12,
  tubes: board.tubes.map(tube => tube.map(c => ({ uid: uid++, c, hid: false }))),
  moves: 3, history: [], elapsed: 1234, seen: [] }))
const code = await encodeSave(incoming)

for (const hash of ['', '#save=arrived']) {
  await check(`import survives ${hash ? 'save-link navigation and ' : ''}pagehide`, async () => {
    const store = playedStore()
    const { handlers, reload } = pageHandlers(store, hash)
    handlers.setCode(code)
    await handlers.loadSave()
    assert.equal(game().n, 12, handlers.message)
    reload()
    assert.equal(game().n, 12, 'outgoing page overwrote the imported board')
    assert.equal(createStore().moves, 3, 'the imported board did not resume')
  })
}

await check('rollback survives pagehide and restores the exact old save', async () => {
  playedStore()
  const original = storage.getItem('sortit:game')
  await importSave(code)
  const imported = createStore()
  const { handlers, reload } = pageHandlers(imported)
  handlers.useRollback()
  assert.equal(storage.getItem('sortit:game'), original, handlers.message)
  reload()
  assert.equal(storage.getItem('sortit:game'), original, 'outgoing page overwrote the rollback')
  assert.equal(createStore().board.n, 1)
})

await check('failed import leaves live persistence enabled', async () => {
  const store = playedStore()
  const { handlers } = pageHandlers(store)
  handlers.setCode('si1.0.broken')
  await handlers.loadSave()
  store.startLevel(2)
  handlers.onPageHide()
  assert.equal(game().n, 2, 'failed import disabled saving')
})

if (failures) process.exitCode = 1
else console.log('save lifecycle: resume, fresh export, import, rollback, and failed import verified')
