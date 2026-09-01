// proves the flight geometry in node, the same way levels and stars are
// proven: every skin's landing verb must produce a path that starts at the
// old spot, actually rises over the arc peak, ends seated at the origin
// reading upright, and keeps its offsets ascending (the web animations api
// throws on a descending offset list at runtime, where no test would see it).
import { SKINS } from '../src/lib/engine/skins.js'
import { flightKeyframes, flightOptions, landingTimes } from '../src/lib/ui/flight.js'

let failures = 0
const fail = msg => { failures += 1; console.error('FAIL ' + msg) }

const GEO = { dx: -120, dy: 80, peakRel: -140, rimRel: -60 }
const VERBS = ['drop', 'screw', 'slide', 'bounce', 'zip', 'float']
const MATERIALS = ['glass', 'metal', 'wood', 'stone', 'neon', 'pop']

const translateOf = t => {
  const m = /translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/.exec(t)
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null
}
const rotationOf = t => {
  const m = /rotate\((-?[\d.]+)deg\)/.exec(t)
  return m ? Number(m[1]) : 0
}

for (const skin of SKINS) {
  const id = `skin ${skin.key}`
  const motion = skin.motion ?? {}
  for (const field of ['seconds', 'lift', 'spin', 'ease', 'stagger', 'land']) {
    if (motion[field] == null) fail(`${id}: motion.${field} missing`)
  }
  if (!VERBS.includes(motion.land)) fail(`${id}: unknown landing verb ${motion.land}`)
  if (!MATERIALS.includes(skin.sound)) fail(`${id}: unknown sound material ${skin.sound}`)

  const kf = flightKeyframes(motion.land, { ...GEO, spin: motion.spin })
  if (kf.length < 3) fail(`${id}: fewer than 3 keyframes`)

  const first = translateOf(kf[0].transform)
  if (!first || first.x !== GEO.dx || first.y !== GEO.dy) fail(`${id}: flight does not start at the old spot (${kf[0].transform})`)
  if (rotationOf(kf[0].transform) !== 0) fail(`${id}: flight starts pre-rotated`)

  const last = translateOf(kf[kf.length - 1].transform)
  if (!last || last.x !== 0 || last.y !== 0) fail(`${id}: flight does not end seated at the origin (${kf[kf.length - 1].transform})`)
  if (rotationOf(kf[kf.length - 1].transform) % 360 !== 0) fail(`${id}: lands tilted (${kf[kf.length - 1].transform})`)

  const ys = kf.map(k => translateOf(k.transform)).filter(Boolean).map(p => p.y)
  if (Math.min(...ys) > GEO.peakRel + 1) fail(`${id}: arc never reaches the peak (min y ${Math.min(...ys)}, peak ${GEO.peakRel})`)

  if (kf[0].offset !== 0) fail(`${id}: first offset is ${kf[0].offset}, not 0`)
  if (kf[kf.length - 1].offset !== 1) fail(`${id}: last offset is ${kf[kf.length - 1].offset}, not 1`)
  let prev = -1
  for (const k of kf) {
    if (k.offset == null) fail(`${id}: a keyframe is missing its offset`)
    else if (k.offset <= prev) fail(`${id}: offsets not ascending (${k.offset} after ${prev})`)
    else prev = k.offset
  }

  const opts = flightOptions(motion, 2)
  if (opts.duration !== motion.seconds * 1000) fail(`${id}: duration ${opts.duration} != ${motion.seconds * 1000}`)
  if (opts.delay !== 2 * motion.stagger * 1000) fail(`${id}: convoy delay ${opts.delay} wrong for index 2`)
  if (opts.fill !== 'backwards') fail(`${id}: fill must hold items at launch through their stagger delay`)

  const times = landingTimes(motion, 4)
  if (times.length !== 4) fail(`${id}: landingTimes count wrong`)
  for (let i = 1; i < times.length; i++) if (times[i] <= times[i - 1]) fail(`${id}: landing times not ascending`)
  if (times[0] <= 0 || times[0] > motion.seconds) fail(`${id}: first landing outside the flight (${times[0]}s of ${motion.seconds}s)`)
}

// the classic skin must still exist (a saved 'tubes' preference keeps working)
// and glass must be the default for a fresh player (SKINS[0] is the fallback)
if (SKINS[0]?.key !== 'glass') fail('glass is not the default skin')
if (!SKINS.some(s => s.key === 'tubes')) fail('the classic tubes skin is gone')

if (failures) { console.error(`${failures} flight problem(s)`); process.exit(1) }
console.log(`flight ok: ${SKINS.length} skins, ${VERBS.length} verbs proven`)
