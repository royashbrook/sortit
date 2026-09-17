import { writeFileSync } from 'node:fs'
import { deriveRelease } from './app-version.mjs'
import { artifactManifest, verifyArtifact } from './release-artifact.mjs'

const args = process.argv.slice(2)
if (args.some(arg => arg !== '--development')) throw new Error('usage: node tools/release-build.mjs [--development]')
process.env.SORTIT_BUILD_MODE = args.includes('--development') ? 'development' : 'release'
const identity = deriveRelease(process.cwd(), process.env.SORTIT_BUILD_MODE)
process.env.SORTIT_RELEASE_IDENTITY = JSON.stringify(identity)
const { build } = await import('vite')
await build()
if (deriveRelease(process.cwd(), process.env.SORTIT_BUILD_MODE).fingerprint !== identity.fingerprint) {
  throw new Error('build inputs changed during compilation; rebuild from a stable snapshot')
}
writeFileSync('build/artifact.json', JSON.stringify(artifactManifest('build', identity), null, 2) + '\n')
verifyArtifact('build', { allowDevelopment: identity.development })
console.log(`verified ${identity.version} / ${identity.fingerprint} / ${identity.source}${identity.dirty ? ' (dirty development build)' : ''}`)
