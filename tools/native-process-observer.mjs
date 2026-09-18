// Temporary Linux reproduction evidence, not a shipped runtime or release gate.
// Sample only browser process identities, never command lines or environments.
import { readFileSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export function selectProcesses(rows, previous) {
  const selected = new Map(rows.filter(row => /^(WebKit|MiniBrowser|WPE)/.test(row.name) || previous.has(`${row.pid}:${row.start}`)).map(row => [`${row.pid}:${row.start}`, row]))
  let changed = true
  while (changed) {
    changed = false
    const parents = new Set([...selected.values()].map(row => row.pid))
    for (const row of rows) {
      const key = `${row.pid}:${row.start}`
      if (parents.has(row.parent) && !selected.has(key)) { selected.set(key, row); changed = true }
    }
  }
  return selected
}

let previous = new Map()
function sample() {
  const rows = []
  for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8')
      const name = /^Name:\s+(.+)$/m.exec(status)?.[1]
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const start = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]
      const row = { pid: Number(pid), parent: Number(/^PPid:\s+(\d+)$/m.exec(status)?.[1]), name, start }
      rows.push(row)
    } catch (error) {
      // Process exit can race either read. Other failures must remain visible.
      if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error
    }
  }
  // Linux helper names need not start with WebKit. Follow browser descendants,
  // retaining an observed identity if its parent exits or it is reparented.
  const current = selectProcesses(rows, previous)
  for (const [key, row] of current) if (!previous.has(key)) console.log(JSON.stringify({ time: Date.now(), event: 'observed', ...row }))
  for (const [key, row] of previous) if (!current.has(key)) console.log(JSON.stringify({ time: Date.now(), event: 'absent', ...row }))
  previous = current
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  sample()
  const timer = setInterval(sample, 250)
  process.on('SIGTERM', () => { clearInterval(timer); sample() })
}
