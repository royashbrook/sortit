// theme: Rock Pool. follows art/ART-SPEC.md; shapes.js is the reference —
// same interface, same ink, same shared face so the sets read as one family.

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
  key: 'ocean',
  title: 'Rock Pool',
  tint: '#FBEFDC',
  items: [
    {
      key: 'fish',
      color: '#F76B15',
      svg: `<g fill="#F76B15" ${S}><path d="M44 32 L58 21 L58 43 Z"/><ellipse cx="27" cy="32" rx="20" ry="14"/><path d="M30 33 Q38 35 36 43 Q29 41 29 36 Z"/></g>` + face(21, 31, 0.9),
    },
    {
      key: 'crab',
      color: '#E5484D',
      svg: `<g fill="#E5484D" ${S}><line x1="20" y1="31" x2="13" y2="24"/><line x1="44" y1="31" x2="51" y2="24"/><circle cx="12" cy="19" r="6.5"/><circle cx="52" cy="19" r="6.5"/><line x1="19" y1="44" x2="9" y2="50"/><line x1="45" y1="44" x2="55" y2="50"/><line x1="22" y1="48" x2="15" y2="56"/><line x1="42" y1="48" x2="49" y2="56"/><circle cx="32" cy="38" r="15.5"/></g>` + face(32, 37),
    },
    {
      key: 'starfish',
      color: '#FFC53D',
      svg: `<path d="M32 6 L39.1 23.3 L57.7 24.7 L43.4 36.7 L47.9 54.8 L32 45 L16.1 54.8 L20.6 36.7 L6.3 24.7 L24.9 23.3 Z" fill="#FFC53D" ${S}/>` +
        `<circle cx="32" cy="15" r="1.7" fill="#FFF6E5"/><circle cx="14" cy="27" r="1.7" fill="#FFF6E5"/><circle cx="50" cy="27" r="1.7" fill="#FFF6E5"/>` + face(32, 32, 0.85),
    },
    {
      key: 'octopus',
      color: '#8E4EC6',
      svg: `<g fill="#8E4EC6" ${S}><path fill="none" d="M18 45 Q16 53 9 56"/><path fill="none" d="M27 45 Q26 55 20 58"/><path fill="none" d="M37 45 Q38 55 44 58"/><path fill="none" d="M46 45 Q48 53 55 56"/><path d="M12 31 A20 20 0 0 1 52 31 L52 40 Q52 45 47 45 L17 45 Q12 45 12 40 Z"/></g>` + face(32, 30),
    },
    {
      key: 'whale',
      color: '#3E63DD',
      svg: `<g fill="#3E63DD" ${S}><path fill="none" d="M23 17 Q21 10 16 9 M25 17 Q27 10 32 9"/><path d="M6 36 Q6 19 27 19 Q45 19 48 31 Q51 25 58 24 Q57 31 52 34 Q57 37 58 44 Q51 43 48 37 Q44 51 26 51 Q6 51 6 36 Z"/></g>` + face(22, 34, 0.95),
    },
    {
      key: 'turtle',
      color: '#46A758',
      svg: `<g fill="#46A758" ${S}><circle cx="50" cy="25" r="8"/><path d="M10 43 L5.5 46.5 L11 49 Z"/><ellipse cx="20" cy="49" rx="5" ry="4"/><ellipse cx="39" cy="49" rx="5" ry="4"/><path d="M9 40 a21 17 0 0 1 42 0 v1 q0 5 -5 5 H14 q-5 0 -5 -5 Z"/><path d="M14 34 h32 M24 25 v20 M37 25 v20" stroke-width="2" fill="none" opacity=".4"/></g>` + face(50, 25, 0.6),
    },
    {
      key: 'seahorse',
      color: '#E93D82',
      svg: `<g fill="#E93D82" ${S}><path d="M40 25 Q47 29 44 36 Q38 34 39 29 Z"/><path d="M12 11 Q22 4 31 7 Q41 10 41 20 Q41 31 35 38 Q30 43 30 47 Q30 52 35 53 Q30 57 25 53 Q20 49 24 42 Q17 40 16 31 Q16 27 20 25 Q17 21 18 17 L8 19 Q6 15 12 11 Z"/></g>` + face(28, 16, 0.7),
    },
    {
      key: 'jellyfish',
      color: '#7ED4C2',
      svg: `<g fill="#7ED4C2" ${S}><path fill="none" d="M20 37 Q16 43 20 48 Q23 52 20 55"/><path fill="none" d="M32 38 Q28 44 32 49 Q35 53 32 57"/><path fill="none" d="M44 37 Q40 43 44 48 Q47 52 44 55"/><path d="M10 33 A22 22 0 0 1 54 33 V35 A5.5 4 0 0 1 43 35 A5.5 4 0 0 1 32 35 A5.5 4 0 0 1 21 35 A5.5 4 0 0 1 10 35 Z"/></g>` + face(32, 26, 0.95),
    },
    {
      key: 'seashell',
      color: '#F7CE9B',
      svg: `<g fill="#F7CE9B" ${S}><path d="M32 56 L13 34 A11 11 0 0 1 24 22 A9 8 0 0 1 40 22 A11 11 0 0 1 51 34 Z"/><path d="M27 44 L20 30 M32 46 V24 M37 44 L44 30" stroke-width="2" fill="none" opacity=".4"/></g>` + face(32, 38, 0.8),
    },
    {
      key: 'pufferfish',
      color: '#BDEE63',
      svg: (() => {
        const pt = (rad, ang) => `${(32 + Math.cos(ang) * rad).toFixed(1)} ${(32 + Math.sin(ang) * rad).toFixed(1)}`
        return `<g fill="#BDEE63" ${S}>` +
          [22, 67, 112, 157, 202, 247, 292, 337].map(a => {
            const r = (a * Math.PI) / 180
            return `<path d="M ${pt(27, r)} L ${pt(16, r - 0.24)} L ${pt(16, r + 0.24)} Z"/>`
          }).join('') +
          `<circle cx="32" cy="32" r="16.5"/></g>` + face(32, 32, 0.95)
      })(),
    },
    {
      key: 'dolphin',
      color: '#9BB0C1',
      svg: `<g fill="#9BB0C1" ${S}><path d="M7 36 Q5 32 9 30 Q11 22 20 18 Q26 15 32 16 Q31 10 38 8 Q39 14 36 17 Q46 19 50 27 Q53 23 58 23 Q57 30 53 32 Q56 35 58 41 Q52 41 49 37 Q44 44 32 44 Q16 44 10 38 Q7 38 7 36 Z"/><path d="M26 35 Q33 37 31 44 Q24 43 23 38 Z"/></g>` + face(18, 28, 0.75),
    },
    {
      key: 'snail',
      color: '#AD7F58',
      svg: `<g fill="#F2C288" ${S}><line x1="48" y1="36" x2="46" y2="28"/><line x1="53" y1="38" x2="55" y2="29"/><circle cx="46" cy="26.5" r="2.4"/><circle cx="55.5" cy="27.5" r="2.4"/><path d="M42 32 Q56 32 56 45 v1 q0 4 -4 4 H10 q-4 0 -4 -4 q0 -8 11 -8 h20 Z"/><circle cx="24" cy="28" r="17" fill="#AD7F58"/><path d="M24 28 a6.5 6.5 0 0 1 6.5 6.5 a10 10 0 0 1 -15 6" fill="none" stroke-width="2" opacity=".45"/></g>` + face(49, 42, 0.62),
    },
  ],
}
