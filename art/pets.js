// theme: Pet Party. follows art/ART-SPEC.md and mirrors shapes.js, the
// reference pack: distinct silhouette AND distinct colour per item, same
// shared friendly face so the family reads as one set.

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
  key: 'pets',
  title: 'Pet Party',
  tint: '#FFE9DA',
  items: [
    {
      key: 'dog',
      color: '#A9743F',
      svg: `<g ${S}><ellipse cx="11" cy="32" rx="7" ry="14" fill="#7E5230"/><ellipse cx="53" cy="32" rx="7" ry="14" fill="#7E5230"/><circle cx="32" cy="34" r="20" fill="#A9743F"/></g>` +
        `<ellipse cx="32" cy="42" rx="9" ry="7" fill="#F2E1C6"/><circle cx="32" cy="36.5" r="2.2" fill="${INK}"/>` + face(32, 34),
    },
    {
      key: 'cat',
      color: '#8B93A6',
      svg: `<g ${S} fill="#8B93A6"><path d="M15 27 L17 7 L31 15 Z"/><path d="M49 27 L47 7 L33 15 Z"/><circle cx="32" cy="36" r="19"/></g>` +
        `<g stroke="${INK}" stroke-width="2" stroke-linecap="round"><line x1="8" y1="33" x2="16" y2="34"/><line x1="8" y1="41" x2="16" y2="39"/><line x1="56" y1="33" x2="48" y2="34"/><line x1="56" y1="41" x2="48" y2="39"/></g>` + face(32, 36),
    },
    {
      key: 'bunny',
      color: '#B08CE0',
      svg: `<g ${S} fill="#B08CE0"><ellipse cx="23" cy="17" rx="6" ry="12.5"/><ellipse cx="41" cy="17" rx="6" ry="12.5"/></g>` +
        `<ellipse cx="23" cy="18" rx="2.8" ry="8" fill="#E9C7E0"/><ellipse cx="41" cy="18" rx="2.8" ry="8" fill="#E9C7E0"/>` +
        `<circle cx="32" cy="40" r="17" fill="#B08CE0" ${S}/>` + face(32, 40),
    },
    {
      key: 'hamster',
      color: '#EFD9A7',
      svg: `<g ${S} fill="#EFD9A7"><circle cx="19" cy="19" r="5"/><circle cx="45" cy="19" r="5"/><path d="M11 40 C11 24 20 17 32 17 C44 17 53 24 53 40 C53 52 44 57 32 57 C20 57 11 52 11 40 Z"/><circle cx="25" cy="53" r="3.5"/><circle cx="39" cy="53" r="3.5"/></g>` +
        `<circle cx="17" cy="41" r="5" fill="#E2BC72"/><circle cx="47" cy="41" r="5" fill="#E2BC72"/>` + face(32, 37),
    },
    {
      key: 'parrot',
      color: '#43A047',
      svg: `<g ${S}><g fill="#E3572B"><circle cx="24" cy="11" r="4.5"/><circle cx="40" cy="11" r="4.5"/><path d="M25 51 L32 60 L39 51 Z"/></g><circle cx="32" cy="8.5" r="4.5" fill="#F4913B"/><ellipse cx="32" cy="34" rx="17" ry="21" fill="#43A047"/><g fill="#2E7D32"><path d="M17 31 C9 36 9 47 16 52 C20 47 20 36 17 31 Z"/><path d="M47 31 C55 36 55 47 48 52 C44 47 44 36 47 31 Z"/></g><path d="M29.5 32 L34.5 32 L32 36.5 Z" fill="#F7D14B" stroke-width="2"/></g>` + face(32, 35),
    },
    {
      key: 'goldfish',
      color: '#F4913B',
      svg: `<g ${S} fill="#F4913B"><path d="M40 34 L57 22 C53 33 53 39 57 50 L40 38 Z"/><path d="M20 25 C22 15 32 15 35 25 Z"/><ellipse cx="26" cy="37" rx="17" ry="13"/></g>` +
        `<circle cx="14" cy="20" r="2.5" fill="none" stroke="${INK}" stroke-width="2"/>` + face(24, 37, 0.85),
    },
    {
      key: 'mouse',
      color: '#C9D2DE',
      svg: `<g ${S} fill="#C9D2DE"><circle cx="17" cy="17" r="9.5"/><circle cx="47" cy="17" r="9.5"/><path d="M46 51 C56 50 58 42 51 39" fill="none"/></g>` +
        `<circle cx="17" cy="17" r="4.5" fill="#F2A0BC"/><circle cx="47" cy="17" r="4.5" fill="#F2A0BC"/>` +
        `<circle cx="32" cy="38" r="17" fill="#C9D2DE" ${S}/>` + face(32, 38),
    },
    {
      key: 'hedgehog',
      color: '#6E4B33',
      svg: `<path d="M13 54 L6 44 L15 41 L10 29 L20 31 L19 17 L28 24 L32 9 L37 23 L45 15 L45 28 L54 24 L51 36 L59 39 L51 46 L55 54 Z" fill="#6E4B33" ${S}/>` +
        `<ellipse cx="32" cy="44" rx="13" ry="9.5" fill="#ECCB9C" ${S}/>` + face(32, 44, 0.8),
    },
    {
      key: 'duck',
      color: '#F7D14B',
      svg: `<g ${S} fill="#F7D14B"><path d="M50 41 L59 30 L57 46 Z"/><ellipse cx="33" cy="46" rx="22" ry="12"/><ellipse cx="40" cy="46" rx="8" ry="5.5" fill="#E8B04B"/><circle cx="22" cy="25" r="13"/><ellipse cx="10.5" cy="28" rx="5.5" ry="3.5" fill="#F4913B" stroke-width="2.5"/></g>` + face(23, 25, 0.8),
    },
    {
      key: 'pig',
      color: '#F2A0BC',
      svg: `<g ${S} fill="#F2A0BC"><path d="M13 29 C6 15 19 5 26 14 Z"/><path d="M51 29 C58 15 45 5 38 14 Z"/><ellipse cx="32" cy="37" rx="23" ry="17"/></g>` +
        `<ellipse cx="32" cy="37.5" rx="4" ry="3" fill="#DE7BA4" stroke="${INK}" stroke-width="2"/><circle cx="30.5" cy="37.5" r="1" fill="${INK}"/><circle cx="33.5" cy="37.5" r="1" fill="${INK}"/>` + face(32, 38, 1.15),
    },
    {
      key: 'fox',
      color: '#E3572B',
      svg: `<g ${S} fill="#E3572B"><path d="M13 27 L14 5 L29 12 Z"/><path d="M51 27 L50 5 L35 12 Z"/><path d="M32 58 L8 33 C7 17 18 12 32 17 C46 12 57 17 56 33 Z"/></g>` +
        `<path d="M32 57 L15 34 C25 42 39 42 49 34 Z" fill="#F6E7D3"/><circle cx="32" cy="40.5" r="2" fill="${INK}"/>` + face(32, 34, 0.95),
    },
    {
      key: 'owl',
      color: '#2A9D8F',
      svg: `<g ${S} fill="#2A9D8F"><path d="M15 21 L10 6 L26 11 Z"/><path d="M49 21 L54 6 L38 11 Z"/><ellipse cx="32" cy="36" rx="20" ry="22"/><path d="M16 33 C12 41 13 50 19 54 C22 48 21 39 16 33 Z"/><path d="M48 33 C52 41 51 50 45 54 C42 48 43 39 48 33 Z"/><g fill="#F6E7D3"><circle cx="26.5" cy="34.5" r="5"/><circle cx="37.5" cy="34.5" r="5"/></g><path d="M29.5 33 L34.5 33 L32 37.5 Z" fill="#F4913B" stroke-width="2"/></g>` + face(32, 36),
    },
  ],
}
