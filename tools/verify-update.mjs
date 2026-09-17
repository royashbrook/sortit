import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const controllerSource = readFileSync(new URL('../src/lib/ui/update.ts', import.meta.url), 'utf8')
const workerSource = readFileSync(new URL('../src/service-worker.ts', import.meta.url), 'utf8')
const running = 'b'.repeat(64), newer = 'c'.repeat(64), rollback = 'a'.repeat(64)
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function target() {
  const listeners = new Map()
  return {
    listeners,
    addEventListener(type, listener, options = {}) {
      if (options.signal?.aborted) return
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(listener)
      options.signal?.addEventListener('abort', () => listeners.get(type)?.delete(listener), { once: true })
    },
    emit(type, event = {}) { for (const fn of [...(listeners.get(type) || [])]) fn(event) },
    count() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0) },
  }
}

function controllerHarness({ deployed = newer, waiting = newer, registrationPending = false,
  reply = true, fetchPending = false, saved = true, source = controllerSource } = {}) {
  const states = [], messages = [], channels = [], timers = new Map(), fetches = []
  const document = Object.assign(target(), { hidden: false })
  const window = target(), serviceWorker = target(), pendingRegistration = deferred()
  let reloads = 0, saveChecks = 0, timerId = 0, updates = 0
  const makeWorker = (fingerprint, state) => Object.assign(target(), {
    state,
    postMessage(data, ports = []) {
      messages.push({ worker: this, data })
      if (data.type === 'SORTIT_VERSION' && reply) queueMicrotask(() => ports[0].postMessage(fingerprint))
    },
  })
  const active = makeWorker(running, 'activated')
  const registration = Object.assign(target(), {
    active, waiting: waiting ? makeWorker(waiting, 'installed') : null, installing: null,
    update: async () => { updates++ },
  })
  Object.assign(serviceWorker, {
    controller: active,
    register: () => registrationPending ? pendingRegistration.promise : Promise.resolve(registration),
  })
  class MessageChannel {
    constructor() {
      this.port1 = { closed: false, onmessage: null, close() { this.closed = true } }
      this.port2 = { closed: false, close() { this.closed = true }, postMessage: data => {
        if (!this.port1.closed && !this.port2.closed) this.port1.onmessage?.({ data })
      } }
      channels.push(this)
    }
  }
  const context = {
    exports: {}, __RELEASE__: { fingerprint: running }, __ENV__: { BASE_URL: '/', PROD: true },
    URL, AbortController, AbortSignal, MessageChannel,
    location: { href: 'https://sortit.test/', protocol: 'https:', reload: () => reloads++ },
    navigator: { serviceWorker }, document,
    addEventListener: window.addEventListener.bind(window),
    setTimeout: fn => { const id = ++timerId; timers.set(id, { fn, interval: false }); return id },
    clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = ++timerId; timers.set(id, { fn, interval: true }); return id },
    clearInterval: id => timers.delete(id),
    fetch: (url, options) => {
      const call = { url: String(url), options, aborted: false }
      fetches.push(call)
      if (!fetchPending) return Promise.resolve({ ok: true, json: async () => ({ fingerprint: deployed }) })
      return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
        call.aborted = true
        reject(new Error('aborted'))
      }, { once: true }))
    },
  }
  vm.runInNewContext(compile(source.replaceAll('import.meta.env', '__ENV__')), context)
  const api = context.exports.startUpdates(state => states.push(state), () => { saveChecks++; return saved })
  return { api, states, messages, channels, timers, fetches, document, window, serviceWorker, makeWorker,
    registration, pendingRegistration, get reloads() { return reloads }, get saveChecks() { return saveChecks },
    setDeployed: value => { deployed = value },
    get updates() { return updates }, last: () => states.at(-1),
    assertDisposed() {
      assert.equal(timers.size, 0, 'no remaining interval or identify timeout')
      for (const channel of channels) assert.ok(channel.port1.closed && channel.port2.closed, 'both message ports closed')
      for (const value of [document, window, serviceWorker, registration, registration.active, registration.waiting, registration.installing]) {
        if (value) assert.equal(value.count(), 0, 'lifecycle listener removed')
      }
    },
  }
}

async function acceptsFingerprint(fingerprint, source) {
  const harness = controllerHarness({ deployed: fingerprint, waiting: fingerprint, source })
  try {
    await settle()
    assert.equal(harness.last()?.status, 'ready', 'a different fully downloaded fingerprint must be offered, including rollback')
    assert.equal(harness.reloads, 0, 'offering a build must not reload')
  } finally { harness.api.dispose(); harness.assertDisposed() }
}

await acceptsFingerprint(newer)
await acceptsFingerprint(rollback)
const lexicalMutant = controllerSource.replace('fingerprint !== __RELEASE__.fingerprint', 'fingerprint > __RELEASE__.fingerprint')
assert.notEqual(lexicalMutant, controllerSource, 'the rollback mutation must hit its intended guard')
await assert.rejects(acceptsFingerprint(rollback, lexicalMutant), /different fully downloaded/, 'lexical ordering mutant is caught')

{
  const h = controllerHarness()
  await settle()
  assert.equal(h.last().ready, true)
  h.serviceWorker.emit('controllerchange')
  await settle()
  assert.equal(h.reloads, 0, 'controller change without apply never refreshes the page')
  assert.equal(h.saveChecks, 0, 'no save/consent callback before apply')
  assert.equal(h.messages.filter(message => message.data.type === 'SORTIT_ACTIVATE').length, 0)
  h.api.apply()
  assert.equal(h.saveChecks, 1)
  assert.equal(h.last().status, 'applying')
  assert.equal(h.messages.filter(message => message.data.type === 'SORTIT_ACTIVATE').length, 1)
  assert.equal(h.reloads, 0, 'consent still waits for controller activation')
  h.serviceWorker.emit('controllerchange')
  assert.equal(h.reloads, 1)
  h.api.dispose()
  h.assertDisposed()
  h.serviceWorker.emit('controllerchange')
  assert.equal(h.reloads, 1, 'disposed applying controller cannot reload later')
}

async function applyDuringCheckInvariant(source = controllerSource) {
  const h = controllerHarness({ reply: false, source })
  try {
    await settle()
    h.channels[0].port2.postMessage(newer)
    await settle()
    assert.equal(h.last().status, 'ready', 'the replacement is downloaded before consent')
    const pending = h.api.check()
    await settle()
    assert.equal(h.channels.length, 2, 'a second check is held awaiting worker identification')
    assert.equal(h.last().status, 'checking')
    assert.equal(h.last().ready, true, 'the downloaded candidate remains available during the recheck')
    h.api.apply()
    assert.equal(h.last().status, 'applying')
    assert.equal(h.reloads, 0, 'accepting waits for the replacement controller')
    const replacement = h.registration.waiting
    replacement.state = 'activated'
    h.registration.active = replacement
    h.registration.waiting = null
    h.serviceWorker.controller = replacement
    // This late result used to overwrite applying with ready, causing the
    // subsequent controllerchange to start another check instead of reload.
    h.channels[1].port2.postMessage(newer)
    await pending
    h.serviceWorker.emit('controllerchange')
    await settle()
    assert.equal(h.reloads, 1, 'consented controller change reloads once despite the late identification result')
    assert.equal(h.last().status, 'applying', 'late check cannot replace the applying state')
    assert.equal(h.saveChecks, 1)
    assert.equal(h.messages.filter(message => message.data.type === 'SORTIT_ACTIVATE').length, 1)
    h.api.dispose()
    h.serviceWorker.emit('controllerchange')
    assert.equal(h.reloads, 1, 'unmounted controller cannot trigger an additional reload')
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await applyDuringCheckInvariant()
const applyingMutant = controllerSource.replace("if (state.status === 'applying' && status !== 'applying') return", '')
assert.notEqual(applyingMutant, controllerSource, 'applying-state mutation reaches the intended guard')
await assert.rejects(applyDuringCheckInvariant(applyingMutant), /reloads once despite/, 'late check clobbering consent is caught')

async function redundantCandidateInvariant(source = controllerSource, alreadyWaiting = true) {
  const h = controllerHarness({ source, waiting: alreadyWaiting ? newer : null })
  try {
    await settle()
    let selected = h.registration.waiting
    if (!alreadyWaiting) {
      selected = h.makeWorker(newer, 'installing')
      h.registration.installing = selected
      h.registration.emit('updatefound')
      selected.state = 'installed'
      h.registration.waiting = selected
      h.registration.installing = null
      selected.emit('statechange')
      await settle()
    }
    assert.ok(selected.count() > 0, 'selected candidate is watched even when already waiting at registration')
    assert.equal(h.last().status, 'ready')
    h.api.apply()
    assert.equal(h.last().status, 'applying')
    const unrelated = h.makeWorker(rollback, 'installing')
    h.registration.installing = unrelated
    h.registration.emit('updatefound')
    unrelated.state = 'redundant'
    unrelated.emit('statechange')
    h.registration.installing = null
    assert.equal(h.last().status, 'applying', 'unrelated worker failure cannot release the selected activation lock')
    const replacement = 'd'.repeat(64)
    h.setDeployed(replacement)
    h.registration.waiting = h.makeWorker(replacement, 'installed')
    selected.state = 'redundant'
    selected.emit('statechange')
    assert.equal(h.last().status, 'failed', 'selected candidate redundancy releases the applying lock')
    assert.equal(h.last().ready, false, 'redundant candidate is no longer offered')
    assert.equal(h.reloads, 0)
    const previousChecks = h.updates
    await h.api.check()
    assert.equal(h.updates, previousChecks + 1, 'a failed activation permits another update check')
    assert.equal(h.last().status, 'ready', 'the replacement can be offered after failed activation')
    h.api.apply()
    assert.equal(h.messages.filter(message => message.data.type === 'SORTIT_ACTIVATE').length, 2, 'retry targets the replacement')
    h.api.dispose()
    assert.equal(selected.count(), 0)
    assert.equal(unrelated.count(), 0)
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await redundantCandidateInvariant()
await redundantCandidateInvariant(controllerSource, false)
const redundantCandidateMutant = controllerSource.replace("if (state.status === 'applying') state.status = 'failed'", '')
assert.notEqual(redundantCandidateMutant, controllerSource, 'selected-candidate failure mutation reaches the explicit lock exit')
await assert.rejects(redundantCandidateInvariant(redundantCandidateMutant), /redundancy releases the applying lock/, 'failed selected activation cannot remain stuck applying')
const waitingWatchMutant = controllerSource.replace('watch(value.waiting)', '')
assert.notEqual(waitingWatchMutant, controllerSource, 'already-waiting mutation removes its lifecycle listener')
await assert.rejects(redundantCandidateInvariant(waitingWatchMutant), /already waiting at registration/, 'preexisting waiting worker failure remains observable')

for (const options of [{ waiting: null }, { waiting: running }, { waiting: rollback }, { reply: false }]) {
  const h = controllerHarness(options)
  await settle()
  h.api.apply()
  assert.equal(h.reloads, 0, 'not downloaded or mismatched worker cannot refresh')
  assert.equal(h.saveChecks, 0, 'non-ready build cannot request save/consent')
  if (options.waiting === null) assert.equal(h.last().status, 'failed', 'a newer deployed build with no downloaded worker is not up to date')
  h.api.dispose()
  await settle()
  h.assertDisposed()
}

{
  const h = controllerHarness({ saved: false })
  await settle()
  h.api.apply()
  assert.equal(h.last().status, 'unsaved')
  assert.equal(h.reloads, 0)
  assert.equal(h.messages.filter(message => message.data.type === 'SORTIT_ACTIVATE').length, 0, 'failed save blocks activation')
  h.api.dispose()
  h.assertDisposed()
}

{
  const h = controllerHarness({ fetchPending: true })
  await settle()
  assert.equal(h.fetches.length, 1)
  assert.equal(h.fetches[0].options.cache, 'no-store')
  const publications = h.states.length
  h.api.dispose()
  await settle()
  assert.equal(h.fetches[0].aborted, true, 'unmount aborts pending metadata fetch')
  assert.equal(h.states.length, publications, 'aborted fetch cannot publish after unmount')
  h.assertDisposed()
}

{
  const h = controllerHarness({ reply: false })
  await settle()
  assert.equal(h.channels.length, 1)
  assert.equal(h.timers.size, 2, 'poll interval and worker identity timeout are pending')
  const publications = h.states.length
  h.api.dispose()
  await settle()
  h.assertDisposed()
  assert.equal(h.states.length, publications, 'late worker identification cannot publish after unmount')
}

async function lateRegistrationInvariant(source = controllerSource) {
  const h = controllerHarness({ registrationPending: true, source })
  try {
    h.api.dispose()
    h.pendingRegistration.resolve(h.registration)
    await settle()
    h.assertDisposed()
    assert.equal(h.fetches.length, 0, 'late registration callback starts no update request')
    assert.equal(h.updates, 0)
    assert.equal(h.states.length, 0)
  } finally { h.api.dispose() }
}
await lateRegistrationInvariant()
const lateRegistrationMutant = controllerSource.replace('if (disposed()) return\n      registration = value', 'registration = value')
assert.notEqual(lateRegistrationMutant, controllerSource, 'late registration mutation reaches the intended guard')
await assert.rejects(lateRegistrationInvariant(lateRegistrationMutant), /remaining interval/, 'late timer resurrection mutant is caught')

async function installedDuringCheckInvariant(source = controllerSource) {
  const h = controllerHarness({ waiting: null, reply: false, source })
  try {
    await settle()
    assert.equal(h.channels.length, 1, 'initial check is waiting for active worker identity')
    const replacement = h.makeWorker(newer, 'installing')
    h.registration.installing = replacement
    h.registration.emit('updatefound')
    assert.equal(replacement.count(), 1, 'installing worker has an owned state listener')
    replacement.state = 'installed'
    h.registration.waiting = replacement
    h.registration.installing = null
    replacement.emit('statechange')
    h.channels[0].port2.postMessage(running)
    await settle()
    assert.equal(h.channels.length, 2, 'installed event during in-flight check must schedule a follow-up')
    h.channels[1].port2.postMessage(newer)
    await settle()
    assert.equal(h.last().status, 'ready')
    assert.equal(h.reloads, 0)
  } finally { h.api.dispose(); h.assertDisposed() }
}
await installedDuringCheckInvariant()
const lostEventMutant = controllerSource.replace('if (checking) { checkAgain = true; return }', 'if (checking) return')
assert.notEqual(lostEventMutant, controllerSource, 'lost-event mutation reaches the intended guard')
await assert.rejects(installedDuringCheckInvariant(lostEventMutant), /schedule a follow-up/, 'lost update-ready event mutant is caught')

function workerHarness({ failInstall = false, source = workerSource, keysGate, clientsGate } = {}) {
  const events = new Map(), stores = new Map(), deleted = [], fetched = []
  const origin = 'https://sortit.test/game/'
  const key = value => new URL(typeof value === 'string' ? value : value.url, origin).href
  let skips = 0, claims = 0, windows = [], keysCalls = 0, clientsCalls = 0
  const caches = {
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map())
      const cache = stores.get(name)
      return {
        addAll: async paths => {
          if (failInstall) throw new Error('one precache response failed')
          const keys = paths.map(key)
          // Native addAll rejects the entire batch when relative and absolute
          // requests resolve to the same cache key. Map.set would hide this bug.
          if (new Set(keys).size !== keys.length) throw new TypeError('Cache.addAll: duplicate request key')
          for (const path of keys) cache.set(path, new Response(`cached ${path}`))
        },
        match: async request => cache.get(key(request)),
      }
    },
    keys: async () => { keysCalls++; await keysGate?.promise; return [...stores.keys()] },
    delete: async name => { deleted.push(name); return stores.delete(name) },
  }
  const self = {
    registration: { scope: origin, installing: null, waiting: null, active: { state: 'activated' } },
    clients: { claim: async () => { claims++ }, matchAll: async () => { clientsCalls++; await clientsGate?.promise; return windows } },
    skipWaiting: async () => { skips++ },
    addEventListener: (type, fn) => events.set(type, fn),
  }
  const context = { self, caches, URL, Request, Response, __KIT__: {
    build: ['/game/_app/app.js'], files: ['/game/manifest.json'], prerendered: ['/game/'], version: newer,
  }, fetch: async request => { fetched.push(request); return new Response('network') } }
  const compiledSource = source.replace("import { build, files, prerendered, version } from '$service-worker'", 'const { build, files, prerendered, version } = __KIT__')
  assert.notEqual(compiledSource, source, 'worker is executed with only its build-manifest import replaced')
  vm.runInNewContext(compile(compiledSource), context)
  const dispatch = async (type, data = {}) => {
    const waits = []
    let response
    events.get(type)({ data: {}, ports: [], ...data, waitUntil: value => waits.push(value), respondWith: value => { response = value } })
    await Promise.all(waits)
    return response === undefined ? undefined : await response
  }
  return { self, stores, deleted, fetched, dispatch, origin, get skips() { return skips }, get claims() { return claims },
    get keysCalls() { return keysCalls }, get clientsCalls() { return clientsCalls },
    setWindows: value => { windows = value } }
}

{
  const h = workerHarness({ failInstall: true })
  await assert.rejects(h.dispatch('install'), /precache response failed/)
  assert.equal(h.skips, 0, 'failed install never skips waiting')
  assert.equal(h.claims, 0, 'failed install never takes control')
}

{
  const duplicateKeyMutant = workerSource.replace('.map(path => new URL(path, scope).href)', '')
  assert.notEqual(duplicateKeyMutant, workerSource, 'normalization mutation reaches the precache guard')
  const h = workerHarness({ source: duplicateKeyMutant })
  await assert.rejects(
    assert.doesNotReject(h.dispatch('install'), 'initial install must normalize equivalent relative and absolute URLs'),
    /initial install must normalize/,
    'removing normalization breaks the initial-install assertion',
  )
  assert.equal(h.stores.get(`sortit-${newer}`).size, 0, 'duplicate-key rejection does not partially populate the cache')
  assert.equal(h.skips, 0)
  assert.equal(h.claims, 0)
}

{
  const h = workerHarness()
  h.stores.set(`sortit-${running}`, new Map([['https://sortit.test/game/_app/old.js', new Response('old module')]]))
  h.stores.set('unrelated-app', new Map())
  await assert.doesNotReject(h.dispatch('install'), 'initial install must normalize equivalent relative and absolute URLs')
  assert.equal(h.skips, 0, 'successful download still waits for consent')
  const cache = h.stores.get(`sortit-${newer}`)
  for (const name of ['release.json', 'licenses.json', 'third-party-notices.txt']) assert.ok(cache.has(h.origin + name), `offline ${name} included`)
  await h.dispatch('activate')
  assert.equal(h.claims, 1)
  assert.deepEqual(h.deleted, [], 'activation alone never deletes old clients’ assets')
  let fingerprint
  await h.dispatch('message', { data: { type: 'SORTIT_VERSION' }, ports: [{ postMessage: value => { fingerprint = value } }] })
  assert.equal(fingerprint, newer)
  await h.dispatch('message', { data: { type: 'SORTIT_ACTIVATE' } })
  assert.equal(h.skips, 1, 'only explicit activation message skips waiting')
  const old = await h.dispatch('fetch', { request: new Request(h.origin + '_app/old.js') })
  assert.equal(await old.text(), 'old module', 'held old client can still retrieve its original module')
  const release = await h.dispatch('fetch', { request: new Request(h.origin + 'release.json?update-probe') })
  assert.equal(await release.text(), 'network', 'metadata probe never returns cached identity')
  assert.equal(h.fetched.at(-1).cache, 'no-store')
  const outside = await h.dispatch('fetch', { request: new Request('https://other.test/file') })
  assert.equal(outside, undefined, 'worker ignores cross-origin requests')
  h.setWindows([{ id: 'new', url: h.origin }, { id: 'old', url: h.origin }])
  const confirmed = { data: { type: 'SORTIT_CLIENT', fingerprint: newer }, source: { id: 'new' } }
  await h.dispatch('message', confirmed)
  assert.deepEqual(h.deleted, [], 'another app tab keeps its old cache')
  h.setWindows([{ id: 'new', url: h.origin }])
  await h.dispatch('message', { ...confirmed, source: { id: 'unrecognized' } })
  assert.deepEqual(h.deleted, [], 'unrecognized client cannot delete old caches')
  await h.dispatch('message', { ...confirmed, data: { type: 'SORTIT_CLIENT', fingerprint: running } })
  assert.deepEqual(h.deleted, [], 'old fingerprint cannot delete old caches')
  h.self.registration.waiting = {}
  await h.dispatch('message', confirmed)
  assert.deepEqual(h.deleted, [], 'pending update preserves fallback cache')
  h.self.registration.waiting = null
  await h.dispatch('message', confirmed)
  assert.deepEqual(h.deleted, [`sortit-${running}`])
  assert.ok(h.stores.has('unrelated-app'), 'other apps’ caches are not touched')
}

async function waitingDuringRetirementInvariant(source = workerSource) {
  const keysGate = deferred()
  const h = workerHarness({ keysGate, source })
  await h.dispatch('install')
  h.setWindows([{ id: 'current', url: h.origin }])
  const retiring = h.dispatch('message', {
    data: { type: 'SORTIT_CLIENT', fingerprint: newer }, source: { id: 'current' },
  })
  await settle()
  assert.equal(h.keysCalls, 1, 'cache retirement is awaiting its cache-name snapshot')
  const replacementCache = `sortit-${'d'.repeat(64)}`
  h.stores.set(replacementCache, new Map([[h.origin, new Response('downloaded replacement shell')]]))
  h.self.registration.waiting = { state: 'installed' }
  keysGate.resolve()
  await retiring
  assert.ok(h.stores.has(replacementCache), 'retirement must not delete a replacement that became waiting during caches.keys')
  assert.deepEqual(h.deleted, [], 'in-flight download suspends retirement after asynchronous snapshots')
}
await waitingDuringRetirementInvariant()
const retirementOrderingMutant = workerSource.replace('const names = await caches.keys()', '')
  .replace('await Promise.all(names.filter', 'await Promise.all((await caches.keys()).filter')
assert.notEqual(retirementOrderingMutant, workerSource, 'retirement-order mutation moves the snapshot after the safety guard')
await assert.rejects(waitingDuringRetirementInvariant(retirementOrderingMutant), /became waiting during caches.keys/, 'replacement-cache retirement race is caught')

// Defensive invariant, not a claimed native retired-worker message delivery:
// native termination discards queued messages and aborts the old worker script.
async function activeChangedDuringRetirementInvariant(source = workerSource) {
  const clientsGate = deferred()
  const h = workerHarness({ clientsGate, source })
  await h.dispatch('install')
  const replacementCache = `sortit-${'d'.repeat(64)}`
  h.stores.set(replacementCache, new Map([[h.origin, new Response('previously downloaded replacement shell')]]))
  h.setWindows([{ id: 'current', url: h.origin }])
  const retiring = h.dispatch('message', {
    data: { type: 'SORTIT_CLIENT', fingerprint: newer }, source: { id: 'current' },
  })
  await settle()
  assert.equal(h.clientsCalls, 1, 'retirement is awaiting the client snapshot')
  h.self.registration.active = { state: 'activated' }
  clientsGate.resolve()
  await retiring
  assert.ok(h.stores.has(replacementCache), 'retired worker must not delete caches after the active worker changes during the event')
  assert.deepEqual(h.deleted, [], 'active-object change invalidates in-flight retirement')
}
await activeChangedDuringRetirementInvariant()
const activeSnapshotMutant = workerSource.replace('worker.registration.active !== active ||', '')
assert.notEqual(activeSnapshotMutant, workerSource, 'active-snapshot mutation reaches the intended defensive guard')
await assert.rejects(activeChangedDuringRetirementInvariant(activeSnapshotMutant), /active worker changes during the event/, 'active-object defense mutant is caught')

console.log('update controller/worker: nine guard mutants caught; consent, selected-activation failure/retry, download readiness, save gate, abort/disposal, atomic install, waiting-replacement retirement and defensive active-object snapshot passed')
