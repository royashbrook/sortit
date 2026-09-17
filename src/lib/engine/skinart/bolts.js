// Shared palette and color-blind marks for the projected toy-hardware skin.
import { renderNut } from './nut-geometry.js'
export { nutGeometry } from './nut-geometry.js'

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


export function nutArt(key, turn = 0, postTip = -1000, id) {
  const [name, color, lit, shade, mark] = NUTS.find(nut => nut[0] === key) ?? ['hid', '#929EA8', '#D7E0E6', '#4C5963', null]
  const symbol = mark ? `<path d="${MARKS[mark]}" fill="currentColor"/>` : '<path d="M-4 -4Q-4 -9 0 -9Q5 -9 5 -5Q5 -2 0 0V2M0 6V7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>'
  return renderNut(name, color, lit, shade, symbol, turn, postTip, id)
}

export default {
  pieces: NUTS.map(([key, color]) => ({ key: `${key} nut`, color, svg: nutArt(key) })),
  hidden: nutArt('hid'),
}
