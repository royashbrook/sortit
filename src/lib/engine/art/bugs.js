// theme: Bug Garden. friendly garden bugs — interface and style follow
// art/shapes.js (the reference pack) and art/ART-SPEC.md.
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
  key: 'bugs',
  title: 'Bug Garden',
  tint: '#EFF7DE',
  items: [
    {
      key: 'ladybug',
      color: '#E5484D',
      svg: `<g ${S}><path d="M27 14 L21 8 M37 14 L43 8" fill="none"/>` +
        `<circle cx="32" cy="35" r="22" fill="#E5484D"/></g>` +
        `<g fill="${INK}"><circle cx="21" cy="8" r="2.2"/><circle cx="43" cy="8" r="2.2"/>` +
        `<circle cx="15" cy="30" r="2.6"/><circle cx="49" cy="30" r="2.6"/><circle cx="20" cy="47" r="2.6"/>` +
        `<circle cx="44" cy="47" r="2.6"/><circle cx="32" cy="53" r="2.6"/></g>` + face(32, 31),
    },
    {
      key: 'bee',
      color: '#FFC53D',
      svg: `<g ${S}><ellipse cx="23" cy="20" rx="8.5" ry="6.5" fill="#FFF6E5"/>` +
        `<ellipse cx="41" cy="20" rx="8.5" ry="6.5" fill="#FFF6E5"/>` +
        `<ellipse cx="32" cy="38" rx="17" ry="13" fill="#FFC53D"/>` +
        `<path d="M22.5 29 L22.5 47 M41.5 29 L41.5 47" fill="none"/></g>` + face(32, 37, 0.85),
    },
    {
      key: 'butterfly',
      color: '#E93D82',
      svg: `<g ${S}><path d="M30 20 L25 9 M34 20 L39 9" fill="none"/>` +
        `<g fill="#E93D82"><circle cx="19" cy="23" r="12.5"/><circle cx="45" cy="23" r="12.5"/>` +
        `<circle cx="21" cy="44" r="9.5"/><circle cx="43" cy="44" r="9.5"/></g>` +
        `<ellipse cx="32" cy="36" rx="6.5" ry="16" fill="#FFF6E5"/></g>` +
        `<circle cx="25" cy="9" r="2" fill="${INK}"/><circle cx="39" cy="9" r="2" fill="${INK}"/>` +
        `<circle cx="17" cy="22" r="3.5" fill="#FFF6E5"/><circle cx="47" cy="22" r="3.5" fill="#FFF6E5"/>` +
        face(32, 30, 0.6),
    },
    {
      key: 'caterpillar',
      color: '#99D52A',
      svg: `<g ${S}><path d="M13 26 L8 15 M20 25 L24 13" fill="none"/>` +
        `<g fill="#99D52A"><circle cx="49" cy="42" r="8"/><circle cx="40" cy="44" r="8"/>` +
        `<circle cx="31" cy="44" r="8"/><circle cx="23" cy="41" r="8"/><circle cx="16" cy="35" r="10.5"/></g></g>` +
        `<circle cx="8" cy="15" r="2" fill="${INK}"/><circle cx="24" cy="13" r="2" fill="${INK}"/>` +
        face(16, 36, 0.62),
    },
    {
      key: 'snail',
      color: '#AD7F58',
      svg: `<g ${S}><path d="M12 31 L8 22 M19 30 L23 20" fill="none"/>` +
        `<g fill="#FFF6E5"><rect x="11" y="44" width="44" height="10" rx="5"/><circle cx="15" cy="40" r="9.5"/></g>` +
        `<circle cx="40" cy="29" r="16" fill="#AD7F58"/><circle cx="40" cy="29" r="8" fill="none"/></g>` +
        `<circle cx="8" cy="22" r="2" fill="${INK}"/><circle cx="23" cy="20" r="2" fill="${INK}"/>` +
        face(15, 41, 0.6),
    },
    {
      key: 'ant',
      color: '#9C5A26',
      svg: `<g ${S}><path d="M28 41 L23 53 M33 43 L33 54 M38 41 L43 53 M13 26 L8 16 M22 25 L27 15" fill="none"/>` +
        `<g fill="#9C5A26"><circle cx="48" cy="34" r="10"/><circle cx="33" cy="37" r="7"/>` +
        `<circle cx="17" cy="34" r="10.5"/></g></g>` + face(17, 34, 0.62),
    },
    {
      key: 'dragonfly',
      color: '#3E63DD',
      svg: `<g ${S}><g fill="#FFF6E5"><ellipse cx="18" cy="30" rx="11" ry="4.5"/>` +
        `<ellipse cx="46" cy="30" rx="11" ry="4.5"/><ellipse cx="20" cy="40" rx="9" ry="4"/>` +
        `<ellipse cx="44" cy="40" rx="9" ry="4"/></g>` +
        `<rect x="29" y="22" width="6" height="32" rx="3" fill="#3E63DD"/>` +
        `<path d="M29 40 L35 40 M29 46 L35 46" stroke-width="2" opacity=".45" fill="none"/>` +
        `<circle cx="32" cy="15" r="9.5" fill="#3E63DD"/></g>` + face(32, 15, 0.62),
    },
    {
      key: 'beetle',
      color: '#8E4EC6',
      svg: `<g ${S}><path d="M18 28 L10 23 M16 38 L7 38 M18 47 L10 52 M46 28 L54 23 M48 38 L57 38 M46 47 L54 52 M26 18 L21 8 M38 18 L43 8" fill="none"/>` +
        `<ellipse cx="32" cy="37" rx="16" ry="20" fill="#8E4EC6"/>` +
        `<path d="M32 42 L32 55" fill="none"/></g>` + face(32, 30, 0.85),
    },
    {
      key: 'spider',
      color: '#12A594',
      svg: `<g ${S}><g fill="none"><path d="M20 21 Q9 16 7 25"/><path d="M17 26 Q6 27 6 37"/>` +
        `<path d="M18 32 Q8 37 10 46"/><path d="M21 37 Q13 45 16 52"/>` +
        `<path d="M44 21 Q55 16 57 25"/><path d="M47 26 Q58 27 58 37"/>` +
        `<path d="M46 32 Q56 37 54 46"/><path d="M43 37 Q51 45 48 52"/></g>` +
        `<circle cx="32" cy="29" r="15.5" fill="#12A594"/></g>` + face(32, 29, 0.95),
    },
    {
      key: 'grasshopper',
      color: '#46A758',
      svg: `<g ${S}><path d="M38 45 L50 26 L55 49 M24 48 L21 55 M31 49 L30 55 M12 26 L6 13 M18 25 L15 11" fill="none"/>` +
        `<ellipse cx="34" cy="40" rx="17" ry="9.5" fill="#46A758"/>` +
        `<circle cx="15" cy="33" r="9" fill="#46A758"/></g>` + face(15, 34, 0.6),
    },
    {
      key: 'firefly',
      color: '#F76B15',
      svg: `<g ${S}><circle cx="32" cy="44" r="11.5" fill="#FFE38C"/>` +
        `<ellipse cx="18" cy="28" rx="5.5" ry="10" fill="#FFF6E5" transform="rotate(-20 18 28)"/>` +
        `<ellipse cx="46" cy="28" rx="5.5" ry="10" fill="#FFF6E5" transform="rotate(20 46 28)"/>` +
        `<path d="M27 15 L22 6 M37 15 L42 6" fill="none"/>` +
        `<ellipse cx="32" cy="25" rx="10.5" ry="12" fill="#F76B15"/></g>` + face(32, 25, 0.72),
    },
    {
      key: 'rolypoly',
      color: '#9BB0C1',
      svg: `<g ${S} fill="none"><path d="M13 34 L6 26 M17 28 L13 19"/>` +
        `<path d="M17 45 L16 54 M25 45 L25 55 M33 45 L33 55 M41 45 L41 55 M49 45 L48 54"/>` +
        `<path d="M8 46 A24 24 0 0 1 56 46 Z" fill="#9BB0C1"/>` +
        `<path d="M41 26 L41 46 M49 31.5 L49 46"/></g>` + face(22, 37, 0.78),
    },
  ],
}
