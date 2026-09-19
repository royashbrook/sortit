import { test, expect } from '@playwright/test'

async function open(page, skin) {
  await page.addInitScript(skin => {
    localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true }))
    localStorage.setItem('sortit:skin', skin)
    const animate = Element.prototype.animate
    window.presentationAnimations = []
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      animation.pause()
      window.presentationAnimations.push(animation)
      return animation
    }
  }, skin)
  await page.goto('/')
  await expect(page.locator('#board')).toHaveAttribute('data-skin', skin)
}

const savedBoard = page => page.evaluate(() => {
  const { tubes, moves } = JSON.parse(localStorage.getItem('sortit:game'))
  return { tubes, moves }
})
const move = async (page, from, to) => {
  await page.locator('.tube').nth(from).click()
  await page.locator('.tube').nth(to).click()
  await expect(page.locator('.item.flying')).not.toHaveCount(0)
}
const stopped = async page => {
  await expect.poll(() => page.evaluate(() => window.presentationAnimations.every(animation => animation.playState === 'idle'))).toBe(true)
  await expect(page.locator('.actor-layer, .item.flying, .fxlayer')).toHaveCount(0)
  // Beyond the mine's final scheduled warp: cancelled timers must not recreate
  // the removed canvas. The compositor animations themselves remain real.
  await page.waitForTimeout(1250)
  await expect(page.locator('.actor-layer, .item.flying, .fxlayer')).toHaveCount(0)
}

for (const skin of ['glass', 'bolts', 'mine']) {
  test(`${skin}: leaving the board cancels presentation and remount keeps the puzzle`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await open(page, skin)
    await move(page, 0, 2)
    const saved = await savedBoard(page)
    await page.getByRole('button', { name: 'LEVELS', exact: true }).click()
    await expect(page.locator('#board')).toHaveCount(0)
    await stopped(page)
    await page.getByRole('button', { name: 'back to the game', exact: true }).click()
    await expect(page.locator('#board')).toHaveAttribute('data-skin', skin)
    await expect(page.locator('.tube').nth(2).locator('.item')).toHaveCount(1)
    expect(await savedBoard(page)).toEqual(saved)
    await move(page, 2, 3)
    await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    await stopped(page)
    expect(await savedBoard(page)).toEqual(saved)
    expect(errors).toEqual([])
  })

  test(`${skin}: a hidden board cancels motion and resumes with the same puzzle`, async ({ page }) => {
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await open(page, skin)
    await move(page, 0, 2)
    const saved = await savedBoard(page)
    // Controlled visibility is portable across headless Chromium and WebKit;
    // it exercises the actual page listeners, not an OS/device background claim.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await stopped(page)
    await expect(page.locator('[data-turn]:not([data-turn="0.0000"])')).toHaveCount(0)
    expect(await savedBoard(page)).toEqual(saved)
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await move(page, 2, 3)
    await page.getByRole('button', { name: 'UNDO', exact: true }).click()
    await stopped(page)
    expect(await savedBoard(page)).toEqual(saved)
    expect(errors).toEqual([])
  })
}
