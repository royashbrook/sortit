import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { verifyArtifact } from './release-artifact.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const noStore = new Set(['index.html', 'service-worker.js', 'release.json', '_app/version.json', 'manifest.json'])
const hostFiles = new Set(['_headers', '_redirects'])
// The host can rewrite navigation HTML while serving unchanged bytes to Node fetch.
const navigationHeaders = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
}

export async function compareLive(manifest, origin, fetcher = fetch) {
  for (const [name, hash] of Object.entries(manifest.files)) {
    const path = name === 'index.html' ? '/' : `/${name}`
    const html = name.endsWith('.html')
    const response = await fetcher(new URL(path, origin), { cache: 'no-store', ...(html ? { headers: navigationHeaders } : {}) })
    if (hostFiles.has(name)) {
      assert.equal(response.status, 404, `${name} must configure the host, not be served`)
      continue
    }
    assert.equal(response.status, 200, `${path} must serve the validated artifact`)
    assert.equal(digest(Buffer.from(await response.arrayBuffer())), hash, `${path} differs from the validated artifact`)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${path} lacks nosniff`)
    const cache = response.headers.get('cache-control') ?? ''
    if (noStore.has(name)) assert.match(cache, /(?:^|[,\s])no-store(?:$|[,\s])/, `${path} must not cache release identity or shell`)
    if (html) assert.match(cache, /(?:^|[,\s])no-transform(?:$|[,\s])/, `${path} must not transform validated HTML`)
    if (name.startsWith('_app/immutable/')) assert.match(cache, /(?:^|[,\s])immutable(?:$|[,\s])/, `${path} must be immutable`)
  }
  const response = await fetcher(new URL('/artifact.json', origin), { cache: 'no-store' })
  assert.equal(response.status, 200, 'the live artifact manifest must be available')
  assert.deepEqual(await response.json(), manifest, 'the live manifest must identify the exact validated bytes')
  return manifest.release
}

async function main() {
  const directory = process.argv[2] ?? 'build'
  const origin = process.argv[3]
  verifyArtifact(directory)
  const manifest = JSON.parse(readFileSync(join(directory, 'artifact.json'), 'utf8'))
  // Edge propagation may briefly expose the previous release. Retry the whole
  // comparison, never bless a mixed artifact or extend the three-minute budget.
  const deadline = Date.now() + 180_000
  for (;;) {
    try {
      const release = await compareLive(manifest, origin, (url, options) => fetch(url, {
        ...options, signal: AbortSignal.timeout(Math.max(1, Math.min(15_000, deadline - Date.now()))),
      }))
      console.log(`live verified: ${release.version} / ${release.fingerprint} / ${release.source}`)
      return
    } catch (error) {
      if (Date.now() >= deadline) throw error
      console.error(`live comparison pending: ${error.message}`)
      await setTimeout(Math.min(2000, deadline - Date.now()))
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--test') {
    const bodies = {
      'index.html': '<html>app</html>', 'release.json': '{"version":"1.2.0"}',
      'service-worker.js': 'worker', '_app/version.json': '{"version":"fingerprint"}',
      '_app/immutable/app.js': 'bundle', 'manifest.json': '{}',
      'third-party-notices.txt': 'complete notices', '_headers': 'host config',
    }
    const manifest = { release: { version: '1.2.0' }, files: Object.fromEntries(Object.entries(bodies).map(([name, body]) => [name, digest(body)])) }
    const origin = 'https://example.test'
    function fixture(change = {}) {
      return async url => {
        const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1)
        if (name === 'artifact.json') return Response.json(change.manifest ?? manifest)
        const headers = { 'x-content-type-options': 'nosniff', 'cache-control': name.endsWith('.html') ? 'no-store, no-transform' : noStore.has(name) ? 'no-store' : name.startsWith('_app/immutable/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0' }
        const status = hostFiles.has(name) ? 404 : 200
        return new Response(bodies[name], { status, headers, ...change[name] })
      }
    }
    assert.deepEqual(await compareLive(manifest, origin, fixture()), manifest.release)
    await assert.rejects(compareLive(manifest, origin, fixture({ 'index.html': { headers: { 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' } } })), /must not transform/)
    const rewritingHost = async (url, options) => {
      const response = await fixture()(url, options)
      const headers = new Headers(options.headers)
      if (url.pathname === '/' && headers.get('accept')?.includes('text/html') && headers.get('user-agent')?.includes('Mozilla/')) {
        return new Response(`${bodies['index.html']}<script src="https://analytics.example.test/beacon.js"></script>`, { headers: response.headers })
      }
      return response
    }
    // The same host gives generic clients the original bytes but rewrites browser HTML.
    assert.equal(digest(Buffer.from(await (await rewritingHost(new URL('/', origin), {})).arrayBuffer())), manifest.files['index.html'])
    await assert.rejects(compareLive(manifest, origin, rewritingHost), /differs/)
    await assert.rejects(compareLive(manifest, origin, fixture({ 'third-party-notices.txt': { status: 404 } })), /validated artifact/)
    await assert.rejects(compareLive(manifest, origin, async (url, options) => url.pathname === '/_app/immutable/app.js'
      ? new Response('wrong bundle', { headers: { 'x-content-type-options': 'nosniff', 'cache-control': 'immutable' } }) : fixture()(url, options)), /differs/)
    await assert.rejects(compareLive(manifest, origin, fixture({ 'release.json': { headers: { 'x-content-type-options': 'nosniff' } } })), /must not cache/)
    await assert.rejects(compareLive(manifest, origin, fixture({ 'index.html': { headers: { 'cache-control': 'no-store' } } })), /nosniff/)
    await assert.rejects(compareLive(manifest, origin, fixture({ '_app/immutable/app.js': { headers: { 'x-content-type-options': 'nosniff' } } })), /immutable/)
    await assert.rejects(compareLive(manifest, origin, fixture({ '_headers': { status: 200 } })), /not be served/)
    await assert.rejects(compareLive(manifest, origin, fixture({ manifest: { ...manifest, release: { version: 'old' } } })), /exact validated bytes/)
    console.log('live verifier: browser-shaped HTML, injection rejection, exact bytes, manifest, notices and host/cache/security controls pass')
  } else await main()
}
