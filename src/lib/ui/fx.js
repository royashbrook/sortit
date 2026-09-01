// landing effects: one shared fixed canvas, a dozen particles per burst, gone
// in under half a second. same zero-asset rule as the sounds: everything is
// drawn, nothing is downloaded. reduced-motion users get no bursts at all
// (Board only calls fx.land from the animated path).

let canvas = null
let ctx = null
let parts = []
let raf = 0

function ensure() {
  if (canvas) return
  canvas = document.createElement('canvas')
  canvas.className = 'fxlayer'
  canvas.setAttribute('aria-hidden', 'true')
  document.body.appendChild(canvas)
  ctx = canvas.getContext('2d')
}

function fit() {
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = innerWidth * dpr
  canvas.height = innerHeight * dpr
  canvas.style.width = innerWidth + 'px'
  canvas.style.height = innerHeight + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

// the burst recipes, keyed by the skin's landing verb
const RECIPES = {
  screw: { n: 7, colors: ['#FFE9A8', '#FFD54A', '#FFFFFF'], shape: 'spark', speed: 130, up: .4, grav: 260, life: .28 },
  bounce: { n: 10, colors: ['#B9A38C', '#8A7A70', '#D8CFC6'], shape: 'chunk', speed: 110, up: .8, grav: 420, life: .34 },
  drop: { n: 8, colors: ['#FFFFFF', '#DCEFFA', '#BFE3F5'], shape: 'dot', speed: 90, up: .9, grav: 150, life: .3 },
  slide: { n: 6, colors: ['#D8C4A6', '#B79A76', '#FFF3DD'], shape: 'chunk', speed: 90, up: .7, grav: 380, life: .26 },
  zip: { n: 9, colors: ['#3EF0D0', '#FF4FD8', '#FFFFFF'], shape: 'spark', speed: 170, up: .3, grav: 60, life: .22 },
  float: { n: 8, colors: ['#FFD7E8', '#BFE8FF', '#FFF6C9'], shape: 'dot', speed: 70, up: 1, grav: -60, life: .45 },
}

function loop(now) {
  raf = 0
  ctx.clearRect(0, 0, innerWidth, innerHeight)
  const next = []
  for (const p of parts) {
    const age = (now - p.born) / 1000
    if (age > p.life) continue
    const t = age / p.life
    p.x += p.vx * 0.016
    p.y += p.vy * 0.016
    p.vy += p.grav * 0.016
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = p.color
    if (p.shape === 'spark') {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(Math.atan2(p.vy, p.vx))
      ctx.fillRect(-p.size * 1.6, -p.size / 3, p.size * 3.2, p.size / 1.5)
      ctx.restore()
    } else if (p.shape === 'chunk') {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
    } else {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
    next.push(p)
  }
  ctx.globalAlpha = 1
  parts = next
  if (parts.length) raf = requestAnimationFrame(loop)
  else ctx.clearRect(0, 0, innerWidth, innerHeight)
}

export const fx = {
  // rect: the landed item's viewport box. verb picks the recipe; the theme's
  // item colors tint half the particles so bursts belong to the board.
  land(rect, verb, themeColors = []) {
    if (typeof document === 'undefined') return
    ensure()
    fit()
    const r = RECIPES[verb] ?? RECIPES.drop
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height * 0.75
    const now = performance.now()
    for (let i = 0; i < r.n; i++) {
      const angle = Math.PI * (1 + (i / (r.n - 1))) // fan across the upper half
      const speed = r.speed * (0.5 + Math.random() * 0.7)
      const palette = (i % 2 === 0 && themeColors.length) ? themeColors : r.colors
      parts.push({
        x: cx + (Math.random() - 0.5) * rect.width * 0.5,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * r.up,
        grav: r.grav,
        size: 2.5 + Math.random() * 2.5,
        color: palette[(Math.random() * palette.length) | 0],
        shape: r.shape,
        born: now,
        life: r.life * (0.75 + Math.random() * 0.5),
      })
    }
    if (!raf) raf = requestAnimationFrame(loop)
  },
}
