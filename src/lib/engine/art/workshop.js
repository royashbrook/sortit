// theme: The Workshop. tools with faces. interface + rules per art/ART-SPEC.md;
// art/shapes.js is the reference pack — same ink, same face, same feel.
//
// house rule: pieces differ by FORM as well as colour, so a colourblind kid
// can always play. bolt = flat hex head + straight shaft, screw = dome head +
// pointy tapered shaft, hammer = cross-peen block, wrench = notched round head.

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
  key: 'workshop',
  title: 'The Workshop',
  tint: '#F5EAD9',
  items: [
    {
      key: 'bolt',
      color: '#6E82A0',
      svg: `<g ${S}><rect x="24" y="21" width="16" height="35" rx="3" fill="#6E82A0"/>` +
        `<path d="M13 8 L51 8 L48 21 L16 21 Z" fill="#6E82A0"/>` +
        `<line x1="26" y1="41" x2="38" y2="38"/><line x1="26" y1="49" x2="38" y2="46"/></g>` +
        face(32, 14.5, 0.75),
    },
    {
      key: 'nut',
      color: '#C9A227',
      svg: `<polygon points="16,8 48,8 58,32 48,56 16,56 6,32" fill="#C9A227" ${S}/>` +
        `<circle cx="32" cy="19" r="5" fill="#FFF6E5" ${S}/>` + face(32, 38),
    },
    {
      key: 'screw',
      color: '#9BB0C1',
      svg: `<g ${S}><path d="M24 22 L40 22 L32 57 Z" fill="#9BB0C1"/>` +
        `<path d="M18 22 A14 14 0 0 1 46 22 Z" fill="#9BB0C1"/>` +
        `<line x1="28" y1="10.5" x2="36" y2="10.5"/>` +
        `<line x1="26.5" y1="31" x2="37.5" y2="29"/><line x1="28" y1="39" x2="36" y2="37"/><line x1="30" y1="47" x2="34" y2="45"/></g>` +
        face(32, 16, 0.7),
    },
    {
      key: 'gear',
      color: '#F76B15',
      svg: `<g fill="#F76B15" ${S}>` +
        [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
          const t = (a * Math.PI) / 180
          const c = Math.cos(t), s = Math.sin(t)
          const p = (r, w) => `${Math.round(32 + c * r - s * w)},${Math.round(32 + s * r + c * w)}`
          const q = (r, w) => `${Math.round(32 + c * r + s * w)},${Math.round(32 + s * r - c * w)}`
          return `<polygon points="${p(17, 6)} ${p(26, 4)} ${q(26, 4)} ${q(17, 6)}"/>`
        }).join('') +
        `<circle cx="32" cy="32" r="20" fill="#F76B15"/></g>` + face(32, 32),
    },
    {
      key: 'spring',
      color: '#12A594',
      svg: `<g fill="#12A594" ${S}><ellipse cx="32" cy="46" rx="17" ry="8.5"/>` +
        `<ellipse cx="32" cy="32" rx="17" ry="8.5"/>` +
        `<ellipse cx="32" cy="18" rx="17" ry="8.5"/></g>` + face(32, 33.5, 0.62),
    },
    {
      key: 'wrench',
      color: '#3E63DD',
      svg: `<rect x="27" y="24" width="10" height="34" rx="4.5" fill="#3E63DD" ${S}/>` +
        `<path d="M24 6 L32 16 L40 6 A13.6 13.6 0 1 1 24 6 Z" fill="#3E63DD" ${S}/>` +
        face(32, 23, 0.62),
    },
    {
      key: 'hammer',
      color: '#5C6B7A',
      svg: `<rect x="22" y="24" width="9" height="32" rx="4" fill="#D9A066" ${S}/>` +
        `<polygon points="12,8 40,8 54,16.5 40,25 12,25" fill="#5C6B7A" ${S}/>` +
        face(26, 16.5, 0.7),
    },
    {
      key: 'brush',
      color: '#E93D82',
      svg: `<g ${S}><rect x="28" y="5" width="8" height="20" rx="3" fill="#C98E5A"/>` +
        `<rect x="25" y="24" width="14" height="9" rx="2" fill="#9BB0C1"/>` +
        `<path d="M25 33 C19 39 18 46 19 52 Q25 57 32 57 Q39 57 45 52 C46 46 45 39 39 33 Z" fill="#E93D82"/></g>` +
        face(32, 45, 0.72),
    },
    {
      key: 'ruler',
      color: '#AD7F58',
      svg: `<rect x="20" y="6" width="24" height="52" rx="3" fill="#AD7F58" ${S}/>` +
        `<g stroke="${INK}" stroke-width="2" stroke-linecap="round"><line x1="20" y1="13" x2="28" y2="13"/><line x1="20" y1="22" x2="24" y2="22"/><line x1="20" y1="31" x2="28" y2="31"/><line x1="20" y1="40" x2="24" y2="40"/><line x1="20" y1="49" x2="28" y2="49"/></g>` +
        face(35, 32, 0.72),
    },
    {
      key: 'magnet',
      color: '#E5484D',
      svg: `<path d="M14 56 V30 A18 18 0 0 1 50 30 V56 H38 V32 A6 6 0 0 0 26 32 V56 Z" fill="#E5484D" ${S}/>` +
        `<rect x="14" y="47" width="12" height="9" fill="#FFF6E5" ${S}/><rect x="38" y="47" width="12" height="9" fill="#FFF6E5" ${S}/>` +
        face(32, 19, 0.72),
    },
    {
      key: 'bulb',
      color: '#FFC53D',
      svg: `<rect x="25" y="40" width="14" height="15" rx="3.5" fill="#C7CFD6" ${S}/>` +
        `<line x1="26" y1="46" x2="38" y2="46" stroke="${INK}" stroke-width="2"/><line x1="26" y1="50" x2="38" y2="50" stroke="${INK}" stroke-width="2"/>` +
        `<circle cx="32" cy="25" r="17" fill="#FFC53D" ${S}/>` +
        `<circle cx="25.5" cy="18.5" r="2.4" fill="#FFF6E5"/>` + face(32, 26),
    },
    {
      key: 'paintcan',
      color: '#46A758',
      svg: `<path d="M16 18 A22 22 0 0 1 48 18" fill="none" ${S}/>` +
        `<rect x="14" y="20" width="36" height="36" rx="4" fill="#46A758" ${S}/>` +
        `<ellipse cx="32" cy="20" rx="19" ry="5.5" fill="#C7CFD6" ${S}/>` +
        `<ellipse cx="32" cy="20" rx="13" ry="3" fill="#46A758" stroke="${INK}" stroke-width="2"/>` +
        face(32, 40, 0.9),
    },
  ],
}
