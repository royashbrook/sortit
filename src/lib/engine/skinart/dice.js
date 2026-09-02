// dice pieces: twelve polyhedral dice (d4 to d20), each set told apart by its
// shape, its colour, and its material (marble, speckle, glitter, metal,
// glass, pearl). no numbers on the faces: form and finish carry identity,
// which also keeps them readable at 40px. lit from the upper left so every
// die reads as a solid. viewBox 0 0 64 64.
//
// exports { pieces: [12 x { key, color, svg }], hidden: svg }

const INK = '#2A2220'
const C = { x: 32, y: 33 }

const pt = (r, deg) => [C.x + r * Math.cos(deg * Math.PI / 180), C.y + r * Math.sin(deg * Math.PI / 180)]
const poly = pts => pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
const centroid = pts => pts.reduce((a, [x, y]) => [a[0] + x / pts.length, a[1] + y / pts.length], [0, 0])

// a shape is its silhouette plus its visible faces. faces get their shade
// from where they sit: up and left is lit, down and right is shadow.
const SHAPES = {
  d4() {
    const a = [32, 6], b = [58, 54], c = [6, 54], m = [32, 36]
    return { outline: [a, b, c], faces: [[a, m, c], [a, b, m], [c, m, b]] }
  },
  d6() {
    const t = [[32, 7], [57, 20], [32, 33], [7, 20]]
    const l = [[7, 20], [32, 33], [32, 59], [7, 46]]
    const r = [[32, 33], [57, 20], [57, 46], [32, 59]]
    return { outline: [[32, 7], [57, 20], [57, 46], [32, 59], [7, 46], [7, 20]], faces: [t, l, r] }
  },
  d8() {
    const n = [32, 5], e = [59, 33], s = [32, 61], w = [5, 33], m = [32, 33]
    return { outline: [n, e, s, w], faces: [[n, m, w], [n, e, m], [w, m, s], [m, e, s]] }
  },
  d10() {
    const top = [32, 4], l = [7, 25], r = [57, 25], bl = [14, 60], br = [50, 60], il = [19, 28], ir = [45, 28], m = [32, 47]
    return {
      outline: [top, r, br, bl, l],
      faces: [[top, ir, m, il], [top, il, bl, l], [top, r, br, ir], [il, m, ir, br, bl]],
    }
  },
  d12() {
    const outer = Array.from({ length: 10 }, (_, i) => pt(28, -90 + i * 36))
    const inner = Array.from({ length: 5 }, (_, i) => pt(13, -90 + i * 72))
    const faces = [inner]
    for (let i = 0; i < 5; i++) {
      const a = inner[i], b = inner[(i + 1) % 5]
      faces.push([a, outer[(i * 2) % 10], outer[(i * 2 + 1) % 10], outer[(i * 2 + 2) % 10], b])
    }
    return { outline: outer, faces }
  },
  d20() {
    const outer = Array.from({ length: 6 }, (_, i) => pt(29, -90 + i * 60))
    const inner = Array.from({ length: 3 }, (_, i) => pt(15, -90 + i * 120))
    const faces = [inner]
    for (let i = 0; i < 3; i++) {
      const a = inner[i], b = inner[(i + 1) % 3]
      const oa = outer[i * 2], om = outer[i * 2 + 1], ob = outer[(i * 2 + 2) % 6]
      faces.push([a, oa, om], [a, om, b], [b, om, ob])
    }
    return { outline: outer, faces }
  },
}

// materials: a defs block and an overlay painted over the whole silhouette
const MATERIALS = {
  marble: (id, color) => ({
    defs: '',
    over: `<g opacity=".55" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"><path d="M10 40 q10 -14 22 -6 t20 -12"/><path d="M16 54 q8 -6 14 -2 t14 -10"/></g><g opacity=".22" fill="none" stroke="#000" stroke-width="1.4"><path d="M12 26 q12 6 20 -2 t22 4"/></g>`,
  }),
  speckle: () => ({
    defs: '',
    over: `<g fill="#fff" opacity=".8">${[[14, 22], [24, 14], [40, 12], [50, 24], [20, 36], [36, 30], [48, 42], [16, 50], [30, 46], [44, 54], [26, 56], [54, 36]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3"/>`).join('')}</g><g fill="#000" opacity=".35">${[[20, 26], [44, 20], [32, 40], [50, 48], [22, 46], [38, 56]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('')}</g>`,
  }),
  glitter: () => ({
    defs: '',
    over: `<g fill="#fff" opacity=".9">${[[16, 24], [28, 12], [42, 16], [50, 30], [22, 40], [36, 34], [46, 46], [18, 52], [32, 52], [52, 54]].map(([x, y]) => `<path d="M${x} ${y - 2.6} l.8 1.8 l1.8 .8 l-1.8 .8 l-.8 1.8 l-.8 -1.8 l-1.8 -.8 l1.8 -.8 z"/>`).join('')}</g>`,
  }),
  metal: (id) => ({
    defs: `<linearGradient id="${id}-m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".35" stop-color="#fff" stop-opacity=".05"/><stop offset=".5" stop-color="#000" stop-opacity=".18"/><stop offset=".7" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>`,
    over: `<rect x="0" y="0" width="64" height="64" fill="url(#${id}-m)"/>`,
  }),
  glass: (id) => ({
    defs: `<radialGradient id="${id}-g" cx=".32" cy=".25" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".4" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient>`,
    over: `<rect x="0" y="0" width="64" height="64" fill="url(#${id}-g)"/>`,
  }),
  pearl: (id) => ({
    defs: `<linearGradient id="${id}-p" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFD6E8" stop-opacity=".8"/><stop offset=".35" stop-color="#D6F0FF" stop-opacity=".7"/><stop offset=".7" stop-color="#E6FFE0" stop-opacity=".7"/><stop offset="1" stop-color="#FFF3C9" stop-opacity=".8"/></linearGradient>`,
    over: `<rect x="0" y="0" width="64" height="64" fill="url(#${id}-p)"/>`,
  }),
}

function die(key, shape, color, material) {
  const id = `die-${key}`
  const { outline, faces } = SHAPES[shape]()
  const mat = MATERIALS[material](id, color)
  const silhouette = `<polygon points="${poly(outline)}"/>`
  // face shading from position: up-left brightens, down-right darkens
  const shaded = faces.map(f => {
    const [cx, cy] = centroid(f)
    const light = ((C.x - cx) + (C.y - cy)) / 40 // -1 .. 1
    const fill = light >= 0 ? `#fff` : `#000`
    const opacity = Math.min(0.42, Math.abs(light) * 0.42 + 0.04).toFixed(2)
    return `<polygon points="${poly(f)}" fill="${fill}" opacity="${opacity}"/>`
  }).join('')
  const edges = faces.map(f => `<polygon points="${poly(f)}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" opacity=".55"/>`).join('')
  return (
    `<defs><clipPath id="${id}-c">${silhouette}</clipPath>${mat.defs}</defs>` +
    `<g clip-path="url(#${id}-c)">` +
    `<rect x="0" y="0" width="64" height="64" fill="${color}"/>` +
    shaded +
    mat.over +
    `</g>` +
    edges +
    `<polygon points="${poly(outline)}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`
  )
}

const SETS = [
  ['ruby d4', 'd4', '#D6323C', 'marble'],
  ['ivory d6', 'd6', '#F1E6CC', 'speckle'],
  ['sapphire d8', 'd8', '#2F6FE0', 'glass'],
  ['emerald d10', 'd10', '#2FA35C', 'glitter'],
  ['amethyst d12', 'd12', '#8A4DD0', 'marble'],
  ['obsidian d20', 'd20', '#2B2B33', 'glitter'],
  ['sunset d6', 'd6', '#F4772E', 'glass'],
  ['pearl d20', 'd20', '#E9EEF5', 'pearl'],
  ['bronze d8', 'd8', '#B0703A', 'metal'],
  ['teal d12', 'd12', '#1FA6A0', 'speckle'],
  ['gold d4', 'd4', '#E8B72C', 'metal'],
  ['rose d10', 'd10', '#F06AA8', 'glitter'],
]

export default {
  pieces: SETS.map(([key, shape, color, material]) => ({ key, color, svg: die(key.replace(/\s+/g, '-'), shape, color, material) })),
  // a mystery die: a cloth dice bag, still closed
  hidden:
    `<path d="M22 22 Q32 14 42 22 L50 52 Q32 62 14 52 Z" fill="#7A5C8E" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M20 24 Q32 30 44 24" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
    `<path d="M24 20 Q32 10 40 20" stroke="#C9A96A" stroke-width="3" fill="none" stroke-linecap="round"/>` +
    `<path d="M28 36 Q28 31 32 31 Q36 31 36 35 Q36 38 33 39 L33 41.5" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
    `<circle cx="33" cy="46" r="1.6" fill="#fff"/>`,
}
