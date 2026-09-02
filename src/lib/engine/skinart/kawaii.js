// kawaii pieces: twelve tiny round friends, every one a different creature so
// silhouettes sort as well as colours do. soft pastel bodies, a bold warm
// outline, dot eyes with a glint, a blush, and the smallest possible mouth.
// they hop between tubes with a squish (see flight.js 'squish'). viewBox
// 0 0 64 64.
//
// exports { pieces: [12 x { key, color, svg }], hidden: svg }

const INK = '#3D3230'
const SW = 2.6

// the face: two glinting dot eyes, a blush on each cheek, and a mouth
function face(cx, cy, spread = 8, mouth = 'w') {
  const mouths = {
    w: `<path d="M${cx - 3} ${cy + 5} q1.5 2.5 3 0 q1.5 2.5 3 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    smile: `<path d="M${cx - 3.5} ${cy + 4.5} q3.5 4 7 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    o: `<circle cx="${cx}" cy="${cy + 5.5}" r="1.8" fill="${INK}"/>`,
    cat: `<path d="M${cx - 3.5} ${cy + 4} q1.75 3 3.5 0 q1.75 3 3.5 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  }
  return (
    `<circle cx="${cx - spread}" cy="${cy}" r="2.6" fill="${INK}"/><circle cx="${cx + spread}" cy="${cy}" r="2.6" fill="${INK}"/>` +
    `<circle cx="${cx - spread + 1}" cy="${cy - 1}" r=".9" fill="#fff"/><circle cx="${cx + spread + 1}" cy="${cy - 1}" r=".9" fill="#fff"/>` +
    `<circle cx="${cx - spread - 4}" cy="${cy + 4}" r="2.6" fill="#FF8FB1" opacity=".55"/><circle cx="${cx + spread + 4}" cy="${cy + 4}" r="2.6" fill="#FF8FB1" opacity=".55"/>` +
    mouths[mouth]
  )
}

const body = (d, fill) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>`
const blob = (cx, cy, rx, ry, fill) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${INK}" stroke-width="${SW}"/>`

const pieces = [
  {
    key: 'bun', color: '#FFB7D2',
    svg:
      blob(24, 20, 5.5, 13, '#FFB7D2') + `<ellipse cx="24" cy="21" rx="2.5" ry="8" fill="#FF8FB1" opacity=".7"/>` +
      blob(40, 20, 5.5, 13, '#FFB7D2') + `<ellipse cx="40" cy="21" rx="2.5" ry="8" fill="#FF8FB1" opacity=".7"/>` +
      blob(32, 40, 21, 18, '#FFB7D2') + face(32, 39, 8, 'w'),
  },
  {
    key: 'kitty', color: '#C9CED8',
    svg:
      body('M14 34 L12 12 L28 22 L36 22 L52 12 L50 34 Z', '#C9CED8') +
      `<path d="M16 20 L19 27 L24 24 Z M48 20 L45 27 L40 24 Z" fill="#FFB7D2"/>` +
      blob(32, 40, 20, 17, '#C9CED8') + face(32, 39, 8, 'cat') +
      `<path d="M4 38 L14 40 M4 46 L14 44 M60 38 L50 40 M60 46 L50 44" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
  },
  {
    key: 'froggy', color: '#8FE08A',
    svg:
      `<circle cx="20" cy="22" r="8" fill="#8FE08A" stroke="${INK}" stroke-width="${SW}"/><circle cx="44" cy="22" r="8" fill="#8FE08A" stroke="${INK}" stroke-width="${SW}"/>` +
      blob(32, 40, 24, 17, '#8FE08A') +
      `<circle cx="20" cy="22" r="3" fill="${INK}"/><circle cx="44" cy="22" r="3" fill="${INK}"/><circle cx="21" cy="21" r="1" fill="#fff"/><circle cx="45" cy="21" r="1" fill="#fff"/>` +
      `<circle cx="16" cy="42" r="3" fill="#FF8FB1" opacity=".55"/><circle cx="48" cy="42" r="3" fill="#FF8FB1" opacity=".55"/>` +
      `<path d="M22 42 q10 8 20 0" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  },
  {
    key: 'bear', color: '#C9925E',
    svg:
      `<circle cx="16" cy="18" r="8" fill="#C9925E" stroke="${INK}" stroke-width="${SW}"/><circle cx="48" cy="18" r="8" fill="#C9925E" stroke="${INK}" stroke-width="${SW}"/>` +
      `<circle cx="16" cy="18" r="3.5" fill="#F2D2B0"/><circle cx="48" cy="18" r="3.5" fill="#F2D2B0"/>` +
      blob(32, 38, 22, 19, '#C9925E') +
      `<ellipse cx="32" cy="45" rx="9" ry="6.5" fill="#F2D2B0"/><ellipse cx="32" cy="42.5" rx="3.2" ry="2.4" fill="${INK}"/>` +
      face(32, 34, 9, 'smile'),
  },
  {
    key: 'chick', color: '#FFE66D',
    svg:
      body('M32 12 C46 12 54 26 54 40 C54 52 44 58 32 58 C20 58 10 52 10 40 C10 26 18 12 32 12 Z', '#FFE66D') +
      `<path d="M30 8 q2 -5 4 0 q-2 3 -4 0" fill="#FFB020"/>` +
      `<ellipse cx="14" cy="42" rx="5" ry="8" fill="#FFD84A" stroke="${INK}" stroke-width="2"/>` +
      face(34, 32, 7, 'o') + `<path d="M31 37.5 L37 37.5 L34 41 Z" fill="#FFB020" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
  },
  {
    key: 'piggy', color: '#FFA48B',
    svg:
      `<path d="M14 26 L10 12 L24 20 Z M50 26 L54 12 L40 20 Z" fill="#FFA48B" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round"/>` +
      blob(32, 38, 22, 19, '#FFA48B') +
      `<ellipse cx="32" cy="44" rx="8" ry="5.5" fill="#FF8A6E" stroke="${INK}" stroke-width="2"/><circle cx="29" cy="44" r="1.4" fill="${INK}"/><circle cx="35" cy="44" r="1.4" fill="${INK}"/>` +
      face(32, 33, 9, 'w'),
  },
  {
    key: 'whale', color: '#7FB8FF',
    svg:
      body('M8 40 C8 24 20 16 34 16 C48 16 56 26 56 38 C56 48 48 54 34 54 C20 54 8 50 8 40 Z', '#7FB8FF') +
      body('M50 30 L62 20 L60 34 L62 44 L48 40 Z', '#7FB8FF') +
      `<path d="M30 16 q-2 -8 4 -10 M30 16 q4 -8 8 -6" stroke="#7FB8FF" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
      `<ellipse cx="26" cy="46" rx="14" ry="6" fill="#DDEFFF"/>` +
      face(28, 34, 8, 'smile'),
  },
  {
    key: 'star', color: '#C58CFF',
    svg:
      body('M32 6 L39 24 L58 25 L43 37 L48 56 L32 45 L16 56 L21 37 L6 25 L25 24 Z', '#C58CFF') +
      face(32, 32, 7, 'smile'),
  },
  {
    key: 'cloud', color: '#DDEFFF',
    svg:
      `<circle cx="20" cy="36" r="12" fill="#DDEFFF" stroke="${INK}" stroke-width="${SW}"/><circle cx="34" cy="28" r="14" fill="#DDEFFF" stroke="${INK}" stroke-width="${SW}"/><circle cx="46" cy="38" r="11" fill="#DDEFFF" stroke="${INK}" stroke-width="${SW}"/>` +
      `<rect x="14" y="36" width="38" height="14" rx="7" fill="#DDEFFF"/><path d="M10 44 q22 10 44 0" stroke="${INK}" stroke-width="${SW}" fill="none" stroke-linecap="round"/>` +
      `<circle cx="20" cy="36" r="12" fill="#DDEFFF"/><circle cx="34" cy="28" r="14" fill="#DDEFFF"/><circle cx="46" cy="38" r="11" fill="#DDEFFF"/>` +
      face(33, 34, 8, 'w'),
  },
  {
    key: 'onigiri', color: '#FFFFFF',
    svg:
      body('M32 8 C40 8 54 34 56 44 C57 50 52 54 46 54 L18 54 C12 54 7 50 8 44 C10 34 24 8 32 8 Z', '#FFFFFF') +
      `<path d="M20 54 L20 42 C20 40 22 38 24 38 L40 38 C42 38 44 40 44 42 L44 54 Z" fill="#2F3B2A" stroke="${INK}" stroke-width="2"/>` +
      face(32, 28, 7, 'w'),
  },
  {
    key: 'mochi', color: '#B8F0D8',
    svg:
      body('M32 14 C46 14 56 26 56 40 C56 50 46 56 32 56 C18 56 8 50 8 40 C8 26 18 14 32 14 Z', '#B8F0D8') +
      `<ellipse cx="32" cy="14" rx="7" ry="4" fill="#DDF8EC" stroke="${INK}" stroke-width="2"/>` +
      `<ellipse cx="26" cy="24" rx="5" ry="2.5" fill="#fff" opacity=".7"/>` +
      face(32, 36, 8, 'o'),
  },
  {
    key: 'bee', color: '#FFB020',
    svg:
      `<ellipse cx="22" cy="20" rx="9" ry="6" fill="#DDEFFF" stroke="${INK}" stroke-width="2" opacity=".9"/><ellipse cx="42" cy="20" rx="9" ry="6" fill="#DDEFFF" stroke="${INK}" stroke-width="2" opacity=".9"/>` +
      blob(32, 38, 22, 17, '#FFB020') +
      `<path d="M14 30 q18 -6 36 0 M13 45 q19 6 38 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>` +
      `<path d="M26 22 L22 12 M38 22 L42 12" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><circle cx="22" cy="12" r="2" fill="${INK}"/><circle cx="42" cy="12" r="2" fill="${INK}"/>` +
      face(32, 37, 8, 'smile'),
  },
]

export default {
  pieces,
  // a mystery friend: a lavender egg, still deciding who to be
  hidden:
    body('M32 8 C46 8 54 24 54 40 C54 52 44 58 32 58 C20 58 10 52 10 40 C10 24 18 8 32 8 Z', '#D9C7FF') +
    `<path d="M27 26 Q27 19 32 19 Q37 19 37 25 Q37 29 33 30.5 L33 34" stroke="${INK}" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33" cy="40" r="2.2" fill="${INK}"/>` +
    `<circle cx="20" cy="42" r="3" fill="#FF8FB1" opacity=".55"/><circle cx="44" cy="42" r="3" fill="#FF8FB1" opacity=".55"/>`,
}
