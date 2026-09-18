import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { assertCurrentDeploy } from './release-artifact.mjs'

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8')
const deploy = read('.github/workflows/deploy-site.yml')
const check = read('.github/workflows/pr-check.yml')
const pkg = JSON.parse(read('package.json'))
const headers = read('static/_headers')
for (const path of ['/', '/index.html']) {
  const block = headers.split('\n\n').flatMap(part => part.split(/\n(?=\/)/)).find(part => part.startsWith(`${path}\n`))
  assert.match(block ?? '', /Cache-Control: no-store, no-transform/, `${path} preserves uncached, unmodified HTML`)
}
const { default: config } = await import('../svelte.config.js')
for (const path of ['_headers', '_redirects']) assert.equal(config.kit.serviceWorker.files(path), false, `${path} is host configuration, not an offline asset`)
for (const path of ['manifest.json', 'icon-192.png']) assert.equal(config.kit.serviceWorker.files(path), true)
assert.match(pkg.devDependencies.wrangler, /^\d+\.\d+\.\d+$/, 'deployment CLI has an exact lockfile version')
assert.match(deploy, /group: sortit-production\s+cancel-in-progress: false/)
assert.match(deploy, /if: github.ref == 'refs\/heads\/main'/)
assert.match(deploy, /ref: main\s+fetch-depth: 0/)
assert.doesNotMatch(deploy, /paths-ignore:/, 'every changed release identity needs a deployment')
for (const workflow of [check, deploy]) {
  for (const command of ['npm ci', 'npm run lint:copy', 'npm run verify', 'npm run svelte-check', 'npm run build', 'npm run test:browser', 'npm run e2e', 'npm run e2e:first-run', 'node tools/verify-pwa.mjs --legacy', 'npm run verify:artifact']) assert.ok(workflow.includes(command), `workflow runs ${command}`)
  assert.ok(workflow.includes('d9949e6263e98323a985ae8f09762a39ecadc335'), 'legacy migration builds the pinned old app')
  assert.ok(workflow.includes('chromium webkit'))
}
const beforePublish = ['npm run test:browser', 'node tools/verify-pwa.mjs --legacy', 'npm run verify:artifact', 'node tools/release-artifact.mjs --current']
function assertPublicationOrder(workflow) {
  const publish = workflow.indexOf('npm exec --no -- wrangler deploy')
  assert.ok(publish >= 0, 'publication command exists')
  for (const command of beforePublish) {
    const position = workflow.indexOf(command)
    assert.ok(position >= 0 && position < publish, `${command} exists and precedes publication`)
  }
  return publish
}
const publish = assertPublicationOrder(deploy)
// A missing command has index -1, which also sorts before publication.
for (const command of beforePublish) {
  const without = deploy.split('\n').filter(line => !line.includes(command)).join('\n')
  assert.throws(() => assertPublicationOrder(without), /exists and precedes publication/)
}
assert.throws(() => assertPublicationOrder(deploy.replace('npm exec --no -- wrangler deploy', '')), /publication command exists/)
assert.equal((deploy.match(/npm run build\n/g) ?? []).length, 1, 'validated production tree is not rebuilt before deploy')
assert.ok(deploy.indexOf('node tools/release-live.mjs build') > publish)
assert.ok(deploy.includes('SORTIT_EXPECTED_SOURCE: ${{ steps.source.outputs.sha }}'))

// Exercise the scheduling policy independently of queue order: every run reads
// the current tip, and a tip changed during validation cannot be published.
const old = '1'.repeat(40), latest = '2'.repeat(40)
for (const events of [[old, latest], [latest, old]]) {
  const published = []
  for (const _event of events) {
    const checkedOut = latest
    assertCurrentDeploy(checkedOut, latest)
    published.push(checkedOut)
  }
  assert.deepEqual(published, [latest, latest])
}
assert.throws(() => assertCurrentDeploy(old, latest), /outdated/)
assert.throws(() => assertCurrentDeploy(latest, latest, 'refs/heads/feature'), /only main/)
console.log('deployment contract: workflow wiring and stale/non-main scheduling policy verified (not a hosted Actions execution)')
