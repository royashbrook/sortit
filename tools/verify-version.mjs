import assert from 'node:assert/strict'
import { formatVersion } from './app-version.mjs'

assert.equal(formatVersion('v1.1', '0'), '1.1.0')
assert.equal(formatVersion('v1.1.1', '0'), '1.1.1')
assert.equal(formatVersion('v1.1', '2'), '1.1.2')
assert.equal(formatVersion('v0.1.17', '1'), '0.1.18')
assert.throws(() => formatVersion('v1.2.3.4', '0'))
assert.throws(() => formatVersion('not-a-version', '0'))
assert.throws(() => formatVersion('v1.1', '-1'))

// kit's own version (version.json, the sw cache name) comes from the same rule
// as the player-facing stamp: a four-part name here is the regression
const { default: config } = await import('../svelte.config.js')
assert.match(config.kit.version.name, /^(\d+\.\d+\.\d+|0\.0\.0-dev)$/, `kit.version.name is ${config.kit.version.name}`)

console.log('release versions: three-part tags, commit distance, and kit.version.name verified')
