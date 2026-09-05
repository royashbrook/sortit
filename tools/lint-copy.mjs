// copy lint for the repo's own public text.
//
//   node tools/lint-copy.mjs
//
// verify-levels/verify-stars prove the ENGINE. nothing proved the repo's own
// words, which is how a "no tracking" claim (banned by the standard, we run a
// cookieless beacon) could ship and only a human catch it. this closes that hole
// and is par's carry-forward from the svelte pilot: the vanilla lint scanned only
// *.md/*.html, but svelte moves the about/footer/maker-mark copy into *.svelte, so
// those files are added to the glob or the very copy svelte introduced goes unseen.
//
// the trap this is built around: the rule text itself has to quote the banned
// phrase, so a naive grep flags the very lines that define the rule. rather than
// guess at intent, a line opts out explicitly with a `copy-lint-ok` marker: a
// comment about why. no heuristics, no false positives.
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const MARKER = 'copy-lint-ok'

const RULES = [
  {
    name: 'false privacy claim',
    // banned outright in our copy: we run a beacon, so these sentences are not true
    test: /\bno tracking\b|\bno analytics\b|\bwe do ?n'?o?t track\b/i,
    why: 'we run a cookieless beacon, so this is false. use the ethos line from the standard.',
  },
  {
    name: 'em-dash',
    test: /—|\s--\s/,
    why: 'house voice uses a colon, a comma, or parentheses instead.',
  },
]

// the house ethos line, verbatim and lowercase, where a store or a search
// result reads it. the about screen has it by hand; these two drifted to
// sentence case once, and case-insensitive checks let that through.
const ETHOS = 'a cosy sorting puzzle for kids. no ads, no lives, no timers, nothing to buy, no accounts, no cookies, nothing sold or shared. works offline.'
const VERBATIM = [
  { file: 'src/app.html', text: ETHOS },
  { file: 'static/manifest.json', text: ETHOS },
]

const files = execSync("git ls-files '*.md' '*.html' '*.svelte'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const hits = []
for (const { file, text } of VERBATIM) {
  if (!readFileSync(file, 'utf8').includes(text)) {
    hits.push({ file, line: 0, rule: { name: 'ethos not verbatim', why: `must contain exactly: ${text}` }, text: '' })
  }
}
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (line.includes(MARKER)) return
    for (const rule of RULES) {
      if (rule.test.test(line)) hits.push({ file, line: i + 1, rule, text: line.trim().slice(0, 90) })
    }
  })
}

for (const h of hits) console.log(`${h.file}:${h.line}  ${h.rule.name}\n    ${h.text}\n    ${h.rule.why}`)
console.log(hits.length ? `\n${hits.length} problem(s) in ${files.length} files` : `clean: ${files.length} files`)
process.exit(hits.length ? 1 : 0)
