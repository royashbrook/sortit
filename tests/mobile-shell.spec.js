import { test, expect } from '@playwright/test'
import { levelBoard } from '../src/lib/engine/levels.ts'

test.use({ hasTouch: true })

async function open(page, level = 1) {
  await page.addInitScript(level => {
    localStorage.setItem('sortit:progress', JSON.stringify({ current: level, done: {}, stars: {}, welcomed: true }))
    localStorage.setItem('sortit:skin', 'bolts')
  }, level)
  await page.goto('/')
  await expect(page.locator('.tube').first()).toBeVisible()
}

test('only the board suppresses double-tap zoom, not ordinary content', async ({ page }) => {
  await open(page)
  await expect(page.locator('html')).toHaveCSS('touch-action', 'auto')
  await expect(page.locator('body')).toHaveCSS('touch-action', 'auto')
  await expect(page.locator('#board')).toHaveCSS('touch-action', 'manipulation')
  expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=/)
  await page.locator('.tube').nth(0).tap()
  await page.locator('.tube').nth(2).tap()
  await expect(page.locator('.tube').nth(2).locator('.item')).toHaveCount(1)
  await page.getByRole('button', { name: 'MORE', exact: true }).tap()
  await page.getByRole('button', { name: 'ABOUT', exact: true }).tap()
  const actions = await page.locator('.about-body').evaluate(el => {
    const values = []
    for (let node = el; node; node = node.parentElement) values.push(getComputedStyle(node).touchAction)
    return values
  })
  expect(actions.every(value => value === 'auto'), JSON.stringify(actions)).toBe(true)
})

const profiles = [
  { name: 'tall portrait', width: 430, height: 932, top: 59, right: 0, bottom: 34, left: 0 },
  { name: 'short portrait', width: 360, height: 640, top: 44, right: 0, bottom: 34, left: 0 },
  { name: 'wide landscape', width: 932, height: 430, top: 0, right: 59, bottom: 21, left: 59 },
  { name: 'short landscape', width: 640, height: 360, top: 0, right: 44, bottom: 21, left: 44 },
]

async function safeBounds(locator, profile) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  const label = `${profile.name}: ${locator}`
  expect.soft(box.x, `${label} left`).toBeGreaterThanOrEqual(profile.left)
  expect.soft(box.y, `${label} top`).toBeGreaterThanOrEqual(profile.top)
  expect.soft(box.x + box.width, `${label} right`).toBeLessThanOrEqual(profile.width - profile.right + .1)
  expect.soft(box.y + box.height, `${label} bottom`).toBeLessThanOrEqual(profile.height - profile.bottom + .1)
}

async function paintOutsideBoard(page, style = '') {
  const frame = await page.locator('#board').boundingBox()
  const options = { animations: 'disabled', mask: [page.getByLabel('time elapsed')] }
  // The coach's rounded border can repaint between captures on Linux. Hide
  // its paint, not its layout or its rectangle: escaped pieces must stay visible.
  const isolated = `.first-run { visibility: hidden !important }\n${style}`
  const shown = await page.screenshot({ ...options, style: isolated })
  const hidden = await page.screenshot({ ...options, style: `${isolated}\n.tube { visibility: hidden !important }` })
  const diff = await page.evaluate(async ({ shown, hidden, frame }) => {
    const decode = async encoded => {
      const bytes = Uint8Array.from(atob(encoded), char => char.charCodeAt(0))
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      bitmap.close()
      return { width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data }
    }
    const a = await decode(shown), b = await decode(hidden)
    const scale = a.width / innerWidth
    let outside = 0
    const pixels = []
    let left = a.width, top = a.height, right = -1, bottom = -1
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      if (x >= frame.x * scale && x < (frame.x + frame.width) * scale && y >= frame.y * scale && y < (frame.y + frame.height) * scale) continue
      const i = (y * a.width + x) * 4
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2] || a.data[i + 3] !== b.data[i + 3]) {
        outside++
        left = Math.min(left, x); top = Math.min(top, y)
        right = Math.max(right, x); bottom = Math.max(bottom, y)
        if (pixels.length < 32) pixels.push({ x, y, shown: [...a.data.slice(i, i + 4)], hidden: [...b.data.slice(i, i + 4)] })
      }
    }
    return { outside, frame, scale, image: { width: a.width, height: a.height }, bounds: outside ? { left, top, right, bottom } : null, pixels }
  }, { shown: shown.toString('base64'), hidden: hidden.toString('base64'), frame })
  // Preserve the actual pair, not a later screenshot after the changing paint
  // is gone. Sampling after both captures leaves their timing unchanged.
  if (diff.outside) {
    await test.info().attach('board-paint-shown', { body: shown, contentType: 'image/png' })
    await test.info().attach('board-paint-hidden', { body: hidden, contentType: 'image/png' })
    await test.info().attach('board-paint-diff', { body: JSON.stringify({ ...diff, style }, null, 2), contentType: 'application/json' })
  }
  return diff
}

test.describe('native safe-area environment values', () => {
  // WebKit does not expose this CDP override. Its ordinary viewport/rotation
  // coverage remains in rotation.spec; these are not physical-iPhone receipts.
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium-only native env(safe-area-inset-*) override')

  for (const skin of ['glass', 'bolts', 'mine', 'dash', 'kawaii', 'dice', 'tubes']) for (const welcomed of [true, false]) {
    test(`${skin}: ${welcomed ? 'welcomed' : 'first-visit shared'} dense board stays inside its card with landscape safe insets`, async ({ page, context }, testInfo) => {
      await page.addInitScript(({ skin, welcomed }) => {
        localStorage.setItem('sortit:skin', skin)
        if (welcomed) localStorage.setItem('sortit:progress', JSON.stringify({ current: 600, done: {}, stars: {}, welcomed: true }))
      }, { skin, welcomed })
      await page.goto(welcomed ? '/' : '/?level=600')
      await expect(page.locator('#board')).toHaveAttribute('data-skin', skin)
      await expect(page.locator('#board-label')).toHaveText('level 600')
      await expect(page.locator('.first-run')).toHaveCount(welcomed ? 0 : 1)
      const contents = () => page.locator('.tube').evaluateAll(tubes => tubes.map(tube => [...tube.querySelectorAll('.item')].map(item => item.dataset.uid)))
      const before = await contents()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, right: 44, bottom: 21, left: 44 } })
      await page.setViewportSize({ width: 640, height: 360 })
      await expect.poll(() => page.locator('#board').evaluate(board => {
        const frame = board.getBoundingClientRect()
        const boxes = [...board.querySelectorAll('.tube, .bolt-post')].map(el => {
          const r = el.getBoundingClientRect()
          return { kind: el.classList.contains('tube') ? 'target' : 'post', left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
        })
        return boxes.filter(box => box.left < frame.left - 1 || box.right > frame.right + 1 || box.top < frame.top - 1 || box.bottom > frame.bottom + 1 || (box.kind === 'target' && Math.min(box.width, box.height) < 44))
      }), { message: `${skin}: the targets and posts must fit the card, not merely the viewport` }).toEqual([])
      expect(await page.locator('#board').evaluate(el => parseFloat(getComputedStyle(el).getPropertyValue('--side')))).toBeGreaterThanOrEqual(20)
      // getBBox includes clipped-away nut geometry. Compare the actual paint,
      // with the moving clock masked, without depending on golden screenshots.
      expect((await paintOutsideBoard(page)).outside).toBe(0)
      if (skin === 'bolts') {
        const lift = await page.locator('#board').evaluate(board => Math.min(...[...board.querySelectorAll('.item svg')].map(svg => svg.getBoundingClientRect().top)) - board.getBoundingClientRect().top + 12)
        expect((await paintOutsideBoard(page, `.item svg { transform: translateY(-${lift}px) }`)).outside).toBeGreaterThan(0)
      }
      expect(await contents()).toEqual(before)
      await page.screenshot({ path: testInfo.outputPath(`dense-safe-${skin}-${welcomed ? 'returning' : 'first-visit'}.png`) })
      const move = levelBoard(600).solution[0]
      await page.locator('.tube').nth(move.from).tap()
      await expect(page.locator('.tube').nth(move.from)).toHaveClass(/sel/)
      await page.locator('.tube').nth(move.to).tap()
      await expect(page.locator('.first-run')).toHaveCount(0)
    })
  }

  test('board paint excludes changing coach paint but detects pieces in its rectangle', async ({ page, context }) => {
    await page.addInitScript(() => localStorage.setItem('sortit:skin', 'bolts'))
    await page.goto('/?level=600')
    await expect(page.locator('.first-run')).toBeVisible()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, right: 44, bottom: 21, left: 44 } })
    await page.setViewportSize({ width: 640, height: 360 })

    const coach = await page.locator('.first-run').boundingBox()
    const inCoach = ({ x, y }) => x >= coach.x && x < coach.x + coach.width && y >= coach.y && y < coach.y + coach.height
    const screenshot = page.screenshot.bind(page)
    let captures = 0
    page.screenshot = options => screenshot({
      ...options,
      style: `${options.style}\n${++captures % 2 === 0 ? '.first-run { border-color: red !important; background: blue !important }' : ''}`,
    })
    try {
      const unisolated = await paintOutsideBoard(page, '.first-run { visibility: visible !important }')
      expect(unisolated.outside).toBeGreaterThan(0)
      expect(unisolated.pixels.some(inCoach)).toBe(true)
      expect((await paintOutsideBoard(page)).outside).toBe(0)
    } finally {
      page.screenshot = screenshot
    }

    const piece = page.locator('.tube').first().locator('.item svg').first()
    await piece.evaluate(svg => svg.id = 'paint-control')
    const box = await piece.boundingBox()
    const lift = box.y + box.height / 2 - (coach.y + coach.height / 2)
    const escaped = await paintOutsideBoard(page, `#paint-control { translate: 0 -${lift}px }`)
    expect(escaped.outside).toBeGreaterThan(0)
    expect(escaped.pixels.some(inCoach)).toBe(true)
  })

  for (const profile of profiles) {
    test(`${profile.name}: board, dock and scrolling sheets respect the safe rectangle`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width: profile.width, height: profile.height })
      const cdp = await context.newCDPSession(page)
      const { top, right, bottom, left } = profile
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, right, bottom, left } })
      await open(page, 600)
      // Prove the browser applied the environment override, not just a viewport.
      const padding = await page.locator('body').evaluate(el => {
        const style = getComputedStyle(el)
        return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(parseFloat)
      })
      expect(padding).toEqual([top, right, bottom, left].map(value => Math.max(12.8, value)))
      await safeBounds(page.locator('.version-stamp'), profile)
      for (const tube of await page.locator('.tube').all()) {
        await safeBounds(tube, profile)
        const box = await tube.boundingBox()
        expect.soft(box.width).toBeGreaterThanOrEqual(44)
      }
      for (const button of await page.locator('#game-nav button').all()) {
        await safeBounds(button, profile)
        const box = await button.boundingBox()
        expect.soft(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
      }
      await page.screenshot({ path: testInfo.outputPath('safe-board.png') })
      await page.getByRole('button', { name: 'LOOKS', exact: true }).tap()
      await safeBounds(page.getByRole('dialog'), profile)
      await page.screenshot({ path: testInfo.outputPath('safe-sheet.png') })
      const done = page.getByRole('button', { name: 'DONE', exact: true })
      await done.scrollIntoViewIfNeeded()
      await safeBounds(done, profile)
      await done.tap()
      await expect(page.locator('dialog')).toHaveCount(0)
      await page.getByRole('button', { name: 'LEVELS', exact: true }).tap()
      await safeBounds(page.getByRole('button', { name: 'back to the game', exact: true }), profile)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(profile.width)
    })
  }

  for (const profile of profiles.filter(profile => profile.name.startsWith('short'))) {
    test(`${profile.name}: a real win leaves all choices reachable`, async ({ page, context }, testInfo) => {
      await page.setViewportSize({ width: profile.width, height: profile.height })
      const cdp = await context.newCDPSession(page)
      const { top, right, bottom, left } = profile
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, right, bottom, left } })
      await open(page)
      for (const move of levelBoard(1).solution) {
        await page.locator('.tube').nth(move.from).tap()
        await page.locator('.tube').nth(move.to).tap()
      }
      await expect(page.locator('.won')).toBeVisible()
      // The panel includes padding behind the home indicator; its content may not.
      const panel = await page.locator('.won').boundingBox()
      expect.soft(panel.y).toBeGreaterThanOrEqual(profile.top)
      await page.screenshot({ path: testInfo.outputPath('safe-win.png') })
      for (const button of await page.locator('.won button').all()) {
        await button.scrollIntoViewIfNeeded()
        await safeBounds(button, profile)
        const box = await button.boundingBox()
        expect.soft(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
        expect(await button.evaluate(el => {
          const r = el.getBoundingClientRect()
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
        })).toBe(true)
      }
      await page.screenshot({ path: testInfo.outputPath('safe-win-bottom.png') })
      await page.getByRole('button', { name: 'NEXT LEVEL', exact: true }).tap()
      await expect(page.locator('#board-label')).toHaveText('level 2')
    })
  }
})
