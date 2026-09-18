import { nutArt } from '../engine/skinart/bolts.ts'
const running = new WeakMap<HTMLElement, () => void>()

// These phases match the screw flight: wind off, carry, wind on. The hex
// faces actually change projection, rather than sliding a stripe texture.
export function nutTurn(progress: number) {
  if (progress <= 0 || progress >= 1) return 0
  if (progress < .3) return -Math.PI * 2 * progress / .3
  if (progress < .74) return -Math.PI * 2
  return -Math.PI * 2 * (1 - (progress - .74) / .26)
}

export function turnNut(node: HTMLElement, animation: Animation, posts: { x: number; y: number }[], angle = nutTurn) {
  running.get(node)?.()
  const svg = node.querySelector('svg')
  const shell = svg?.querySelector('[data-nut]')
  if (!svg || !shell) return () => {}
  const index = shell.getAttribute('data-nut') ?? 'hid'
  const id = shell.getAttribute('data-art-id') ?? undefined
  const rest = svg.innerHTML
  let raf = 0
  let stopped = false
  const restore = () => {
    if (stopped) return
    stopped = true
    cancelAnimationFrame(raf)
    svg.innerHTML = rest
    running.delete(node)
  }
  const frame = () => {
    if (!node.isConnected || animation.playState === 'idle' || animation.playState === 'finished') return restore()
    const progress = animation.effect?.getComputedTiming().progress ?? 0
    const rect = node.getBoundingClientRect()
    const post = posts.find(p => Math.abs(p.x - (rect.left + rect.width / 2)) < .5)
    const tip = post ? (post.y - rect.top) * 64 / rect.width : null
    svg.innerHTML = nutArt(index, angle(progress), tip, id)
    raf = requestAnimationFrame(frame)
  }
  running.set(node, restore)
  frame()
  animation.finished.then(restore, restore)
  return restore
}
