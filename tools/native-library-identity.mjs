// Temporary Linux evidence, not a shipped runtime or release gate.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, readlinkSync, realpathSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { basename, dirname, join } from 'node:path'
import { webkit } from '@playwright/test'

export function descendants(rows, root) {
  const pids = new Set([root])
  for (let size = -1; size !== pids.size;) {
    size = pids.size
    for (const row of rows) if (pids.has(row.parent)) pids.add(row.pid)
  }
  return rows.filter(row => pids.has(row.pid))
}

export function soupMappings(maps) {
  const files = new Map()
  for (const line of maps.split('\n')) {
    const match = /^\S+\s+\S+\s+\S+\s+\S+\s+(\d+)\s+(\/.*)$/.exec(line)
    if (match && /^libsoup-.*\.so(?:\.|$)/.test(basename(match[2]))) {
      files.set(match[2], { path: match[2], inode: match[1] })
    }
  }
  return [...files.values()]
}

function processRows() {
  const rows = []
  for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8')
      rows.push({ pid: Number(pid), parent: Number(/^PPid:\s+(\d+)$/m.exec(status)[1]) })
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error
    }
  }
  return rows
}

function libraryIdentity(mapping) {
  const path = realpathSync(mapping.path)
  assert.equal(statSync(path, { bigint: true }).ino.toString(), mapping.inode, 'mapped file inode changed')
  const notes = execFileSync('readelf', ['-n', path], { encoding: 'utf8' })
  const buildId = /Build ID:\s+(\S+)/.exec(notes)?.[1]
  assert(buildId, 'mapped library has no ELF build identity')
  const owner = spawnSync('dpkg-query', ['-S', path], { encoding: 'utf8' })
  if (owner.error) throw owner.error
  // A bundled object may have no package owner. Preserve that result as unknown.
  assert(owner.status === 0 || owner.status === 1, `dpkg-query failed: ${owner.stderr}`)
  return { ...mapping, realpath: path, buildId,
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    packageOwner: { status: owner.status, stdout: owner.stdout.trim(), stderr: owner.stderr.trim() } }
}

async function inspect() {
  assert.equal(process.platform, 'linux', 'this inventory requires the actual Linux browser')
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<title>library identity</title>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let host, browser
  try {
    host = await webkit.launchServer({ headless: true })
    const root = host.process().pid
    assert(Number.isSafeInteger(root) && root > 1, 'owned browser process required')
    browser = await webkit.connect(host.wsEndpoint())
    const page = await browser.newPage()
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    assert.equal(await page.title(), 'library identity')
    const processes = descendants(processRows(), root).map(({ pid, parent }) => ({
      pid, parent, executable: readlinkSync(`/proc/${pid}/exe`),
      libraries: soupMappings(readFileSync(`/proc/${pid}/maps`, 'utf8')).map(libraryIdentity),
    }))
    assert(processes.some(p => /NetworkProcess/.test(basename(p.executable)) && p.libraries.length),
      'no owned network process with mapped libsoup was observed')
    const require = createRequire(import.meta.url)
    const core = dirname(require.resolve('playwright-core/package.json'))
    const metadata = JSON.parse(readFileSync(join(core, 'browsers.json'), 'utf8'))
    const packageVersion = execFileSync('dpkg-query', ['-W', '-f=${Version}', 'libsoup-3.0-0'], { encoding: 'utf8' })
    console.log(JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      platform: process.platform, node: process.version, browser: await browser.version(),
      playwright: JSON.parse(readFileSync(join(core, 'package.json'), 'utf8')).version,
      webkitMetadata: metadata.browsers.find(b => b.name === 'webkit'),
      installedSoupPackage: packageVersion, processes }, null, 2))
  } finally {
    await browser?.close()
    await host?.close()
    await new Promise(resolve => server.close(resolve))
  }
}

if (process.argv[2] === '--test') {
  assert.deepEqual(descendants([
    { pid: 9, parent: 8 }, { pid: 7, parent: 1 }, { pid: 8, parent: 7 },
    { pid: 11, parent: 10 }, { pid: 10, parent: 1 },
  ], 7).map(row => row.pid), [9, 7, 8])
  const mapped = '1-2 r--p 0000 08:01 42 /usr/lib/libsoup-3.0.so.0.6.0'
  assert.deepEqual(soupMappings(`${mapped}\n${mapped}\n1-2 rw-p 0000 00:00 0\n1-2 r--p 0000 08:01 43 /usr/lib/libother.so`),
    [{ path: '/usr/lib/libsoup-3.0.so.0.6.0', inode: '42' }])
  assert.deepEqual(soupMappings('1-2 r--p 0000 08:01 44 /tmp/libsoup-not-a-library.txt'), [])
  console.log('runtime identity controls: owned descendants only, deduplicated library mappings, unrelated paths excluded')
} else await inspect()
