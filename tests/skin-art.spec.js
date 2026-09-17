import { test, expect } from '@playwright/test'

async function open(page, skin, level = 1) {
  await page.addInitScript(({ skin, level }) => {
    localStorage.setItem('sortit:progress', JSON.stringify({ current: level, done: {}, stars: {}, welcomed: true }))
    localStorage.setItem('sortit:skin', skin)
  }, { skin, level })
  await page.goto('/')
  await expect(page.locator('#board')).toHaveAttribute('data-skin', skin)
}

for (const width of [360, 430]) test(`hardware thumbnail contains its crown and base at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 740 })
  await open(page, 'bolts')
  await page.getByRole('button', { name: 'LOOKS', exact: true }).click()
  const icon = page.locator('.look').filter({ hasText: 'Nuts & Bolts' }).locator('svg')
  const shapes = await icon.evaluate(svg => {
    const frame = svg.getBoundingClientRect()
    // Crown clip outlines are the painted boundary, not the deliberately
    // oversized subtraction path that lets the shaft show through the bore.
    const nodes = svg.querySelectorAll('.nut-shell clipPath path, .nut-facet > path, .bolt-head path')
    return [...nodes].map(node => {
      const b = node.getBBox(), m = node.getScreenCTM()
      const corners = [[b.x, b.y], [b.x + b.width, b.y + b.height]].map(([x,y]) => new DOMPoint(x,y).matrixTransform(m))
      return { left: corners[0].x - frame.left, top: corners[0].y - frame.top,
        right: frame.right - corners[1].x, bottom: frame.bottom - corners[1].y }
    })
  })
  expect(shapes.length).toBeGreaterThan(10)
  for (const shape of shapes) for (const inset of Object.values(shape)) expect(inset).toBeGreaterThan(.3)
  await expect(icon.locator('.bolt-head')).toHaveCount(1)
  await expect(icon.locator('.nut-shell')).toHaveCount(2)
  const ids = await page.locator('[id]').evaluateAll(nodes => nodes.map(node => node.id))
  expect(new Set(ids).size).toBe(ids.length)
})

for (const from of [0, 3]) test(`the pickaxe tip strikes the source, from stack ${from + 1}`, async ({ page }, testInfo) => {
  // Freeze the real compositor animation at creation, not a mock drawing.
  await page.addInitScript(() => {
    const animate = Element.prototype.animate
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args)
      animation.pause()
      return animation
    }
  })
  await open(page, 'mine')
  // The two filled stacks are 0/1. Move to the right edge and back to cover
  // the mirrored strike as well as the ordinary right-side tool.
  if (from === 3) {
    await page.locator('.tube').nth(0).click()
    await page.locator('.tube').nth(3).click()
    await page.locator('.actor-layer').evaluate(() => document.getAnimations().forEach(a => a.finish()))
    await expect(page.locator('.actor-layer')).toHaveCount(0)
  }
  await page.locator('.tube').nth(from).click()
  // Exercise the fully enlarged selection, not whichever partial scale the
  // next click happened to catch on a fast machine.
  await page.locator('.tube').nth(from).locator('.item').last().evaluate(node => {
    for (const animation of node.getAnimations()) {
      if (animation.effect.getTiming().iterations === Infinity) { animation.pause(); animation.currentTime = 0 }
      else animation.finish()
    }
  })
  await page.locator('.tube').nth(2).click()
  // Read the captured departure position, not selection's still-easing lift
  // sampled before Playwright waits for the destination click to be stable.
  const source = await page.locator('.item.flying').first().boundingBox()
  const pick = page.locator('.actor.pickaxe').first()
  await expect(pick).toBeAttached()
  const contact = await pick.evaluate(async pick => {
    const animation = pick.getAnimations()[0]
    animation.currentTime = Number(animation.effect.getTiming().duration) * .72
    await new Promise(resolve => requestAnimationFrame(resolve))
    const svg = pick.querySelector('svg')
    const tip = new DOMPoint(66, 30).matrixTransform(svg.getScreenCTM())
    const grip = new DOMPoint(36, 65).matrixTransform(svg.getScreenCTM())
    const head = svg.querySelector('.pick-head')
    return { tip: { x: tip.x, y: tip.y }, grip: { x: grip.x, y: grip.y }, mirrored: pick.classList.contains('from-right'),
      paintedTip: head.isPointInFill(new DOMPoint(65.5, 29.5)), fill: getComputedStyle(head).fill }
  })
  expect(contact.paintedTip).toBe(true)
  expect(contact.fill).not.toBe('none')
  expect(contact.mirrored).toBe(from === 0)
  expect(Math.abs(contact.tip.x - (source.x + source.width * (from === 0 ? .8 : .26)))).toBeLessThan(1)
  expect(Math.abs(contact.tip.y - (source.y + source.width * .30))).toBeLessThan(1)
  expect(Math.abs(contact.grip.x - contact.tip.x)).toBeGreaterThan(source.width * .6)
  await page.screenshot({ path: testInfo.outputPath('strike.png') })
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(page.locator('.actor-layer')).toHaveCount(0)
})

for (const width of [360, 430]) test(`dice stay readable on a dense board at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 740 })
  await open(page, 'dice', 175)
  const art = await page.locator('.item svg').evaluateAll(nodes => nodes.map(svg => {
    const b = svg.getBBox()
    return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height, pips: svg.querySelectorAll('circle').length }
  }))
  expect(art.length).toBeGreaterThan(20)
  for (const box of art) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.right).toBeLessThanOrEqual(64)
    expect(box.bottom).toBeLessThanOrEqual(64)
    expect(box.pips).toBeGreaterThan(0)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({ path: testInfo.outputPath('dice.png') })
})

test('mine respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page, 'mine')
  await page.locator('.tube').nth(0).click()
  await page.locator('.tube').nth(2).click()
  await expect(page.locator('.tube').nth(2).locator('.item')).toHaveCount(1)
  await expect(page.locator('.actor-layer')).toHaveCount(0)
})
