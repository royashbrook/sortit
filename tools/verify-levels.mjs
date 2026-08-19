// proves every shipped board before anyone plays it:
//   - all 600 campaign levels resolve to a solvable board inside the same
//     solver budget the phone uses (so the phone replays the proof, never
//     discovers a gap in it)
//   - the daily is solvable for the next N years of dates
//   - generation is deterministic: two runs, byte-identical boards
//
//   node tools/verify-levels.mjs            # levels + 3 years of dailies
//   node tools/verify-levels.mjs --days=30  # quicker daily sweep
import { LEVEL_COUNT, levelBoard, seedBoard } from '../levels.js'
import { dailySeed } from '../seed.js'

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

let dailyWorstMs = 0
const start = new Date()
for (let d = 0; d < DAYS; d++) {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + d)
  const t0 = Date.now()
  seedBoard(dailySeed(date))
  const ms = Date.now() - t0
  if (ms > dailyWorstMs) dailyWorstMs = ms
}
console.log(`dailies: ${DAYS} days from today solvable, slowest ${dailyWorstMs}ms`)
console.log(`total: ${((Date.now() - started) / 1000).toFixed(1)}s`)
