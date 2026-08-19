// theme: Fruit Farm. follows art/ART-SPEC.md; shapes.js is the reference —
// same interface, same ink, same face, so the sets read as one family.

const INK = '#3D3230'
const LEAF = '#46A758'
const CREAM = '#FFF6E5'

// the shared face: two dot eyes and a smile, centred at (cx, cy), scaled by s.
function face(cx, cy, s = 1) {
  const ex = 5.5 * s
  const ey = 1.5 * s
  const er = 1.9 * s
  const sw = 2.4 * s
  const sr = 4.6 * s
  return `<circle cx="${cx - ex}" cy="${cy - ey}" r="${er}" fill="${INK}"/>` +
    `<circle cx="${cx + ex}" cy="${cy - ey}" r="${er}" fill="${INK}"/>` +
    `<path d="M ${cx - sr} ${cy + 3.2 * s} Q ${cx} ${cy + 3.2 * s + sr} ${cx + sr} ${cy + 3.2 * s}" ` +
    `stroke="${INK}" stroke-width="${sw}" stroke-linecap="round" fill="none"/>`
}

const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`

export default {
  key: 'fruits',
  title: 'Fruit Farm',
  tint: '#FFF1DC',
  items: [
    {
      key: 'apple',
      color: '#E5484D',
      svg: `<path d="M32 16 C32 11 33 8 36 6" fill="none" ${S}/>` +
        `<path d="M36 12 C38 5 46 4 49 8 C47 14 40 16 36 12 Z" fill="${LEAF}" ${S}/>` +
        `<path d="M32 19 C27 12 16 12 12 21 C7 31 12 46 21 53 C26 57 30 54 32 54 C34 54 38 57 43 53 C52 46 57 31 52 21 C48 12 37 12 32 19 Z" fill="#E5484D" ${S}/>` +
        face(32, 36),
    },
    {
      key: 'banana',
      color: '#FFB627',
      svg: `<path d="M10 20 C10 36 20 52 38 53 C48 54 55 40 56 26 C56 21 51 21 50 25 C48 34 42 40 34 40 C26 40 17 32 15 22 C14 17 10 16 10 20 Z" fill="#FFB627" ${S}/>` +
        face(34, 47, 0.7),
    },
    {
      key: 'grapes',
      color: '#8E4EC6',
      svg: `<path d="M32 26 C32 14 33 10 37 7" fill="none" ${S}/>` +
        `<g fill="#8E4EC6" ${S}><circle cx="24" cy="21" r="8"/><circle cx="40" cy="21" r="8"/><circle cx="15" cy="32" r="8"/><circle cx="49" cy="32" r="8"/><circle cx="24" cy="45" r="8"/><circle cx="40" cy="45" r="8"/><circle cx="32" cy="52" r="7"/><circle cx="32" cy="33" r="10"/></g>` +
        face(32, 33, 0.78),
    },
    {
      key: 'orange',
      color: '#F76B15',
      svg: `<path d="M30 14 C26 6 16 6 14 12 C18 18 26 18 30 14 Z" fill="${LEAF}" ${S}/>` +
        `<path d="M34 14 C38 6 48 6 50 12 C46 18 38 18 34 14 Z" fill="${LEAF}" ${S}/>` +
        `<circle cx="32" cy="36" r="20" fill="#F76B15" ${S}/>` +
        `<circle cx="24" cy="27" r="2.5" fill="${CREAM}" opacity=".7"/>` +
        face(32, 37),
    },
    {
      key: 'strawberry',
      color: '#E93D82',
      svg: `<path d="M32 57 C18 50 11 38 12 27 C13 20 21 16 32 16 C43 16 51 20 52 27 C53 38 46 50 32 57 Z" fill="#E93D82" ${S}/>` +
        `<path d="M20 18 L26 8 L32 15 L38 8 L44 18 Z" fill="${LEAF}" ${S}/>` +
        `<g fill="${CREAM}"><circle cx="21" cy="28" r="1.6"/><circle cx="43" cy="28" r="1.6"/><circle cx="17" cy="37" r="1.6"/><circle cx="47" cy="37" r="1.6"/><circle cx="25" cy="48" r="1.6"/><circle cx="39" cy="48" r="1.6"/></g>` +
        face(32, 35, 0.95),
    },
    {
      key: 'pear',
      color: '#99D52A',
      svg: `<path d="M32 10 C32 8 33 6 35 5" fill="none" ${S}/>` +
        `<path d="M35 9 C39 4 45 5 46 9 C43 13 37 13 35 9 Z" fill="${LEAF}" ${S}/>` +
        `<path d="M32 10 C36 10 38 15 39 21 C40 27 46 31 48 39 C50 49 42 56 32 56 C22 56 14 49 16 39 C18 31 24 27 25 21 C26 15 28 10 32 10 Z" fill="#99D52A" ${S}/>` +
        face(32, 42),
    },
    {
      key: 'watermelon',
      color: '#FF6E7F',
      svg: `<path d="M7 20 A25 25 0 0 0 57 20 Z" fill="${LEAF}" ${S}/>` +
        `<path d="M11 20 A21 21 0 0 0 53 20 Z" fill="${CREAM}"/>` +
        `<path d="M14 20 A18 18 0 0 0 50 20 Z" fill="#FF6E7F" ${S}/>` +
        `<g fill="${INK}"><circle cx="21" cy="26" r="1.7"/><circle cx="43" cy="26" r="1.7"/></g>` +
        face(32, 29, 0.8),
    },
    {
      key: 'pineapple',
      color: '#D98E32',
      svg: `<path d="M22 24 L18 7 L28 17 L32 5 L36 17 L46 7 L42 24 Z" fill="${LEAF}" ${S}/>` +
        `<ellipse cx="32" cy="39" rx="15" ry="18" fill="#D98E32" ${S}/>` +
        `<path d="M21 31 L43 49 M43 31 L21 49" stroke="${INK}" stroke-width="2" fill="none" opacity=".22"/>` +
        face(32, 38, 0.9),
    },
    {
      key: 'cherries',
      color: '#9E2B2B',
      svg: `<path d="M20 34 C21 21 26 13 33 9 M44 36 C42 23 38 14 33 9" fill="none" ${S}/>` +
        `<path d="M33 10 C36 4 44 4 46 9 C42 14 36 14 33 10 Z" fill="${LEAF}" ${S}/>` +
        `<circle cx="44" cy="45" r="10.5" fill="#9E2B2B" ${S}/>` +
        `<circle cx="20" cy="42" r="10.5" fill="#9E2B2B" ${S}/>` +
        `<circle cx="48" cy="41" r="2" fill="${CREAM}" opacity=".6"/>` +
        face(20, 42, 0.62),
    },
    {
      key: 'lemon',
      color: '#F2E749',
      svg: `<path d="M6 32 C6 27 10 24 15 22 C21 18 27 17 32 17 C37 17 43 18 49 22 C54 24 58 27 58 32 C58 37 54 40 49 42 C43 46 37 47 32 47 C27 47 21 46 15 42 C10 40 6 37 6 32 Z" fill="#F2E749" ${S}/>` +
        `<ellipse cx="19" cy="26" rx="3" ry="2" fill="${CREAM}" opacity=".7"/>` +
        face(32, 32, 0.85),
    },
    {
      key: 'blueberries',
      color: '#3E63DD',
      svg: `<circle cx="20" cy="24" r="11" fill="#3E63DD" ${S}/>` +
        `<circle cx="44" cy="24" r="11" fill="#3E63DD" ${S}/>` +
        `<g stroke="${INK}" stroke-width="2" fill="none" opacity=".45"><circle cx="20" cy="21" r="2.6"/><circle cx="44" cy="21" r="2.6"/></g>` +
        `<circle cx="32" cy="42" r="14" fill="#3E63DD" ${S}/>` +
        face(32, 42, 0.9),
    },
    {
      key: 'peach',
      color: '#FFAB76',
      svg: `<path d="M36 13 C40 5 50 6 51 11 C48 17 39 18 36 13 Z" fill="${LEAF}" ${S}/>` +
        `<path d="M32 16 C36 9 48 10 52 21 C56 34 48 51 32 55 C16 51 8 34 12 21 C16 10 28 9 32 16 Z" fill="#FFAB76" ${S}/>` +
        `<path d="M32 16 C29 20 28 24 28 28" stroke="${INK}" stroke-width="2" fill="none" opacity=".35"/>` +
        face(32, 37),
    },
  ],
}
