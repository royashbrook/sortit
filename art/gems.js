// theme: Gem Cave. interface and rules match art/shapes.js (see ART-SPEC.md).
//
// house rule: pieces differ by FORM as well as colour. twelve gems, twelve
// silhouettes: circle, cut-corner square, teardrop, hexagon, tall oval,
// brilliant cut, pearl-on-shell, triangle, angular heart, sparkle star,
// crystal spikes, geode dome.

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
  key: 'gems',
  title: 'Gem Cave',
  tint: '#F9E8EF',
  items: [
    {
      key: 'ruby',
      color: '#E5484D',
      svg: `<circle cx="32" cy="32" r="24" fill="#E5484D" ${S}/>` +
        `<path d="M16 25 A18 18 0 0 1 24 16" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` +
        face(32, 33),
    },
    {
      key: 'emerald',
      color: '#30A46C',
      svg: `<path d="M18 8 L46 8 L56 18 L56 46 L46 56 L18 56 L8 46 L8 18 Z" fill="#30A46C" ${S}/>` +
        `<rect x="16" y="16" width="32" height="32" fill="none" stroke="${INK}" stroke-width="2" opacity=".35"/>` +
        face(32, 32),
    },
    {
      key: 'sapphire',
      color: '#3E63DD',
      svg: `<path d="M32 6 C43 22 50 31 50 40 A18 18 0 0 1 14 40 C14 31 21 22 32 6 Z" fill="#3E63DD" ${S}/>` +
        `<path d="M20 41 A12 12 0 0 0 25 50" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` +
        face(32, 39, 0.95),
    },
    {
      key: 'amethyst',
      color: '#8E4EC6',
      svg: `<path d="M32 6 L54 19 L54 45 L32 58 L10 45 L10 19 Z" fill="#8E4EC6" ${S}/>` +
        `<path d="M15 22 L15 42" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>` +
        face(32, 33),
    },
    {
      key: 'topaz',
      color: '#FFB224',
      svg: `<ellipse cx="32" cy="32" rx="16" ry="26" fill="#FFB224" ${S}/>` +
        `<path d="M22 22 A16 20 0 0 1 27 13" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>` +
        face(32, 33, 0.95),
    },
    {
      key: 'diamond',
      color: '#8FD8EA',
      svg: `<path d="M18 12 L46 12 L57 26 L32 56 L7 26 Z" fill="#8FD8EA" ${S}/>` +
        `<path d="M7 26 L57 26 M18 12 L25 26 L32 56 M46 12 L39 26 L32 56" stroke="${INK}" stroke-width="2" fill="none" opacity=".4"/>` +
        face(32, 20, 0.7),
    },
    {
      key: 'pearl',
      color: '#E08A6E',
      svg: `<path d="M8 33 A24 21 0 0 0 56 33 Z" fill="#E08A6E" ${S}/>` +
        `<path d="M32 53 L18 36 M32 53 L32 34 M32 53 L46 36" stroke="${INK}" stroke-width="2" fill="none" opacity=".35"/>` +
        `<circle cx="32" cy="26" r="13" fill="#FFF6E5" ${S}/>` +
        face(32, 26, 0.8),
    },
    {
      key: 'citrine',
      color: '#FFDD33',
      svg: `<path d="M32 8 L57 51 L7 51 Z" fill="#FFDD33" ${S}/>` +
        `<path d="M27 20 L21 31" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` +
        face(32, 38, 0.95),
    },
    {
      key: 'heart',
      color: '#E93D82',
      svg: `<path d="M32 57 L9 31 L9 21 L18 12 L28 12 L32 18 L36 12 L46 12 L55 21 L55 31 Z" fill="#E93D82" ${S}/>` +
        `<path d="M13 22 L20 15" stroke="#FFF6E5" stroke-width="3" stroke-linecap="round" fill="none" opacity=".7"/>` +
        face(32, 31, 0.95),
    },
    {
      key: 'star',
      color: '#12A594',
      svg: `<path d="M32 6 L39 25 L58 32 L39 39 L32 58 L25 39 L6 32 L25 25 Z" fill="#12A594" ${S}/>` +
        face(32, 32, 0.8),
    },
    {
      key: 'cluster',
      color: '#B98AE0',
      svg: `<g fill="#B98AE0" ${S}>` +
        `<path d="M13 56 L13 36 L20 24 L27 36 L27 56 Z"/>` +
        `<path d="M41 56 L41 38 L48 28 L55 38 L55 56 Z"/>` +
        `<path d="M25 56 L25 24 L33 8 L41 24 L41 56 Z"/>` +
        `</g>` + face(33, 38, 0.85),
    },
    {
      key: 'geode',
      color: '#A18072',
      svg: `<path d="M6 52 A26 30 0 0 1 58 52 Z" fill="#A18072" ${S}/>` +
        `<path d="M14 52 A18 21 0 0 1 50 52 Z" fill="#FFF6E5" ${S}/>` +
        `<path d="M22 52 A10 12 0 0 1 42 52 Z" fill="#8E4EC6" ${S}/>` +
        face(32, 45, 0.8),
    },
  ],
}
