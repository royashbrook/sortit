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

// our own blocky pickaxe: a broad cyan head and stepped wooden haft. the
// silhouette borrows the visual grammar of voxel tools without importing art.
const PICKAXE =
  `<svg viewBox="0 0 72 72" aria-hidden="true" shape-rendering="crispEdges">` +
  `<path class="pick-handle" d="M4 57 H12 V49 H20 V41 H28 V33 H36 V25 H48 V37 H40 V41 H32 V49 H24 V57 H16 V69 H4 Z" fill="${INK}"/>` +
  `<path d="M8 57 H16 V49 H24 V41 H32 V33 H40 V29 H44 V33 H36 V41 H28 V49 H20 V57 H12 V65 H8 Z" fill="#8B552F"/>` +
  `<path d="M12 57 H16 V53 H24 V45 H32 V37 H36 V33 H40 V29 H44 V33 H40 V37 H36 V41 H32 V45 H28 V49 H24 V53 H20 V57 H16 V61 H12 Z" fill="#C8894E"/>` +
  `<path class="pick-head" d="M3 13 H11 V9 H19 V5 H47 V9 H55 V13 H63 V17 H69 V29 H61 V25 H53 V21 H45 V29 H37 V25 H29 V21 H21 V25 H13 V33 H3 Z" fill="${INK}"/>` +
  `<path d="M7 15 H15 V11 H21 V9 H45 V13 H53 V17 H61 V21 H65 V25 H61 V21 H53 V17 H45 V21 H41 V25 H37 V21 H29 V17 H21 V21 H15 V25 H11 V29 H7 Z" fill="#27AFC1"/>` +
  `<path d="M15 11 H21 V9 H45 V13 H53 V17 H45 V17 H39 V21 H31 V17 H21 V21 H15 V25 H11 V21 H15 Z" fill="#7DE3E8"/>` +
  `<path d="M41 25 H45 V21 H53 V17 H61 V21 H65 V25 H61 V21 H53 V17 H45 V21 H41 Z" fill="#087D9A"/>` +
  `</svg>`

export function pickaxeSwing(x, side, boardWidth) {
  const toolOnLeft = x + side * 1.9 > boardWidth
  const direction = toolOnLeft ? 1 : -1
  return {
    toolOnLeft,
    left: toolOnLeft ? x - side * 0.9 : x + side * 0.72,
    ready: -52 * direction,
    windup: -62 * direction,
    impact: 28 * direction,
    rest: 24 * direction,
  }
}

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
    // the head always faces the source. most blocks are struck by a tool on
    // their right; right-edge blocks use the same swing from their left.
    const { toolOnLeft, left, ready, windup, impact, rest } = pickaxeSwing(at.x, side, board.width)
    if (!toolOnLeft) pick.classList.add('from-right')
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
