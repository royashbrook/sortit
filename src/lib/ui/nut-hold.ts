import { nutArt } from '../engine/skinart/bolts.ts'
import { turnNut } from './nut-turn.ts'
import { tick } from 'svelte'

type Hold = { selected: boolean; side: number }

// Selection owns only the top nut. A matching run stays seated until the
// move, rather than stacking a tower of waiting nuts over the row above it.
export function holdNut(node: HTMLElement, initial: Hold) {
  let state = initial
  let animation: Animation | undefined
  let restoreTurn = () => {}
  let ownsPose = false
  let revision = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const svg = node.querySelector('svg')!
  const rest = svg.innerHTML
  const shell = svg.querySelector<SVGGElement>('[data-nut]')!
  const key = shell.dataset.nut!
  const id = shell.dataset.artId!

  function stop() {
    animation?.cancel()
    animation = undefined
    restoreTurn()
    if (ownsPose) {
      node.style.removeProperty('transform')
      svg.innerHTML = rest
      ownsPose = false
    }
  }

  function position(next: Hold) {
    if (!next.selected && !ownsPose) return
    const arrival = node.classList.contains('flying')
      ? node.getAnimations().find(a => a.effect instanceof KeyframeEffect && a.effect.getKeyframes().length > 2)
      : undefined
    if (next.selected && arrival) {
      const current = revision
      // One transform owner at a time. A quick tap still selects immediately,
      // but the next wind-off waits for the incoming carry to finish.
      void arrival.finished.then(() => { if (revision === current) update(state) }, () => {})
      return
    }
    const offset = new DOMMatrix(getComputedStyle(node).transform).m42
    const angle = Number(svg.querySelector<SVGGElement>('[data-nut]')?.dataset.turn ?? 0)
    const box = node.getBoundingClientRect()
    const tip = node.closest('.tube')!.querySelector('.bolt-tip')!.getBoundingClientRect()
    const target = next.selected ? tip.top - (box.bottom - offset) - 4 : 0
    if (next.selected && ownsPose && !animation && Math.abs(target - offset) < .1) return
    stop()
    if (document.hidden) return
    ownsPose = true
    const settle = () => {
      node.style.transform = `translateY(${target}px)`
      svg.innerHTML = next.selected ? nutArt(key, 0, null, id) : rest
      ownsPose = next.selected
      if (!next.selected) node.style.removeProperty('transform')
    }
    if (reduced.matches) { settle(); return }
    const current = node.animate([
      { transform: `translateY(${offset}px)` },
      { transform: `translateY(${target}px)` },
    ], { duration: 280, easing: 'ease-in-out', fill: 'forwards' })
    animation = current
    const endAngle = next.selected ? -Math.PI * 2 : 0
    restoreTurn = turnNut(node, current, [{ x: tip.left + tip.width / 2, y: tip.top + tip.height / 2 }],
      p => angle + (endAngle - angle) * p)
    current.finished.then(() => {
      if (animation !== current) return
      restoreTurn()
      current.cancel()
      animation = undefined
      settle()
    }, () => {})
  }
  function update(next: Hold) {
    state = next
    const current = ++revision
    // The action can update before the parent's --side and post viewBox.
    // Measure only after that same Svelte flush has painted its new geometry.
    void tick().then(() => { if (revision === current) position(next) })
  }
  const visibility = () => { if (document.hidden) { revision++; stop() } else update(state) }
  const motion = () => update(state)
  document.addEventListener('visibilitychange', visibility)
  reduced.addEventListener('change', motion)
  update(initial)
  return {
    update,
    destroy() {
      revision++
      stop()
      document.removeEventListener('visibilitychange', visibility)
      reduced.removeEventListener('change', motion)
    },
  }
}
