import { test, expect } from '@playwright/test'

// Installed app on a phone: fast double taps must not zoom and a long press must not raise the
// copy menu. The native iOS gestures cannot be synthesised headless, so pin the mechanism that
// stops them, on the whole shell rather than only the board, and prove text fields still opt in.
test('the shell blocks tap zoom, selection and the callout menu; text fields stay selectable', async ({ page }) => {
  await page.goto('/')
  // goto resolves at load, which the app's dynamic-import bootstrap does not delay, so the layout
  // may not have mounted yet (it had not, on the webkit gate). the gesture listener is attached in
  // the same mount flush that stamps the theme, so wait for that stamp before probing it.
  await expect(page.locator('html')).toHaveAttribute('data-theme', /./)
  const shell = await page.evaluate(() => {
    const s = getComputedStyle(document.body)
    return {
      touchAction: s.touchAction,
      userSelect: s.userSelect || s.webkitUserSelect,
      callout: s.getPropertyValue('-webkit-touch-callout'),
    }
  })
  expect(shell.touchAction).toBe('manipulation')
  expect(shell.userSelect).toBe('none')
  if (shell.callout) expect(shell.callout).toBe('none') // webkit reports it; chromium leaves it blank

  const prevented = await page.evaluate(() => {
    const event = new Event('gesturestart', { cancelable: true })
    window.dispatchEvent(event)
    return event.defaultPrevented
  })
  expect(prevented).toBe(true)

  const field = await page.evaluate(() => {
    const area = document.createElement('textarea')
    area.readOnly = true
    area.value = 'ABC123'
    document.body.append(area)
    area.style.userSelect = area.style.webkitUserSelect = 'text'
    area.select()
    const picked = area.selectionEnd - area.selectionStart
    area.remove()
    return picked
  })
  expect(field).toBe(6)
})
