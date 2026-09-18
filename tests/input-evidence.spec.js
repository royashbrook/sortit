import { test, expect } from '@playwright/test'
import { inputEvidence } from './input-evidence.js'

test.use({ hasTouch: true })

for (const intercepted of [false, true]) {
  test(`input evidence distinguishes intended stack from ${intercepted ? 'intercepted' : 'delivered'} native tap`, async ({ page }, testInfo) => {
    const evidence = await inputEvidence(page)
    // Hold the same real overlap used by the flight regression. The negative
    // control restores the old hit rule only; the diagnostic must tell them apart.
    await page.addInitScript(() => {
      localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true }))
      const animate = Element.prototype.animate
      Element.prototype.animate = function (frames, options) {
        const animation = animate.call(this, frames, options)
        if (this.matches('.item.flying') && Array.isArray(frames) && frames.length > 2) {
          animation.pause()
          animation.currentTime = 0
        }
        return animation
      }
    })
    await page.goto('/')
    const stacks = page.locator('#board .tube')
    await evidence.tap(0, () => stacks.nth(0).tap())
    await evidence.tap(2, () => stacks.nth(2).tap())
    const flight = page.locator('.item.flying')
    await expect(flight).toHaveCount(1)
    if (intercepted) await page.addStyleTag({ content: '.item.flying { pointer-events: auto !important }' })
    const rect = await flight.boundingBox()
    await evidence.tap(0, () => page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2))
    const actual = intercepted ? 2 : 0
    await expect(stacks.nth(actual)).toHaveClass(/\bsel\b/)
    const result = await evidence.read()
    const click = result.events.filter(event => event.type === 'click').at(-1)
    expect(result.dropped).toBe(0)
    expect(result.actions.map(action => action.stack)).toEqual([0, 2, 0])
    expect(result.actions.every(action => action.completed >= action.started)).toBe(true)
    expect(click.trusted).toBe(true)
    expect(click.target.owner).toBe(actual)
    // These native taps have the same hit and target. Check the field value,
    // not independence of the two observations; the trace retains both.
    expect(click.hit.owner).toBe(actual)
    expect(click.target.flying).toBe(intercepted)
    expect(click.after.map((stack, index) => stack.selected ? index : -1).filter(index => index >= 0)).toEqual([actual])
    expect(click.flights).toHaveLength(1)
    expect(click.flights[0].owner).toBe(2)
    expect(click.flights[0].pointerEvents).toBe(intercepted ? 'auto' : 'none')
    expect(click.flights[0].animations[0]).toMatchObject({ time: 0, state: 'paused' })
    await evidence.attach(testInfo)
  })
}
