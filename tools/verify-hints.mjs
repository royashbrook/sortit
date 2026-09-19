// Exercise the real page handler and compiled store, including reachable dead ends (refs #92).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks, stripTypeScriptTypes } from 'node:module'
import { compileModule, parse } from 'svelte/compiler'

// Only the store's solver import is wrapped. Board generation and the solver
// stay unchanged; the budget control makes the real search stop at zero nodes.
const solverUrl = new URL('../src/lib/engine/solver.ts', import.meta.url).href
const probe = globalThis.__sortitHintProbe = { forceBudget: false, last: null, beforeSearch: null, calls: 0 }
const solverSeam = `data:text/javascript,${encodeURIComponent(`
  export * from ${JSON.stringify(solverUrl)};
  import { solve as realSolve } from ${JSON.stringify(solverUrl)};
  export function solve(tubes, capacity, options) {
    const probe = globalThis.__sortitHintProbe;
    probe.calls++;
    probe.beforeSearch?.();
    return probe.last = realSolve(tubes, capacity, probe.forceBudget ? { ...options, maxNodes: 0 } : options);
  }
`)}`
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith('/src/lib/ui/store.svelte.ts') && specifier === '../engine/solver.ts') {
      return { url: solverSeam, shortCircuit: true }
    }
    return next(specifier, context)
  },
  load(url, context, next) {
    const loaded = next(url, context)
    if (!url.endsWith('.svelte.ts')) return loaded
    return { format: 'module', shortCircuit: true, source: compileModule(stripTypeScriptTypes(String(loaded.source)), { generate: 'client', filename: url }).js.code }
  },
})

const saved = new Map()
globalThis.localStorage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, String(value)), removeItem: key => saved.delete(key) }
globalThis.window = globalThis
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, documentElement: { dataset: {}, style: { setProperty() {} } } }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.matchMedia = () => ({ matches: true })
globalThis.setInterval = () => 0
Date.now = () => 1000 // Snapshot comparisons should not count time spent proving the hint.
const timers = new Map()
let nextTimer = 0
globalThis.setTimeout = (run, delay) => { const id = ++nextTimer; timers.set(id, { run, delay }); return id }
globalThis.clearTimeout = id => timers.delete(id)
saved.set('sortit:muted', '1')
const { createStore } = await import('../src/lib/ui/store.svelte.ts')

const page = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8')
const handler = parse(page).instance.content.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'doHint')
assert.ok(handler, 'the actual HINT handler is missing')
const hint = new Function('store', `${stripTypeScriptTypes(page.slice(handler.start, handler.end))}; return doHint()`)
assert.match(page, /class="stuck" role="status"/)
assert.match(page, /store\.hintResult\?\.status === 'dead-end' \? 'no solution from here\. try undo\.'/)
assert.match(page, /store\.hintResult\?\.status === 'budget-limit' \? 'no hint yet\. try a move or undo\.'/)

const deadEnd = [[2, 6], [3, 2], [3, 5], [1, 3]]
function play(store, path) {
  for (const [from, to] of path) {
    const before = store.moves
    store.tap(from); store.tap(to)
    assert.equal(store.moves, before + 1, 'fixture move must be legal in the real game')
  }
}
let failures = 0
function check(name, run) {
  saved.clear(); saved.set('sortit:muted', '1')
  probe.forceBudget = false; probe.beforeSearch = null
  const store = createStore()
  try { run(store); console.log(`ok   ${name}`) }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.message}`) }
  finally { store.dispose(); assert.equal(timers.size, 0, 'hint and par timers must be released') }
}

check('level 14 dead end reports recovery while legal moves remain, and Undo restores a hint', store => {
  store.startLevel(14)
  play(store, deadEnd)
  assert.equal(store.moves, 4)
  assert.equal(store.stuck, false, 'the ordinary no-moves notice must not explain this failure')
  const before = store.saveSnapshot()
  assert.deepEqual(hint(store), { status: 'dead-end' })
  assert.deepEqual(store.hintResult, { status: 'dead-end' })
  assert.equal(probe.last.aborted, false)
  assert.ok(probe.last.nodes < 60000, 'dead-end fixture must exhaust before the hint budget')
  assert.deepEqual(store.hintTubes, [])
  assert.deepEqual(store.saveSnapshot(), before, 'requesting a hint must not change the saved puzzle')
  store.undo()
  assert.equal(store.moves, 3)
  assert.equal(store.hintResult, null)
  const recovered = hint(store)
  assert.equal(recovered.status, 'move')
  assert.deepEqual(store.hintTubes, [recovered.move.from, recovered.move.to])
})

check('budget exhaustion is not a dead end and clears the previous highlight before searching', store => {
  store.startLevel(14)
  assert.equal(hint(store).status, 'move')
  assert.equal(store.hintTubes.length, 2)
  probe.beforeSearch = () => {
    assert.deepEqual(store.hintTubes, [], 'new search retained the previous highlight')
    assert.equal(store.hintResult, null)
  }
  probe.forceBudget = true
  assert.deepEqual(hint(store), { status: 'budget-limit' })
  assert.equal(probe.last.aborted, true, 'the control must exercise a real solver budget abort')
  assert.equal(store.stuck, false)
  assert.deepEqual(store.hintTubes, [])
  probe.forceBudget = false
  assert.equal(hint(store).status, 'move', 'a later search should replace the budget notice')
})

check('a move and a new puzzle clear stale hint feedback and highlights', store => {
  store.startLevel(14)
  play(store, deadEnd)
  assert.equal(hint(store).status, 'dead-end')
  play(store, [[0, 1]])
  assert.equal(store.hintResult, null)
  assert.deepEqual(store.hintTubes, [])
  store.replay()
  const next = hint(store)
  assert.equal(next.status, 'move')
  play(store, [[next.move.from, next.move.to]])
  assert.equal(store.hintResult, null)
  assert.deepEqual(store.hintTubes, [])
  probe.forceBudget = true
  assert.equal(hint(store).status, 'budget-limit')
  store.startLevel(1)
  assert.equal(store.hintResult, null)
  assert.deepEqual(store.hintTubes, [])
})

check('won and disposed boards do not search or report failure', store => {
  store.startLevel(1)
  play(store, store.board.solution.map(move => [move.from, move.to]))
  assert.ok(store.won)
  const calls = probe.calls
  assert.equal(hint(store), null)
  assert.equal(store.hintResult, null)
  store.dispose()
  assert.equal(hint(store), null)
  assert.equal(probe.calls, calls)
})

if (failures) process.exitCode = 1
else console.log('hints: reachable dead end, undo recovery, real budget abort, feedback cleanup, and won/disposed controls verified')
