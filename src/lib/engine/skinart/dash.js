// dash pieces: twelve player icons from a geometric rhythm-runner, bold black
// outline, two flat neon colours, a face that is all attitude. the forms
// differ (cube, ball, ship, ufo, wave) so silhouettes sort as well as colours
// do, and each form carries its own move verb (a cube flips, a ball rolls, a
// ship flies, a ufo hovers, a wave zigs). an aesthetic tribute: the look is
// the homage, every design here is ours. viewBox 0 0 64 64.
//
// exports { pieces: [12 x { key, color, svg, verb }], hidden: svg }

const INK = '#0B0B14'
const SW = 3.6

function cube(key, a, b, design) {
  const eyes = {
    // each design: a different face and inner geometry so two cubes never twin
    classic: `<rect x="20" y="22" width="9" height="12" fill="${INK}"/><rect x="35" y="22" width="9" height="12" fill="${INK}"/><rect x="22" y="24" width="4" height="5" fill="#fff"/><rect x="37" y="24" width="4" height="5" fill="#fff"/><rect x="24" y="40" width="16" height="4" fill="${INK}"/>`,
    smirk: `<rect x="18" y="20" width="12" height="9" fill="${b}" stroke="${INK}" stroke-width="2.6"/><rect x="34" y="20" width="12" height="9" fill="${b}" stroke="${INK}" stroke-width="2.6"/><rect x="21" y="23" width="5" height="4" fill="${INK}"/><rect x="37" y="23" width="5" height="4" fill="${INK}"/><path d="M22 41 L34 41 L42 36" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
    angry: `<path d="M17 18 L30 24 L30 32 L17 32 Z" fill="${INK}"/><path d="M47 18 L34 24 L34 32 L47 32 Z" fill="${INK}"/><rect x="24" y="26" width="4" height="4" fill="#fff"/><rect x="36" y="26" width="4" height="4" fill="#fff"/><rect x="20" y="40" width="24" height="5" fill="${INK}"/><rect x="24" y="40" width="4" height="5" fill="#fff"/><rect x="36" y="40" width="4" height="5" fill="#fff"/>`,
    visor: `<rect x="16" y="20" width="32" height="12" rx="2" fill="${INK}"/><rect x="19" y="23" width="26" height="4" fill="${b}"/><rect x="26" y="40" width="12" height="4" fill="${INK}"/>`,
    wide: `<circle cx="24" cy="28" r="7" fill="#fff" stroke="${INK}" stroke-width="2.6"/><circle cx="40" cy="28" r="7" fill="#fff" stroke="${INK}" stroke-width="2.6"/><circle cx="26" cy="29" r="3" fill="${INK}"/><circle cx="42" cy="29" r="3" fill="${INK}"/><path d="M22 41 Q32 48 42 41" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
  }
  return {
    key: `${key} cube`, color: a, verb: 'flip',
    svg:
      `<rect x="10" y="10" width="44" height="44" rx="4" fill="${a}" stroke="${INK}" stroke-width="${SW}"/>` +
      `<rect x="15" y="15" width="34" height="34" rx="2" fill="none" stroke="${b}" stroke-width="3"/>` +
      eyes[design],
  }
}

function ball(key, a, b, design) {
  const inner = design === 'split'
    ? `<path d="M32 10 A22 22 0 0 1 32 54 Z" fill="${b}"/>`
    : `<circle cx="32" cy="32" r="12" fill="${b}"/><circle cx="32" cy="32" r="6" fill="${a}"/>`
  return {
    key: `${key} ball`, color: a, verb: 'roll',
    svg:
      `<circle cx="32" cy="32" r="22" fill="${a}"/>` + inner +
      `<circle cx="32" cy="32" r="22" fill="none" stroke="${INK}" stroke-width="${SW}"/>` +
      `<rect x="23" y="25" width="6" height="8" fill="${INK}"/><rect x="35" y="25" width="6" height="8" fill="${INK}"/>` +
      `<path d="M26 41 L38 41" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`,
  }
}

function ship(key, a, b, design) {
  const fin = design === 'tall'
    ? `<path d="M18 36 L18 14 L30 30 Z" fill="${b}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
    : `<path d="M14 34 L22 18 L32 30 Z" fill="${b}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`
  return {
    key: `${key} ship`, color: a, verb: 'fly',
    svg:
      fin +
      `<path d="M8 38 L44 30 L58 38 L50 50 L14 50 Z" fill="${a}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<circle cx="40" cy="40" r="5" fill="#fff" stroke="${INK}" stroke-width="2.4"/><circle cx="41.5" cy="40.5" r="2" fill="${INK}"/>` +
      `<rect x="10" y="46" width="30" height="3" fill="${INK}" opacity=".45"/>`,
  }
}

function ufo(key, a, b) {
  return {
    key: `${key} ufo`, color: a, verb: 'hover',
    svg:
      `<path d="M20 34 A12 14 0 0 1 44 34 Z" fill="${b}" stroke="${INK}" stroke-width="3"/>` +
      `<ellipse cx="32" cy="38" rx="26" ry="9" fill="${a}" stroke="${INK}" stroke-width="${SW}"/>` +
      `<circle cx="16" cy="38" r="2.6" fill="#fff"/><circle cx="32" cy="41" r="2.6" fill="#fff"/><circle cx="48" cy="38" r="2.6" fill="#fff"/>` +
      `<rect x="27" y="24" width="4" height="6" fill="${INK}"/><rect x="34" y="24" width="4" height="6" fill="${INK}"/>`,
  }
}

function wave(key, a, b) {
  return {
    key: `${key} wave`, color: a, verb: 'zig',
    svg:
      `<path d="M10 32 L38 14 L38 26 L56 32 L38 38 L38 50 Z" fill="${a}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      `<path d="M22 32 L38 22 L38 42 Z" fill="${b}"/>` +
      `<circle cx="42" cy="32" r="3" fill="${INK}"/>`,
  }
}

const pieces = [
  cube('lime', '#7CFF3F', '#0B0B14', 'classic'),
  cube('magenta', '#FF3FD8', '#33062A', 'smirk'),
  cube('cyan', '#3FF0FF', '#083A40', 'angry'),
  cube('orange', '#FF8A00', '#5A2E00', 'visor'),
  cube('violet', '#A24BFF', '#2A0F4A', 'wide'),
  ball('yellow', '#FFE63F', '#7A6A00', 'split'),
  ball('red', '#FF3B3B', '#5C0A0A', 'core'),
  ship('blue', '#3F7BFF', '#0E2B70', 'tall'),
  ship('white', '#F4F4FF', '#8A8AA8', 'low'),
  ufo('mint', '#3FFFB0', '#0C5A3B'),
  ufo('pink', '#FF7FD2', '#7A1E5A'),
  wave('gold', '#FFC53F', '#6B4A00'),
]

export default {
  pieces,
  // a mystery icon: a locked dark cube with the question mark lit up
  hidden:
    `<rect x="10" y="10" width="44" height="44" rx="4" fill="#1B1B2E" stroke="${INK}" stroke-width="${SW}"/>` +
    `<rect x="15" y="15" width="34" height="34" rx="2" fill="none" stroke="#3EF0D0" stroke-width="2.5" opacity=".6"/>` +
    `<path d="M26 26 Q26 19 32 19 Q38 19 38 25 Q38 30 33 31.5 L33 35" stroke="#3EF0D0" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33" cy="41" r="2.2" fill="#3EF0D0"/>`,
}
