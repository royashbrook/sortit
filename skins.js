// skins: how the board LOOKS and how a move MOVES, orthogonal to themes.
// a theme picks the twelve faces (art/); a skin picks the container those
// faces live in and the motion verb that carries them between containers.
//
// each skin styles the board via [data-skin] rules in app.css, and animates
// via the same FLIP mechanism game.js always had: the only thing a motion
// verb changes is the transform an item STARTS from and the easing that
// brings it home. pour slides, flip somersaults and snaps, screw spins in
// and settles like a nut on a thread.
export const SKINS = [
  {
    key: 'tubes',
    title: 'Tubes',
    motion: { rotate: 0, ease: 'cubic-bezier(.3,1.2,.5,1)', seconds: .22 },
    preview: '<rect x="22" y="10" width="20" height="46" rx="6" fill="#fff" stroke="#3D3230" stroke-width="3"/><circle cx="32" cy="47" r="6" fill="#E5484D"/><circle cx="32" cy="34" r="6" fill="#4FA3D1"/>',
  },
  {
    key: 'bolts',
    title: 'Nuts & Bolts',
    motion: { rotate: -720, ease: 'cubic-bezier(.2,.9,.35,1.05)', seconds: .34 },
    preview: '<rect x="29" y="8" width="6" height="48" fill="#B9AFA6" stroke="#3D3230" stroke-width="2.4"/><path d="M22 44 L27 40 L37 40 L42 44 L42 52 L37 56 L27 56 L22 52 Z" fill="#D8CFC6" stroke="#3D3230" stroke-width="2.6"/><path d="M22 26 L27 22 L37 22 L42 26 L42 34 L37 38 L27 38 L22 34 Z" fill="#D8CFC6" stroke="#3D3230" stroke-width="2.6"/>',
  },
  {
    key: 'beads',
    title: 'Beads & Sticks',
    motion: { rotate: 0, ease: 'cubic-bezier(.25,1.35,.45,1)', seconds: .26 },
    preview: '<rect x="30" y="6" width="4" height="50" rx="2" fill="#A98F71" stroke="#3D3230" stroke-width="2"/><circle cx="32" cy="47" r="8" fill="#79B84C" stroke="#3D3230" stroke-width="2.6"/><circle cx="32" cy="30" r="8" fill="#F0C33C" stroke="#3D3230" stroke-width="2.6"/>',
  },
  {
    key: 'blocks',
    title: 'Block Stacks',
    motion: { rotate: 180, ease: 'cubic-bezier(.34,1.45,.6,1)', seconds: .3 },
    preview: '<rect x="20" y="38" width="24" height="18" fill="#79B84C" stroke="#3D3230" stroke-width="3"/><rect x="20" y="18" width="24" height="18" fill="#B98A5A" stroke="#3D3230" stroke-width="3"/>',
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
