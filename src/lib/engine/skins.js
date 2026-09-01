// skins: how the board LOOKS and how a move MOVES, orthogonal to themes.
// a theme picks the twelve faces (art/); a skin picks the container those
// faces live in, the flight that carries them between containers, and the
// material they sound like when they land.
//
// each skin styles the board via [data-skin] rules in app.css. motion is a
// three-beat flight the Board choreographs with the web animations api:
// lift out of the source, arc across, then the skin's own landing verb.
//
//   seconds  whole flight for one item
//   lift     arc peak above the higher tube mouth, in item-sides
//   spin     degrees turned over the flight (multiples of 360 land upright;
//            the screw lands at -720 so the hex flats visibly wind down)
//   ease     easing for the landing beat
//   stagger  per-item delay when a run of items convoys over
//   land     landing verb: also picks the particle burst and sound family
//            'drop' | 'screw' | 'slide' | 'bounce' | 'zip' | 'float'
//   sound    material palette in sounds.js: 'glass' | 'metal' | 'wood' |
//            'stone' | 'neon' | 'pop'
export const SKINS = [
  {
    key: 'glass',
    title: 'Glass',
    motion: { seconds: .38, lift: 1.1, spin: 0, ease: 'cubic-bezier(.3,1.25,.5,1)', stagger: .055, land: 'drop' },
    sound: 'glass',
    preview: '<defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".35" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#cfe3ef" stop-opacity=".5"/></linearGradient></defs><rect x="20" y="8" width="24" height="48" rx="10" fill="url(#pg)" stroke="#3D3230" stroke-width="3"/><rect x="24" y="12" width="5" height="38" rx="2.5" fill="#fff" opacity=".8"/><circle cx="32" cy="46" r="7" fill="#E5484D"/><circle cx="32" cy="31" r="7" fill="#4FA3D1"/>',
  },
  {
    key: 'bolts',
    title: 'Nuts & Bolts',
    motion: { seconds: .52, lift: 1.25, spin: -720, ease: 'cubic-bezier(.45,.05,.55,.95)', stagger: .07, land: 'screw' },
    sound: 'metal',
    preview: '<defs><linearGradient id="pb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#EFEAE3"/><stop offset=".5" stop-color="#B9AFA6"/><stop offset="1" stop-color="#8F857C"/></linearGradient></defs><rect x="29" y="8" width="6" height="48" fill="url(#pb)" stroke="#3D3230" stroke-width="2.4"/><path d="M22 44 L27 40 L37 40 L42 44 L42 52 L37 56 L27 56 L22 52 Z" fill="url(#pb)" stroke="#3D3230" stroke-width="2.6"/><path d="M22 26 L27 22 L37 22 L42 26 L42 34 L37 38 L27 38 L22 34 Z" fill="url(#pb)" stroke="#3D3230" stroke-width="2.6"/>',
  },
  {
    key: 'beads',
    title: 'Beads & Sticks',
    motion: { seconds: .34, lift: 1.15, spin: 0, ease: 'cubic-bezier(.25,1.35,.45,1)', stagger: .05, land: 'slide' },
    sound: 'wood',
    preview: '<rect x="30" y="6" width="4" height="50" rx="2" fill="#A98F71" stroke="#3D3230" stroke-width="2"/><circle cx="32" cy="47" r="8" fill="#79B84C" stroke="#3D3230" stroke-width="2.6"/><circle cx="32" cy="30" r="8" fill="#F0C33C" stroke="#3D3230" stroke-width="2.6"/>',
  },
  {
    key: 'blocks',
    title: 'Block Stacks',
    motion: { seconds: .36, lift: 1.3, spin: 360, ease: 'cubic-bezier(.34,1.45,.6,1)', stagger: .06, land: 'bounce' },
    sound: 'wood',
    preview: '<rect x="20" y="38" width="24" height="18" fill="#79B84C" stroke="#3D3230" stroke-width="3"/><rect x="20" y="18" width="24" height="18" fill="#B98A5A" stroke="#3D3230" stroke-width="3"/>',
  },
  // the three below are aesthetic tributes, deliberately NOT the trademarks:
  // the look is the homage, the name stays ours.
  {
    key: 'voxel',
    title: 'Voxel Mine',
    motion: { seconds: .34, lift: 1.2, spin: 0, ease: 'cubic-bezier(.5,0,.8,.6)', stagger: .06, land: 'bounce' },
    sound: 'stone',
    preview: '<g transform="translate(4 2)"><path d="M18 40 L18 58 L42 58 L42 40 Z" fill="#8A6142" stroke="#3D3230" stroke-width="3"/><path d="M18 40 L26 33 L50 33 L42 40 Z" fill="#6FA644" stroke="#3D3230" stroke-width="3"/><path d="M42 40 L50 33 L50 51 L42 58 Z" fill="#5C3F2B" stroke="#3D3230" stroke-width="3"/><path d="M18 16 L18 34 L42 34 L42 16 Z" fill="#8A6142" stroke="#3D3230" stroke-width="3" transform="translate(0 -12)"/><path d="M18 16 L26 9 L50 9 L42 16 Z" fill="#6FA644" stroke="#3D3230" stroke-width="3" transform="translate(0 -12)"/><path d="M42 16 L50 9 L50 27 L42 34 Z" fill="#5C3F2B" stroke="#3D3230" stroke-width="3" transform="translate(0 -12)"/></g>',
  },
  {
    key: 'dash',
    title: 'Neon Dash',
    motion: { seconds: .26, lift: .9, spin: -360, ease: 'cubic-bezier(.5,0,.2,1)', stagger: .04, land: 'zip' },
    sound: 'neon',
    preview: '<rect x="6" y="6" width="52" height="52" rx="6" fill="#141A2E"/><rect x="20" y="34" width="20" height="20" rx="3" fill="#1B2340" stroke="#3EF0D0" stroke-width="3"/><rect x="20" y="11" width="20" height="20" rx="3" fill="#1B2340" stroke="#FF4FD8" stroke-width="3"/>',
  },
  {
    key: 'kawaii',
    title: 'Kawaii Pop',
    motion: { seconds: .42, lift: 1.35, spin: 24, ease: 'cubic-bezier(.3,1.75,.5,1)', stagger: .07, land: 'float' },
    sound: 'pop',
    preview: '<rect x="18" y="8" width="28" height="48" rx="14" fill="#FFE3EE" stroke="#3D3230" stroke-width="3"/><circle cx="32" cy="44" r="9" fill="#FFB7D2" stroke="#3D3230" stroke-width="2.6"/><circle cx="32" cy="23" r="9" fill="#BFE8FF" stroke="#3D3230" stroke-width="2.6"/>',
  },
  {
    key: 'tubes',
    title: 'Classic',
    motion: { seconds: .22, lift: .9, spin: 0, ease: 'cubic-bezier(.3,1.2,.5,1)', stagger: .04, land: 'drop' },
    sound: 'pop',
    preview: '<rect x="22" y="10" width="20" height="46" rx="6" fill="#fff" stroke="#3D3230" stroke-width="3"/><circle cx="32" cy="47" r="6" fill="#E5484D"/><circle cx="32" cy="34" r="6" fill="#4FA3D1"/>',
  },
]

const KEY = 'sortit:skin'

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
