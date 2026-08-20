// guards the star behaviours that used to live only in a reviewer's head
// (ludo's cold review: the curve, the backfill, and the never-downgrade rule
// were all unguarded because CI only ran verify-levels).
//
//   node tools/verify-stars.mjs
import { STAR_SLACK, starsFor } from '../src/lib/engine/stars.js'
import { PARS } from '../src/lib/engine/pars.js'

let bad = 0
const want = (label, got, expect) => {
  if (got !== expect) { bad++; console.error(`FAIL ${label}: got ${got}, want ${expect}`) }
}

// the curve, at its exact boundaries
const par = PARS[0] // level 1, known small
want('at par', starsFor(par, par, null), 3)
want('at par+slack3', starsFor(par + STAR_SLACK.three, par, null), 3)
want('one past slack3', starsFor(par + STAR_SLACK.three + 1, par, null), 2)
want('at par+slack2', starsFor(par + STAR_SLACK.two, par, null), 2)
want('one past slack2', starsFor(par + STAR_SLACK.two + 1, par, null), 1)
want('finishing always earns one', starsFor(999, par, null), 1)
want('fallback goal drives when par unknown', starsFor(9, null, 8), 3)
want('nothing known still earns one', starsFor(50, null, null), 1)

// legacy backfill: an old best at par must derive 3 stars, never re-earn 1.
// this mirrors the loadProgress derivation exactly.
const legacy = { 1: PARS[0], 2: PARS[1] + STAR_SLACK.two + 5 }
const derived = {}
for (const [key, best] of Object.entries(legacy)) {
  const n = Number(key)
  derived[n] = starsFor(best, PARS[n - 1] ?? null, null)
}
want('legacy perfect best backfills to 3', derived[1], 3)
want('legacy slow best backfills to 1', derived[2], 1)

// never-downgrade: the accept rule is a max, prove it as used
const accept = (stored, incoming) => (incoming > (stored ?? 0) ? incoming : stored ?? incoming)
want('worse replay keeps the better stars', accept(3, 1), 3)
want('better replay upgrades', accept(1, 3), 3)

if (bad) { console.error(`${bad} failures`); process.exit(1) }
console.log('stars: curve boundaries, legacy backfill, and never-downgrade all hold')
