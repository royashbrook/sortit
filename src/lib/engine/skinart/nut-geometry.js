// A shallow orthographic hex prism. Body height is exactly the stack pitch,
// so the upper nut hides the lower crown. No mesh engine required.
const RADIUS = 30, DEPTH = .32, PITCH = 40, TOP = -RADIUS * DEPTH
const point = (p, y = 0) => `${p.x.toFixed(3)} ${(p.y + y).toFixed(3)}`
const polygon = points => `M${points.join('L')}Z`
const blend = (color, target, amount) => '#' + [1, 3, 5].map(i =>
  Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - amount) + target * amount).toString(16).padStart(2, '0')
).join('')

export function nutGeometry(turn = 0) {
  const vertices = Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI / 3 + turn
    return { x: 32 + RADIUS * Math.cos(angle), y: TOP + RADIUS * DEPTH * Math.sin(angle) }
  })
  const faces = vertices.flatMap((a, i) => {
    const b = vertices[(i + 1) % 6]
    // Visible edges run right to left in this projection.
    if (a.x - b.x < .001) return []
    return [{ index: i, a, b, width: a.x - b.x, slope: (a.y - b.y) / (a.x - b.x) }]
  })
  return { vertices, faces }
}

export function renderNut(key, color, lit, shade, mark, turn = 0, postTip = -1000, id = `preview-${key}`) {
  const { vertices, faces } = nutGeometry(turn)
  const crown = polygon(vertices.map(v => point(v)))
  // The shaft occludes the BACK of the crown as well as passing through its
  // bore. Cut only where the actual post exists. In free flight it is a hole,
  // not a notch. Clipping to the crown keeps the cut from painting outside it.
  const hole = postTip !== null && postTip < TOP - 2.654
    ? `M22 ${postTip}H42V${TOP - 2.654}A12 4.8 0 1 1 22 ${TOP - 2.654}Z`
    : `M20 ${TOP}a12 4.8 0 1 0 24 0a12 4.8 0 1 0 -24 0Z`
  const body = faces.map(({ index, a, b, width, slope }) => {
    const light = Math.max(-.38, Math.min(.22, -.10 - slope * 1.3))
    const fill = blend(color, light > 0 ? 255 : 0, Math.abs(light))
    const face = polygon([point(a), point(b), point(b, PITCH), point(a, PITCH)])
    const bevel = polygon([point(a), point(b), point(b, 3.2), point(a, 3.2)])
    const foot = polygon([point(a, PITCH - 3), point(b, PITCH - 3), point(b, PITCH), point(a, PITCH)])
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2 + PITCH * .53
    // The mark belongs to the facet and compresses with its perspective.
    return `<g class="nut-facet"><path d="${face}" fill="${fill}" stroke="${shade}" stroke-width=".65" stroke-linejoin="round"/>` +
      `<path d="${bevel}" fill="#fff" opacity=".25"/><path d="${foot}" fill="#000" opacity=".14"/>` +
      (index === 1 ? `<g color="#fffaf0" transform="matrix(${width / 30} ${width / 30 * slope} 0 1 ${cx} ${cy})">${mark}</g>` : '') + '</g>'
  }).join('')
  return `<g class="nut-shell" data-nut="${key}" data-art-id="${id}" data-turn="${turn.toFixed(4)}">` +
    `<defs><clipPath id="${id}-crown"><path d="${crown}"/></clipPath></defs>` +
    `<path class="nut-crown" clip-path="url(#${id}-crown)" d="${crown}${hole}" fill="${lit}" fill-rule="evenodd"/>` +
    `<path class="nut-bore" d="M20 ${TOP}a12 4.8 0 0 0 24 0" fill="none" stroke="#53616B" stroke-width="1.5"/>` +
    body + '</g>'
}
