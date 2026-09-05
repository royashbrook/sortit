// The mine pieces stay apart on a dense board: form as well as colour.
//
// at level 175 a block is about 41px, so a 5-unit pixel is 3px. the browser
// owns the pixels; this gate owns the drawing data that makes them readable:
// every block has a top face colour of its own, and every ore carries one
// seam big enough to be a silhouette at that size, not a scatter of specks.
import mine from '../src/lib/engine/skinart/mine.js'

let failures = 0
const fail = msg => { failures += 1; console.error('FAIL ' + msg) }

// 8x8 cells of 5 units on the front face; a seam must be at least this many
// connected cells of the ore colour (a 3x4 block, about 9x12px on a dense board)
const MIN_SEAM = 12

const topFaceOf = svg => /matrix\(1 0 1 -1 12 20\)"><rect x="0" y="0" width="40" height="12" fill="(#[0-9A-Fa-f]{6})"/.exec(svg)?.[1]

function frontCells(svg, color) {
  const front = /<g transform="translate\(12 20\)">([\s\S]*?)<\/g>/.exec(svg)?.[1] ?? ''
  const cells = new Set()
  for (const m of front.matchAll(/<rect x="(\d+)" y="(\d+)" width="5" height="5" fill="([^"]+)"\/>/g)) {
    if (m[3].toLowerCase() === color.toLowerCase()) cells.add(`${m[1] / 5},${m[2] / 5}`)
  }
  return cells
}

// the largest 4-connected run of cells
function largestSeam(cells) {
  const seen = new Set()
  let best = 0
  for (const start of cells) {
    if (seen.has(start)) continue
    const stack = [start]
    seen.add(start)
    let size = 0
    while (stack.length) {
      const [x, y] = stack.pop().split(',').map(Number)
      size += 1
      for (const next of [`${x + 1},${y}`, `${x - 1},${y}`, `${x},${y + 1}`, `${x},${y - 1}`]) {
        if (cells.has(next) && !seen.has(next)) { seen.add(next); stack.push(next) }
      }
    }
    best = Math.max(best, size)
  }
  return best
}

const tops = new Map()
for (const piece of mine.pieces) {
  const top = topFaceOf(piece.svg)
  if (!top) { fail(`${piece.key}: no top face found`); continue }
  const owner = tops.get(top.toLowerCase())
  if (owner) fail(`${piece.key} and ${owner} share the top face colour ${top}`)
  tops.set(top.toLowerCase(), piece.key)

  if (!piece.key.endsWith(' ore')) continue
  const seam = largestSeam(frontCells(piece.svg, piece.color))
  if (seam < MIN_SEAM) fail(`${piece.key}: largest seam is ${seam} cells, want ${MIN_SEAM} or more`)
}

if (topFaceOf(mine.hidden) && tops.has(topFaceOf(mine.hidden).toLowerCase())) fail('the mystery block shares a top face colour with a piece')

if (failures) process.exit(1)
console.log(`mine cues ok: ${mine.pieces.length} distinct top faces, every ore seam ${MIN_SEAM}+ cells`)
