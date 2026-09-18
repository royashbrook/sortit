import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const contentTypes = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
}

export function startArtifactServer(artifacts, port = 4198) {
  const trees = Object.fromEntries(Object.entries(artifacts).map(([key, artifact]) => {
    const files = new Map()
    const visit = (dir, prefix = '') => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${prefix}/${entry.name}`
        if (entry.isDirectory()) visit(join(dir, entry.name), path)
        else if (entry.isFile()) files.set(path, readFileSync(join(dir, entry.name)))
      }
    }
    visit(artifact.dir)
    return [key, files]
  }))
  let current = 'a', failures = new Set(), offline = false
  const requests = []
  const server = createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost')
    const path = url.pathname === '/' ? '/index.html' : url.pathname
    if (offline) { requests.push({ build: current, path, status: 0 }); response.destroy(); return }
    // Cloudflare consumes these files and does not expose them as assets.
    const body = ['/_headers', '/_redirects'].includes(path) ? undefined : trees[current].get(path)
    const status = failures.has(path) ? 503 : body ? 200 : 404
    const entry = { build: current, path, status, finished: false, closed: false }
    requests.push(entry)
    response.once('finish', () => { entry.finished = true })
    response.once('close', () => { entry.closed = true })
    const payload = status === 200 ? body : Buffer.from(`fixture ${status}`)
    const extension = path.slice(path.lastIndexOf('.'))
    response.writeHead(status, {
      'Content-Type': `${contentTypes[extension] ?? 'application/octet-stream'}; charset=utf-8`,
      'Content-Length': payload.length,
      'Cache-Control': 'no-store',
      ...(path === '/service-worker.js' ? { 'Service-Worker-Allowed': '/' } : {}),
    })
    response.end(payload)
  })
  return new Promise((resolveServer, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolveServer({
      requests,
      serve(key, failedPaths = []) {
        assert(trees[key], `unknown fixture build ${key}`)
        current = key
        failures = new Set(failedPaths)
        offline = false
        requests.length = 0
      },
      offline(value) { offline = value },
      bytes(key, path) { return trees[key].get(path) },
      paths(key) { return [...trees[key].keys()] },
      close: () => new Promise(done => { server.close(done); server.closeAllConnections() }),
    }))
  })
}

function run(command, args, options) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? '')
    process.stderr.write(result.stderr ?? '')
    throw new Error(`${basename(command)} ${args.join(' ')} exited ${result.status}`)
  }
}

function buildFixtures(root, work) {
  const source = join(work, 'source')
  for (const name of ['src', 'static', 'tools', 'package.json', 'package-lock.json', 'vite.config.js', 'svelte.config.js', 'tsconfig.json']) {
    cpSync(join(root, name), join(source, name), { recursive: true })
  }
  const gitdir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).trim()
  writeFileSync(join(source, '.git'), `gitdir: ${gitdir}\n`)
  symlinkSync(join(root, 'node_modules'), join(source, 'node_modules'), 'dir')
  const builds = []
  for (const marker of ['first', 'second']) {
    // Only this inert static fixture changes. The actual input fingerprint is
    // derived by the normal build wrapper, never injected or invented here.
    writeFileSync(join(source, 'static', 'pwa-fixture.txt'), `${marker}\n`)
    run(process.execPath, ['tools/release-build.mjs', '--development'], { cwd: source })
    const dir = join(work, marker)
    cpSync(join(source, 'build'), dir, { recursive: true })
    const release = JSON.parse(readFileSync(join(dir, 'release.json'), 'utf8'))
    builds.push({ dir, ...release })
  }
  assert.notEqual(builds[0].fingerprint, builds[1].fingerprint)
  builds.sort((left, right) => right.fingerprint.localeCompare(left.fingerprint))
  assert(builds[1].fingerprint < builds[0].fingerprint, 'the destination must exercise hash rollback, not greater-than detection')
  return { a: builds[0], b: builds[1] }
}

async function main() {
  const { values } = parseArgs({ options: { legacy: { type: 'string' }, artifacts: { type: 'string' } } })
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const work = mkdtempSync(join(process.env.SORTIT_PWA_WORK_ROOT ?? tmpdir(), 'sortit-pwa-'))
  const artifacts = values.artifacts ? JSON.parse(readFileSync(resolve(values.artifacts), 'utf8')) : buildFixtures(root, work)
  if (values.legacy) {
    const dir = resolve(values.legacy)
    assert(existsSync(join(dir, 'service-worker.js')), 'legacy directory must contain the shipped worker')
    artifacts.legacy = {
      dir,
      source: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim(),
      workerSha256: digest(readFileSync(join(dir, 'service-worker.js'))),
    }
  }
  const manifest = join(work, 'artifacts.json')
  writeFileSync(manifest, JSON.stringify(artifacts, null, 2) + '\n')
  console.log(`PWA fixtures: ${manifest}\nA ${artifacts.a.fingerprint}\nB ${artifacts.b.fingerprint} (lower hash)\nlegacy ${artifacts.legacy?.source ?? 'not supplied'}`)
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.pwa.config.js'], {
    cwd: root,
    env: { ...process.env, SORTIT_PWA_ARTIFACTS: manifest, SORTIT_PWA_OUTPUT: join(work, 'results') },
    stdio: 'inherit',
  })
  console.log(`PWA browser evidence: ${work}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
