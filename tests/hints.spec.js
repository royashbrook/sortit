import { test, expect } from '@playwright/test'

for (const width of [360, 430]) test(`a reachable dead end offers Undo at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 740 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    localStorage.setItem('sortit:progress', JSON.stringify({ current: 14, done: {}, stars: {}, welcomed: true }))
  })
  await page.goto('/')
  await expect(page.locator('#board-label')).toHaveText('level 14')
  const tubes = page.locator('.tube')
  for (const [from, to] of [[2, 6], [3, 2], [3, 5], [1, 3]]) {
    await tubes.nth(from).click()
    await tubes.nth(to).click()
  }
  await expect(page.locator('.stuck')).toHaveCount(0)
  await page.getByRole('button', { name: 'HINT', exact: true }).click()
  const notice = page.locator('.stuck[role="status"]')
  await expect(notice).toContainText('no solution from here. try undo.')
  await page.screenshot({ path: testInfo.outputPath('hint-recovery.png') })
  const targets = await notice.locator('button').evaluateAll(nodes => nodes.map(node => {
    const b = node.getBoundingClientRect()
    return { left: b.left, right: b.right, bottom: b.bottom, width: b.width, height: b.height,
      hit: node.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)) }
  }))
  expect(targets).toHaveLength(2)
  for (const b of targets) {
    expect(b.left).toBeGreaterThanOrEqual(0)
    expect(b.right).toBeLessThanOrEqual(width)
    expect(b.bottom).toBeLessThanOrEqual(740)
    expect(b.width).toBeGreaterThanOrEqual(44)
    expect(b.height).toBeGreaterThanOrEqual(44)
    expect(b.hit).toBe(true)
  }
  await notice.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(notice).toHaveCount(0)
  await page.getByRole('button', { name: 'HINT', exact: true }).click()
  await expect(page.locator('.tube.hint-from')).toHaveCount(1)
  await expect(page.locator('.tube.hint')).toHaveCount(1)
})
