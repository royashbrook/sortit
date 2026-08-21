// mechanical half of ART-SPEC.md. usage:
//   node tools/validate-art.mjs            # all themes in art/index.js
//   node tools/validate-art.mjs art/x.js   # one file while authoring
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const ALLOWED_TAGS = new Set(['g', 'path', 'circle', 'rect', 'ellipse', 'line', 'polygon', 'polyline'])

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

function dist(a, b) {
  const [r1, g1, b1] = hexToRgb(a)
  const [r2, g2, b2] = hexToRgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

const problems = []
const bad = (file, msg) => problems.push(`${file}: ${msg}`)

async function checkTheme(file, theme) {
  if (!theme || typeof theme !== 'object') return bad(file, 'no default export object')
  for (const field of ['key', 'title', 'tint']) {
    if (typeof theme[field] !== 'string' || !theme[field]) bad(file, `missing ${field}`)
  }
  if (!/^#[0-9A-Fa-f]{6}$/.test(theme.tint ?? '')) bad(file, `tint not #rrggbb: ${theme.tint}`)
  if (!Array.isArray(theme.items) || theme.items.length !== 12) {
    return bad(file, `items must be exactly 12, got ${theme.items?.length}`)
  }
  const keys = new Set()
  const colors = []
  theme.items.forEach((item, i) => {
    const id = `item[${i}] (${item.key ?? '?'})`
    if (!item.key || keys.has(item.key)) bad(file, `${id}: missing/duplicate key`)
    keys.add(item.key)
    if (!/^#[0-9A-Fa-f]{6}$/.test(item.color ?? '')) bad(file, `${id}: color not #rrggbb`)
    else colors.push([item.key, item.color])
    const svg = item.svg ?? ''
    if (!svg) return bad(file, `${id}: empty svg`)
    if (svg.length > 1400) bad(file, `${id}: svg ${svg.length} chars, spec cap is ~700, hard cap 1400`)
    if (/<\s*(svg|script|image|foreignObject|use|a)\b/i.test(svg)) bad(file, `${id}: forbidden tag`)
    if (/\bhref\s*=|url\s*\(|http/i.test(svg)) bad(file, `${id}: external reference`)
    for (const m of svg.matchAll(/<\s*([a-zA-Z]+)/g)) {
      if (!ALLOWED_TAGS.has(m[1])) bad(file, `${id}: tag <${m[1]}> not allowed`)
    }
  })
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = dist(colors[i][1], colors[j][1])
      if (d < 40) bad(file, `colors too close: ${colors[i][0]} ${colors[i][1]} vs ${colors[j][0]} ${colors[j][1]} (dist ${d.toFixed(0)})`)
    }
  }
}

const args = process.argv.slice(2)
if (args.length) {
  for (const arg of args) {
    const mod = await import(pathToFileURL(resolve(arg)).href)
    await checkTheme(arg, mod.default)
  }
} else {
  const { THEMES } = await import(pathToFileURL(resolve('src/lib/engine/art/index.js')).href)
  const keys = new Set()
  for (const theme of THEMES) {
    if (keys.has(theme.key)) bad('index', `duplicate theme key ${theme.key}`)
    keys.add(theme.key)
    await checkTheme(`art/${theme.key}.js`, theme)
  }
}

if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}
console.log(`art ok (${args.length || 'all'} theme${args.length === 1 ? '' : 's'})`)
