import assert from 'node:assert/strict'
import dice from '../src/lib/engine/skinart/dice.ts'

// saved item indices must still point at the same colour (refs #29).
assert.deepEqual(dice.pieces.map(piece => piece.color), [
  '#D6323C', '#F1E6CC', '#2F6FE0', '#2FA35C', '#8A4DD0', '#2B2B33',
  '#F4772E', '#E9EEF5', '#B0703A', '#1FA6A0', '#E8B72C', '#F06AA8',
])
assert.equal(new Set(dice.pieces.map(piece => piece.key)).size, 12)
const signatures = new Set()
const counts = [0, 0, 0, 0, 0, 0]
for (const piece of dice.pieces) {
  assert.doesNotMatch(piece.svg, /\bid=|url\(|NaN|Infinity|undefined|<script\b|\son\w+=/)
  const faces = [...piece.svg.matchAll(/<g transform="([^"]+)">(.*?)<\/g>/g)]
  assert.equal(faces.length, 3, `${piece.key}: three pip-covered faces`)
  const values = faces.map(([, , face]) => [...face.matchAll(/r="2\.65" fill="([^"]+)"/g)].length)
  assert.ok(values.every(value => value >= 1 && value <= 6))
  assert.equal(new Set(values).size, 3, `${piece.key}: adjacent faces repeat a value`)
  for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
    assert.notEqual(values[a] + values[b], 7, `${piece.key}: opposite faces touch`)
  }
  counts[values[2] - 1]++
  signatures.add(faces[2][2])
}
assert.deepEqual(counts, [2, 2, 2, 2, 2, 2])
assert.equal(signatures.size, 12, 'front faces must remain distinct without body colour')
assert.doesNotMatch(dice.hidden, /\bid=|url\(/)
console.log('dice art: saved colour order, 12 distinct pip faces, adjacent values, and repeat-safe SVG verified')
