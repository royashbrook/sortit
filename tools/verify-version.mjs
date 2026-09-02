import assert from 'node:assert/strict'
import { formatVersion } from './app-version.mjs'

assert.equal(formatVersion('v1.1', '0'), '1.1.0')
assert.equal(formatVersion('v1.1.1', '0'), '1.1.1')
assert.equal(formatVersion('v1.1', '2'), '1.1.2')
assert.equal(formatVersion('v0.1.17', '1'), '0.1.18')
assert.throws(() => formatVersion('v1.2.3.4', '0'))
assert.throws(() => formatVersion('not-a-version', '0'))
assert.throws(() => formatVersion('v1.1', '-1'))

console.log('release versions: three-part tags and commit distance verified')
