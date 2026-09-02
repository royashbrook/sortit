// nuts & bolts pieces: twelve anodised hex nuts, face on, lit from the upper
// left. the nut IS the piece (no theme face on top): colour carries identity,
// and a small stamped mark on the crown carries it again for anyone who does
// not read colour. drawn for a viewBox of 0 0 64 64.
//
// every piece module in skinart/ exports the same shape:
//   { pieces: [12 x { key, color, svg }], hidden: svg }

const HEX = 'M32 4 L56 18 L56 46 L32 60 L8 46 L8 18 Z'
const INNER = 'M32 11 L50 21.5 L50 42.5 L32 53 L14 42.5 L14 21.5 Z'

// the twelve stamped marks, each a tiny engraving centred at (32,32), drawn
// in a darker shade of the nut so it reads as machined rather than painted
const MARKS = {
  dot: 'M32 32 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
  bar: 'M25 30 h14 v4 h-14 z',
  plus: 'M30 25 h4 v5 h5 v4 h-5 v5 h-4 v-5 h-5 v-4 h5 z',
  cross: 'M26 26 l3 -0.2 l3 3.2 l3 -3.2 l3 0.2 l-4.5 6 l4.5 6 l-3 0.2 l-3 -3.2 l-3 3.2 l-3 -0.2 l4.5 -6 z',
  tri: 'M32 25 l7 12 h-14 z',
  ring: 'M32 32 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 z M32 32 m-3 0 a3 3 0 1 1 6 0 a3 3 0 1 1 -6 0 z',
  square: 'M27 27 h10 v10 h-10 z',
  star: 'M32 24 l2.4 5.2 l5.6 .6 l-4.2 3.8 l1.2 5.6 l-5 -2.9 l-5 2.9 l1.2 -5.6 l-4.2 -3.8 l5.6 -.6 z',
  diamond: 'M32 25 l7 7 l-7 7 l-7 -7 z',
  dots: 'M27 32 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M37 32 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0',
  chevron: 'M25 30 l7 -6 l7 6 l-2.6 2.6 l-4.4 -3.8 l-4.4 3.8 z M25 37 l7 -6 l7 6 l-2.6 2.6 l-4.4 -3.8 l-4.4 3.8 z',
  wave: 'M24 33 q4 -7 8 0 t8 0 l0 3.5 q-4 7 -8 0 t-8 0 z',
}

// colour triples: face, lit edge, shadow edge. the twelve read apart on a
// phone in sunlight, and no two share a hue family.
const NUTS = [
  ['red', '#E5484D', '#FF8A8E', '#8E2226', 'dot'],
  ['blue', '#3B82F6', '#8DB8FF', '#1E3F8A', 'bar'],
  ['gold', '#F0B429', '#FFE08A', '#8C6410', 'plus'],
  ['green', '#46A758', '#93D9A0', '#1F5A2B', 'cross'],
  ['violet', '#8E4EC6', '#C9A0EA', '#4A2470', 'tri'],
  ['orange', '#F76B15', '#FFA96B', '#8A3A08', 'ring'],
  ['teal', '#12A594', '#7DD9CD', '#085C52', 'square'],
  ['pink', '#E93D82', '#FF9CC4', '#821E47', 'star'],
  ['brown', '#A0704A', '#D4AC88', '#5A3B24', 'diamond'],
  ['sky', '#5BB8F5', '#B3E1FF', '#2A6A96', 'dots'],
  ['lime', '#9BC53D', '#D3EB8F', '#557020', 'chevron'],
  ['plum', '#5C3B8C', '#A98AD1', '#2C1A48', 'wave'],
]

function nut(key, face, lit, shade, mark) {
  const g = `bolt-${key}`
  return (
    `<defs>` +
    `<linearGradient id="${g}-f" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${lit}"/><stop offset=".45" stop-color="${face}"/><stop offset="1" stop-color="${shade}"/>` +
    `</linearGradient>` +
    `<linearGradient id="${g}-c" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${face}"/><stop offset="1" stop-color="${lit}"/>` +
    `</linearGradient>` +
    `<radialGradient id="${g}-b" cx=".4" cy=".35" r=".7">` +
    `<stop offset="0" stop-color="#6E665F"/><stop offset=".6" stop-color="#3A3430"/><stop offset="1" stop-color="#1E1B19"/>` +
    `</radialGradient>` +
    `</defs>` +
    // the outer hex body, bevelled by the diagonal gradient
    `<path d="${HEX}" fill="url(#${g}-f)" stroke="#2A2220" stroke-width="2.5" stroke-linejoin="round"/>` +
    // the crown: a flatter inner hex catching the light
    `<path d="${INNER}" fill="url(#${g}-c)" stroke="${shade}" stroke-width="1.5" stroke-linejoin="round" opacity=".95"/>` +
    // the stamped mark, engraved into the crown
    `<path d="${MARKS[mark]}" fill="#1E1B19" opacity=".8" transform="translate(0 -12.5) scale(.95) translate(1.7 1.7)"/>` +
    // the threaded bore
    `<circle cx="32" cy="36" r="9.5" fill="url(#${g}-b)" stroke="#1E1B19" stroke-width="1.5"/>` +
    `<circle cx="32" cy="36" r="6.5" fill="none" stroke="#8C847C" stroke-width="1.2" stroke-dasharray="2.2 1.6" opacity=".8"/>` +
    // one specular glint on the upper-left flat
    `<path d="M12 20 L30 9 L30 12 L14 22 Z" fill="#fff" opacity=".45"/>`
  )
}

export default {
  pieces: NUTS.map(([key, face, lit, shade, mark]) => ({ key: `${key} nut`, color: face, svg: nut(key, face, lit, shade, mark) })),
  // a mystery nut: dull unfinished steel with a question stamp
  hidden:
    `<defs><linearGradient id="bolt-hid" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#D9D3CC"/><stop offset=".5" stop-color="#A39B93"/><stop offset="1" stop-color="#5E5751"/></linearGradient></defs>` +
    `<path d="${HEX}" fill="url(#bolt-hid)" stroke="#2A2220" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<path d="${INNER}" fill="#B5ADA5" stroke="#5E5751" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M27 25 Q27 19 32 19 Q37 19 37 24 Q37 28 33 29.5 L33 32" stroke="#4A433D" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33" cy="36.5" r="1.8" fill="#4A433D"/>` +
    `<circle cx="32" cy="45" r="5" fill="#3A3430" stroke="#1E1B19" stroke-width="1.5"/>`,
}
