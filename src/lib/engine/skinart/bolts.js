// nuts & bolts pieces: twelve coloured hex nuts seen in three-quarter view,
// the way they sit on a real bolt: a lit top face with the bore showing,
// then the side faces below it carrying a small white mark for anyone who
// does not read colour. the nut IS the piece, no theme face on top.
//
// the side faces live in a wide band under a clip. app.css slides that band
// sideways while a nut is flying, so a nut screwing down the post visibly
// TURNS about the bolt instead of tumbling in the plane of the screen.
// drawn for a viewBox of 0 0 64 64.
//
// every piece module in skinart/ exports the same shape:
//   { pieces: [12 x { key, color, svg }], hidden: svg }

// the flattened hexagon of the top face, and the body below it
const TOP = 'M6 18 L20 8 L44 8 L58 18 L44 28 L20 28 Z'
const BODY = 'M6 18 L6 50 L20 60 L44 60 L58 50 L58 18 L44 28 L20 28 Z'
// one period of the band: a lit side face, the front face, a shaded side
// face (14 + 24 + 14 = 52 units). a full turn of the nut is two periods.
export const BAND_PERIOD = 52

// the twelve marks, each centred at (0,0) in a 16-unit box
const MARKS = {
  dot: 'M0 0 m-3.2 0 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0',
  bar: 'M-6 -2 h12 v4 h-12 z',
  plus: 'M-2 -6 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4 z',
  cross: 'M-5.5 -3.5 l2 -2 l3.5 3.5 l3.5 -3.5 l2 2 l-3.5 3.5 l3.5 3.5 l-2 2 l-3.5 -3.5 l-3.5 3.5 l-2 -2 l3.5 -3.5 z',
  tri: 'M0 -6 l6.5 11 h-13 z',
  ring: 'M0 0 m-6 0 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 z M0 0 m-3 0 a3 3 0 1 1 6 0 a3 3 0 1 1 -6 0 z',
  square: 'M-5 -5 h10 v10 h-10 z',
  star: 'M0 -7 l2.1 4.5 l4.9 .5 l-3.7 3.3 l1.1 4.9 l-4.4 -2.6 l-4.4 2.6 l1.1 -4.9 l-3.7 -3.3 l4.9 -.5 z',
  diamond: 'M0 -6.5 l6.5 6.5 l-6.5 6.5 l-6.5 -6.5 z',
  dots: 'M-4.5 0 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0 M4.5 0 m-2.6 0 a2.6 2.6 0 1 0 5.2 0 a2.6 2.6 0 1 0 -5.2 0',
  chevron: 'M-6 -1 l6 -5 l6 5 l-2.4 2.4 l-3.6 -3 l-3.6 3 z M-6 5 l6 -5 l6 5 l-2.4 2.4 l-3.6 -3 l-3.6 3 z',
  heart: 'M0 6 C-7 1 -7 -6 -2.5 -6 C-1 -6 0 -5 0 -4 C0 -5 1 -6 2.5 -6 C7 -6 7 1 0 6 z',
}

// face, lit edge, shadow edge: the twelve read apart on a phone in sunlight
const NUTS = [
  ['red', '#E5484D', '#FF8A8E', '#9C2A2E', 'tri'],
  ['blue', '#3B82F6', '#8DB8FF', '#234A9C', 'plus'],
  ['gold', '#F0B429', '#FFE08A', '#A0721A', 'diamond'],
  ['green', '#46A758', '#93D9A0', '#27683A', 'dot'],
  ['violet', '#8E4EC6', '#C9A0EA', '#563087', 'star'],
  ['orange', '#F76B15', '#FFA96B', '#A3450C', 'square'],
  ['teal', '#12A594', '#7DD9CD', '#0B6C61', 'ring'],
  ['pink', '#E93D82', '#FF9CC4', '#9A2656', 'heart'],
  ['brown', '#A0704A', '#D4AC88', '#66472E', 'bar'],
  ['sky', '#5BB8F5', '#B3E1FF', '#3479A6', 'dots'],
  ['lime', '#9BC53D', '#D3EB8F', '#648228', 'chevron'],
  ['slate', '#5F6B7A', '#A2AFBF', '#3A424D', 'cross'],
]

function nut(key, face, lit, shade, mark) {
  const id = `nut-${key}`
  // one period of side faces; the mark rides the front face only
  const period = (x) =>
    `<rect x="${x}" y="18" width="14" height="42" fill="${lit}"/>` +
    `<rect x="${x + 14}" y="18" width="24" height="42" fill="${face}"/>` +
    `<rect x="${x + 38}" y="18" width="14" height="42" fill="${shade}"/>` +
    `<path d="${MARKS[mark]}" fill="#fff" opacity=".92" transform="translate(${x + 26} 42)"/>`
  return (
    `<defs>` +
    `<clipPath id="${id}-c"><path d="${BODY}"/></clipPath>` +
    `<linearGradient id="${id}-t" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".5" stop-color="${lit}"/><stop offset="1" stop-color="${face}"/>` +
    `</linearGradient>` +
    `</defs>` +
    // the side faces: a band three periods wide, clipped to the body. the
    // band starts one period left so the front face sits centre at rest.
    `<g clip-path="url(#${id}-c)">` +
    `<g class="nut-band">${period(-46)}${period(6)}${period(58)}</g>` +
    // the bottom bevel and a soft vertical shading over the whole body
    `<path d="M6 44 L6 50 L20 60 L44 60 L58 50 L58 44 L44 54 L20 54 Z" fill="#000" opacity=".22"/>` +
    `<rect x="6" y="18" width="52" height="42" fill="url(#${id}-v)"/>` +
    `</g>` +
    `<defs><linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>` +
    `</linearGradient></defs>` +
    // the top face, lit from the upper left, and the threaded bore
    `<path d="${TOP}" fill="url(#${id}-t)"/>` +
    `<ellipse cx="32" cy="18" rx="9.5" ry="4.6" fill="#2E2A27"/>` +
    `<ellipse cx="32" cy="17.4" rx="7" ry="3.2" fill="none" stroke="#8C847C" stroke-width="1" stroke-dasharray="2 1.4" opacity=".7"/>` +
    // the edges
    `<path d="${TOP}" fill="none" stroke="#2A2220" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M6 18 L6 50 L20 60 L44 60 L58 50 L58 18" fill="none" stroke="#2A2220" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M20 28 L20 60 M44 28 L44 60" stroke="#2A2220" stroke-width="1.2" opacity=".55"/>` +
    // the rod rising out of the bore. hidden on nuts buried in a stack (the
    // nut above covers it) and shown by app.css on the top nut and on a nut in
    // flight, so the bolt visibly passes THROUGH the nut instead of stopping
    // at it. same width as the bore, same thread pitch as the css post.
    `<g class="nut-rod" display="none">` +
    `<rect x="22.5" y="-30" width="19" height="48" fill="url(#${id}-r)"/>` +
    `<rect x="22.5" y="-30" width="19" height="48" fill="url(#${id}-rs)"/>` +
    `<path d="M22.5 -30 V18 M41.5 -30 V18" stroke="#2A2220" stroke-width="1.6"/>` +
    `</g>` +
    `<defs>` +
    `<pattern id="${id}-r" width="19" height="6" patternUnits="userSpaceOnUse"><rect width="19" height="3" fill="#D3CCC4"/><rect y="3" width="19" height="2" fill="#8F877F"/><rect y="5" width="19" height="1" fill="#6E665F"/></pattern>` +
    `<linearGradient id="${id}-rs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>` +
    `</defs>`
  )
}

export default {
  pieces: NUTS.map(([key, face, lit, shade, mark]) => ({ key: `${key} nut`, color: face, svg: nut(key, face, lit, shade, mark) })),
  // a mystery nut: dull unfinished steel, a question mark on the front face
  hidden: nut('hid', '#A39B93', '#D9D3CC', '#5E5751', 'dot')
    .replace(/<path d="[^"]*" fill="#fff" opacity="\.92" transform="translate\(32 42\)"\/>/,
      `<path d="M-4 -5 Q-4 -10 0 -10 Q4 -10 4 -6 Q4 -3 1 -2 L1 0" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" transform="translate(32 42)"/><circle cx="33" cy="46" r="1.6" fill="#fff"/>`),
}
