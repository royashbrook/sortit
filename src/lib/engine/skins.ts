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
import bolts, { nutArt } from './skinart/bolts.ts'
import { NUT_PITCH, NUT_TOP } from './skinart/nut-geometry.ts'
import { boltArt } from './skinart/bolt-geometry.ts'
import mine from './skinart/mine.ts'
import dash from './skinart/dash.ts'
import kawaii from './skinart/kawaii.ts'
import dice from './skinart/dice.ts'
import glass from './skinart/glass.ts'
import { readSlotResult, writeSlot } from '../storage.ts'
import type { Skin } from './types.ts'

// a LOOKS card: two of the skin's own pieces stacked, so the card is the skin
const stack = (a: string, b: string): string =>
  `<g transform="translate(14 30) scale(.56)">${a}</g><g transform="translate(14 -2) scale(.56)">${b}</g>`

export const SKINS: Skin[] = [
  {
    key: 'glass',
    title: 'Glass Garden',
    pieces: glass.pieces,
    hidden: glass.hidden,
    motion: { seconds: .42, lift: 1, spin: 0, stagger: .06, land: 'drop' },
    sound: 'glass',
    preview: '<rect x="10" y="3" width="44" height="58" rx="14" fill="#CBE7E5" stroke="#7EACA8" stroke-width="2"/>' +
      stack(glass.pieces[0].svg, glass.pieces[7].svg),
  },
  {
    key: 'bolts',
    title: 'Nuts & Bolts',
    pieces: bolts.pieces,
    hidden: bolts.hidden,
    pieceRatio: NUT_PITCH / 64,
    // Include the rear crown and bottom stroke at every turn. CSS offsets this
    // viewport inside the unchanged stack slot without scaling the artwork.
    pieceViewBox: `0 -20 64 ${NUT_PITCH + 21}`,
    tubeLip: 64,
    // The nut's projected facets turn about the post. Planar rotation would
    // tumble it in screen space instead of screwing it along the shaft.
    motion: { seconds: .48, lift: .75, spin: 0, stagger: .06, land: 'screw' },
    sound: 'metal',
    preview:
      `<g class="hardware-preview" transform="translate(16 1) scale(.5)">` +
      boltArt(100, 'look-bolt', 100 - NUT_PITCH * 2 - 14) +
      `<g transform="translate(0 ${100 - NUT_PITCH - NUT_TOP})">${nutArt('red', 0, -1000, 'look-red')}</g>` +
      `<g transform="translate(0 ${100 - NUT_PITCH * 2 - NUT_TOP})">${nutArt('blue', 0, -1000, 'look-blue')}</g></g>`,
  },
  {
    key: 'mine',
    title: 'Block Mine',
    pieces: mine.pieces,
    hidden: mine.hidden,
    // one clear strike, one carrier trip, one set-down. quick enough that the
    // performance explains the move without making the player wait for it.
    motion: { seconds: .9, lift: 0, spin: 0, stagger: .06, land: 'mine' },
    sound: 'stone',
    preview: `<g transform="translate(16 32) scale(.5)">${mine.pieces[1].svg}</g><g transform="translate(16 2) scale(.5)">${mine.pieces[0].svg}</g>`,
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
export function loadSkin(rememberDefault = false): Skin {
  const previousDefault = SKINS.find(skin => skin.key === 'bolts')!
  const saved = readSlotResult(KEY)
  if (!saved.ok) return previousDefault
  const chosen = SKINS.find(skin => skin.key === saved.value)
  if (chosen) return chosen
  // Older installs did not persist the default until LOOKS was used. Their
  // board must not change material just because this release adds a default.
  const progress = readSlotResult('sortit:progress')
  const game = readSlotResult('sortit:game')
  if (!progress.ok || !game.ok) return previousDefault
  const returning = progress.value !== null || game.value !== null
  const resolved = returning ? previousDefault : SKINS.find(skin => skin.key === 'glass')!
  // The owning store pins this before its first save makes a new install look old.
  if (rememberDefault) saveSkin(resolved)
  return resolved
}

export function saveSkin(skin: Skin): boolean {
  return writeSlot(KEY, skin.key)
}
