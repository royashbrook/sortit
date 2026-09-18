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

function controllerHarness({ deployed = newer, waiting = newer, installing = null, registrationPending = false,
  reply = true, fetchPending = false, updatePending = false, saved = true, source = controllerSource } = {}) {
  const states = [], messages = [], channels = [], timers = new Map(), fetches = []
  const document = Object.assign(target(), { hidden: false })
  const window = target(), serviceWorker = target(), pendingRegistration = deferred(), pendingUpdate = deferred()
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
    active, waiting: waiting ? makeWorker(waiting, 'installed') : null,
    installing: installing ? makeWorker(installing, 'installing') : null,
    update: async () => { updates++; if (updatePending) await pendingUpdate.promise },
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
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay, interval: false }); return id },
    clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = ++timerId; timers.set(id, { fn, interval: true }); return id },
    clearInterval: id => timers.delete(id),
    fetch: (url, options) => {
      const call = { url: String(url), options, aborted: false }
      fetches.push(call)
      if (!fetchPending) return Promise.resolve({ ok: true, json: async () => ({ fingerprint: deployed }) })
      return new Promise((_resolve, reject) => {
        call.reject = reject
        options.signal.addEventListener('abort', () => {
          call.aborted = true
          reject(new Error('aborted'))
        }, { once: true })
      })
    },
  }
  vm.runInNewContext(compile(source.replaceAll('import.meta.env', '__ENV__')), context)
  const api = context.exports.startUpdates(state => states.push(state), () => { saveChecks++; return saved })
  return { api, states, messages, channels, timers, fetches, document, window, serviceWorker, makeWorker,
    registration, pendingRegistration, pendingUpdate, get reloads() { return reloads }, get saveChecks() { return saveChecks },
    setDeployed: value => { deployed = value },
    setFetchPending: value => { fetchPending = value },
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

async function stalledUpdateInvariant(source = controllerSource, dispose = false) {
  const h = controllerHarness({ source, waiting: null, updatePending: true })
  try {
    await settle()
    assert.equal(h.updates, 1)
    assert.equal(h.last().status, 'checking')
    const deadline = [...h.timers].find(([, timer]) => !timer.interval && timer.delay === 8000)
    assert.ok(deadline, 'a native update must have an owned eight-second deadline')
    if (dispose) {
      h.api.dispose()
      await settle()
      h.assertDisposed()
    } else {
      h.timers.delete(deadline[0])
      deadline[1].fn()
      await settle()
      assert.equal(h.last().status, 'failed', 'stalled update exits checking with a retryable failure')
      assert.equal(h.last().ready, false)
      assert.equal([...h.timers.values()].filter(timer => !timer.interval).length, 0)
      h.registration.waiting = h.makeWorker(newer, 'installed')
      await h.api.check()
      assert.equal(h.last().status, 'ready', 'an explicit retry discovers a recovered download')
      assert.equal(h.updates, 1, 'recovery reuses a downloaded worker')
    }
    const publications = h.states.length
    h.pendingUpdate.resolve()
    await settle()
    assert.equal(h.states.length, publications, 'late native settlement cannot publish after timeout or disposal')
    assert.equal(h.reloads, 0, 'native settlement never grants reload consent')
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await stalledUpdateInvariant()
await stalledUpdateInvariant(controllerSource, true)
const stalledUpdateMutant = controllerSource.replace('Promise.race([value.update(), deadline])', 'Promise.race([value.update(), deadline.catch(() => new Promise(() => {}))])')
assert.notEqual(stalledUpdateMutant, controllerSource, 'deadline mutation reaches the native await')
await assert.rejects(stalledUpdateInvariant(stalledUpdateMutant), /exits checking/, 'an ignored deadline cannot leave checking stuck')

const lexicalMutant = controllerSource.replace('fingerprint !== __RELEASE__.fingerprint', 'fingerprint > __RELEASE__.fingerprint')
assert.notEqual(lexicalMutant, controllerSource, 'the rollback mutation must hit its intended guard')
await assert.rejects(acceptsFingerprint(rollback, lexicalMutant), /different fully downloaded/, 'lexical ordering mutant is caught')

async function noConcurrentInstallInvariant(source = controllerSource) {
  const h = controllerHarness({ waiting: null, installing: newer, source })
  const replacement = h.registration.installing
  try {
    await settle()
    assert.equal(h.updates, 0, 'registration already installing must not receive a concurrent update request')
    assert.equal(h.last().status, 'downloading')
    assert.equal(h.last().ready, false, 'an unfinished install is never offered')
    replacement.state = 'installed'
    h.registration.installing = null
    h.registration.waiting = replacement
    replacement.emit('statechange')
    await settle()
    assert.equal(h.updates, 0, 'a matching downloaded worker needs no redundant update')
    assert.equal(h.last().status, 'ready', 'installed replacement remains discoverable')
    assert.equal(h.reloads, 0, 'installation alone does not grant reload consent')
    h.registration.waiting = null
    h.registration.active = replacement
    await h.api.check()
    assert.equal(h.updates, 1, 'normal checks resume when no replacement is pending')
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await noConcurrentInstallInvariant()
const concurrentInstallMutant = controllerSource.replace('if (!registration.installing && fingerprint !== identity.fingerprint)', 'if (fingerprint !== identity.fingerprint)')
assert.notEqual(concurrentInstallMutant, controllerSource, 'concurrent update mutation removes the install guard')
await assert.rejects(noConcurrentInstallInvariant(concurrentInstallMutant), /concurrent update request/, 'overlapping registration and update is caught')

async function sameBuildWaitingInvariant(source = controllerSource) {
  const h = controllerHarness({ deployed: running, waiting: running, source })
  const replacement = h.registration.waiting
  h.serviceWorker.controller = h.registration.active = h.makeWorker(null, 'activated')
  try {
    await settle()
    assert.equal(h.updates, 0, 'a matching waiting build must not receive another update request')
    assert.equal(h.messages.filter(message => message.worker === replacement && message.data.type === 'SORTIT_ACTIVATE').length, 1,
      'an already-loaded build activates its matching waiting worker despite the legacy controller')
    assert.equal(h.reloads, 0, 'finishing the current build does not reload again')
    assert.equal(h.last().ready, false, 'the same build is not offered as another update')
    replacement.state = 'activated'
    h.registration.waiting = null
    h.registration.active = h.serviceWorker.controller = replacement
    h.serviceWorker.emit('controllerchange')
    await settle()
    assert.equal(h.last().status, 'current')
    assert.equal(h.reloads, 0)
    assert.ok(h.messages.some(message => message.worker === replacement && message.data.type === 'SORTIT_CLIENT'),
      'the new controller receives the running page identity after the handoff')
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await sameBuildWaitingInvariant()

async function quietHandoffInvariant(source = controllerSource) {
  const h = controllerHarness({ deployed: running, waiting: running, source })
  const replacement = h.registration.waiting
  h.serviceWorker.controller = h.registration.active = h.makeWorker(null, 'activated')
  try {
    await settle()
    const fetches = h.fetches.length, messages = h.messages.length
    replacement.emit('statechange')
    h.window.emit('online')
    h.window.emit('pageshow')
    h.document.emit('visibilitychange')
    for (const timer of h.timers.values()) if (timer.interval) timer.fn()
    await h.api.check()
    await settle()
    assert.equal(h.fetches.length, fetches, 'activation handoff must not start another probe through the outgoing worker')
    assert.equal(h.messages.length, messages, 'activation handoff must not dispatch more worker messages')
    assert.equal(h.reloads, 0)

    const unrelated = h.makeWorker(newer, 'installing')
    h.registration.installing = unrelated
    h.registration.emit('updatefound')
    unrelated.state = 'redundant'
    unrelated.emit('statechange')
    h.registration.installing = null
    await h.api.check()
    assert.equal(h.fetches.length, fetches, 'unrelated worker failure must not release the handoff')
    assert.notEqual(h.last().status, 'failed', 'unrelated failure must not report this handoff failed')

    replacement.state = 'activated'
    h.registration.waiting = null
    h.registration.active = h.serviceWorker.controller = replacement
    h.serviceWorker.emit('controllerchange')
    await settle()
    assert.equal(h.last().status, 'current', 'controller change resumes normal update checks')
    assert.ok(h.fetches.length > fetches)
    assert.equal(h.reloads, 0, 'matching-page activation never adds another reload')
    h.api.dispose()
    assert.equal(unrelated.count(), 0)
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await quietHandoffInvariant()

async function activationRecoveryInvariant(source = controllerSource, mode = 'timeout', consent = false) {
  const identity = consent ? newer : running
  const h = controllerHarness({ deployed: identity, waiting: identity, source })
  const selected = h.registration.waiting
  const post = selected.postMessage.bind(selected)
  if (mode === 'throw') selected.postMessage = (data, ports) => {
    if (data.type === 'SORTIT_ACTIVATE') throw new Error('worker no longer accepts messages')
    post(data, ports)
  }
  try {
    await settle()
    if (consent) h.api.apply()
    if (mode === 'timeout') {
      const deadline = [...h.timers].find(([, timer]) => !timer.interval && timer.delay === 8000)
      assert.ok(deadline, 'activation must have an owned eight-second recovery deadline')
      h.timers.delete(deadline[0])
      deadline[1].fn()
    } else if (mode === 'redundant') {
      selected.state = 'redundant'
      selected.emit('statechange')
    }
    assert.equal(h.last().status, 'failed', `${mode} releases activation with a visible failure`)
    assert.equal(h.last().ready, false, 'failed activation must not keep a stale ready action')
    assert.equal(h.reloads, 0)
    assert.equal([...h.timers.values()].filter(timer => !timer.interval).length, 0, 'failed activation clears its deadline')

    h.registration.waiting = h.makeWorker(newer, 'installed')
    h.setDeployed(newer)
    const before = h.fetches.length
    await h.api.check()
    assert.equal(h.fetches.length, before + 1, 'failed handoff permits an explicit retry')
    assert.equal(h.last().status, 'ready', 'retry discovers the current replacement')
    h.api.dispose()
    assert.equal(selected.count(), 0)
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
for (const consent of [false, true]) {
  for (const mode of ['timeout', 'redundant', 'throw']) await activationRecoveryInvariant(controllerSource, mode, consent)
}

async function activationDisposalInvariant(source = controllerSource) {
  const h = controllerHarness({ deployed: running, waiting: running, source })
  await settle()
  const callbacks = [...h.timers.values()].map(timer => timer.fn)
  h.api.dispose()
  h.assertDisposed()
  const publications = h.states.length, messages = h.messages.length, fetches = h.fetches.length
  for (const callback of callbacks) callback()
  await settle()
  assert.equal(h.states.length, publications, 'disposed activation cannot publish a late failure')
  assert.equal(h.messages.length, messages)
  assert.equal(h.fetches.length, fetches)
}
await activationDisposalInvariant()

const quietMutant = controllerSource.replace('document.hidden || activating ||', 'document.hidden ||')
assert.ok(quietMutant !== controllerSource, 'quiet mutation reaches the check entry guard')
await assert.rejects(quietHandoffInvariant(quietMutant), /another probe/, 'new probes during activation are caught')
const deadlineMutant = controllerSource.replace('if (!disposed() && activating === worker) failActivation()', '')
assert.ok(deadlineMutant !== controllerSource, 'deadline mutation disables recovery')
await assert.rejects(activationRecoveryInvariant(deadlineMutant), /timeout releases activation/, 'ignored activation cannot remain quiet forever')
const handoffRedundancyMutant = controllerSource.replace('if (worker === activating) failActivation()', '')
assert.ok(handoffRedundancyMutant !== controllerSource, 'handoff redundancy mutation disables recovery')
await assert.rejects(activationRecoveryInvariant(handoffRedundancyMutant, 'redundant'), /redundant releases activation/, 'superseded matching-page worker cannot keep the lock')
const handoffChangedMutant = controllerSource.replace('const changed = () => {\n    clearActivation()', 'const changed = () => {')
assert.ok(handoffChangedMutant !== controllerSource, 'controllerchange mutation keeps the handoff locked')
await assert.rejects(quietHandoffInvariant(handoffChangedMutant), /resumes normal update checks/, 'successful handoff must resume checking')
const activationDisposeMutant = controllerSource.replace('lifetime.abort()\n      clearActivation()', 'lifetime.abort()')
assert.ok(activationDisposeMutant !== controllerSource, 'disposal mutation leaks the activation deadline')
await assert.rejects(activationDisposalInvariant(activationDisposeMutant), /remaining interval or identify timeout/, 'activation deadline is owned by the mounted controller')
const activationThrowMutant = controllerSource.replace("try { worker.postMessage({ type: 'SORTIT_ACTIVATE' }) } catch { failActivation() }", "try { worker.postMessage({ type: 'SORTIT_ACTIVATE' }) } catch {}")
assert.ok(activationThrowMutant !== controllerSource, 'activation send mutation swallows rejection')
await assert.rejects(activationRecoveryInvariant(activationThrowMutant, 'throw'), /throw releases activation/, 'rejected activation exits immediately rather than awaiting the deadline')

const sameBuildMutant = controllerSource.replace('activate(target)', '/* no activation */')
assert.notEqual(sameBuildMutant, controllerSource, 'same-build activation mutation removes the handoff')
await assert.rejects(sameBuildWaitingInvariant(sameBuildMutant), /matching waiting worker/, 'matching-page legacy handoff stays observable')
const waitingUpdateMutant = controllerSource.replace('if (!registration.installing && fingerprint !== identity.fingerprint)', 'if (!registration.installing)')
assert.notEqual(waitingUpdateMutant, controllerSource, 'waiting-update mutation removes downloaded identity reuse')
await assert.rejects(sameBuildWaitingInvariant(waitingUpdateMutant), /another update request/, 'a downloaded matching worker is not redundantly updated')

async function staleWaitingInvariant(source = controllerSource) {
  const h = controllerHarness({ waiting: rollback, deployed: newer, source })
  try {
    await settle()
    assert.equal(h.updates, 1, 'a stale waiting build must still request the deployed replacement')
    assert.equal(h.last().ready, false, 'mismatched waiting build is not offered')
    const replacement = h.makeWorker(newer, 'installing')
    h.registration.installing = replacement
    h.registration.emit('updatefound')
    replacement.state = 'installed'
    h.registration.installing = null
    h.registration.waiting = replacement
    replacement.emit('statechange')
    await settle()
    assert.equal(h.updates, 1, 'matching downloaded replacement is reused')
    assert.equal(h.last().status, 'ready')
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await staleWaitingInvariant()
const staleWaitingMutant = controllerSource.replace('fingerprint !== identity.fingerprint)', '!registration.waiting)')
assert.notEqual(staleWaitingMutant, controllerSource, 'stale-waiting mutation prevents all waiting replacements')
await assert.rejects(staleWaitingInvariant(staleWaitingMutant), /deployed replacement/, 'downloaded reuse cannot pin an outdated waiting build')

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

async function probeFailsDuringApplyInvariant(source = controllerSource) {
  const h = controllerHarness({ source })
  try {
    await settle()
    h.setFetchPending(true)
    const pending = h.api.check()
    await settle()
    h.api.apply()
    h.fetches.at(-1).reject(new Error('network lost during activation'))
    await pending
    assert.equal(h.last().status, 'applying', 'late probe rejection cannot erase applying state')
    h.serviceWorker.emit('controllerchange')
    assert.equal(h.reloads, 1)
  } finally { h.api.dispose(); await settle(); h.assertDisposed() }
}
await probeFailsDuringApplyInvariant()
const applyingMutant = controllerSource.replace("if (state.status === 'applying' && status !== 'applying') return", '')
assert.notEqual(applyingMutant, controllerSource, 'applying-state mutation reaches the intended guard')
await assert.rejects(probeFailsDuringApplyInvariant(applyingMutant), /erase applying state/, 'late probe failure clobbering consent is caught')

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
    const previousChecks = h.fetches.length
    await h.api.check()
    assert.equal(h.fetches.length, previousChecks + 1, 'a failed activation permits another update check')
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

console.log('update controller/worker: twenty guard mutants caught; consent, quiet handoff, native-update deadline and late-settlement recovery, activation timeout/redundancy/send-failure recovery, install/update sequencing, matching-page legacy handoff, downloaded-build reuse/supersession, download readiness, save gate, abort/disposal, atomic install, waiting-replacement retirement and defensive active-object snapshot passed')
