// the campaign: 600 levels dealt from their level number, plus the daily.
//
// EVERY constant in this file is load-bearing for determinism. level 217 must
// be the same board on every phone forever, because kids share them ("i'm on
// 217!") and the daily is the same board worldwide. change a constant after
// release and you have silently replaced everyone's game. add levels, add
// themes at the END of rotation, but do not touch the mixing maths.
import { rng, shuffle } from './seed.js'
import { solve, isComplete } from './solver.js'

export const LEVEL_COUNT = 600
export const WORLD_SIZE = 20
export const WORLD_COUNT = LEVEL_COUNT / WORLD_SIZE

// budget the phone spends proving a board before showing it. verify-levels.mjs
// asserts every campaign level resolves inside this same budget, so the phone
// never actually hits the retry tail the verifier didn't see.
const SOLVE_BUDGET = { maxNodes: 120000 }
const MAX_SALT = 64

// difficulty curve. hand-tuned opening so the first session teaches itself,
// then one more colour every 30 levels until the full 12, then variety comes
// from capacity-5 tubes, hidden ("mystery") boards, and the colour rotation.
export function paramsFor(n) {
  if (n <= 2) return { colors: 2, capacity: 3, empties: 2, hidden: false }
  if (n <= 4) return { colors: 3, capacity: 3, empties: 2, hidden: false }
  if (n <= 6) return { colors: 3, capacity: 4, empties: 2, hidden: false }
  if (n <= 10) return { colors: 4, capacity: 4, empties: 2, hidden: false }
  if (n <= 20) return { colors: 5, capacity: 4, empties: 2, hidden: false }
  const step = Math.floor((n - 21) / 30)
  let colors = Math.min(12, 6 + step)
  if (colors === 12) colors = 10 + (n % 3) // 10/11/12 rotation keeps late game varied
  const capacity = n >= 120 && n % 7 === 0 ? 5 : 4
  const hidden = n >= 61 && n % 4 === 0
  return { colors, capacity, empties: 2, hidden }
}

// stable integer mixing for (level, salt) -> seed. frozen forever, see header.
function levelSeed(n, salt) {
  return (Math.imul(n, 2654435761) ^ Math.imul(salt + 1, 40503) ^ 0x9e3779b9) >>> 0
}

// deal the full multiset of items into the filled tubes, then append empties.
export function deal(params, seed) {
  const random = rng(seed)
  const items = []
  for (let c = 0; c < params.colors; c++) {
    for (let k = 0; k < params.capacity; k++) items.push(c)
  }
  const mixed = shuffle(random, items)
  const tubes = []
  for (let t = 0; t < params.colors; t++) {
    tubes.push(mixed.slice(t * params.capacity, (t + 1) * params.capacity))
  }
  for (let e = 0; e < params.empties; e++) tubes.push([])
  return tubes
}

function acceptable(tubes, params) {
  // a tube that starts already finished is a freebie that reads as a bug
  return !tubes.some(t => t.length > 0 && isComplete(t, params.capacity))
}

// walk salts until the solver signs off. deterministic: every device walks the
// same salts with the same budget and stops at the same board.
function findBoard(params, seedFor) {
  for (let salt = 0; salt < MAX_SALT; salt++) {
    const tubes = deal(params, seedFor(salt))
    if (!acceptable(tubes, params)) continue
    const result = solve(tubes, params.capacity, SOLVE_BUDGET)
    if (result.solved) return { tubes, salt, solution: result.moves }
  }
  // verify-levels.mjs proves this is unreachable for every shipped level and
  // for every daily for years ahead; the throw is here for honesty, not use.
  throw new Error('no solvable board found')
}

export function levelBoard(n) {
  const params = paramsFor(n)
  const found = findBoard(params, salt => levelSeed(n, salt))
  return { kind: 'level', n, params, ...found }
}

// the daily: mid-range difficulty, seeded by the date (see seed.js dailySeed).
// also serves any shared ?seed= board, so a friend's daily replays exactly.
export function seedBoard(seed) {
  const random = rng(seed)
  const params = {
    colors: 6 + Math.floor(random() * 4), // 6..9
    capacity: 4,
    empties: 2,
    hidden: false,
  }
  const found = findBoard(params, salt => (Math.imul(seed, 2246822519) ^ Math.imul(salt + 1, 3266489917)) >>> 0)
  return { kind: 'seed', seed, params, ...found }
}
