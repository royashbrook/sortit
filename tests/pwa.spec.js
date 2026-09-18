import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { startArtifactServer } from '../tools/verify-pwa.mjs'

const artifacts = process.env.SORTIT_PWA_ARTIFACTS
  ? JSON.parse(readFileSync(process.env.SORTIT_PWA_ARTIFACTS, 'utf8')) : null
test.skip(!artifacts, 'run node tools/verify-pwa.mjs to build and serve two real artifacts')
let server
test.beforeAll(async () => { if (artifacts) server = await startArtifactServer(artifacts) })
test.afterAll(async () => { await server?.close() })
test.beforeEach(async ({ page, browserName }, info) => {
  if (server) server.timeline.length = 0
  server?.serve('a')
  await page.addInitScript(() => {
    const documentId = performance.timeOrigin
    let operation = 0
    const record = (event, detail = {}) => {
      const events = JSON.parse(sessionStorage.getItem('pwa-timeline') || '[]')
      events.push({ time: Date.now(), documentId, event, ...detail })
      sessionStorage.setItem('pwa-timeline', JSON.stringify(events.slice(-150)))
    }
    const state = registration => ({
      active: registration.active?.state, waiting: registration.waiting?.state,
      installing: registration.installing?.state,
    })
    record('page', { url: location.href })
    for (const event of ['pagehide', 'pageshow', 'online', 'offline', 'visibilitychange']) {
      const target = event === 'visibilitychange' ? document : window
      target.addEventListener(event, value => record(event, { persisted: value.persisted, visibility: document.visibilityState, online: navigator.onLine }))
    }
    let lastUI
    new MutationObserver(() => {
      const ui = { button: document.querySelector('.check-updates')?.textContent ?? null, toast: document.querySelector('.toast')?.textContent ?? null }
      const value = JSON.stringify(ui)
      if (value !== lastUI) { lastUI = value; record('update-ui', ui) }
    }).observe(document, { subtree: true, childList: true, characterData: true })
    const nativeFetch = window.fetch
    window.fetch = function (...args) {
      const probe = String(args[0]).includes('update-probe')
      if (probe) record('probe-start')
      const promise = nativeFetch.apply(this, args)
      if (probe) promise.then(response => record('probe-headers', { status: response.status }),
        error => record('probe-error', { name: error.name, message: error.message }))
      return promise
    }
    const NativeChannel = window.MessageChannel
    window.MessageChannel = function (...args) {
      const channel = new NativeChannel(...args)
      channel.port1.addEventListener('message', event => record('identity-reply', { value: event.data }))
      return channel
    }
    window.MessageChannel.prototype = NativeChannel.prototype
    const nativePost = ServiceWorker.prototype.postMessage
    ServiceWorker.prototype.postMessage = function (...args) {
      record('worker-message', { type: args[0]?.type, worker: this.state })
      return nativePost.apply(this, args)
    }
    const watch = registration => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => record('worker-state', { worker: worker.state, ...state(registration) }))
    }
    for (const [owner, key] of [[ServiceWorkerContainer.prototype, 'register'], [ServiceWorkerRegistration.prototype, 'update']]) {
      const native = owner[key]
      owner[key] = function (...args) {
        const operationId = ++operation
        record(`${key}-start`, { operationId, ...(key === 'update' ? state(this) : {}) })
        const promise = native.apply(this, args)
        promise.then(registration => {
          record(`${key}-end`, { operationId, ...state(registration) })
          if (key === 'register') {
            watch(registration)
            registration.addEventListener('updatefound', () => { record('updatefound', state(registration)); watch(registration) })
          }
        }, error => record(`${key}-error`, { operationId, name: error.name, message: error.message }))
        return promise
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => record('controllerchange', { controller: navigator.serviceWorker.controller?.state }))
  })
  if (browserName === 'webkit') info.annotations.push({ type: 'platform-limit', description: 'Playwright WebKit offline emulation rejects navigation with an internal engine error. These offline checks instead cut every fixture-server socket; they do not certify OS/device offline mode.' })
})
test.afterEach(async ({ page }, info) => {
  await info.attach('fixture-timeline', { body: JSON.stringify([...server.timeline, { time: Date.now(), event: 'snapshot' }], null, 2), contentType: 'application/json' })
  if (!page.isClosed()) {
    const timeline = await page.evaluate(() => JSON.stringify([
      ...JSON.parse(sessionStorage.getItem('pwa-timeline') || '[]'),
      { time: Date.now(), event: 'snapshot', documentId: performance.timeOrigin },
    ])).catch(error => JSON.stringify({ error: error.message }))
    await info.attach('pwa-timeline', { body: timeline ?? '[]', contentType: 'application/json' })
  }
  if (info.status === info.expectedStatus) return
  await info.attach('artifact-requests', { body: JSON.stringify(server.requests, null, 2), contentType: 'application/json' })
  if (!page.isClosed()) {
    const state = await page.evaluate(async () => ({
      caches: await caches.keys(),
      workers: (await navigator.serviceWorker.getRegistrations()).map(registration => ({
        active: registration.active?.state, waiting: registration.waiting?.state, installing: registration.installing?.state,
      })),
    })).catch(error => ({ error: error.message }))
    await info.attach('worker-state', { body: JSON.stringify(state, null, 2), contentType: 'application/json' })
  }
})

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const cacheNames = page => page.evaluate(() => caches.keys())
const puzzle = page => page.evaluate(() => {
  const { tubes, moves, history } = JSON.parse(localStorage.getItem('sortit:game'))
  return { tubes, moves, history }
})
const timeline = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('pwa-timeline') || '[]'))
async function about(page) {
  if (await page.locator('dialog').count()) await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'MORE', exact: true }).click()
  await page.getByRole('button', { name: 'ABOUT', exact: true }).click()
}
async function workerVersion(page) {
  return page.evaluate(() => new Promise(resolve => {
    const worker = navigator.serviceWorker.controller
    if (!worker) return resolve(null)
    const channel = new MessageChannel()
    const timer = setTimeout(() => { channel.port1.close(); resolve(null) }, 1000)
    channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data) }
    worker.postMessage({ type: 'SORTIT_VERSION' }, [channel.port2])
  }))
}
async function open(page, key = 'a') {
  await page.addInitScript(() => {
    if (!localStorage.getItem('sortit:progress')) {
      localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true }))
      localStorage.setItem('sortit:skin', 'bolts')
    }
  })
  await page.goto('/')
  await expect(page.locator('#board')).toBeVisible()
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)
  if (key !== 'legacy') await expect.poll(() => workerVersion(page)).toBe(artifacts[key].fingerprint)
}
async function move(page, from = 0, to = 2) {
  await page.locator('.tube').nth(from).click()
  await page.locator('.tube').nth(to).click()
  await expect(page.locator('.tube').nth(to).locator('.item')).toHaveCount(1)
}
async function check(page) {
  await about(page)
  // A visibility/online check can finish while About opens. Never mistake its
  // now-ready button for another request to check, which would accept an update.
  await page.locator('.check-updates').evaluate(button => { if (!button.classList.contains('ready')) button.click() })
}
async function accept(page, key) {
  await page.keyboard.press('Escape')
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('.toast').click()])
  await expect(page.locator('#board')).toBeVisible()
  await expect.poll(() => workerVersion(page)).toBe(artifacts[key].fingerprint)
  await about(page)
  await expect(page.getByText(`build ${artifacts[key].fingerprint.slice(0, 12)}`, { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
}
async function offline(context) {
  server.offline(true)
  if (test.info().project.name !== 'webkit') await context.setOffline(true)
}
async function offlineFlow(page, context) {
  await offline(context)
  await page.reload()
  await expect(page.locator('#board')).toBeVisible()
  await move(page, 2, 3)
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(page.locator('.tube').nth(2).locator('.item')).toHaveCount(1)
  const notices = await page.evaluate(async () => {
    const response = await fetch('/third-party-notices.txt')
    return { ok: response.ok, text: await response.text() }
  })
  expect(notices.ok).toBe(true)
  expect(notices.text).toContain('MIT')
  expect(notices.text.length).toBeGreaterThan(1000)
}

test('consent updates to a lower fingerprint, preserves saves and holds old-tab assets until safe retirement', async ({ page, context, browserName }, info) => {
  const errors = []
  page.on('pageerror', error => errors.push({ name: error.name, message: error.message, stack: error.stack ?? '' }))
  await open(page)
  await move(page)
  const saved = await puzzle(page)
  const held = await context.newPage()
  await open(held)
  await held.evaluate(() => { window.heldDocument = 'still running A' })
  const oldAsset = server.paths('a').find(path => path.includes('/nodes/2.') && path.endsWith('.js') && !server.paths('b').includes(path))
  expect(oldAsset, 'fixture must contain a genuinely replaced immutable module').toBeTruthy()
  await page.evaluate(async () => { await (await caches.open('unrelated-app-cache')).put('/unrelated', new Response('keep me')) })
  server.serve('b')
  expect(artifacts.b.fingerprint < artifacts.a.fingerprint).toBe(true)
  await check(page)
  await expect(page.locator('.toast')).toHaveText('update ready, tap to reload', { timeout: 15_000 })
  expect(await workerVersion(page)).toBe(artifacts.a.fingerprint)
  await expect(page.getByText(`build ${artifacts.a.fingerprint.slice(0, 12)}`, { exact: false })).toBeVisible()
  expect(await puzzle(page)).toEqual(saved)
  await accept(page, 'b')
  expect(await puzzle(page)).toEqual(saved)
  expect(await held.evaluate(() => window.heldDocument)).toBe('still running A')
  await expect.poll(() => workerVersion(held)).toBe(artifacts.b.fingerprint)
  expect(await cacheNames(page)).toEqual(expect.arrayContaining([`sortit-${artifacts.a.fingerprint}`, `sortit-${artifacts.b.fingerprint}`, 'unrelated-app-cache']))
  const bytes = await held.evaluate(async path => {
    const response = await fetch(path, { cache: 'no-store' })
    return { status: response.status, body: Array.from(new Uint8Array(await response.arrayBuffer())) }
  }, oldAsset)
  expect(bytes.status).toBe(200)
  expect(digest(Buffer.from(bytes.body))).toBe(digest(server.bytes('a', oldAsset)))
  expect(server.requests.some(request => request.path === oldAsset)).toBe(false)
  await held.close()
  await check(page)
  await expect.poll(() => cacheNames(page)).toEqual(expect.arrayContaining([`sortit-${artifacts.b.fingerprint}`, 'unrelated-app-cache']))
  await expect.poll(async () => (await cacheNames(page)).includes(`sortit-${artifacts.a.fingerprint}`)).toBe(false)
  await page.keyboard.press('Escape')
  expect(errors).toEqual([])
  await offlineFlow(page, context)
  const outageErrors = errors.splice(0)
  await info.attach('native-offline-diagnostics', { body: JSON.stringify(outageErrors, null, 2), contentType: 'application/json' })
  for (const error of outageErrors) {
    expect(browserName).toBe('webkit')
    expect([
      { name: 'FetchEvent.respondWith received an error', message: 'TypeError: Load failed', stack: '' },
      { name: 'Fetch API cannot load http', message: '/127.0.0.1:4198/release.json?update-probe.', stack: '' },
    ]).toContainEqual(error)
  }
  server.offline(false)
  await context.setOffline(false)
  await check(page)
  await expect(page.locator('.check-updates')).toHaveText('up to date')
  expect(errors).toEqual([])
})

test('a failed new-asset download leaves the old generation playable offline and retries honestly', async ({ page, context }) => {
  await open(page)
  await move(page)
  const saved = await puzzle(page)
  const failed = server.paths('b').find(path => path.includes('/nodes/2.') && path.endsWith('.js'))
  server.serve('b', [failed])
  await check(page)
  await expect(page.locator('.check-updates')).toHaveText('download failed, tap to retry', { timeout: 15_000 })
  expect(server.requests.some(request => request.path === failed && request.status === 503)).toBe(true)
  expect(await workerVersion(page)).toBe(artifacts.a.fingerprint)
  await expect(page.locator('.toast')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await offlineFlow(page, context)
  expect(await puzzle(page)).toEqual(saved)
  await context.setOffline(false)
  const priorRequests = server.timeline.filter(event => event.event === 'request').map(event => event.id)
  server.serve('b')
  expect(server.timeline.filter(event => event.event === 'request').map(event => event.id)).toEqual(priorRequests)
  expect(new Set((await timeline(page)).filter(event => event.event === 'page').map(event => event.documentId)).size).toBeGreaterThan(1)
  await check(page)
  await expect(page.locator('.toast')).toHaveText('update ready, tap to reload', { timeout: 15_000 })
  await accept(page, 'b')
  expect(await puzzle(page)).toEqual(saved)
})

test('a stalled native update reports failure without losing play or consent, then recovers', async ({ page }) => {
  await open(page)
  await move(page)
  const saved = await puzzle(page)
  await about(page)
  await expect(page.locator('.check-updates')).toHaveText('up to date')
  server.serve('b')
  server.stall('/service-worker.js')
  try {
    const started = Date.now()
    await check(page)
    await expect(page.locator('.check-updates')).toHaveText('download failed, tap to retry', { timeout: 12_000 })
    expect(Date.now() - started).toBeGreaterThanOrEqual(7000)
    expect(server.requests.some(request => request.path === '/service-worker.js' && !request.finished)).toBe(true)
    const before = await timeline(page)
    const pending = before.findLast(event => event.event === 'update-start')
    const failedUI = before.findLast(event => event.event === 'update-ui' && event.button === 'download failed, tap to retry')
    expect(pending.time).toBeGreaterThanOrEqual(started)
    expect(failedUI.documentId).toBe(pending.documentId)
    expect(failedUI.time - pending.time).toBeGreaterThanOrEqual(7000)
    const settled = event => event.documentId === pending.documentId && event.operationId === pending.operationId && ['update-end', 'update-error'].includes(event.event)
    expect(before.filter(settled)).toEqual([])
    const request = server.timeline.findLast(event => event.event === 'request' && event.url === '/service-worker.js')
    expect(request.stalled).toBe(true)
    expect(server.timeline.filter(event => event.id === request.id).map(event => event.event)).toEqual(['request'])
    expect(await workerVersion(page)).toBe(artifacts.a.fingerprint)
    expect(await puzzle(page)).toEqual(saved)
    await expect(page.locator('.toast')).toHaveCount(0)
    server.resume()
    await check(page)
    await expect(page.locator('.toast')).toHaveText('update ready, tap to reload', { timeout: 15_000 })
    expect((await timeline(page)).filter(settled).map(event => event.event)).toEqual(['update-end'])
    expect(server.timeline.filter(event => event.id === request.id).map(event => event.event)).toContain('response-finish')
    expect((await timeline(page)).some(event => event.event === 'update-ui' && event.toast === 'update ready, tap to reload')).toBe(true)
    expect(await workerVersion(page)).toBe(artifacts.a.fingerprint)
    await accept(page, 'b')
    expect(await puzzle(page)).toEqual(saved)
  } finally { server.resume() }
})

test('version and update probes never fall back to cached identities when offline', async ({ page, context }) => {
  await open(page)
  await move(page)
  const paths = ['/release.json', '/release.json?update-probe', '/_app/version.json', '/?update-probe']
  await page.evaluate(async ({ paths, fingerprint }) => {
    const cache = await caches.open(`sortit-${fingerprint}`)
    for (const path of paths) await cache.put(path, new Response('stale cached identity'))
  }, { paths, fingerprint: artifacts.a.fingerprint })
  await offline(context)
  const outcomes = await page.evaluate(async paths => Promise.all(paths.map(async path => {
    try { const response = await fetch(path); return { path, text: await response.text() } }
    catch { return { path, failed: true } }
  })), paths)
  expect(outcomes).toEqual(paths.map(path => ({ path, failed: true })))
  await offlineFlow(page, context)
})

test('the shipped legacy install migrates at the same origin without losing its saved puzzle', async ({ page }) => {
  test.skip(!artifacts.legacy, 'supply --legacy <shipped build directory> for the legacy migration proof')
  server.serve('legacy')
  await open(page, 'legacy')
  await expect(page.locator('.version-stamp')).toHaveText('v1.1.21')
  await move(page)
  const saved = await puzzle(page)
  server.serve('a')
  await check(page)
  await expect(page.locator('.toast')).toHaveText('update ready, tap to reload', { timeout: 15_000 })
  await page.keyboard.press('Escape')
  await Promise.all([page.waitForNavigation({ waitUntil: 'load' }), page.locator('.toast').click()])
  // The shipped worker does not answer the new identity handshake. Allow the
  // controller's bounded 4-second timeout and queued post-install check.
  await expect.poll(() => workerVersion(page), { timeout: 15_000 }).toBe(artifacts.a.fingerprint)
  expect(await puzzle(page)).toEqual(saved)
  await expect(page.locator('.tube').nth(2).locator('.item')).toHaveCount(1)
})

test('a new page finishes an already-waiting legacy handoff without another reload or consent prompt', async ({ page }) => {
  test.skip(!artifacts.legacy, 'supply --legacy <shipped build directory> for the legacy handoff proof')
  server.serve('legacy')
  await open(page, 'legacy')
  await move(page)
  const saved = await puzzle(page)
  server.serve('a')
  await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update() })
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state)).toBe('installed')
  expect(await workerVersion(page)).toBeNull()
  await page.reload()
  await expect(page.locator('.version-stamp')).toHaveText(`v${artifacts.a.version}`)
  await page.evaluate(() => { window.migrationDocument = 'same page' })
  await expect.poll(() => workerVersion(page), { timeout: 15_000 }).toBe(artifacts.a.fingerprint)
  expect(await page.evaluate(() => window.migrationDocument)).toBe('same page')
  await expect(page.locator('.toast')).toHaveCount(0)
  expect(await puzzle(page)).toEqual(saved)
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).waiting)).toBeNull()
})
