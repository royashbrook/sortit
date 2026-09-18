import { test, expect } from '@playwright/test'

test.use({ hasTouch: true })

for (const skin of ['bolts', 'mine', 'dash', 'kawaii', 'dice', 'tubes']) {
  test(`${skin}: a tap beneath a travelling piece belongs to the underlying stack`, async ({ page }) => {
    await page.addInitScript(skin => {
      localStorage.setItem('sortit:skin', skin)
      localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true }))
      const animate = Element.prototype.animate
      Element.prototype.animate = function (frames, options) {
        const animation = animate.call(this, frames, options)
        // Hold the real source-overlap pose, rather than race a fast compositor.
        if (this.matches('.item.flying') && Array.isArray(frames) && frames.length > 2) {
          animation.pause()
          animation.currentTime = 0
        }
        return animation
      }
    }, skin)
    await page.goto('/')
    const stacks = page.locator('#board .tube')
    await expect(stacks).toHaveCount(4)
    await stacks.nth(0).tap()
    await stacks.nth(2).tap()
    const flight = page.locator('.item.flying')
    await expect(flight).toHaveCount(1)
    const point = await flight.evaluate(node => {
      const nut = node.getBoundingClientRect()
      const source = document.querySelector('#board .tube').getBoundingClientRect()
      return {
        x: nut.left + nut.width / 2, y: nut.top + nut.height / 2,
        source: { left: source.left, right: source.right, top: source.top, bottom: source.bottom },
        owner: [...document.querySelectorAll('#board .tube')].indexOf(node.closest('.tube')),
      }
    })
    // The piece now belongs to stack 2 but is visibly over stack 0.
    expect(point.owner).toBe(2)
    expect(point.x).toBeGreaterThan(point.source.left)
    expect(point.x).toBeLessThan(point.source.right)
    expect(point.y).toBeGreaterThan(point.source.top)
    expect(point.y).toBeLessThan(point.source.bottom)
    await page.touchscreen.tap(point.x, point.y)
    await expect(stacks.nth(0)).toHaveClass(/\bsel\b/)
    await expect(stacks.nth(2)).not.toHaveClass(/\bsel\b/)
    await expect(stacks.nth(0).locator('.item')).toHaveCount(2)
    await expect(stacks.nth(2).locator('.item')).toHaveCount(1)
  })
}
