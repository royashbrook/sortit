import { test, expect } from '@playwright/test'

for (const width of [360, 430]) for (const theme of ['daylight', 'dusk']) {
  test(`mine cubes and scenery fit the board at ${width}px in ${theme}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 740 })
    await page.addInitScript(({ theme }) => {
      localStorage.setItem('sortit:progress', JSON.stringify({ current: 175, done: {}, stars: {}, welcomed: true }))
      localStorage.setItem('sortit:skin', 'mine')
      localStorage.setItem('sortit:theme', theme)
    }, { theme })
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expect(page.locator('#board')).toHaveAttribute('data-skin', 'mine')
    const cubes = await page.locator('.item svg').evaluateAll(nodes => nodes.map(svg => {
      const cube = svg.querySelector('.mine-cube')
      const b = cube.getBBox(), m = cube.getScreenCTM()
      const left = new DOMPoint(b.x, b.y).matrixTransform(m).x
      const right = new DOMPoint(b.x + b.width, b.y).matrixTransform(m).x
      const item = svg.closest('.item').getBoundingClientRect()
      const tube = svg.closest('.tube').getBoundingClientRect()
      const face = svg.querySelector('[data-face="right"]')
      const fm = face.getScreenCTM()
      const origin = new DOMPoint(0, 0).matrixTransform(fm)
      const bottom = new DOMPoint(0, 40).matrixTransform(fm)
      const back = new DOMPoint(40, 0).matrixTransform(fm)
      return { center: (left + right) / 2 - (tube.left + tube.width / 2),
        inset: Math.min(left - item.left, item.right - right),
        verticalDrift: bottom.x - origin.x, down: bottom.y - origin.y,
        awayX: back.x - origin.x, awayY: back.y - origin.y,
        faceHeight: face.querySelector('rect').getAttribute('height') }
    }))
    expect(cubes.length).toBeGreaterThan(20)
    for (const cube of cubes) {
      expect(Math.abs(cube.center)).toBeLessThan(.6)
      expect(cube.inset).toBeGreaterThan(1)
      expect(Math.abs(cube.verticalDrift)).toBeLessThan(.01)
      expect(cube.down).toBeGreaterThan(10)
      expect(cube.awayX).toBeGreaterThan(0)
      expect(cube.awayY).toBeLessThan(0)
      expect(cube.faceHeight).toBe('40')
    }
    const scene = page.locator('.mine-scene')
    await expect(scene).toHaveAttribute('aria-hidden', 'true')
    await expect(scene).toHaveCSS('pointer-events', 'none')
    expect(await scene.locator('path').count()).toBeGreaterThan(10)
    const targets = await page.locator('.tube').evaluateAll(nodes => nodes.map(node => {
      const b = node.getBoundingClientRect()
      return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.closest('.tube') === node
    }))
    expect(targets.every(Boolean)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
    await page.screenshot({ path: testInfo.outputPath('mine.png') })
    await page.getByRole('button', { name: 'LOOKS', exact: true }).click()
    const preview = page.locator('.look').filter({ hasText: 'Block Mine' }).locator('svg')
    const bounds = await preview.evaluate(svg => {
      const b = svg.getBBox()
      return { left: b.x, right: b.x + b.width, top: b.y, bottom: b.y + b.height }
    })
    expect(bounds.left).toBeGreaterThan(0)
    expect(bounds.top).toBeGreaterThan(0)
    expect(bounds.right).toBeLessThan(64)
    expect(bounds.bottom).toBeLessThan(64)
    await page.getByRole('button', { name: 'Kawaii Pop' }).click()
    await expect(page.locator('.mine-scene')).toHaveCount(0)
  })
}
