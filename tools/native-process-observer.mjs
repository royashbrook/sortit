// Temporary Linux reproduction evidence, not a shipped runtime or release gate.
// Sample only browser process identities, never command lines or environments.
import { readFileSync, readdirSync } from 'node:fs'

let previous = new Map()
function sample() {
  const current = new Map()
  for (const pid of readdirSync('/proc').filter(name => /^\d+$/.test(name))) {
    try {
      const status = readFileSync(`/proc/${pid}/status`, 'utf8')
      const name = /^Name:\s+(.+)$/m.exec(status)?.[1]
      if (!/^(WebKit|MiniBrowser)/.test(name ?? '')) continue
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const start = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19]
      const row = { pid: Number(pid), parent: Number(/^PPid:\s+(\d+)$/m.exec(status)?.[1]), name, start }
      const key = `${pid}:${start}`
      current.set(key, row)
      if (!previous.has(key)) console.log(JSON.stringify({ time: Date.now(), event: 'observed', ...row }))
    } catch (error) {
      // Process exit can race either read. Other failures must remain visible.
      if (error.code !== 'ENOENT' && error.code !== 'ESRCH') throw error
    }
  }
  for (const [key, row] of previous) if (!current.has(key)) console.log(JSON.stringify({ time: Date.now(), event: 'absent', ...row }))
  previous = current
}
sample()
const timer = setInterval(sample, 250)
process.on('SIGTERM', () => { clearInterval(timer); sample() })
