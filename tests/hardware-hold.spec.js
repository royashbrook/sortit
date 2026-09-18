import { test, expect } from '@playwright/test'

async function open(page, level = 29) {
  await page.addInitScript(level => {
    localStorage.setItem('sortit:progress', JSON.stringify({ current: level, done: {}, stars: {}, welcomed: true }))
    localStorage.setItem('sortit:skin', 'bolts')
  }, level)
  await page.goto('/')
  await expect(page.locator('.bolt-tip').first()).toBeVisible()
}

async function expectLoosened(nut) {
  await expect.poll(() => nut.evaluate(n => n.getAnimations().length)).toBe(0)
  const pose = await nut.evaluate(node => ({
    rise: -new DOMMatrix(getComputedStyle(node).transform).m42 / node.getBoundingClientRect().width,
    angle: Number(node.querySelector('[data-nut]').dataset.turn),
    bottom: node.getBoundingClientRect().bottom,
    tip: node.closest('.tube').querySelector('.bolt-tip').getBoundingClientRect().top,
  }))
  expect(pose.rise).toBeCloseTo(12 / 64, 4)
  expect(pose.angle).toBeCloseTo(-Math.PI / 3, 4)
  expect(pose.bottom).toBeGreaterThan(pose.tip)
}

for (const level of [1, 29, 175, 600]) test(`full posts do not imply another slot, level ${level}`, async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await open(page, level)
  const full = await page.locator('.tube').first().evaluate(tube => {
    const top = tube.querySelector('.item:last-child').getBoundingClientRect()
    const tip = tube.querySelector('.bolt-tip').getBoundingClientRect()
    const svg = tube.querySelector('.item:last-child svg')
    const matrix = svg.getScreenCTM()
    const crown = new DOMPoint(32, -9.6).matrixTransform(matrix)
    return { exposed: crown.y - tip.top, pitch: top.height, axis: Math.abs(crown.x - (tip.left + tip.width / 2)),
      scaleX: matrix.a, scaleY: matrix.d, width: top.width, viewBox: svg.getAttribute('viewBox') }
  })
  expect(full.exposed).toBeGreaterThan(0)
  expect(full.exposed).toBeLessThan(full.pitch * .55)
  expect(full.axis).toBeLessThan(.5)
  expect(full.viewBox).toBe('0 0 64 40')
  expect(full.scaleX).toBeCloseTo(full.scaleY, 4)
  expect(full.pitch / full.width).toBeCloseTo(40 / 64, 3)
  await page.screenshot({ path: info.outputPath(`hardware-${level}.png`) })
})

test('selection loosens on the thread, holds without bobbing, then screws back down', async ({ page }, info) => {
  await open(page)
  const nut = page.locator('.tube').first().locator('.item').last()
  const before = await nut.boundingBox()
  await page.locator('.tube').first().click()
  await expect(page.locator('.tube').first().locator('.lift')).toHaveCount(1)
  const winding = await nut.evaluate(async node => {
    const a = node.getAnimations()[0]
    a.pause()
    a.currentTime = 140
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const angle = Number(node.querySelector('[data-nut]').dataset.turn)
    a.finish()
    return angle
  })
  expect(winding).toBeLessThan(-.2)
  await expectLoosened(nut)
  const held = await nut.boundingBox()
  expect(before.y - held.y).toBeCloseTo(before.width * 12 / 64, 3)
  await page.waitForTimeout(800)
  expect(await nut.boundingBox()).toEqual(held)
  await page.screenshot({ path: info.outputPath('selected.png') })
  await page.locator('.tube').first().click()
  const returning = await nut.evaluate(async node => {
    const a = node.getAnimations()[0]
    a.pause()
    a.currentTime = 140
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const angle = Number(node.querySelector('[data-nut]').dataset.turn)
    a.finish()
    return angle
  })
  expect(returning).toBeGreaterThan(-Math.PI / 3)
  expect(returning).toBeLessThan(-.2)
  await expect.poll(() => nut.evaluate(n => n.getAnimations().length)).toBe(0)
  expect(await nut.boundingBox()).toEqual(before)
  await expect(page.locator('.item.flying')).toHaveCount(0)
})

for (const fast of [true, false]) test(`selection transfers without dipping back into its source (${fast ? 'immediate' : 'held'})`, async ({ page }) => {
  await open(page, 1)
  await page.locator('.tube').first().click()
  if (!fast) await expect.poll(() => page.locator('.tube').first().locator('.item').last().evaluate(n => n.getAnimations().length)).toBe(0)
  await page.locator('.tube').nth(2).click()
  const flight = page.locator('.item.flying').first()
  await expect(flight).toBeAttached()
  const pose = await flight.evaluate(async node => {
    const a = node.getAnimations().find(a => a.effect.getKeyframes().length > 2)
    a.pause()
    const frames = a.effect.getKeyframes()
    const start = new DOMMatrix(frames[0].transform)
    const clear = new DOMMatrix(frames[1].transform)
    a.currentTime = Number(a.effect.getTiming().duration) * .3
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    return { start: start.m42, clear: clear.m42, x: start.m41 - clear.m41,
      bottom: node.getBoundingClientRect().bottom, tip: document.querySelector('.bolt-tip').getBoundingClientRect().top }
  })
  expect(pose.clear).toBeLessThanOrEqual(pose.start)
  expect(pose.x).toBe(0)
  expect(pose.bottom).toBeLessThan(pose.tip - 3)
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(page.locator('.item.flying')).toHaveCount(0)
  await expect(page.locator('.tube').first().locator('.item')).toHaveCount(3)
})

test('reduced motion holds clearly without a spinning or bobbing loop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await open(page)
  await page.locator('.tube').first().click()
  const nut = page.locator('.tube').first().locator('.item').last()
  await expectLoosened(nut)
})

test('selection survives resize, cancels in the background, and rapid reselection stays owned', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await open(page)
  const nut = page.locator('.tube').first().locator('.item').last()
  await page.locator('.tube').first().click()
  // Retarget the real in-progress lift twice, not a settled CSS pose.
  await page.locator('.tube').first().dispatchEvent('click')
  await page.locator('.tube').first().dispatchEvent('click')
  await page.setViewportSize({ width: 740, height: 390 })
  await expectLoosened(nut)
  const paintedTop = await nut.locator('clipPath[id$="-crown"] path').evaluate(path => {
    const box = path.getBBox()
    return new DOMPoint(box.x, box.y).matrixTransform(path.getScreenCTM()).y
  })
  expect(paintedTop).toBeGreaterThanOrEqual((await page.locator('#board').boundingBox()).y)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expectLoosened(nut)
  expect(errors).toEqual([])
})

test('three matching nuts loosen together without changing their spacing, then move and undo cleanly', async ({ page }, info) => {
  await open(page, 29)
  // Build a matching run with three legal moves, not a fabricated save.
  for (const from of [0, 1, 2]) {
    await page.locator('.tube').nth(from).click()
    await page.locator('.tube').nth(6).click()
    await expect(page.locator('.item.flying')).toHaveCount(0)
  }
  const source = page.locator('.tube').nth(6), target = page.locator('.tube').nth(7)
  const before = await source.locator('.item').count()
  const saved = await page.evaluate(() => localStorage.getItem('sortit:game'))
  const boxes = await source.locator('.item').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()))
  await source.click()
  await expect(source.locator('.lift')).toHaveCount(3)
  const halfway = await source.locator('.item').evaluateAll(async nodes => {
    const animations = nodes.map(n => n.getAnimations()[0])
    for (const a of animations) { a.pause(); a.currentTime = 140 }
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    const poses = nodes.map(n => ({ y: n.getBoundingClientRect().y, turn: Number(n.querySelector('[data-nut]').dataset.turn) }))
    for (const a of animations) a.finish()
    return poses
  })
  for (let i = 0; i < 3; i++) {
    expect(boxes[i].y - halfway[i].y).toBeCloseTo(boxes[i].width * 6 / 64, 2)
    expect(halfway[i].turn).toBeCloseTo(-Math.PI / 6, 3)
    await expectLoosened(source.locator('.item').nth(i))
  }
  const held = await source.locator('.item').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().y))
  for (let i = 1; i < 3; i++) expect(held[i] - held[i - 1]).toBeCloseTo(boxes[i].y - boxes[i - 1].y, 3)
  await page.screenshot({ path: info.outputPath('group-selected.png') })
  await source.click()
  await expect.poll(() => source.locator('.item').evaluateAll(nodes => nodes.reduce((count, n) => count + n.getAnimations().length, 0))).toBe(0)
  expect(await source.locator('.item').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().toJSON()))).toEqual(boxes)
  await expect(source.locator('.lift')).toHaveCount(0)
  await source.click()
  await target.click()
  await expect(target.locator('.item')).toHaveCount(3)
  await expect(page.locator('.item.flying')).toHaveCount(0)
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(source.locator('.item')).toHaveCount(before)
  const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('sortit:game')))
  expect(restored.tubes).toEqual(JSON.parse(saved).tubes)
  expect(restored.moves).toBe(JSON.parse(saved).moves)
})

test('hint teaches the same loosening gesture without restoring the generic bob', async ({ page }) => {
  await open(page, 1)
  await page.getByRole('button', { name: 'HINT', exact: true }).click()
  const source = page.locator('.tube.hint-from'), nut = source.locator('.item').last()
  await expect(source).toHaveCount(1)
  await expectLoosened(nut)
  expect(await nut.evaluate(n => getComputedStyle(n).animationName)).toBe('none')
})

test('selecting an arriving nut lets its carry finish before loosening again', async ({ page }) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate
    window.competingNutMotion = []
    Element.prototype.animate = function (frames, options) {
      if (this.matches('.item') && frames.length === 2 && this.getAnimations().some(a => a.effect.getKeyframes().length > 2)) {
        window.competingNutMotion.push(this.dataset.uid)
      }
      return animate.call(this, frames, options)
    }
  })
  await open(page, 1)
  await page.locator('.tube').first().click()
  await page.locator('.tube').nth(2).click()
  const nut = page.locator('.tube').nth(2).locator('.item').last()
  await nut.evaluate(node => {
    const flight = node.getAnimations().find(a => a.effect.getKeyframes().length > 2)
    flight.pause()
    flight.currentTime = Number(flight.effect.getTiming().duration) * .5
  })
  await page.locator('.tube').nth(2).click()
  // Both animations would write transform, snapping sideways to the target.
  expect(await page.evaluate(() => window.competingNutMotion)).toEqual([])
  await expect.poll(() => nut.evaluate(n => n.getAnimations().length)).toBe(1)
  expect(await nut.evaluate(n => n.getAnimations()[0].effect.getKeyframes().length)).toBeGreaterThan(2)
  await nut.evaluate(n => n.getAnimations()[0].finish())
  await expectLoosened(nut)
})
