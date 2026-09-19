import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 430, height: 932 }, hasTouch: true })

for (const skin of ['glass', 'bolts', 'mine', 'dash', 'kawaii', 'dice', 'tubes']) {
  test(`${skin}: dense board survives portrait and short-landscape rotation`, async ({ page }) => {
    await page.addInitScript(skin => {
      localStorage.setItem('sortit:skin', skin)
      localStorage.setItem('sortit:progress', JSON.stringify({ current: 600, done: {}, stars: {}, welcomed: true }))
    }, skin)
    await page.goto('/')
    await expect(page.locator('#board')).toHaveAttribute('data-skin', skin)
    const contents = () => page.locator('.tube').evaluateAll(tubes => tubes.map(tube => [...tube.querySelectorAll('.item')].map(item => item.dataset.uid)))
    const before = await contents()
    expect(before.length).toBeGreaterThan(10)

    for (const [width, height] of [[430, 932], [932, 430], [360, 640], [640, 360], [430, 740]]) {
      await page.setViewportSize({ width, height })
      await expect.poll(() => page.locator('#board').evaluate(board => {
        const frame = board.getBoundingClientRect()
        const dock = document.querySelector('#game-nav').getBoundingClientRect()
        const problems = []
        if (document.documentElement.scrollWidth > innerWidth) problems.push('horizontal overflow')
        if (frame.bottom > dock.top) problems.push('board behind dock')
        for (const [index, tube] of [...board.querySelectorAll('.tube')].entries()) {
          const box = tube.getBoundingClientRect()
          if (box.width < 44 || box.height < 44) problems.push(`stack ${index}: target below 44px`)
          if (box.left < frame.left - 1 || box.right > frame.right + 1 || box.top < frame.top - 1 || box.bottom > frame.bottom + 1) problems.push(`stack ${index}: outside board`)
          if (!tube.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))) problems.push(`stack ${index}: covered`)
        }
        for (const button of document.querySelectorAll('#game-nav button')) {
          const box = button.getBoundingClientRect()
          if (!button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))) problems.push(`dock ${button.textContent}: covered`)
        }
        return problems
      }), { message: `${skin} at ${width}x${height}` }).toEqual([])
      expect(await contents()).toEqual(before)
    }
    await page.locator('.tube').first().tap()
    await expect(page.locator('.tube').first()).toHaveClass(/sel/)
    await page.getByRole('button', { name: 'MORE', exact: true }).tap()
    await expect(page.getByRole('dialog', { name: 'More', exact: true })).toBeVisible()
  })
}
