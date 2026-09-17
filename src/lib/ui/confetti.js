// a short skin-themed canvas confetti burst for wins. self-contained: creates its
// canvas, animates, removes it. honours prefers-reduced-motion by doing
// nothing, which is the correct celebration for that setting.
import { drawConfettiPiece } from './confetti-art.js'

// the burst on screen, if any: a new board takes it down before its time
let active = null

export function clearConfetti() {
  if (!active) return
  cancelAnimationFrame(active.frame)
  active.canvas.remove()
  active = null
}

export function confetti(colors, skin = 'tubes') {
  clearConfetti()
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // capture size ONCE: a rotation mid-burst must not smear a mismatched
  // clearRect, and dpr is capped like the game canvas: a dpr-3 phone does
  // not need a ~40MB backing store for a two-second effect.
  const W = innerWidth
  const H = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.dataset.skin = skin
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  const g = canvas.getContext('2d')
  if (!g) return
  g.scale(dpr, dpr)

  // At most 36 tiny stamps for the twelve-colour palette. Shapes are painted
  // once per burst, not rebuilt for every falling piece on every phone frame.
  const stamps = colors.map(color => Array.from({ length: 3 }, (_, variant) => {
    const stamp = document.createElement('canvas')
    stamp.className = 'confetti-stamp'
    stamp.width = stamp.height = Math.ceil(24 * dpr)
    const paint = stamp.getContext('2d')
    if (!paint) return null
    paint.scale(stamp.width / 24, stamp.height / 24)
    paint.translate(12, 12)
    drawConfettiPiece(paint, skin, color, variant)
    return stamp
  }))
  if (stamps.some(variants => variants.some(stamp => !stamp))) return
  document.body.append(canvas)

  // spawn band is shallow and fall speed floored so every piece the burst
  // pays for actually crosses the screen within its lifetime
  const pieces = Array.from({ length: 96 }, (_, i) => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.3,
    size: 14 + Math.random() * 8,
    vy: 190 + Math.random() * 170,
    vx: -40 + Math.random() * 80,
    rot: Math.random() * Math.PI,
    vr: -4 + Math.random() * 8,
    stamp: stamps[Math.floor(Math.random() * stamps.length)][i % 3],
  }))

  const run = { canvas, frame: 0 }
  active = run
  let last = performance.now()
  const done = last + 2600
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    g.clearRect(0, 0, W, H)
    for (const p of pieces) {
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rot += p.vr * dt
      g.save()
      g.translate(p.x, p.y)
      g.rotate(p.rot)
      g.scale(p.size / 20, p.size / 20)
      g.globalAlpha = Math.min(1, Math.max(0, (done - now) / 400))
      g.drawImage(p.stamp, -12, -12, 24, 24)
      g.restore()
    }
    if (now < done) run.frame = requestAnimationFrame(frame)
    else { canvas.remove(); if (active === run) active = null }
  }
  run.frame = requestAnimationFrame(frame)
}
