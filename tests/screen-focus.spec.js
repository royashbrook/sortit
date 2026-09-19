import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 360, height: 640 } })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true })))
  await page.goto('/')
  await expect(page.locator('#board .tube').first()).toBeVisible()
})

async function activate(page, control) {
  await control.focus()
  await page.keyboard.press('Enter')
}

test('entering LEVELS focuses the new main screen without inventing an Escape action', async ({ page }, testInfo) => {
  await activate(page, page.getByRole('button', { name: 'LEVELS', exact: true }))
  const levels = page.locator('#levels')
  await expect(levels).toBeFocused()
  await expect(levels).toHaveAccessibleName(/world 1/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(levels).toBeFocused()
  await expect(levels).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('levels-focused.png') })
})

for (const route of ['back to the game', 'PLAY', 'level 1']) {
  test(`${route} returns keyboard focus to the game screen`, async ({ page }, testInfo) => {
    await activate(page, page.getByRole('button', { name: 'LEVELS', exact: true }))
    await expect(page.locator('#levels')).toBeVisible()
    await activate(page, page.getByRole('button', { name: route, exact: true }))
    await expect(page.locator('#game')).toBeFocused()
    await expect(page.locator('#game')).toHaveAccessibleName('level 1')
    if (route === 'PLAY') await page.screenshot({ path: testInfo.outputPath('game-focused.png') })
    await activate(page, page.locator('.tube').first())
    await expect(page.locator('.tube').first()).toHaveClass(/sel/)
    await expect(page.locator('.tube').first()).toBeFocused()
  })
}

test('first mount and same-screen dialog changes do not take keyboard focus', async ({ page }) => {
  await expect(page.locator('#game')).not.toBeFocused()
  const looks = page.getByRole('button', { name: 'LOOKS', exact: true })
  await activate(page, looks)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(looks).toBeFocused()
  await activate(page, page.getByRole('button', { name: 'LEVELS', exact: true }))
  await activate(page, page.getByRole('button', { name: 'MORE', exact: true }))
  await activate(page, page.getByRole('button', { name: 'ABOUT', exact: true }))
  await page.keyboard.press('Escape')
  await expect(page.locator('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'MORE', exact: true })).toBeFocused()
})

test('screen focus does not frame the whole app, but keyboard targets keep their outline', async ({ page }) => {
  await activate(page, page.getByRole('button', { name: 'LEVELS', exact: true }))
  await expect(page.locator('#levels')).toBeFocused()
  await expect(page.locator('#levels')).toHaveCSS('outline-style', 'none')
  await activate(page, page.getByRole('button', { name: 'PLAY', exact: true }))
  await expect(page.locator('#game')).toBeFocused()
  await expect(page.locator('#game')).toHaveCSS('outline-style', 'none')
  const target = page.locator('.tube').first()
  await activate(page, target)
  await expect(target).toBeFocused()
  await expect(target).toHaveClass(/sel/)
  expect(await target.evaluate(el => el.matches(':focus-visible'))).toBe(true)
  expect(await target.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none')
})
