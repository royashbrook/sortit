// the shell on a phone, checked in a real browser at 430x932.
//
//   npm run build && node tools/e2e-shell.mjs [--url http://127.0.0.1:8130/]
//
// without --url it serves build/ itself on a free port and stops that server
// when it is done. the verify scripts prove the engine and the store; this is
// the layer they cannot see: computed styles, the confetti canvas, what a tap
// on HINT leaves on the board.
//
// playwright is not a dependency of this repo. point PLAYWRIGHT_HOME at a
// checkout that has @playwright/test installed, or `npm i --no-save
// @playwright/test` here (that touches node_modules only).
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { levelBoard } from '../src/lib/engine/levels.js'

const require = createRequire(process.env.PLAYWRIGHT_HOME ? join(process.env.PLAYWRIGHT_HOME, 'package.json') : import.meta.url)
const { chromium } = require('@playwright/test')

const args = process.argv.slice(2)
const urlArg = args[args.indexOf('--url') + 1]
const root = resolve(fileURLToPath(import.meta.url), '../../build')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' }

// build/ is relative-path static output, so a plain file server is the real thing
async function serveBuild() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    let file = join(root, path.endsWith('/') ? `${path}index.html` : path)
    try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html') } catch { /* fall through to 404 */ }
    try {
      const body = await readFile(file)
      res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404); res.end()
    }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }
}

const failures = []
async function check(name, run) {
  try { await run(); console.log(`ok   ${name}`) }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`) }
}
const ok = (condition, message) => { if (!condition) throw new Error(message) }
const settle = ms => new Promise(done => setTimeout(done, ms))

const served = urlArg ? null : await serveBuild()
const url = urlArg ?? served.url
const browser = await chromium.launch()
const phone = { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }

// a fresh phone: empty storage, so the board is level 1
async function fresh(init) {
  const context = await browser.newContext(phone)
  if (init) await context.addInitScript(init)
  const page = await context.newPage()
  await page.goto(url)
  await page.locator('#board .tube').first().waitFor()
  return { page, context }
}
const tube = (page, index) => page.locator('#board .tube').nth(index)
const nav = (page, label) => page.locator('#game-nav button', { hasText: new RegExp(`^${label}$`) })

await check('a tap leaves no grey box on a post or a nav button', async () => {
  const { page, context } = await fresh()
  const highlight = sel => page.$eval(sel, el => getComputedStyle(el).getPropertyValue('-webkit-tap-highlight-color'))
  ok(await highlight('.tube') === 'rgba(0, 0, 0, 0)', `.tube highlight is ${await highlight('.tube')}`)
  ok(await highlight('#game-nav button') === 'rgba(0, 0, 0, 0)', `nav highlight is ${await highlight('#game-nav button')}`)
  await context.close()
})

await check('level 1 pieces grow past 64px on a phone', async () => {
  const { page, context } = await fresh()
  const box = await page.locator('#board .item').first().boundingBox()
  ok(box && box.width > 64, `piece is ${box?.width}px wide`)
  await context.close()
})

await check('the dusk theme darkens the board under the bolts look', async () => {
  const { page, context } = await fresh(() => localStorage.setItem('sortit:theme', 'dusk'))
  const dusk = 'rgb(27, 23, 36)' // the theme's --surface-sunk
  let seen = ''
  for (let i = 0; i < 20 && seen !== dusk; i++) {
    seen = await page.$eval('#board', el => getComputedStyle(el).backgroundColor)
    if (seen !== dusk) await settle(100)
  }
  ok(seen === dusk, `board paints ${seen}`)
  await context.close()
})

await check('a win\'s confetti is gone once the next level opens', async () => {
  const { page, context } = await fresh()
  for (const move of levelBoard(1).solution) { await tube(page, move.from).tap(); await tube(page, move.to).tap() }
  await page.locator('.won').waitFor()
  ok(await page.locator('canvas.confetti').count() === 1, 'the win did not rain confetti')
  await page.locator('.won button', { hasText: 'NEXT LEVEL' }).tap()
  await page.locator('#board-label', { hasText: 'level 2' }).waitFor()
  ok(await page.locator('canvas.confetti').count() === 0, 'confetti kept falling over level 2')
  await context.close()
})

await check('a hint lifts the piece on the source and rings the destination', async () => {
  const { page, context } = await fresh()
  await nav(page, 'HINT').tap()
  const from = page.locator('#board .tube.hint-from')
  const to = page.locator('#board .tube.hint')
  ok(await from.count() === 1, `${await from.count()} source tubes marked`)
  ok(await to.count() === 1, `${await to.count()} destination tubes marked`)
  await settle(250) // the lift transition
  const lifted = await from.locator('.item').last().evaluate(el => getComputedStyle(el).transform)
  ok(lifted !== 'none', 'the source piece did not lift')
  ok(await to.evaluate(el => el.classList.contains('hint-from')) === false, 'destination is also marked as the source')
  await context.close()
})

await browser.close()
served?.close()
if (failures.length) { console.error(`\n${failures.length} shell check(s) failed`); process.exit(1) }
console.log('\nshell checks passed')
