// stars: how well a solve went, judged against the EXACT best possible.
//
// par comes from real maths, never vibes: campaign levels read the shipped
// table (tools/make-pars.mjs), dailies and shared seeds compute theirs at
// board-open with the exact solver. the curve is deliberately kind at the
// bottom (finishing always earns a star, this is the cosy one) and honest at
// the top (three stars means you were within a whisker of perfect).
import { PARS } from './pars.js'
import { optimal } from './solver.js'

export const STAR_SLACK = { three: 2, two: 6 }

export function parFor(board) {
  if (board.kind === 'level') return PARS[board.n - 1] ?? null
  const result = optimal(board.tubes, board.params.capacity)
  return result.aborted ? null : result.length
}

// stars against par; when par is unknowable (a pathological shared seed), the
// proof solution's length stands in as the goal and the caller must not print
// "best possible" next to it, because it is not.
export function starsFor(moves, par, fallbackGoal) {
  const goal = par ?? fallbackGoal
  if (goal == null) return 1
  if (moves <= goal + STAR_SLACK.three) return 3
  if (moves <= goal + STAR_SLACK.two) return 2
  return 1
}

export function starRow(stars) {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
}
