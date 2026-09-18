import { test, expect } from '@playwright/test'
import { levelBoard } from '../src/lib/engine/levels.ts'
import { inputEvidence } from './input-evidence.js'

test('play, settings, save QR and explicit sharing keep puzzle data local', async ({ page, context, baseURL }, testInfo) => {
  const evidence = await inputEvidence(page)
  const requests = []
  const sockets = []
  context.on('request', request => requests.push({ url: request.url(), method: request.method(), body: request.postData() }))
  page.on('websocket', socket => sockets.push(socket.url()))
  await page.addInitScript(() => {
    window.testShares = []
    window.testCopies = []
    Object.defineProperty(navigator, 'share', { value: async payload => window.testShares.push(payload) })
    Object.defineProperty(navigator, 'canShare', { value: () => true })
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => window.testCopies.push(text) } })
  })
  await page.goto('/')
  await expect(page.locator('.first-run')).toBeVisible()
  await page.getByRole('button', { name: 'GOT IT', exact: true }).tap()
  await page.evaluate(() => navigator.serviceWorker.ready)

  try {
    for (const move of levelBoard(1).solution) {
      await evidence.tap(move.from, () => page.locator('.tube').nth(move.from).tap())
      await evidence.tap(move.to, () => page.locator('.tube').nth(move.to).tap())
    }
    await expect(page.locator('.won')).toBeVisible()
  } finally {
    await evidence.attach(testInfo)
  }
  expect(await page.evaluate(() => window.testShares)).toEqual([])
  await page.getByRole('button', { name: 'SEND THIS PUZZLE TO A FRIEND', exact: true }).tap()
  const shared = await page.evaluate(() => window.testShares)
  expect(shared).toHaveLength(1)
  expect(new URL(shared[0].url).search).toBe('?level=1')
  expect(new URL(shared[0].url).hash).toBe('')
  await page.getByRole('button', { name: 'NEXT LEVEL', exact: true }).tap()

  await page.getByRole('button', { name: 'LOOKS', exact: true }).tap()
  for (const name of ['Block Mine', 'Neon Dash', 'Kawaii Pop', 'Dice Table', 'Classic', 'Nuts & Bolts']) {
    await page.getByRole('button', { name, exact: true }).tap()
  }
  for (const name of ['Dusk', 'Bubblegum', 'Daylight']) await page.getByRole('button', { name, exact: true }).tap()
  await page.getByRole('button', { name: 'DONE', exact: true }).tap()
  await page.getByRole('button', { name: 'MORE', exact: true }).tap()
  await page.getByRole('button', { name: 'SOUND ON', exact: true }).tap()
  await page.getByRole('button', { name: 'MOVE MY SAVE', exact: true }).tap()
  await expect(page.getByLabel('Your save code')).toHaveValue(/^si1\./)
  expect(await page.evaluate(() => window.testCopies)).toEqual([])
  await page.getByRole('button', { name: 'SHOW AS QR CODE', exact: true }).tap()
  await expect(page.locator('.save-qr')).toBeVisible()
  await page.getByRole('button', { name: 'COPY SAVE CODE', exact: true }).tap()
  expect(await page.evaluate(() => window.testCopies)).toEqual([await page.getByLabel('Your save code').inputValue()])
  await page.getByRole('button', { name: 'BACK', exact: true }).tap()
  await page.getByRole('button', { name: 'MORE', exact: true }).tap()
  await page.getByRole('button', { name: 'ABOUT', exact: true }).tap()
  await page.locator('.check-updates').tap()
  await expect(page.getByRole('button', { name: 'up to date', exact: true })).toBeVisible()

  expect(requests.length).toBeGreaterThan(10)
  expect(requests.some(request => request.url.includes('update-probe'))).toBe(true)
  expect(requests.filter(request => new URL(request.url).origin !== new URL(baseURL).origin)).toEqual([])
  expect(requests.filter(request => request.method !== 'GET' || request.body !== null)).toEqual([])
  expect(requests.filter(request => !['', '?update-probe'].includes(new URL(request.url).search))).toEqual([])
  expect(requests.some(request => request.url.includes('si1.'))).toBe(false)
  expect(sockets).toEqual([])
  expect(await context.cookies()).toEqual([])
})

test.use({ hasTouch: true })
