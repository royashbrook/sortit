// the first-run card in a real browser at 430x932: fresh storage shows it
// once, the second load of the same storage does not.
//
//   npm run build && node tools/e2e-first-run.mjs [--url http://127.0.0.1:8130/]
//
// without --url it serves build/ itself on a free port. playwright is not a
// dependency of this repo: point PLAYWRIGHT_HOME at a checkout that has
// @playwright/test installed, or `npm i --no-save @playwright/test` here.
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(process.env.PLAYWRIGHT_HOME ? join(process.env.PLAYWRIGHT_HOME, 'package.json') : import.meta.url)
const { chromium } = require('@playwright/test')

const args = process.argv.slice(2)
const urlArg = args[args.indexOf('--url') + 1]
const root = resolve(fileURLToPath(import.meta.url), '../../build')
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' }

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

const served = urlArg ? null : await serveBuild()
const url = urlArg ?? served.url
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
const page = await context.newPage()
const failures = []
const ok = (condition, message) => { if (condition) console.log(`ok   ${message}`); else { failures.push(message); console.error(`FAIL ${message}`) } }

await page.goto(url)
await page.locator('#board .tube').first().waitFor()
ok(await page.locator('.first-run').count() === 1, 'a fresh phone shows the first-run card on level 1')
ok(await page.locator('#board-label').innerText() === 'level 1', 'the board under the card is level 1')

await page.reload()
await page.locator('#board .tube').first().waitFor()
ok(await page.locator('.first-run').count() === 0, 'the second load does not show the card')

await browser.close()
served?.close()
if (failures.length) { console.error(`\n${failures.length} first-run check(s) failed`); process.exit(1) }
console.log('\nfirst-run checks passed')
