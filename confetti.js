// a two-second canvas confetti burst for wins. self-contained: creates its
// canvas, animates, removes it. honours prefers-reduced-motion by doing
// nothing, which is the correct celebration for that setting.

export function confetti(colors) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  // capture size ONCE: a rotation mid-burst must not smear a mismatched
  // clearRect, and dpr is capped like the game canvas — a dpr-3 phone does
  // not need a ~40MB backing store for a two-second effect.
  const W = innerWidth
  const H = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.className = 'confetti'
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  document.body.append(canvas)
  const g = canvas.getContext('2d')
  g.scale(dpr, dpr)

  // spawn band is shallow and fall speed floored so every piece the burst
  // pays for actually crosses the screen within its lifetime
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * W,
    y: -20 - Math.random() * H * 0.3,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    vy: 190 + Math.random() * 170,
    vx: -40 + Math.random() * 80,
    rot: Math.random() * Math.PI,
    vr: -4 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
  }))

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
      g.fillStyle = p.color
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      g.restore()
    }
    if (now < done) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
