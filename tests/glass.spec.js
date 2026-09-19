import { test, expect } from '@playwright/test'

test('glass is the fresh default', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#board')).toHaveAttribute('data-skin', 'glass')
  await page.reload()
  await expect(page.locator('#board')).toHaveAttribute('data-skin', 'glass')
})

test('an older unlabelled save keeps bolts until glass is chosen', async ({ page }) => {
  // Seed before boot. Editing disk under a live store would correctly be
  // overwritten by that store's pagehide save, not test upgrade adoption.
  await page.addInitScript(() => {
    if (localStorage.getItem('sortit:progress')) return
    localStorage.setItem('sortit:progress', JSON.stringify({ current: 93, done: {}, stars: {}, welcomed: true }))
  })
  await page.goto('/')
  await expect(page.locator('#board')).toHaveAttribute('data-skin', 'bolts')
  await expect(page.locator('#board-label')).toHaveText('level 93')
  await page.getByRole('button', { name: 'LOOKS', exact: true }).click()
  await page.getByRole('button', { name: 'Glass Garden', exact: true }).click()
  await page.reload()
  await expect(page.locator('#board')).toHaveAttribute('data-skin', 'glass')
  await expect(page.locator('#board-label')).toHaveText('level 93')
})

for (const theme of ['paper', 'dusk']) test(`dense glass has contained art and unobstructed targets in ${theme}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 640 })
  await page.addInitScript(theme => {
    localStorage.setItem('sortit:skin', 'glass')
    localStorage.setItem('sortit:theme', theme)
    localStorage.setItem('sortit:progress', JSON.stringify({ current: 600, done: {}, stars: {}, welcomed: true }))
  }, theme)
  await page.goto('/')
  await expect(page.locator('#board')).toHaveAttribute('data-skin', 'glass')
  await expect(page.locator('#board')).toHaveCSS('background-color', theme === 'dusk' ? 'rgb(27, 23, 36)' : 'rgb(255, 238, 210)')
  const art = await page.locator('.item svg').evaluateAll(nodes => nodes.map(svg => {
    const b = svg.getBBox()
    return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height,
      mark: svg.querySelectorAll('path[fill-rule="evenodd"]').length }
  }))
  expect(art.length).toBeGreaterThan(20)
  for (const b of art) {
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.right).toBeLessThanOrEqual(64)
    expect(b.bottom).toBeLessThanOrEqual(64)
    expect(b.mark).toBe(2)
  }
  const hitTargets = await page.locator('.tube').evaluateAll(nodes => nodes.map(node => {
    const b = node.getBoundingClientRect()
    return { width: b.width, hit: node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) }
  }))
  for (const target of hitTargets) { expect(target.width).toBeGreaterThanOrEqual(44); expect(target.hit).toBe(true) }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  await page.screenshot({ path: testInfo.outputPath('glass.png') })
})
