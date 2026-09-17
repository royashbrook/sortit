import { test, expect } from '@playwright/test'
import { levelBoard } from '../src/lib/engine/levels.js'

const skins = ['bolts', 'mine', 'dash', 'kawaii', 'dice', 'tubes']
async function win(page, skin) {
  await page.addInitScript(skin => {
    localStorage.setItem('sortit:skin', skin)
    localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true }))
    window.confettiPaint = []
    window.confettiDraws = 0
    const drawImage = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (this.canvas.className === 'confetti' && args[0].className === 'confetti-stamp') window.confettiDraws++
      return drawImage.apply(this, args)
    }
    for (const name of ['fill', 'strokeRect', 'moveTo', 'fillRect', 'bezierCurveTo', 'roundRect', 'arc']) {
      const original = CanvasRenderingContext2D.prototype[name]
      CanvasRenderingContext2D.prototype[name] = function (...args) {
        if (this.canvas.className === 'confetti-stamp' && window.confettiPaint.length < 1500) window.confettiPaint.push([name, ...args])
        return original.apply(this, args)
      }
    }
  }, skin)
  await page.goto('/')
  await expect(page.locator('#board')).toHaveAttribute('data-skin', skin)
  for (const move of levelBoard(1).solution) {
    await page.locator('#board .tube').nth(move.from).click()
    await page.locator('#board .tube').nth(move.to).click()
  }
  await expect(page.locator('.won')).toBeVisible()
}

for (const skin of skins) {
  test(`${skin} wins with its own material confetti and clears on next board`, async ({ page }, testInfo) => {
    await win(page, skin)
    const canvas = page.locator('canvas.confetti')
    await expect(canvas).toHaveAttribute('data-skin', skin)
    await expect(canvas).toHaveAttribute('aria-hidden', 'true')
    await expect(canvas).toHaveCSS('pointer-events', 'none')
    // Inspect calls made by the shipped renderer, not just its identifying label.
    await expect.poll(() => page.evaluate(skin => {
      const has = (name, ...args) => window.confettiPaint.some(c => c[0] === name && args.every((v, i) => c[i + 1] === v))
      return { bolts: has('fill', 'evenodd') && has('strokeRect'),
        mine: has('moveTo', -8, -4) && has('fillRect', -6, -1, 2, 2),
        dash: has('moveTo', -1, -9), kawaii: has('bezierCurveTo'),
        dice: has('roundRect') && has('arc'), tubes: has('fillRect', -4, -8, 8, 16) && has('arc') }[skin]
    }, skin)).toBe(true)
    await expect.poll(() => page.evaluate(() => window.confettiDraws)).toBeGreaterThan(0)
    await page.waitForTimeout(600)
    await page.screenshot({ path: testInfo.outputPath(`${skin}-win.png`) })
    await page.getByRole('button', { name: 'NEXT LEVEL', exact: true }).click()
    await expect(page.locator('#board-label')).toHaveText('level 2')
    await expect(canvas).toHaveCount(0)
  })

  test(`${skin} wins quietly with reduced motion`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await win(page, skin)
    await expect(page.locator('canvas.confetti')).toHaveCount(0)
    expect(await page.evaluate(() => window.confettiPaint.length)).toBe(0)
  })
}
