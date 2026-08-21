// proves every shipped board before anyone plays it:
//   - all 600 campaign levels resolve to a solvable board inside the same
//     solver budget the phone uses (so the phone replays the proof, never
//     discovers a gap in it)
//   - the daily is solvable for the next N years of dates
//   - generation is deterministic: two runs, byte-identical boards
//
//   node tools/verify-levels.mjs            # levels + 3 years of dailies
//   node tools/verify-levels.mjs --days=30  # quicker daily sweep
//   - the par table matches the exact solver (spot-proof), and every daily's
//     par computes inside the phone budget, so stars are never a guess
import { LEVEL_COUNT, levelBoard, seedBoard } from '../src/lib/engine/levels.js'
import { dailySeed } from '../src/lib/engine/seed.js'
import { optimal } from '../src/lib/engine/solver.js'
import { PARS } from '../src/lib/engine/pars.js'
import { rng } from '../src/lib/engine/seed.js'

const daysArg = process.argv.find(a => a.startsWith('--days='))
const DAYS = daysArg ? Number(daysArg.split('=')[1]) : 3 * 365

let maxSalt = 0
let maxMoves = 0
let worst = null
const started = Date.now()

const boards = []
for (let n = 1; n <= LEVEL_COUNT; n++) {
  const t0 = Date.now()
  const board = levelBoard(n)
  const ms = Date.now() - t0
  boards.push(JSON.stringify(board.tubes))
  if (board.salt > maxSalt) maxSalt = board.salt
  if (board.solution.length > maxMoves) maxMoves = board.solution.length
  if (!worst || ms > worst.ms) worst = { n, ms }
}
console.log(`levels: ${LEVEL_COUNT}/${LEVEL_COUNT} solvable`)
console.log(`  max salt walked: ${maxSalt}, longest solution: ${maxMoves} moves`)
console.log(`  slowest generate: level ${worst.n} at ${worst.ms}ms`)

// determinism: a second full pass must reproduce every board exactly
for (let n = 1; n <= LEVEL_COUNT; n++) {
  if (JSON.stringify(levelBoard(n).tubes) !== boards[n - 1]) {
    console.error(`NONDETERMINISTIC at level ${n}`)
    process.exit(1)
  }
}
console.log('  determinism: second pass identical')

// the par table: right shape, and EVERY entry re-proved against the exact
// solver (ludo's cold review: a fixed sample lets the other 560 drift forever;
// the full regeneration costs ~95s and exact-table provenance is the promise)
if (PARS.length !== LEVEL_COUNT) { console.error(`pars.js has ${PARS.length} entries, want ${LEVEL_COUNT}`); process.exit(1) }
for (let n = 1; n <= LEVEL_COUNT; n++) {
  const board = levelBoard(n)
  if (PARS[n - 1] > board.solution.length) { console.error(`level ${n}: par ${PARS[n - 1]} beats the proof solution ${board.solution.length}`); process.exit(1) }
  const exact = optimal(board.tubes, board.params.capacity, { maxNodes: 60_000_000 })
  if (exact.aborted || exact.length !== PARS[n - 1]) {
    console.error(`level ${n}: table says par ${PARS[n - 1]}, solver says ${exact.length} (aborted ${exact.aborted})`)
    process.exit(1)
  }
}
console.log(`pars: all ${LEVEL_COUNT} table entries match the exact solver`)

let dailyWorstMs = 0
let dailyParWorstMs = 0
const start = new Date()
for (let d = 0; d < DAYS; d++) {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d)
  const t0 = Date.now()
  const daily = seedBoard(dailySeed(date))
  const ms = Date.now() - t0
  if (ms > dailyWorstMs) dailyWorstMs = ms
  const p0 = Date.now()
  const par = optimal(daily.tubes, daily.params.capacity) // the PHONE budget
  const pms = Date.now() - p0
  if (pms > dailyParWorstMs) dailyParWorstMs = pms
  if (par.aborted) { console.error(`daily ${date.toISOString().slice(0, 10)}: par aborts at phone budget`); process.exit(1) }
}
console.log(`dailies: ${DAYS} days from today solvable, slowest ${dailyWorstMs}ms, slowest par ${dailyParWorstMs}ms`)
console.log(`total: ${((Date.now() - started) / 1000).toFixed(1)}s`)
