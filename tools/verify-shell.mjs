// the shell theme-token contract, on the parts kidgames' lint-tokens.mjs
// cannot see: sortit's themes are javascript (themes.ts writes token values
// onto the root), so the "every theme declares the whole set" and "the heart
// is the same in every theme" rules are checked here against that file, and
// the shell rules that must read those tokens are checked in app.css.
//
// app.css also carries a static copy of every theme (:root for the default,
// a [data-theme] block per alternate) so the lint can see a second theme. two
// copies of one truth drift unless something holds them together, so the last
// check here reads the css blocks back and requires them equal to themes.ts,
// token for token, value for value, no extras either way.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SHELL_THEMES, THEME_TOKENS } from '../src/lib/ui/themes.ts'

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

// the css mirror: the token declarations of a theme block, as themes.ts would spell them
const declared = block => Object.fromEntries(
  [...block.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map(([, token, value]) => [token, value.trim()]),
)
const stripComments = text => text.replace(/\/\*[\s\S]*?\*\//g, '')
for (const [index, theme] of SHELL_THEMES.entries()) {
  const selector = index === 0 ? ':root' : `[data-theme="${theme.key}"]`
  const block = new RegExp(`\\n${selector.replace(/[[\]]/g, '\\$&')} \\{([\\s\\S]*?)\\n\\}`).exec(css)?.[1]
  assert.ok(block, `app.css has no ${selector} block for the ${theme.key} theme`)
  assert.deepEqual(declared(stripComments(block)), theme.tokens, `app.css ${selector} drifted from themes.ts ${theme.key}`)
}

console.log(`shell tokens: ${THEME_TOKENS.length} declared in every theme, the css mirror matches themes.ts for ${SHELL_THEMES.map(t => t.key).join(', ')}, and the mark and the pressed button read them`)
