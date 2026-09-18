import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { deriveRelease, formatVersion, inputFingerprint } from './app-version.mjs'

assert.equal(formatVersion('v1.2', '0'), '1.2.0')
assert.equal(formatVersion('v1.2', '7'), '1.2.7')
for (const tag of ['v1.2.3', 'v01.2', 'v1.02', '1.2', 'v1', 'not-a-version']) assert.throws(() => formatVersion(tag, '0'))
for (const distance of ['-1', '1extra', '01', '1.2', '9007199254740992']) assert.throws(() => formatVersion('v1.2', distance))

const root = mkdtempSync(join(tmpdir(), 'sortit-release-fixtures-'))
const repo = join(root, 'source')
mkdirSync(repo)
const git = (...args) => execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
  cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}).trim()
try {
  git('init', '-b', 'main')
  git('config', 'user.name', 'Release fixture')
  git('config', 'user.email', 'release-fixture@example.invalid')
  mkdirSync(join(repo, 'src'))
  writeFileSync(join(repo, 'src/main.ts'), 'export const value = 1\n')
  git('add', '.')
  git('commit', '-m', 'fixture root')
  assert.throws(() => deriveRelease(repo, 'release'), /anchor/)
  assert.match(deriveRelease(repo, 'development').version, /-dev$/)
  git('tag', 'v1.1.21') // legacy history remains untouched, never a milestone
  git('tag', 'v01.2')
  assert.throws(() => deriveRelease(repo, 'release'), /anchor/)
  git('tag', '-a', 'v1.2', '-m', 'milestone')
  assert.equal(deriveRelease(repo, 'release').version, '1.2.0')
  git('commit', '--allow-empty', '-m', 'one later commit')
  assert.equal(deriveRelease(repo, 'release').version, '1.2.1')
  git('checkout', '-b', 'feature')
  git('commit', '--allow-empty', '-m', 'side branch one')
  git('tag', 'v8.9') // nearer but misleading side-branch milestone
  git('commit', '--allow-empty', '-m', 'side branch two')
  git('checkout', 'main')
  git('commit', '--allow-empty', '-m', 'mainline two')
  git('merge', '--no-ff', 'feature', '-m', 'merge feature')
  const merged = deriveRelease(repo, 'release')
  assert.equal(merged.anchor, 'v1.2')
  assert.equal(merged.version, '1.2.5', 'all merged commits and merge commit count')
  assert.equal(deriveRelease(repo, 'release').fingerprint, merged.fingerprint, 'same source and toolchain rebuild deterministically')
  assert.notEqual(deriveRelease(repo, 'development').fingerprint, merged.fingerprint, 'development cannot masquerade as release')
  const before = inputFingerprint(repo, {})
  writeFileSync(join(repo, 'src/main.ts'), 'export const value = 2\n')
  assert.throws(() => deriveRelease(repo, 'release'), /clean/)
  assert.equal(deriveRelease(repo, 'development').dirty, true)
  assert.notEqual(inputFingerprint(repo, {}), before, 'changed bundles have changed input fingerprints')
  writeFileSync(join(repo, 'src/main.ts'), 'export const value = 1\n')
  git('tag', 'v1.3')
  assert.equal(deriveRelease(repo, 'release').version, '1.3.0')
  const shallow = join(root, 'shallow')
  git('clone', '--depth', '1', pathToFileURL(repo).href, shallow)
  assert.throws(() => deriveRelease(shallow, 'release'), /shallow/)
  assert.match(deriveRelease(shallow, 'development').version, /-dev$/)
} finally { rmSync(root, { recursive: true, force: true }) }

console.log('release policy: exact/later/merged/side-branch/next-minor/legacy/invalid/missing/dirty/shallow fixtures and deterministic fingerprints passed')
