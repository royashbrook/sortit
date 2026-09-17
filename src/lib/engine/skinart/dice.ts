// rounded toy dice. six pip counts in two contrasting finishes give all
// twelve colours their own mark, even when colour alone is hard to read.
import type { SkinArt } from '../types.ts'

const INK = '#2A2220'
const PIPS = [
  [[16, 16]],
  [[8, 8], [24, 24]],
  [[8, 8], [16, 16], [24, 24]],
  [[8, 8], [24, 8], [8, 24], [24, 24]],
  [[8, 8], [24, 8], [16, 16], [8, 24], [24, 24]],
  [[8, 8], [24, 8], [8, 16], [24, 16], [8, 24], [24, 24]],
]
// adjacent faces never show opposite values (opposites sum to seven).
const TOP = [3, 1, 1, 1, 1, 2]
const SIDE = [2, 3, 5, 2, 4, 3]
const OUTLINE = 'M22 7H50Q57 7 57 14V39Q57 43 54 46L45 55Q42 58 37 58H14Q7 58 7 51V27Q7 22 10 19L18 10Q20 7 22 7Z'

function pips(value: number, light: boolean, transform: string): string {
  const fill = light ? '#FFF3DA' : INK
  return `<g transform="${transform}">${PIPS[value - 1].map(([x, y]) =>
    `<circle cx="${x}" cy="${y + .65}" r="3.5" fill="#FFF3DA" opacity=".32"/>` +
    `<circle cx="${x}" cy="${y}" r="3.25" fill="${INK}" opacity=".65"/>` +
    `<circle cx="${x}" cy="${y + .35}" r="2.65" fill="${fill}"/>`
  ).join('')}</g>`
}

function die(color: string, value: number, light: boolean): string {
  // no defs or ids: repeated pieces and picker previews share the document.
  return (
    `<path d="${OUTLINE}" fill="${color}"/>` +
    `<path d="M22 7H50Q54 7 56 10L44 23Q41 20 37 20H14Q11 20 9 21L18 10Q20 7 22 7Z" fill="#FFF3DA" opacity=".28"/>` +
    `<path d="M56 10Q57 12 57 14V39Q57 43 54 46L45 55Q42 58 37 58Q44 57 44 50V28Q44 25 43 23Z" fill="${INK}" opacity=".32"/>` +
    `<rect x="7" y="20" width="37" height="38" rx="7" fill="${color}"/>` +
    `<rect x="10" y="23" width="31" height="31" rx="5" fill="#FFF3DA" opacity=".1"/>` +
    `<path d="M11 31V28Q11 24 16 24H34M21 11H46" fill="none" stroke="#FFF3DA" stroke-opacity=".55" stroke-width="2.3" stroke-linecap="round"/>` +
    `<path d="M44 27V49Q44 56 37 58M47 23L53 17" fill="none" stroke="${INK}" stroke-opacity=".24" stroke-width="1.4" stroke-linecap="round"/>` +
    pips(TOP[value - 1], light, 'matrix(1 0 .36 -.36 10 20)') +
    pips(SIDE[value - 1], light, 'matrix(.35 -.35 0 1 44 22)') +
    pips(value, light, 'translate(10 23)') +
    `<path d="${OUTLINE}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
  )
}

// saved games identify pieces by index. keep this colour order (refs #29).
const SETS: [key: string, color: string, value: number, light: boolean][] = [
  ['ruby die', '#D6323C', 1, true],
  ['ivory die', '#F1E6CC', 1, false],
  ['sapphire die', '#2F6FE0', 2, true],
  ['emerald die', '#2FA35C', 3, true],
  ['amethyst die', '#8A4DD0', 4, true],
  ['obsidian die', '#2B2B33', 5, true],
  ['sunset die', '#F4772E', 2, false],
  ['pearl die', '#E9EEF5', 3, false],
  ['bronze die', '#B0703A', 4, false],
  ['teal die', '#1FA6A0', 6, true],
  ['gold die', '#E8B72C', 5, false],
  ['rose die', '#F06AA8', 6, false],
]

export default {
  pieces: SETS.map(([key, color, value, light]) => ({ key, color, svg: die(color, value, light) })),
  // a mystery die: a cloth dice bag, still closed
  hidden:
    `<path d="M22 22 Q32 14 42 22 L50 52 Q32 62 14 52 Z" fill="#7A5C8E" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M20 24 Q32 30 44 24" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M24 20 Q32 10 40 20" stroke="#C9A96A" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M28 36 Q28 31 32 31 Q36 31 36 35 Q36 38 33 39 L33 41.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33" cy="46" r="1.6" fill="#fff"/>`,
} satisfies SkinArt
