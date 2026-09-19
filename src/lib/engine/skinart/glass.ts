// Coloured glass marbles with inset marks. Layered paths keep the highlights
// self-contained: no shared SVG ids, fonts, filters or downloaded textures.
import type { SkinArt } from '../types.ts'

const MARKS = [
  'M32 22L42 40H22Z',
  'M30 23H34V29H40V33H34V39H30V33H24V29H30Z',
  'M32 22L42 32L32 42L22 32Z',
  'M32 23A9 9 0 1 1 31.99 23Z',
  'M32 21L35 28L43 29L37 34L39 42L32 38L25 42L27 34L21 29L29 28Z',
  'M24 24H40V40H24Z',
  'M32 25C22 16 16 30 32 41C48 30 42 16 32 25Z',
  'M32 21A11 11 0 1 1 31.99 21ZM32 26A6 6 0 1 0 32.01 26Z',
  'M23 26H41V30H23ZM23 35H41V39H23Z',
  'M32 21L36 26L43 28L39 35L32 42L25 35L21 28L28 26Z',
  'M29 21H39L33 29H40L25 43L29 33H23Z',
  'M22 26L26 22L32 28L38 22L42 26L36 32L42 38L38 42L32 36L26 42L22 38L28 32Z',
]
const COLOURS = [
  ['coral', '#DD4457'], ['blue', '#387BE1'], ['honey', '#D99512'],
  ['jade', '#2A9B61'], ['violet', '#8B50C5'], ['orange', '#E47729'],
  ['rose', '#DA4A8D'], ['teal', '#168F9B'], ['pearl', '#C0D3DA'],
  ['lime', '#7D9624'], ['indigo', '#535BB4'], ['smoke', '#697B8C'],
] as const

function marble(color: string, mark: string): string {
  return `<ellipse cx="33" cy="57" rx="23" ry="4" fill="#102E46" opacity=".18"/>` +
    `<circle cx="32" cy="31" r="27" fill="${color}" stroke="#183746" stroke-opacity=".55" stroke-width="1.7"/>` +
    `<path d="M7 24C6 57 43 67 57 41C40 53 14 42 7 24Z" fill="#14283E" opacity=".29"/>` +
    `<circle cx="29" cy="26" r="21" fill="#FFFFFF" opacity=".11"/>` +
    `<ellipse cx="26" cy="16" rx="16" ry="9" transform="rotate(-24 26 16)" fill="#FFFFFF" opacity=".27"/>` +
    `<path d="M13 22C16 12 26 8 36 11" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".83"/>` +
    `<path d="M21 51C31 55 42 51 48 44" fill="none" stroke="#FFFFFF" stroke-width="2.3" stroke-linecap="round" opacity=".55"/>` +
    `<path d="${mark}" transform="translate(0 1.2)" fill="#123548" opacity=".42" fill-rule="evenodd"/>` +
    `<path d="${mark}" fill="#FFFFFF" fill-opacity=".94" stroke="#173A4A" stroke-opacity=".4" stroke-width="1" stroke-linejoin="round" fill-rule="evenodd"/>` +
    `<circle cx="47" cy="19" r="2" fill="#FFFFFF" opacity=".7"/>`
}

export default {
  pieces: COLOURS.map(([key, color], i) => ({ key: `${key} glass`, color, svg: marble(color, MARKS[i]) })),
  hidden: marble('#8194A4', 'M25 26C25 16 41 17 40 26C40 31 34 31 33 35H30C30 29 36 29 36 25C36 21 29 21 29 26ZM30 39H34V43H30Z'),
} satisfies SkinArt
