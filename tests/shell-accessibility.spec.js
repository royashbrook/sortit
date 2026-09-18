import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 360, height: 640 } })

async function open(page, theme, progress = { current: 1, done: {}, stars: {} }) {
  await page.addInitScript(({ theme, progress }) => {
    localStorage.setItem('sortit:progress', JSON.stringify({ ...progress, welcomed: true }))
    localStorage.setItem('sortit:theme', theme)
  }, { theme, progress })
  await page.goto('/')
  await expect(page.locator('#board .tube').first()).toBeVisible()
}

function contrast({ colour, background, opacity }) {
  const rgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number)
  const bg = rgb(background)
  const fg = rgb(colour).map((value, index) => value * opacity + bg[index] * (1 - opacity))
  const luminance = values => values.map(value => value / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
    .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  const a = luminance(fg), b = luminance(bg)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}

async function expectControlContrast(page, selector, textSelector) {
  const controls = page.locator(selector)
  expect(await controls.count(), selector).toBeGreaterThan(0)
  for (const control of await controls.all()) {
    const paint = await control.evaluate((el, textSelector) => {
      const style = getComputedStyle(el)
      const text = getComputedStyle(textSelector ? el.querySelector(textSelector) : el)
      const ancestorOpacity = []
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        ancestorOpacity.push(Number(getComputedStyle(parent).opacity))
      }
      return { colour: text.color, background: style.backgroundColor, opacity: Number(style.opacity), ancestorOpacity }
    }, textSelector)
    // These controls have flat, opaque surfaces and no translucent ancestors.
    // Opacity-one is part of the contract so this oracle cannot miss a faded button.
    expect.soft(paint.opacity, selector).toBe(1)
    expect.soft(paint.ancestorOpacity.every(value => value === 1), selector).toBe(true)
    expect.soft(paint.background.startsWith('rgb('), selector).toBe(true)
    expect.soft(paint.colour.startsWith('rgb('), selector).toBe(true)
    expect.soft(contrast(paint), `${selector}: ${JSON.stringify(paint)}`).toBeGreaterThanOrEqual(4.5)
  }
}

for (const theme of ['daylight', 'dusk', 'bubblegum']) {
  test(`${theme}: nested dialogs restore the surviving menu opener`, async ({ page }) => {
    await open(page, theme)
    const more = page.getByRole('button', { name: 'MORE', exact: true })
    for (const next of [null, 'ABOUT', 'HOW TO PLAY', 'MOVE MY SAVE']) {
      await more.focus()
      await page.keyboard.press('Enter')
      await expect(page.locator('dialog')).toBeVisible()
      if (next) await page.getByRole('button', { name: next, exact: true }).click()
      await expect(page.locator('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      // Role queries hide a closed dialog before its DOM has actually retired.
      await expect(page.locator('dialog')).toHaveCount(0)
      await expect(more).toBeFocused()
    }
    const looks = page.getByRole('button', { name: 'LOOKS', exact: true })
    await looks.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await expect(looks).toBeFocused()
  })

  test(`${theme}: secondary shell text clears normal-text contrast`, async ({ page }) => {
    await open(page, theme)
    const version = await page.locator('.version-stamp').evaluate(el => ({
      colour: getComputedStyle(el).color, opacity: Number(getComputedStyle(el).opacity),
      background: getComputedStyle(document.body).backgroundColor,
    }))
    expect(contrast(version), 'version on the unobscured game surface').toBeGreaterThanOrEqual(4.5)
    await page.getByRole('button', { name: 'MORE', exact: true }).click()
    await page.getByRole('button', { name: 'ABOUT', exact: true }).click()
    for (const selector of ['.about-ethos', '.maker-mark']) {
      const paint = await page.locator(selector).evaluate(el => ({
        colour: getComputedStyle(el).color, opacity: Number(getComputedStyle(el).opacity),
        background: getComputedStyle(el.closest('dialog')).backgroundColor,
      }))
      expect(contrast(paint), selector).toBeGreaterThanOrEqual(4.5)
    }
  })

  test(`${theme}: selected and completed controls keep legible text`, async ({ page }) => {
    await open(page, theme, { current: 2, done: { 1: 4 }, stars: { 1: 3 } })
    await page.getByRole('button', { name: 'MORE', exact: true }).click()
    await expectControlContrast(page, 'dialog .big:not(.secondary)')
    await expectControlContrast(page, 'dialog .big.secondary:not(.sound-toggle)')
    await expectControlContrast(page, '.sound-toggle')
    await page.locator('.sound-toggle').click()
    await expectControlContrast(page, '.sound-toggle.muted')
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'LOOKS', exact: true }).click()
    await expectControlContrast(page, '.look')
    await expectControlContrast(page, '.theme-chip')
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).toHaveCount(0)
    await page.getByRole('button', { name: 'LEVELS', exact: true }).click()
    await expectControlContrast(page, '#game-nav [data-active]')
    await expectControlContrast(page, '.lvl.now')
    await expectControlContrast(page, '.lvl.done')
    await expectControlContrast(page, '.lvl.done', '.sub')
  })
}
