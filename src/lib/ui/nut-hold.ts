import { nutArt } from '../engine/skinart/bolts.ts'
import { turnNut } from './nut-turn.ts'
import { tick } from 'svelte'

type Hold = { selected: boolean; side: number }

// Loosen a matching run together, still on the thread. Clearing the entire
// post belongs to the committed move, after a destination has been chosen.
export function holdNut(node: HTMLElement, initial: Hold) {
  let state = initial
  let animation: Animation | undefined
  let restoreTurn = () => {}
  let ownsPose = false
  let revision = 0
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const svg = node.querySelector('svg')!
  let rest = svg.innerHTML
  const shell = svg.querySelector<SVGGElement>('[data-nut]')!
  let key = shell.dataset.nut!
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
    // Revealing a mystery piece changes its face without remounting this action.
    // Capture the current face when taking ownership, never an in-flight pose.
    if (!ownsPose) {
      rest = svg.innerHTML
      key = svg.querySelector<SVGGElement>('[data-nut]')!.dataset.nut!
    }
    const offset = new DOMMatrix(getComputedStyle(node).transform).m42
    const angle = Number(svg.querySelector<SVGGElement>('[data-nut]')?.dataset.turn ?? 0)
    const box = node.getBoundingClientRect()
    const tip = node.closest('.tube')!.querySelector('.bolt-tip')!.getBoundingClientRect()
    const target = next.selected ? -next.side * 12 / 64 : 0
    const endAngle = next.selected ? -Math.PI / 3 : 0
    if (next.selected && ownsPose && !animation && Math.abs(target - offset) < .1) return
    stop()
    if (document.hidden) return
    ownsPose = true
    const settle = () => {
      node.style.transform = `translateY(${target}px)`
      const postTip = (tip.top + tip.height / 2 - (box.top - offset + target)) * 64 / next.side
      svg.innerHTML = next.selected ? nutArt(key, endAngle, postTip, id) : rest
      ownsPose = next.selected
      if (!next.selected) node.style.removeProperty('transform')
    }
    if (reduced.matches) { settle(); return }
    const current = node.animate([
      { transform: `translateY(${offset}px)` },
      { transform: `translateY(${target}px)` },
    ], { duration: 280, easing: 'ease-in-out', fill: 'forwards' })
    animation = current
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
