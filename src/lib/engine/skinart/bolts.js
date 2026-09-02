// nuts & bolts pieces: twelve chunky front-on hex nuts wrapped around one
// tube-owned post. this is the physical read of the reference: the post only
// protrudes above the stack; an occupied section is completely inside a nut.
// a white mark keeps every nut distinct without relying on colour alone.
//
// the side faces live in a wide band under a clip. app.css slides that band
// sideways while a nut is flying, so a nut screwing down the post visibly
// TURNS about the bolt instead of tumbling in the plane of the screen.
// drawn for a viewBox of 0 0 64 40. the painted nut deliberately bleeds five
// units above and below that box: the upper shell covers the top edge of the
// lower shell, the way two nuts seated directly together actually read.
//
// every piece module in skinart/ exports the same shape:
//   { pieces: [12 x { key, color, svg }], hidden: svg }

const SHELL = 'M1 4 L9 -5 H55 L63 4 V36 L55 45 H9 L1 36 Z'
// one period of the turning shell: a lit side, broad front, and shaded side
// (11 + 40 + 11 = 62 units). app.css slides one full period while the piece
// travels; repeated periods make that a seamless rotation about the post.

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
    `<rect x="${x}" y="-5" width="11" height="50" fill="${lit}"/>` +
    `<rect x="${x + 11}" y="-5" width="40" height="50" fill="${face}"/>` +
    `<rect x="${x + 51}" y="-5" width="11" height="50" fill="${shade}"/>` +
    `<path d="${MARKS[mark]}" fill="#fff" opacity=".94" transform="translate(${x + 31} 21) scale(.9)"/>`
  return (
    `<defs>` +
    `<clipPath id="${id}-c"><path d="${SHELL}"/></clipPath>` +
    `</defs>` +
    // the shell: a band three periods wide, clipped to the nut. the
    // band starts one period left so the front face sits centre at rest.
    `<g clip-path="url(#${id}-c)">` +
    `<g class="nut-band">${period(-61)}${period(1)}${period(63)}</g>` +
    // machined bevels sell the thickness without exposing a fake top hole
    `<path d="M1 4 L9 -5 H55 L63 4 L55 10 H9 Z" fill="#fff" opacity=".28"/>` +
    `<path d="M1 36 L9 45 H55 L63 36 L55 30 H9 Z" fill="#000" opacity=".2"/>` +
    `<rect x="1" y="-5" width="62" height="50" fill="url(#${id}-v)"/>` +
    `</g>` +
    `<defs><linearGradient id="${id}-v" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".48" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/>` +
    `</linearGradient></defs>` +
    `<path class="nut-shell" d="${SHELL}" fill="none" stroke="#2A2220" stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M9 10 V30 M55 10 V30" stroke="#2A2220" stroke-width="1.2" opacity=".5"/>`
  )
}

export default {
  pieces: NUTS.map(([key, face, lit, shade, mark]) => ({ key: `${key} nut`, color: face, svg: nut(key, face, lit, shade, mark) })),
  // a mystery nut: dull unfinished steel, a question mark on the front face
  hidden: nut('hid', '#A39B93', '#D9D3CC', '#5E5751', 'dot')
    .replace(/<path d="[^"]*" fill="#fff" opacity="\.94" transform="translate\(32 21\) scale\(\.9\)"\/>/,
      `<path d="M-4 -5 Q-4 -10 0 -10 Q4 -10 4 -6 Q4 -3 1 -2 L1 0" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round" transform="translate(32 20) scale(.9)"/><circle cx="32.9" cy="25" r="1.5" fill="#fff"/>`),
}
