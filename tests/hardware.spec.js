import { test, expect } from '@playwright/test'

async function open(page, level = 1, theme = 'warm') {
  await page.addInitScript(({ level, theme }) => {
    localStorage.setItem('sortit:progress', JSON.stringify({ current: level, done: {}, stars: {}, welcomed: true }))
    localStorage.setItem('sortit:skin', 'bolts')
    localStorage.setItem('sortit:theme', theme)
  }, { level, theme })
  await page.goto('/')
  await expect(page.locator('.bolt-post').first()).toBeVisible()
}

for (const size of [{ width: 430, height: 932 }, { width: 360, height: 640 }])
for (const level of [1, 29, 175, 600]) test(`hardware fits level ${level} at ${size.width}x${size.height}`, async ({ page }) => {
  await page.setViewportSize(size)
  await open(page, level)
  const geometry = await page.locator('#board').evaluate(board => {
    const box = board.getBoundingClientRect()
    const tubes = [...board.querySelectorAll('.tube')].map(node => {
      const rect = node.getBoundingClientRect()
      return { x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom, width: rect.width }
    })
    const ids = [...board.querySelectorAll('[id]')].map(node => node.id)
    return { x: box.x, right: box.right, y: box.y, bottom: box.bottom, tubes, ids, width: document.documentElement.scrollWidth }
  })
  expect(geometry.width).toBeLessThanOrEqual(size.width)
  expect(new Set(geometry.ids).size).toBe(geometry.ids.length)
  for (const tube of geometry.tubes) {
    expect(tube.width).toBeGreaterThanOrEqual(44)
    expect(tube.x).toBeGreaterThanOrEqual(geometry.x - 1)
    expect(tube.right).toBeLessThanOrEqual(geometry.right + 1)
    expect(tube.y).toBeGreaterThanOrEqual(geometry.y)
    expect(tube.bottom).toBeLessThanOrEqual(geometry.bottom)
  }
})

test('a moving nut changes facets, clears its post, and survives undo', async ({ page }) => {
  await open(page)
  const source = await page.locator('.bolt-tip').nth(0).boundingBox()
  await page.locator('.tube').nth(0).click()
  await page.locator('.tube').nth(2).click()
  const moving = page.locator('.item.flying').first()
  await expect(moving).toBeAttached()
  const uid = await moving.getAttribute('data-uid')
  const sample = fraction => page.locator(`[data-uid="${uid}"]`).evaluate(async (node, fraction) => {
    const animation = node.getAnimations().find(a => a.effect.getKeyframes().length > 2)
    if (!animation) throw new Error('flight missing')
    animation.pause()
    animation.currentTime = Number(animation.effect.getTiming().duration) * fraction
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = node.getBoundingClientRect()
    return { x: box.x + box.width / 2, bottom: box.bottom, turn: Number(node.querySelector('.nut-shell').dataset.turn), faces: node.querySelector('.nut-facet path').getAttribute('d') }
  }, fraction)
  const winding = await sample(.075) // 90 degrees, not a hexagon's 60-degree symmetry
  const clear = await sample(.3)
  expect(winding.turn).toBeLessThan(-1)
  expect(clear.faces).not.toBe(winding.faces)
  expect(clear.bottom).toBeLessThan(source.y)
  expect(Math.abs(clear.x - (source.x + source.width / 2))).toBeLessThan(1)
  await sample(.5)
  expect(await moving.locator('.nut-crown').evaluate(path => path.isPointInFill(new DOMPoint(32, -25)))).toBe(true)
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(page.locator('.item.flying')).toHaveCount(0)
  await expect(page.locator('[data-turn]:not([data-turn="0.0000"])')).toHaveCount(0)
  await expect(page.locator('.tube').nth(0).locator('.item')).toHaveCount(3)
})

test('the post occludes the back crown and upper nuts hide lower crowns', async ({ page }) => {
  await open(page)
  const mounted = await page.locator('.tube').nth(0).locator('.item').last().locator('.nut-crown').evaluate(path => ({
    rear: path.isPointInFill(new DOMPoint(32, -25)),
    side: path.isPointInFill(new DOMPoint(15, -10)),
    hole: path.isPointInFill(new DOMPoint(32, -15)),
  }))
  expect(mounted).toEqual({ rear: false, side: true, hole: false })
  const stack = await page.locator('.tube').nth(0).evaluate(tube => {
    const [lower, upper] = tube.querySelectorAll('.item')
    const rect = lower.getBoundingClientRect()
    const surface = document.elementFromPoint(rect.left + rect.width * .25, rect.top - 5 * rect.width / 64)
    return { expected: upper.dataset.uid, visible: surface.closest('.item')?.dataset.uid }
  })
  expect(stack.visible).toBe(stack.expected)
})

test('reduced motion makes the same move without a turn loop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.locator('.tube').nth(0).click()
  await page.locator('.tube').nth(2).click()
  await expect(page.locator('.tube').nth(2).locator('.item')).toHaveCount(1)
  await expect(page.locator('.item.flying')).toHaveCount(0)
  await expect(page.locator('[data-turn]:not([data-turn="0.0000"])')).toHaveCount(0)
})

test('dusk keeps the same hardware and scoped clip ids', async ({ page }) => {
  await open(page, 29, 'dusk')
  await expect(page.locator('#board')).toHaveCSS('background-color', 'rgb(27, 23, 36)')
  await expect(page.locator('.bolt-head')).toHaveCount(8)
  await expect(page.locator('.nut-bore')).toHaveCount(24)
})
