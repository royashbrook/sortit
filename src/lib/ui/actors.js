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

// A long wooden haft and a narrow, hooked metal head. The two are visibly
// separate even at phone size. Original pixel art, no downloaded game assets.
const PICKAXE =
  `<svg viewBox="0 0 72 72" aria-hidden="true" shape-rendering="crispEdges">` +
  `<path class="pick-handle" d="M30 15H42V66H30Z" fill="#302820"/>` +
  `<path d="M33 19H39V63H33Z" fill="#A46936"/>` +
  `<path d="M33 22H35V60H33Z" fill="#E2B16A"/>` +
  `<path d="M35 34H39V38H35ZM35 48H39V52H35ZM33 60H39V63H33Z" fill="#704328"/>` +
  `<path class="pick-head" d="M6 30V19H10V15H14V11H22V7H50V11H58V15H62V19H66V30H60V24H56V20H48V18H24V20H16V24H12V30Z" fill="#143C46"/>` +
  `<path d="M9 25V20H13V16H17V13H25V10H47V13H55V16H59V20H63V25H62V22H58V18H49V15H23V18H14V22H10V25Z" fill="#40CDD2"/>` +
  `<path d="M17 13H25V10H47V13H25V15H17ZM13 16H17V19H13Z" fill="#BAFFFF"/>` +
  `<path d="M48 15H55V17H59V20H63V25H62V22H58V18H49Z" fill="#178899"/>` +
  `<path d="M31 10H41V19H31Z" fill="#215462"/><path d="M33 11H39V16H33Z" fill="#6AF0EC"/>` +
  `</svg>`

export function pickaxeSwing(x, side, boardWidth) {
  const toolOnLeft = x + side * 2.1 > boardWidth
  const direction = toolOnLeft ? 1 : -1
  const impact = 28 * direction
  // Rotate around the grip, then place the striking tip ON the source face.
  // The former corner pivot swung the handle into the block instead.
  const angle = impact * Math.PI / 180
  const tipX = 30 * direction, tipY = -35
  const size = side * 1.2
  return {
    toolOnLeft,
    left: x + side * (toolOnLeft ? .26 : .8) - (tipX * Math.cos(angle) - tipY * Math.sin(angle) + 36) * size / 72,
    top: side * .30 - (tipX * Math.sin(angle) + tipY * Math.cos(angle) + 65) * size / 72,
    size,
    ready: -52 * direction,
    windup: -62 * direction,
    impact,
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
  // Selection enlarges the measured source. The departure flight renders at
  // scale(1), so aim at the actual piece size, not that transient enlargement.
  const side = trips[0].to.width
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
    const { toolOnLeft, left, top, size, ready, windup, impact, rest } = pickaxeSwing(at.x, side, board.width)
    if (!toolOnLeft) pick.classList.add('from-right')
    pick.style.cssText = `left:${left}px;top:${at.y + top}px;width:${size}px;height:${size}px`
    layer.appendChild(pick)
    const delay = (n - 1 - k) * d
    const a = pick.animate([
      { transform: `rotate(${ready}deg) scale(.96)`, opacity: 0, offset: 0 },
      { transform: `rotate(${ready}deg) scale(1)`, opacity: 1, offset: 0.12 },
      { transform: `rotate(${windup}deg) scale(1)`, opacity: 1, easing: 'ease-out', offset: 0.34 },
      { transform: `rotate(${impact}deg) scale(1)`, opacity: 1, easing: 'cubic-bezier(.7,0,1,.5)', offset: 0.72 },
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
