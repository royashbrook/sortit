import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function artifactManifest(directory, release) {
  const files = {}
  const walk = (path = '') => {
    for (const entry of readdirSync(join(directory, path), { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
      const name = path ? `${path}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(name)
      else if (entry.isFile() && name !== 'artifact.json') files[name] = createHash('sha256').update(readFileSync(join(directory, name))).digest('hex')
      else if (!entry.isFile()) throw new Error(`unsupported artifact entry: ${name}`)
    }
  }
  walk()
  return { schema: 1, release, files, sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex') }
}

export function assertCurrentDeploy(source, mainHead, ref = 'refs/heads/main') {
  assert.equal(ref, 'refs/heads/main', 'only main can deploy')
  assert.match(source, /^[a-f0-9]{40}$/, 'deploy source is an exact commit')
  assert.equal(source, mainHead, 'outdated deployment refused: validated source is no longer main HEAD')
}

export function verifyArtifact(directory, { allowDevelopment = false, expectedSource } = {}) {
  const read = name => readFileSync(join(directory, name), 'utf8')
  const manifest = JSON.parse(read('artifact.json'))
  const release = JSON.parse(read('release.json'))
  assert.deepEqual(manifest, artifactManifest(directory, release), 'artifact bytes or manifest changed after validation')
  assert.match(release.fingerprint, /^[a-f0-9]{64}$/)
  assert.match(release.source, /^[a-f0-9]{40}$/)
  if (expectedSource) assert.equal(release.source, expectedSource, 'artifact must come from the requested commit')
  if (!allowDevelopment) {
    assert.equal(release.development, false, 'development artifact cannot deploy')
    assert.equal(release.dirty, false, 'dirty artifact cannot deploy')
    assert.match(release.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
    assert.match(release.anchor, /^v(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  }
  assert.equal(JSON.parse(read('_app/version.json')).version, release.fingerprint, 'Kit updater and release fingerprint agree')
  const clientCode = Object.keys(manifest.files).filter(name => name.endsWith('.js') && name !== 'service-worker.js').map(read).join('\n')
  assert.ok(clientCode.includes(release.version), 'client shell agrees with release version')
  assert.ok(read('service-worker.js').includes(release.fingerprint), 'worker cache agrees with release fingerprint')
  for (const name of ['manifest.json', 'third-party-notices.txt', 'licenses.json']) assert.ok(manifest.files[name], `artifact includes ${name}`)
  const inventory = JSON.parse(read('licenses.json'))
  for (const name of ['svelte', 'qrcode']) assert.ok(inventory.packages.some(pkg => pkg.name === name), `artifact inventory includes ${name}`)
  for (const pkg of inventory.packages) {
    assert.ok(pkg.modules.length && pkg.notices.length, `inventory has evidence for ${pkg.name}`)
    for (const notice of pkg.notices) assert.ok(read('third-party-notices.txt').includes(notice.text), `complete notice for ${pkg.name}`)
  }
  // Source-level precache membership is supplemented by actual offline browser tests.
  for (const name of ['third-party-notices.txt', 'licenses.json']) assert.ok(read('service-worker.js').includes(name), `worker includes offline ${name}`)
  return release
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (process.argv[2] === '--test') {
    const old = '1'.repeat(40), current = '2'.repeat(40)
    assert.doesNotThrow(() => assertCurrentDeploy(current, current))
    assert.throws(() => assertCurrentDeploy(old, current), /outdated/)
    assert.throws(() => assertCurrentDeploy(current, current, 'refs/heads/feature'), /only main/)
    const directory = mkdtempSync(join(tmpdir(), 'sortit-artifact-fixtures-'))
    try {
      const release = { version: '1.2.0', source: current, anchor: 'v1.2', dirty: false, development: false, fingerprint: 'a'.repeat(64) }
      const write = (path, text) => { mkdirSync(dirname(join(directory, path)), { recursive: true }); writeFileSync(join(directory, path), text) }
      const seal = () => write('artifact.json', JSON.stringify(artifactManifest(directory, JSON.parse(readFileSync(join(directory, 'release.json'), 'utf8')))))
      write('release.json', JSON.stringify(release))
      write('index.html', '<html>client shell</html>')
      write('app.js', JSON.stringify(release))
      write('service-worker.js', `${release.fingerprint} third-party-notices.txt licenses.json`)
      write('_app/version.json', JSON.stringify({ version: release.fingerprint }))
      write('manifest.json', '{}')
      write('third-party-notices.txt', 'complete notices fixture')
      write('licenses.json', JSON.stringify({ packages: ['svelte', 'qrcode'].map(name => ({ name, modules: ['fixture.js'], notices: [{ text: 'complete notices fixture' }] })) }))
      seal()
      assert.deepEqual(verifyArtifact(directory, { expectedSource: current }), release)
      assert.throws(() => verifyArtifact(directory, { expectedSource: old }), /requested commit/)
      write('app.js', 'changed after validation')
      assert.throws(() => verifyArtifact(directory), /artifact bytes/)
      write('app.js', JSON.stringify(release))
      write('_app/version.json', JSON.stringify({ version: 'b'.repeat(64) }))
      seal()
      assert.throws(() => verifyArtifact(directory), /Kit updater/)
      write('_app/version.json', JSON.stringify({ version: release.fingerprint }))
      write('third-party-notices.txt', 'notice removed')
      seal()
      assert.throws(() => verifyArtifact(directory), /complete notice/)
      write('third-party-notices.txt', 'complete notices fixture')
      write('service-worker.js', release.fingerprint)
      seal()
      assert.throws(() => verifyArtifact(directory), /offline/)
      write('service-worker.js', `${release.fingerprint} third-party-notices.txt licenses.json`)
      write('release.json', JSON.stringify({ ...release, development: true }))
      seal()
      assert.throws(() => verifyArtifact(directory), /development artifact/)
      assert.doesNotThrow(() => verifyArtifact(directory, { allowDevelopment: true }))
    } finally { rmSync(directory, { recursive: true, force: true }) }
    console.log('artifact integrity: altered bytes, wrong source/fingerprint, missing notices, offline omission and development deployment rejected; stale/non-main ordering guards passed')
  } else if (process.argv[2] === '--current') {
    assertCurrentDeploy(process.argv[3], process.argv[4], process.argv[5])
  } else {
    const release = verifyArtifact(process.argv[2] || 'build', {
      allowDevelopment: process.argv.includes('--development'), expectedSource: process.env.GITHUB_SHA,
    })
    console.log(`artifact verified: ${release.version} ${release.fingerprint}`)
  }
}
