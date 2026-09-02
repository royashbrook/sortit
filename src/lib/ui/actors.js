// actors: characters that perform a move on top of the board, timed to the
// same clock as the pieces' own flight. the mine conversion's move is a
// pickaxe that mines the source block, then a tall dark visitor who carries
// the block over and sets it down. everything is drawn svg, nothing loaded.
//
// an actor layer is one absolutely positioned div inside #board; it removes
// itself when the move's last animation settles. reduced-motion never gets
// here (the Board skips the animated path entirely).

const INK = '#0B0B14'

function el(tag, cls, html) {
  const node = document.createElement(tag)
  if (cls) node.className = cls
  if (html != null) node.innerHTML = html
  return node
}

// a stone pickaxe: wooden haft, iron head. drawn with the haft end at the
// origin so a rotation swings it like a real one.
const PICKAXE =
  `<svg viewBox="-4 -60 68 68" aria-hidden="true">` +
  `<path d="M0 0 L38 -38" stroke="#7A5233" stroke-width="7" stroke-linecap="round"/>` +
  `<path d="M0 0 L38 -38" stroke="#5A3A22" stroke-width="3" stroke-linecap="round" opacity=".6"/>` +
  `<path d="M22 -54 Q40 -60 56 -40 Q46 -38 40 -40 Q44 -30 38 -20 Q30 -34 22 -54 Z" fill="#B9B9B9" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` +
  `<path d="M26 -50 Q38 -52 48 -42" stroke="#E6E6E6" stroke-width="2" fill="none" stroke-linecap="round"/>` +
  `</svg>`

// the visitor: tall, thin, dark, with glowing violet eyes and long arms that
// hold the block out in front. body 64 wide by 150 tall in svg units; the
// block slot is a 40x40 square at (12, 58). an aesthetic tribute, ours.
function visitor(blockSvg) {
  return (
    `<svg viewBox="0 0 64 150" aria-hidden="true">` +
    `<rect x="24" y="4" width="16" height="16" rx="2" fill="${INK}"/>` +
    `<rect x="25" y="10" width="5" height="3" fill="#D46BFF"/><rect x="34" y="10" width="5" height="3" fill="#D46BFF"/>` +
    `<rect x="25" y="10" width="5" height="3" fill="#fff" opacity=".35"/><rect x="34" y="10" width="5" height="3" fill="#fff" opacity=".35"/>` +
    `<rect x="26" y="20" width="12" height="62" fill="${INK}"/>` +
    `<rect x="26" y="82" width="5" height="64" fill="${INK}"/><rect x="33" y="82" width="5" height="64" fill="${INK}"/>` +
    // arms reach forward and down to the block
    `<path d="M27 24 L10 62 L14 96" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M37 24 L54 62 L50 96" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<g class="held" transform="translate(12 58) scale(.625)">${blockSvg}</g>` +
    `</svg>`
  )
}

// trips: [{ from: DOMRect, to: DOMRect, svg, color }] bottom-to-top of the
// moved run. motion: the skin's motion. returns a promise for the layer's end.
export function mine(boardEl, trips, motion, hooks = {}) {
  const board = boardEl.getBoundingClientRect()
  const S = motion.seconds * 1000
  const d = (motion.stagger ?? 0) * 1000
  const n = trips.length
  const side = trips[0].from.width
  const layer = el('div', 'actor-layer')
  boardEl.appendChild(layer)
  const rel = r => ({ x: r.left - board.left, y: r.top - board.top })

  const settled = []

  // the pickaxe swings at each block from the top of the run down. a swing
  // is three quick chops across the block's own shudder window (0 .. .28S)
  for (let k = n - 1; k >= 0; k--) {
    const at = rel(trips[k].from)
    const pick = el('div', 'actor pickaxe', PICKAXE)
    // the haft's end sits just off the block's right shoulder so the head
    // swings down INTO the block rather than through it
    pick.style.cssText = `left:${at.x + side * 0.8}px;top:${at.y - side * 0.25}px;width:${side * 1.1}px;height:${side * 1.1}px`
    layer.appendChild(pick)
    const delay = (n - 1 - k) * d
    const a = pick.animate([
      { transform: 'rotate(-60deg)', opacity: 0, offset: 0 },
      { transform: 'rotate(-60deg)', opacity: 1, offset: 0.08 },
      { transform: 'rotate(28deg)', offset: 0.32 },
      { transform: 'rotate(-55deg)', offset: 0.5 },
      { transform: 'rotate(28deg)', offset: 0.7 },
      { transform: 'rotate(-55deg)', offset: 0.86 },
      { transform: 'rotate(30deg)', opacity: 1, offset: 0.96 },
      { transform: 'rotate(30deg)', opacity: 0, offset: 1 },
    ], { duration: S * 0.3, delay, easing: 'linear', fill: 'both' })
    settled.push(a.finished)
  }

  // the visitor appears where the run was, carrying the whole run, floats
  // across, and fades once the last block is set down
  const top = trips[n - 1]
  const dest = trips[0]
  const src = rel(top.from)
  const dst = rel(dest.to)
  const stackSvg = trips.map((t, i) => `<g transform="translate(0 ${-(i) * 64})">${t.svg}</g>`).join('')
  const who = el('div', 'actor visitor', visitor(stackSvg))
  const h = side * 2.35
  who.style.cssText = `left:${src.x}px;top:${src.y + side - h}px;width:${side}px;height:${h}px`
  layer.appendChild(who)
  const appear = S * 0.3 + (n - 1) * d
  const arrive = S * 0.8
  const gone = S * 0.86 + n * d
  const dx = dst.x - src.x
  const dy = (dst.y + side) - (src.y + side)
  const total = gone + S * 0.12
  const w = who.animate([
    { transform: 'translate(0px, 0px)', opacity: 0, offset: 0 },
    { transform: 'translate(0px, 0px)', opacity: 0, offset: appear / total },
    { transform: 'translate(0px, -6px)', opacity: 1, offset: (appear + S * 0.08) / total },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - side * 0.6}px)`, opacity: 1, easing: 'ease-in-out', offset: (appear + (arrive - appear) * 0.5) / total },
    { transform: `translate(${dx}px, ${dy}px)`, opacity: 1, offset: arrive / total },
    { transform: `translate(${dx}px, ${dy}px)`, opacity: 1, offset: gone / total },
    { transform: `translate(${dx}px, ${dy - 10}px)`, opacity: 0, offset: 1 },
  ], { duration: total, easing: 'linear', fill: 'both' })
  settled.push(w.finished)
  // the held stack lets go as the blocks pop into place
  const held = who.querySelector('.held')
  if (held) {
    settled.push(held.animate([
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: arrive / total },
      { opacity: 0, offset: (arrive + S * 0.06) / total },
      { opacity: 0, offset: 1 },
    ], { duration: total, easing: 'linear', fill: 'both' }).finished)
  }
  if (hooks.warp) {
    setTimeout(() => hooks.warp(top.from), appear)
    setTimeout(() => hooks.warp(dest.to), gone)
  }

  return Promise.allSettled(settled).then(() => layer.remove())
}
