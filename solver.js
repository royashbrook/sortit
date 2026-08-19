// the exact solver. it exists so no kid is ever handed an impossible board:
// every campaign level and every daily is proven solvable by this file before
// it is shown, and the HINT button replays it from the current position.
//
// runs identically in the browser and in node (tools/verify-levels.mjs), so
// what the build verified is exactly what the phone generates.

export function isComplete(tube, capacity) {
  if (tube.length !== capacity) return false
  for (let i = 1; i < tube.length; i++) if (tube[i] !== tube[0]) return false
  return true
}

export function isWin(tubes, capacity) {
  return tubes.every(t => t.length === 0 || isComplete(t, capacity))
}

export function topRun(tube) {
  const top = tube[tube.length - 1]
  let n = 1
  for (let i = tube.length - 2; i >= 0 && tube[i] === top; i--) n++
  return n
}

// canonical key: tube order is irrelevant to the puzzle, so sorting the tube
// strings collapses every permutation into one visited-set entry.
function keyOf(tubes) {
  return tubes.map(t => t.join(',')).sort().join('|')
}

// legal, non-pointless moves. pointless ones pruned here rather than scored low,
// because they only ever shuffle state without progress:
//   - out of a finished tube
//   - a uniform tube into an empty tube (same position, new name)
//   - into more than one empty tube (empties are interchangeable)
export function legalMoves(tubes, capacity) {
  const moves = []
  for (let from = 0; from < tubes.length; from++) {
    const src = tubes[from]
    if (src.length === 0 || isComplete(src, capacity)) continue
    const top = src[src.length - 1]
    const run = topRun(src)
    const uniform = run === src.length
    let emptySeen = false
    for (let to = 0; to < tubes.length; to++) {
      if (to === from) continue
      const dst = tubes[to]
      const space = capacity - dst.length
      if (space === 0) continue
      if (dst.length === 0) {
        if (uniform || emptySeen) continue
        emptySeen = true
        moves.push({ from, to, count: Math.min(run, space) })
      } else if (dst[dst.length - 1] === top) {
        moves.push({ from, to, count: Math.min(run, space) })
      }
    }
  }
  return moves
}

export function applyMove(tubes, move) {
  const next = tubes.map(t => t.slice())
  const moved = next[move.from].splice(next[move.from].length - move.count, move.count)
  next[move.to].push(...moved)
  return next
}

// move ordering is what keeps the DFS fast: finish a tube > grow a match >
// free a tube, and reach for an empty tube last.
function ordered(tubes, capacity) {
  const moves = legalMoves(tubes, capacity)
  for (const m of moves) {
    const src = tubes[m.from]
    const dst = tubes[m.to]
    let score = 0
    if (dst.length > 0) {
      score += 40
      const uniformDst = dst.every(v => v === dst[0])
      if (uniformDst && dst.length + m.count === capacity) score += 100
      if (uniformDst) score += 20
    }
    if (m.count === topRun(src)) score += 15       // whole run comes along
    if (m.count === src.length) score += 25        // source tube freed
    m.score = score
  }
  moves.sort((a, b) => b.score - a.score || a.from - b.from || a.to - b.to)
  return moves
}

// depth-first with a visited set and a node budget. not minimal-length, just a
// proof plus a usable line: good enough for verification and for hints.
// returns { solved, moves, nodes, aborted }: aborted=true means the budget ran
// out before an answer either way.
export function solve(tubes, capacity, { maxNodes = 200000, maxDepth = 300 } = {}) {
  const visited = new Set()
  const path = []
  let nodes = 0
  let aborted = false

  function search(state, depth) {
    if (isWin(state, capacity)) return true
    if (depth >= maxDepth) return false
    if (++nodes > maxNodes) { aborted = true; return false }
    const key = keyOf(state)
    if (visited.has(key)) return false
    visited.add(key)
    for (const move of ordered(state, capacity)) {
      path.push(move)
      if (search(applyMove(state, move), depth + 1)) return true
      path.pop()
      if (aborted) return false
    }
    return false
  }

  const solved = search(tubes, 0)
  return { solved, moves: solved ? path.slice() : null, nodes, aborted }
}
