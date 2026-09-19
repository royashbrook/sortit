import { test, expect } from '@playwright/test'

test.use({ isMobile: true, hasTouch: true })

// Sample the composed page, not a serialized SVG with a repaired viewBox.
async function crowns(page) {
  const points = await page.locator('.tube .item:last-child .nut-crown').evaluateAll(paths => paths.flatMap(path => {
    const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d')
    ctx.fillStyle = getComputedStyle(path).fill
    ctx.fillRect(0, 0, 1, 1)
    const expected = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    return [15, 49].map(x => {
      const point = new DOMPoint(x, -10).matrixTransform(path.getScreenCTM())
      return { x: point.x, y: point.y, expected }
    })
  }))
  const screenshot = await page.screenshot({ animations: 'disabled' })
  return page.evaluate(async ({ encoded, points }) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width; canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(image, 0, 0)
    const scale = canvas.width / innerWidth
    return points.map(point => {
      const actual = [...ctx.getImageData(Math.round(point.x * scale), Math.round(point.y * scale), 1, 1).data].slice(0, 3)
      return { ...point, actual, error: Math.max(...actual.map((value, i) => Math.abs(value - point.expected[i]))) }
    })
  }, { encoded: screenshot.toString('base64'), points })
}

for (const deviceScaleFactor of [1, 3]) test.describe(`DPR ${deviceScaleFactor}`, () => {
test.use({ deviceScaleFactor })
for (const width of [390, 430]) test(`nut crowns paint on the mobile board at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 932 })
  await page.addInitScript(() => {
    localStorage.setItem('sortit:skin', 'bolts')
    localStorage.setItem('sortit:theme', 'dusk')
    localStorage.setItem('sortit:progress', JSON.stringify({ current: 93, done: {}, stars: {}, welcomed: true }))
  })
  await page.goto('/')
  await expect(page.locator('.tube')).toHaveCount(10)
  const normal = await crowns(page)
  await info.attach('normal-crowns', { body: JSON.stringify(normal), contentType: 'application/json' })
  expect(normal).toHaveLength(16)
  expect.soft(normal.filter(point => point.error > 3), 'mounted crown pixels match their painted fill').toEqual([])
  // A nut must not rely on drawing beyond its SVG viewport. This control also
  // fails in Chromium, where the original overflow happens to render correctly.
  await page.addStyleTag({ content: '[data-skin="bolts"] .item svg { overflow: hidden !important }' })
  const clipped = await crowns(page)
  await info.attach('viewport-crowns', { body: JSON.stringify(clipped), contentType: 'application/json' })
  expect(clipped.filter(point => point.error > 3), 'the whole crown lives inside its own viewport').toEqual([])
  await page.screenshot({ path: info.outputPath('mobile-crowns.png'), animations: 'disabled' })
  await page.locator('.tube').first().tap()
  await expect.poll(() => page.locator('.tube').first().locator('.item').last().evaluate(el => el.getAnimations().length)).toBe(0)
  const held = await crowns(page)
  expect(held.filter(point => point.error > 3), 'loosened crowns remain painted').toEqual([])
})
})
