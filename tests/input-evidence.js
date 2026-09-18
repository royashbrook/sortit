// Test-only evidence for missed input: intent, native target, and rendered result
// are separate observations. Nothing here delays input until a move succeeds.
export async function inputEvidence(page) {
  const actions = []
  await page.addInitScript(() => {
    const events = []
    const rows = new WeakMap()
    let dropped = 0
    const at = () => performance.timeOrigin + performance.now()
    const stacks = () => [...document.querySelectorAll('#board .tube')]
    const owner = node => stacks().indexOf(node?.closest?.('.tube'))
    const describe = node => node instanceof Element ? {
      tag: node.tagName, class: node.getAttribute('class'), uid: node.closest('[data-uid]')?.getAttribute('data-uid') ?? null,
      owner: owner(node), flying: Boolean(node.closest('.flying')),
    } : null
    const board = () => stacks().map(node => ({
      label: node.getAttribute('aria-label'), selected: node.classList.contains('sel'),
      items: [...node.querySelectorAll('.item')].map(item => item.getAttribute('data-uid')),
    }))
    const record = event => {
      if (!document.querySelector('#board')?.contains(event.target)) return
      if (events.length >= 256) { dropped++; return }
      const point = event.changedTouches?.[0] ?? event
      const row = {
        at: at(), type: event.type, trusted: event.isTrusted, target: describe(event.target),
        point: { x: point.clientX, y: point.clientY },
        hit: describe(document.elementFromPoint(point.clientX, point.clientY)),
        before: board(),
        flights: [...document.querySelectorAll('#board .item.flying')].map(node => {
          const rect = node.getBoundingClientRect()
          return {
            ...describe(node), pointerEvents: getComputedStyle(node).pointerEvents,
            rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            animations: node.getAnimations().map(animation => ({ time: animation.currentTime, state: animation.playState })),
          }
        }),
      }
      events.push(row)
      rows.set(event, row)
    }
    for (const type of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click']) {
      document.addEventListener(type, record, { capture: true, passive: true })
      window.addEventListener(type, event => {
        const row = rows.get(event)
        // A capture-phase microtask can run before the app's listener. Wait for
        // bubbling past the app, then observe its queued render. A stopped event
        // intentionally has no after snapshot, rather than an invented result.
        if (row) queueMicrotask(() => { row.after = board(); row.afterAt = at(); row.prevented = event.defaultPrevented })
      }, { passive: true })
    }
    window.inputEvidence = () => ({ capturedAt: at(), events, dropped, board: board(), visible: document.visibilityState })
  })
  return {
    async tap(stack, send) {
      const action = { stack, started: Date.now(), completed: null }
      actions.push(action)
      await send()
      action.completed = Date.now()
    },
    async read() {
      return { actions, ...await page.evaluate(() => window.inputEvidence()) }
    },
    async attach(testInfo) {
      const result = page.isClosed() ? { unavailable: 'page closed' }
        : await this.read().catch(error => ({ actions, unavailable: error.message }))
      await testInfo.attach('board-input-evidence', { body: JSON.stringify(result, null, 2), contentType: 'application/json' })
    },
  }
}
