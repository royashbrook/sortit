// Proves the total-conversion contract and every movement geometry in Node.
// The browser owns pixels; this gate owns the data that makes those pixels
// possible: twelve unique pieces, a mystery piece, valid per-piece verbs,
// stable Classic fallback, and flights that start and finish where they say.
import { SKINS } from '../src/lib/engine/skins.js'
import { flightKeyframes, flightOptions, landingTimes } from '../src/lib/ui/flight.js'
import { readFileSync } from 'node:fs'

let failures = 0
const fail = msg => { failures += 1; console.error('FAIL ' + msg) }

const GEO = { dx: -120, dy: 80, peakRel: -140, rimRel: -60 }
const VERBS = new Set(['drop', 'screw', 'breakpop', 'mine', 'flip', 'roll', 'fly', 'hover', 'zig', 'squish', 'tumble'])
const MATERIALS = new Set(['metal', 'stone', 'neon', 'pop', 'cute', 'dice'])
const CONVERSIONS = ['bolts', 'mine', 'dash', 'kawaii', 'dice', 'tubes']
const CSS = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8')
const BOARD = readFileSync(new URL('../src/lib/ui/Board.svelte', import.meta.url), 'utf8')

const translateOf = transform => {
  const match = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(transform)
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null
}

const rotationOf = transform => {
  const match = /rotate\((-?[\d.]+)deg\)/.exec(transform)
  return match ? Number(match[1]) : 0
}

function verifyFlight(verb, motion, id) {
  const keyframes = flightKeyframes(verb, { ...GEO, spin: motion.spin })
  if (keyframes.length < 3) fail(`${id}: fewer than 3 keyframes`)

  const first = translateOf(keyframes[0].transform)
  if (!first || first.x !== GEO.dx || first.y !== GEO.dy) {
    fail(`${id}: flight does not start at the old spot (${keyframes[0].transform})`)
  }
  if (rotationOf(keyframes[0].transform) !== 0) fail(`${id}: starts pre-rotated`)

  const last = translateOf(keyframes.at(-1).transform)
  if (!last || last.x !== 0 || last.y !== 0) {
    fail(`${id}: flight does not end seated at the origin (${keyframes.at(-1).transform})`)
  }
  if (rotationOf(keyframes.at(-1).transform) % 360 !== 0) {
    fail(`${id}: lands tilted (${keyframes.at(-1).transform})`)
  }

  if (verb === 'breakpop' || verb === 'mine') {
    const hiddenAtDestination = keyframes.some(frame => {
      const point = translateOf(frame.transform)
      return frame.opacity === 0 && point?.x === 0 && point?.y === 0
    })
    if (!hiddenAtDestination) fail(`${id}: destroy/create swap is visible`)
  } else {
    const ys = keyframes.map(frame => translateOf(frame.transform)).filter(Boolean).map(point => point.y)
    if (Math.min(...ys) > GEO.peakRel + 1) {
      fail(`${id}: path never reaches the arc peak (min y ${Math.min(...ys)})`)
    }
  }

  if (verb === 'screw') {
    const backedOff = translateOf(keyframes[1].transform)
    const linedUp = translateOf(keyframes.at(-2).transform)
    if (!backedOff || backedOff.x !== GEO.dx || backedOff.y >= GEO.dy) {
      fail(`${id}: nut does not back straight off the source post`)
    }
    if (!linedUp || linedUp.x !== 0 || linedUp.y !== GEO.rimRel) {
      fail(`${id}: nut does not line up on the destination post before seating`)
    }
  }

  if (keyframes[0].offset !== 0) fail(`${id}: first offset is not 0`)
  if (keyframes.at(-1).offset !== 1) fail(`${id}: last offset is not 1`)
  let previous = -1
  for (const frame of keyframes) {
    if (frame.offset == null) fail(`${id}: keyframe missing offset`)
    else if (frame.offset <= previous) fail(`${id}: offsets descend at ${frame.offset}`)
    else previous = frame.offset
  }

  const times = landingTimes(motion, 4, verb)
  if (times.length !== 4) fail(`${id}: landingTimes count wrong`)
  for (let i = 1; i < times.length; i++) {
    if (times[i] <= times[i - 1]) fail(`${id}: landing times not ascending`)
  }
  if (times[0] <= 0 || times[0] > motion.seconds) {
    fail(`${id}: first landing outside the animation`)
  }
}

if (SKINS.map(skin => skin.key).join(',') !== CONVERSIONS.join(',')) {
  fail(`v1 conversion set/order drifted: ${SKINS.map(skin => skin.key).join(',')}`)
}

for (const skin of SKINS) {
  const id = `skin ${skin.key}`
  const motion = skin.motion ?? {}
  for (const field of ['seconds', 'lift', 'spin', 'stagger', 'land']) {
    if (motion[field] == null) fail(`${id}: motion.${field} missing`)
  }
  if (!VERBS.has(motion.land)) fail(`${id}: unknown default verb ${motion.land}`)
  if (!MATERIALS.has(skin.sound)) fail(`${id}: unknown sound material ${skin.sound}`)
  if (!skin.preview?.includes('<')) fail(`${id}: preview is empty`)
  if (skin.key !== 'tubes' && !CSS.includes(`[data-skin="${skin.key}"]`)) {
    fail(`${id}: no board furniture css`)
  }

  const verbs = new Set([motion.land])
  if (skin.key === 'tubes') {
    if (skin.pieces != null || skin.hidden != null) fail('Classic must keep using world art')
  } else {
    if (skin.pieces?.length !== 12) fail(`${id}: expected 12 pieces, got ${skin.pieces?.length ?? 0}`)
    if (!skin.hidden?.includes('<')) fail(`${id}: mystery piece is empty`)
    const keys = new Set()
    const svgs = new Set()
    for (const [index, piece] of (skin.pieces ?? []).entries()) {
      if (!piece.key || keys.has(piece.key)) fail(`${id}: piece ${index} has a missing/duplicate key`)
      keys.add(piece.key)
      if (!/^#[0-9a-f]{6}$/i.test(piece.color ?? '')) fail(`${id}: piece ${index} has invalid color`)
      if (!/<(?:path|rect|circle|ellipse|polygon|g)\b/.test(piece.svg ?? '')) fail(`${id}: piece ${index} has no vector art`)
      if (/<script\b|\son\w+=/i.test(piece.svg ?? '')) fail(`${id}: piece ${index} has active markup`)
      if (svgs.has(piece.svg)) fail(`${id}: piece ${index} duplicates another piece's art`)
      svgs.add(piece.svg)
      const verb = piece.verb ?? motion.land
      if (!VERBS.has(verb)) fail(`${id}: piece ${index} has unknown verb ${verb}`)
      verbs.add(verb)
    }
  }

  for (const verb of verbs) verifyFlight(verb, motion, `${id}/${verb}`)

  const options = flightOptions(motion, 2)
  if (options.duration !== motion.seconds * 1000) fail(`${id}: duration is wrong`)
  if (options.delay !== 2 * motion.stagger * 1000) fail(`${id}: convoy delay is wrong`)
  if (options.fill !== 'backwards') fail(`${id}: stagger does not hold the launch pose`)
  if (options.easing !== 'linear') fail(`${id}: effect easing would desync audio from keyframe offsets`)
}

const bolts = SKINS.find(skin => skin.key === 'bolts')
if (bolts?.pieceRatio !== .625 || bolts?.pieceViewBox !== '0 0 64 40' || bolts?.tubeLip !== 34) {
  fail('bolts: squat nut geometry contract drifted')
}
if ((bolts?.motion.seconds ?? 1) > .5) fail('bolts: single-nut move exceeds half a second')
for (const [index, piece] of (bolts?.pieces ?? []).entries()) {
  if (!piece.svg.includes('class="nut-shell"')) fail(`bolts: piece ${index} has no mounted shell`)
  if (piece.svg.includes('nut-bore') || /<ellipse\b/.test(piece.svg)) fail(`bolts: piece ${index} exposes a fake top hole`)
  const shell = /class="nut-shell" d="([^"]+)"/.exec(piece.svg)?.[1] ?? ''
  if (!shell.includes('L9 -5') || !shell.includes('L55 45')) fail(`bolts: piece ${index} no longer overlaps the nut below`)
}
if (!CSS.includes('#board[data-skin="bolts"] { gap: 2px; }')) fail('bolts: row gap is no longer compact')
if (!CSS.includes('* -62 / 64')) fail('bolts: the side band no longer completes a scaled mechanical turn')
if (!CSS.includes('z-index: var(--stack-depth, 1)')) fail('bolts: upper nuts no longer paint over lower nuts')
if (!BOARD.includes('style:--stack-depth={itemIndex + 1}')) fail('bolts: stack order no longer puts upper nuts in front')
const mine = SKINS.find(skin => skin.key === 'mine')
if ((mine?.motion.seconds ?? 2) >= 1) fail('mine: performance is no longer sub-one-second')

if (failures) {
  console.error(`${failures} conversion/flight problem(s)`)
  process.exit(1)
}
console.log(`flight ok: ${SKINS.length} conversions, ${VERBS.size} verbs, ${(SKINS.length - 1) * 12} custom pieces proven`)
