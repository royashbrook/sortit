import assert from 'node:assert/strict'
import { nutGeometry } from '../src/lib/engine/skinart/nut-geometry.ts'
import { nutArt } from '../src/lib/engine/skinart/bolts.ts'
import { nutTurn } from '../src/lib/ui/nut-turn.ts'

// Test the object, not the old stripe renderer's spelling (refs #29).
for (let n = 0; n < 72; n++) {
  const angle = n * Math.PI / 36
  const { vertices, faces } = nutGeometry(angle)
  assert.equal(vertices.length, 6)
  assert.ok(faces.length >= 2 && faces.length <= 3)
  const xs = vertices.map(p => p.x)
  const visibleWidth = faces.reduce((sum, face) => sum + face.width, 0)
  assert.ok(Math.abs(visibleWidth - (Math.max(...xs) - Math.min(...xs))) < 1e-6, 'visible faces leave a gap')
  for (const p of vertices) {
    assert.ok(p.x >= 1.99 && p.x <= 62.01)
    assert.ok(p.y <= .001 && p.y >= -19.201)
  }
  for (const face of faces) assert.ok(Number.isFinite(face.slope))
  assert.doesNotMatch(nutArt('red', angle), /NaN|Infinity|undefined/)
}
assert.notDeepEqual(nutGeometry(0), nutGeometry(Math.PI / 6), 'rotation does not change the silhouette')
const rest = nutArt('red', 0, -100, 'one')
const free = nutArt('red', 0, null, 'two')
assert.notEqual(rest, free, 'shaft cannot pass in front of the back crown')
assert.match(rest, /fill-rule="evenodd"/)
assert.match(free, /nut-bore/)
assert.match(rest, /id="one-crown"/)
assert.match(free, /url\(#two-crown\)/)
assert.match(nutArt('hid'), /stroke-linecap="round"/)
assert.equal(nutTurn(0), 0)
assert.ok(Math.abs(nutTurn(.3) + 2 * Math.PI) < 1e-9)
assert.equal(nutTurn(.3), nutTurn(.7), 'nut spins during lateral carry')
assert.ok(Math.abs(nutTurn(1)) < 1e-9, 'nut finishes rotated')
assert.ok(nutTurn(.1) < 0 && nutTurn(.9) > nutTurn(.8), 'screwing on is not the reverse of unscrewing')
console.log('nut geometry: 72 projections, occlusion, unique clips, and mechanical phases verified')
