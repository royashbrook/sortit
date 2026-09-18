import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const { webkit } = createRequire(import.meta.url)('@playwright/test')
const artifacts = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const resources = new Map()
const walk = (dir, prefix = '') => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = `${prefix}/${entry.name}`
    if (entry.isDirectory()) walk(join(dir, entry.name), path)
    else if (entry.isFile() && !['_headers', '_redirects', 'service-worker.js'].includes(entry.name)) {
      resources.set(path, readFileSync(join(dir, entry.name)))
    }
  }
}
walk(artifacts.a.dir)
const failedPath = [...resources.keys()].find(path => path.includes('/nodes/2.') && path.endsWith('.js'))
assert.ok(failedPath)
let generation = 'a'
let fail = false
const server = createServer((request, response) => {
  const path = new URL(request.url, 'http://fixture').pathname
  let body, type = 'application/octet-stream', status = 200
  if (path === '/') {
    body = '<!doctype html><title>native cache install reproduction</title>'
    type = 'text/html'
  } else if (path === '/minimal-worker.js') {
    type = 'application/javascript'
    body = `const VERSION=${JSON.stringify(generation)};
      self.addEventListener('install', event => event.waitUntil(caches.open('minimal-'+VERSION).then(cache => cache.addAll(${JSON.stringify([...resources.keys()])}))));
      self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
      self.addEventListener('message', event => { if(event.data.type==='SORTIT_VERSION') event.ports[0]?.postMessage(VERSION); });`
  } else {
    status = fail && path === failedPath ? 503 : resources.has(path) ? 200 : 404
    body = status === 200 ? resources.get(path) : 'fixture failure'
  }
  response.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(body) })
  response.end(body)
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`
const identity = page => page.evaluate(() => new Promise(resolve => {
  const channel = new MessageChannel()
  const timer = setTimeout(() => { channel.port1.close(); resolve(null) }, 1000)
  channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data) }
  navigator.serviceWorker.controller.postMessage({ type: 'SORTIT_VERSION' }, [channel.port2])
}))
const count = Number(process.argv[3] ?? 50)
try {
  for (let trial = 1; trial <= count; trial++) {
    const browser = await webkit.launch()
    try {
      const page = await browser.newPage()
      generation = 'a'; fail = false
      await page.goto(origin)
      await page.evaluate(async () => {
        await navigator.serviceWorker.register('/minimal-worker.js', { updateViaCache: 'none' })
        await navigator.serviceWorker.ready
        if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
      })
      assert.equal(await identity(page), 'a')
      generation = 'b'; fail = true
      await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration()
        const failed = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('replacement did not become redundant')), 15000)
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing
            worker.addEventListener('statechange', () => {
              if (worker.state === 'redundant') { clearTimeout(timer); resolve() }
            })
          }, { once: true })
        })
        await registration.update()
        await failed
      })
      const result = await identity(page)
      console.log(JSON.stringify({ trial, time: Date.now(), result }))
      assert.equal(result, 'a', 'failed replacement must leave the prior worker responsive')
    } finally { await browser.close() }
  }
} finally { await new Promise(resolve => server.close(resolve)) }
