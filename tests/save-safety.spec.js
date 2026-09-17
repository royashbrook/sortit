import { test, expect } from '@playwright/test'
import { levelBoard } from '../src/lib/engine/levels.ts'
import { decodeSave, encodeSaveSlots } from '../src/lib/ui/save-transfer.ts'

const progress = { current: 12, done: { 1: 10 }, stars: { 1: 3 }, welcomed: true }
const board = levelBoard(12)
let uid = 0
const incoming = {
  progress: JSON.stringify(progress),
  game: JSON.stringify({ kind: 'level', n: 12, tubes: board.tubes.map(tube => tube.map(c => ({ c, uid: uid++, hid: false }))),
    moves: 3, history: [], elapsed: 1234, seen: [], started: true }),
  skin: 'mine', theme: 'dusk', muted: '1',
}
const welcome = () => {
  if (!localStorage.getItem('sortit:progress')) localStorage.setItem('sortit:progress', JSON.stringify({ current: 1, done: {}, stars: {}, welcomed: true }))
}
const game = page => page.evaluate(() => JSON.parse(localStorage.getItem('sortit:game')))
const boardState = async page => {
  const { tubes, moves, history } = await game(page)
  return { tubes, moves, history }
}
const transfer = async page => {
  await page.getByRole('button', { name: 'MORE', exact: true }).click()
  await page.getByRole('button', { name: 'MOVE MY SAVE', exact: true }).click()
  await expect(page.getByLabel('Your save code')).toHaveValue(/^si1\./)
}
const move = async page => {
  await page.locator('.tube').nth(0).click()
  await page.locator('.tube').nth(2).click()
  await expect.poll(async () => (await game(page)).moves).toBe(1)
}

test.beforeEach(async ({ context }) => { await context.addInitScript(welcome) })

test('malformed undo is retained for recovery and cannot crash Undo', async ({ page }) => {
  const corrupt = JSON.stringify({ ...JSON.parse(incoming.game), history: [{ tubes: [null], moves: 0 }] })
  await page.addInitScript(raw => localStorage.setItem('sortit:game', raw), corrupt)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.locator('.storage-warning')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('sortit:game:recovery'))).toBe(corrupt)
  await page.getByRole('button', { name: 'UNDO', exact: true }).click()
  await expect(page.locator('#board')).toBeVisible()
  expect(errors).toEqual([])
})

test('blocked writes stay visible and transfer exports the live unsaved move', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#board')).toBeVisible()
  await page.evaluate(() => {
    const set = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('sortit:')) throw new DOMException('Blocked for test', 'QuotaExceededError')
      return set.call(this, key, value)
    }
  })
  await page.locator('.tube').nth(0).click()
  await page.locator('.tube').nth(2).click()
  await expect(page.locator('.storage-warning')).toBeVisible()
  expect((await game(page)).moves).toBe(0)
  await page.getByRole('button', { name: 'SAVE TRANSFER', exact: true }).click()
  await expect(page.getByLabel('Your save code')).toHaveValue(/^si1\./)
  const exported = await decodeSave(await page.getByLabel('Your save code').inputValue())
  expect(JSON.parse(exported.slots.game).moves).toBe(1)
  expect(JSON.parse(exported.slots.game).tubes[2]).toHaveLength(1)
})

test('reset and import cancellation preserve the existing save', async ({ page }) => {
  await page.goto('/')
  await move(page)
  const before = await boardState(page)
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'RESET', exact: true }).click()
  expect(await boardState(page)).toEqual(before)
  await transfer(page)
  await page.getByLabel('Paste a save code here:').fill(await encodeSaveSlots(incoming))
  const bytes = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))))
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'LOAD THIS SAVE', exact: true }).click()
  expect(await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))))).toBe(bytes)
})

test('transfer still opens when access to localStorage itself is denied', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#board')).toBeVisible()
  await page.evaluate(() => Object.defineProperty(window, 'localStorage', {
    configurable: true, get() { throw new DOMException('Storage denied', 'SecurityError') },
  }))
  await page.locator('.tube').nth(0).click()
  await page.locator('.tube').nth(2).click()
  await page.getByRole('button', { name: 'SAVE TRANSFER', exact: true }).click()
  await expect(page.getByLabel('Your save code')).toHaveValue(/^si1\./)
  const exported = await decodeSave(await page.getByLabel('Your save code').inputValue())
  expect(JSON.parse(exported.slots.game).moves).toBe(1)
})

test('two open tabs adopt an import and the old tab cannot restore its previous board', async ({ page, context }) => {
  await page.goto('/')
  await move(page)
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.locator('#board-label')).toHaveText('level 1')
  await transfer(page)
  await page.getByLabel('Paste a save code here:').fill(await encodeSaveSlots(incoming))
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'LOAD THIS SAVE', exact: true }).click()
  await expect(page.locator('.transfer-status')).toHaveText('progress moved.')
  await expect(other.locator('#board-label')).toHaveText('level 12')
  await expect(other.locator('#board')).toHaveAttribute('data-skin', 'mine')
  await expect(other.locator('html')).toHaveAttribute('data-theme', 'dusk')
  await other.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')))
  expect((await game(page)).n).toBe(12)
  expect((await game(page)).moves).toBe(3)
  const bytes = await page.evaluate(() => localStorage.getItem('sortit:game'))
  page.once('dialog', dialog => dialog.dismiss())
  await page.getByRole('button', { name: 'UNDO LAST TRANSFER', exact: true }).click()
  expect(await page.evaluate(() => localStorage.getItem('sortit:game'))).toBe(bytes)
})
