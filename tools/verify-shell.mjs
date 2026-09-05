// the shell theme-token contract, on the parts kidgames' lint-tokens.mjs
// cannot see: sortit's themes are javascript (themes.js writes token values
// onto the root), so the "every theme declares the whole set" and "the heart
// is the same in every theme" rules are checked here against that file, and
// the shell rules that must read those tokens are checked in app.css.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SHELL_THEMES, THEME_TOKENS } from '../src/lib/ui/themes.js'

const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8')
const root = /:root \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''
const rule = selector => css.slice(css.indexOf(`\n${selector}`)).split('}')[0]

for (const token of ['--font-mono', '--shadow-pressed', '--mark-heart']) {
  assert.match(root, new RegExp(`\\n\\s*${token}:`), `${token} is not declared on :root`)
  assert.ok(THEME_TOKENS.includes(token), `${token} is not in THEME_TOKENS`)
}
for (const theme of SHELL_THEMES) {
  for (const token of THEME_TOKENS) assert.ok(theme.tokens[token], `${theme.key} does not declare ${token}`)
  assert.equal(theme.tokens['--mark-heart'], SHELL_THEMES[0].tokens['--mark-heart'], `${theme.key} repaints the maker mark`)
}

assert.match(rule('.maker-mark {'), /font-family: var\(--font-mono\);/, 'the maker mark does not read --font-mono alone')
assert.match(rule('.mark-heart {'), /fill: var\(--mark-heart\)/, 'the heart is not the --mark-heart token')
assert.match(rule('.big:active {'), /box-shadow: var\(--shadow-pressed\)/, 'the pressed button does not read --shadow-pressed')

console.log('shell tokens: --font-mono, --shadow-pressed, --mark-heart declared in every theme and read by the mark and the pressed button')
