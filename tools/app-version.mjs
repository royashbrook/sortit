import { execFileSync } from 'node:child_process'

export function formatVersion(tag, distance) {
  const parts = tag.replace(/^v/, '').split('.')
  if (parts.length > 3 || !parts.every(part => /^\d+$/.test(part))) throw new Error('invalid version tag')
  while (parts.length < 3) parts.push('0')

  const commits = Number.parseInt(distance, 10)
  if (!Number.isSafeInteger(commits) || commits < 0) throw new Error('invalid commit distance')
  parts[2] = String(Number(parts[2]) + commits)
  return parts.join('.')
}

export function appVersion() {
  try {
    const run = args => execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const tag = run(['describe', '--tags', '--abbrev=0'])
    return formatVersion(tag, run(['rev-list', `${tag}..HEAD`, '--count']))
  } catch {
    return '0.0.0-dev'
  }
}
