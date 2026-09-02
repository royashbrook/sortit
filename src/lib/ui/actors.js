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

// a pixel pickaxe: one readable steel head and a square wooden haft. the old
// curved head became a grey blob at phone size; hard steps survive scaling.
const PICKAXE =
  `<svg viewBox="0 0 72 72" aria-hidden="true" shape-rendering="crispEdges">` +
  `<path d="M8 66 L4 62 L48 18 L54 24 L12 68 Z" fill="#7A5233" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` +
  `<path d="M10 60 L46 24 L49 27 L13 63 Z" fill="#B77A45"/>` +
  `<path d="M18 8 H48 L67 21 L61 28 L46 18 H25 L12 31 L5 24 Z" fill="#BFC8CE" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
  `<path d="M23 11 H47 L58 19 H49 L44 16 H25 L17 24 H11 Z" fill="#EDF2F4" opacity=".85"/>` +
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
// moved run. motion: the skin's motion. returns a handle: `done` settles when
// the layer has removed itself, `cancel()` tears the performance down early
// (undo, reset, a skin change, unmount): every animation cancelled, every
// pending warp timer cleared, the layer gone, so nothing keeps performing
// over a board that no longer has that move.
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
  const animations = []
  const timers = []
  let live = true
  const cancel = () => {
    if (!live) return
    live = false
    for (const a of animations) a.cancel()
    for (const t of timers) clearTimeout(t)
    layer.remove()
  }

  // one decisive strike per block. one clear action reads better than the old
  // three-hit flutter and keeps a multi-block move from feeling like a queue.
  for (let k = n - 1; k >= 0; k--) {
    const at = rel(trips[k].from)
    const pick = el('div', 'actor pickaxe', PICKAXE)
    // keep the whole swing inside the board: a right-edge block is struck
    // from its left shoulder with the same tool mirrored mechanically.
    const fromLeft = at.x + side * 1.9 > board.width
    if (fromLeft) pick.classList.add('from-left')
    const left = fromLeft ? at.x - side * 0.9 : at.x + side * 0.72
    const ready = fromLeft ? 52 : -52
    const windup = fromLeft ? 62 : -62
    const impact = fromLeft ? -28 : 28
    const rest = fromLeft ? -24 : 24
    pick.style.cssText = `left:${left}px;top:${at.y - side * 0.34}px;width:${side * 1.18}px;height:${side * 1.18}px`
    layer.appendChild(pick)
    const delay = (n - 1 - k) * d
    const a = pick.animate([
      { transform: `rotate(${ready}deg) scale(.96)`, opacity: 0, offset: 0 },
      { transform: `rotate(${ready}deg) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `rotate(${windup}deg) scale(1)`, opacity: 1, easing: 'ease-out', offset: 0.34 },
      { transform: `rotate(${impact}deg) scale(1.04)`, opacity: 1, easing: 'cubic-bezier(.7,0,1,.5)', offset: 0.72 },
      { transform: `rotate(${rest}deg) scale(1)`, opacity: 1, offset: 0.84 },
      { transform: `rotate(${rest}deg) scale(1)`, opacity: 0, offset: 1 },
    ], { duration: S * 0.38, delay, easing: 'linear', fill: 'both' })
    animations.push(a)
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
  const appear = S * 0.34 + (n - 1) * d
  const arrive = S * 0.72
  const gone = S * 0.82 + n * d
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
  animations.push(w)
  settled.push(w.finished)
  // the held stack lets go as the blocks pop into place
  const held = who.querySelector('.held')
  if (held) {
    const h = held.animate([
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: arrive / total },
      { opacity: 0, offset: (arrive + S * 0.06) / total },
      { opacity: 0, offset: 1 },
    ], { duration: total, easing: 'linear', fill: 'both' })
    animations.push(h)
    settled.push(h.finished)
  }
  if (hooks.warp) {
    timers.push(setTimeout(() => { if (live) hooks.warp(top.from) }, appear))
    timers.push(setTimeout(() => { if (live) hooks.warp(dest.to) }, gone))
  }

  const done = Promise.allSettled(settled).then(() => { if (live) { live = false; layer.remove() } })
  return { done, cancel }
}
