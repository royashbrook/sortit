// theme: Shape Town. the reference art pack — every other theme copies this
// file's interface and rules (see art/ART-SPEC.md).
//
// house rule: pieces differ by FORM as well as colour, so a colourblind kid
// can always play. every item here has a distinct silhouette AND a distinct
// colour, plus the same friendly face so the set reads as one family.

const INK = '#3D3230'

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
  key: 'shapes',
  title: 'Shape Town',
  tint: '#FFEED2',
  items: [
    {
      key: 'sun',
      color: '#FFC53D',
      svg: `<g ${S}>` +
        [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
          const r = (a * Math.PI) / 180
          const x1 = 32 + Math.cos(r) * 21, y1 = 32 + Math.sin(r) * 21
          const x2 = 32 + Math.cos(r) * 27, y2 = 32 + Math.sin(r) * 27
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
        }).join('') +
        `<circle cx="32" cy="32" r="16" fill="#FFC53D"/></g>` + face(32, 32),
    },
    {
      key: 'square',
      color: '#3E63DD',
      svg: `<rect x="12" y="12" width="40" height="40" rx="9" fill="#3E63DD" ${S}/>` + face(32, 32),
    },
    {
      key: 'triangle',
      color: '#46A758',
      svg: `<path d="M32 9 L56 52 L8 52 Z" fill="#46A758" ${S}/>` + face(32, 38),
    },
    {
      key: 'star',
      color: '#E93D82',
      svg: `<path d="M32 6 L39.6 23.4 L58 25.4 L44 38.4 L48.4 57 L32 47.2 L15.6 57 L20 38.4 L6 25.4 L24.4 23.4 Z" fill="#E93D82" ${S}/>` + face(32, 34, 0.9),
    },
    {
      key: 'heart',
      color: '#E5484D',
      svg: `<path d="M32 55 C8 39 10 18 24 18 C29.5 18 32 23 32 23 C32 23 34.5 18 40 18 C54 18 56 39 32 55 Z" fill="#E5484D" ${S}/>` + face(32, 32, 0.95),
    },
    {
      key: 'moon',
      color: '#8E4EC6',
      svg: `<path d="M40 8 A26 26 0 1 0 56 42 A20 20 0 0 1 40 8 Z" fill="#8E4EC6" ${S}/>` + face(30, 36, 0.9),
    },
    {
      key: 'cloud',
      color: '#9BB0C1',
      svg: `<path d="M18 46 A9 9 0 0 1 16 28 A12 12 0 0 1 39 22 A10 10 0 0 1 48 46 Z" fill="#9BB0C1" ${S}/>` + face(32, 36, 0.85),
    },
    {
      key: 'drop',
      color: '#12A594',
      svg: `<path d="M32 6 C44 24 51 33 51 41 A19 19 0 0 1 13 41 C13 33 20 24 32 6 Z" fill="#12A594" ${S}/>` + face(32, 40, 0.95),
    },
    {
      key: 'diamond',
      color: '#00A2C7',
      svg: `<path d="M20 12 L44 12 L56 27 L32 56 L8 27 Z" fill="#00A2C7" ${S}/><path d="M8 27 L56 27 M20 12 L26 27 L32 56 M44 12 L38 27 L32 56" stroke="${INK}" stroke-width="2" fill="none" opacity=".45"/>` + face(32, 21, 0.7),
    },
    {
      key: 'lightning',
      color: '#F76B15',
      svg: `<path d="M36 5 L14 36 L28 36 L24 59 L50 26 L34 26 Z" fill="#F76B15" ${S}/>` + face(31, 25, 0.72),
    },
    {
      key: 'flower',
      color: '#99D52A',
      svg: `<g fill="#99D52A" ${S}>` +
        [0, 60, 120, 180, 240, 300].map(a => {
          const r = (a * Math.PI) / 180
          const x = 32 + Math.cos(r) * 15, y = 32 + Math.sin(r) * 15
          return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="10"/>`
        }).join('') +
        `</g><circle cx="32" cy="32" r="12" fill="#FFF6E5" ${S}/>` + face(32, 32, 0.8),
    },
    {
      key: 'donut',
      color: '#AD7F58',
      svg: `<circle cx="32" cy="32" r="24" fill="#AD7F58" ${S}/><circle cx="32" cy="32" r="8" fill="#FFF6E5" ${S}/>` +
        `<circle cx="20" cy="24" r="1.8" fill="#FFF6E5"/><circle cx="44" cy="22" r="1.8" fill="#FFF6E5"/><circle cx="46" cy="40" r="1.8" fill="#FFF6E5"/><circle cx="18" cy="40" r="1.8" fill="#FFF6E5"/>` +
        face(32, 47, 0.62),
    },
  ],
}
