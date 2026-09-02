// skins: total conversions of the board, orthogonal to the engine. a skin
// owns what the pieces ARE (its own twelve, or the theme's art for classic),
// what the containers look like, how a move travels, what it sounds like.
// the engine, the levels, and the scoring never know which skin is on.
//
// each skin:
//   pieces   twelve { key, color, svg, verb? } from skinart/, or absent for a
//            theme-driven skin (classic shows the world's art faces)
//   hidden   the mystery piece's svg (absent = the shared question mark)
//   motion   the flight the Board plays with the web animations api:
//     seconds  whole trip for one item
//     lift     arc peak above the higher tube mouth, in item-sides
//     spin     degrees turned over the trip (full turns land upright)
//     stagger  per-item delay when a run of items convoys over
//     land     default verb (a piece may override with its own `verb`):
//              drop | screw | breakpop | flip | roll | fly | hover | zig
//   sound    material palette in sounds.js: metal | stone | neon | pop
//   preview  inner svg for the LOOKS card, viewBox 0 0 64 64
import bolts from './skinart/bolts.js'
import mine from './skinart/mine.js'
import dash from './skinart/dash.js'
import kawaii from './skinart/kawaii.js'
import dice from './skinart/dice.js'

// a LOOKS card: two of the skin's own pieces stacked, so the card is the skin
const stack = (a, b) =>
  `<g transform="translate(14 30) scale(.56)">${a}</g><g transform="translate(14 -2) scale(.56)">${b}</g>`

export const SKINS = [
  {
    key: 'bolts',
    title: 'Nuts & Bolts',
    pieces: bolts.pieces,
    hidden: bolts.hidden,
    // spin 0: the nut turns about the bolt via its own side band (app.css
    // nutspin), a planar rotate would read as tumbling in three-quarter view
    motion: { seconds: .6, lift: 1.25, spin: 0, stagger: .09, land: 'screw' },
    sound: 'metal',
    preview:
      `<rect x="29" y="2" width="6" height="60" fill="#B9AFA6" stroke="#2A2220" stroke-width="2"/>` +
      stack(bolts.pieces[0].svg, bolts.pieces[1].svg),
  },
  {
    key: 'mine',
    title: 'Block Mine',
    pieces: mine.pieces,
    hidden: mine.hidden,
    // a mined move is long on purpose: pickaxe swings, the carrier's trip,
    // the set-down. stagger is small so a run is one trip, not a queue.
    motion: { seconds: 1.3, lift: 0, spin: 0, stagger: .08, land: 'mine' },
    sound: 'stone',
    preview: stack(mine.pieces[1].svg, mine.pieces[0].svg),
  },
  {
    key: 'dash',
    title: 'Neon Dash',
    pieces: dash.pieces,
    hidden: dash.hidden,
    motion: { seconds: .44, lift: 1, spin: 360, stagger: .06, land: 'flip' },
    sound: 'neon',
    preview:
      `<rect x="2" y="2" width="60" height="60" rx="6" fill="#141A2E"/>` +
      stack(dash.pieces[0].svg, dash.pieces[1].svg),
  },
  {
    key: 'kawaii',
    title: 'Kawaii Pop',
    pieces: kawaii.pieces,
    hidden: kawaii.hidden,
    motion: { seconds: .5, lift: 1.4, spin: 0, stagger: .08, land: 'squish' },
    sound: 'cute',
    preview:
      `<rect x="2" y="2" width="60" height="60" rx="14" fill="#FFE3EE"/>` +
      stack(kawaii.pieces[0].svg, kawaii.pieces[2].svg),
  },
  {
    key: 'dice',
    title: 'Dice Table',
    pieces: dice.pieces,
    hidden: dice.hidden,
    motion: { seconds: .52, lift: 1.2, spin: 720, stagger: .07, land: 'tumble' },
    sound: 'dice',
    preview:
      `<rect x="2" y="2" width="60" height="60" rx="10" fill="#1F6B45"/>` +
      stack(dice.pieces[5].svg, dice.pieces[0].svg),
  },
  {
    key: 'tubes',
    title: 'Classic',
    motion: { seconds: .3, lift: 1, spin: 0, stagger: .05, land: 'drop' },
    sound: 'pop',
    preview: '<rect x="22" y="10" width="20" height="46" rx="6" fill="#fff" stroke="#3D3230" stroke-width="3"/><circle cx="32" cy="47" r="6" fill="#E5484D"/><circle cx="32" cy="34" r="6" fill="#4FA3D1"/>',
  },
]

const KEY = 'sortit:skin'

// a saved key that no longer exists (a retired skin) falls back to the
// default, so an old preference never strands a player on a blank board
export function loadSkin() {
  try {
    const saved = localStorage.getItem(KEY)
    return SKINS.find(skin => skin.key === saved) ?? SKINS[0]
  } catch {
    return SKINS[0]
  }
}

export function saveSkin(skin) {
  try { localStorage.setItem(KEY, skin.key) } catch { /* a blocked store only costs the preference */ }
}
