const problems = new Map<string, string>()
const listeners = new Set<(message: string) => void>()
const protectedSlots = new Set<string>()

export function reportStorageIssue(key: string, message: string): void {
  if (message) problems.set(key, message)
  else problems.delete(key)
  const current = [...new Set(problems.values())].join(' ')
  for (const listener of listeners) listener(current)
}

export function subscribeStorageStatus(listener: (message: string) => void): () => void {
  listeners.add(listener)
  listener([...new Set(problems.values())].join(' '))
  return () => { listeners.delete(listener) }
}

export type SlotRead = { ok: true; value: string | null } | { ok: false }

export function readSlotResult(key: string): SlotRead {
  if (typeof window === 'undefined') return { ok: false }
  try { return { ok: true, value: localStorage.getItem(key) } }
  catch { reportStorageIssue(key, 'storage is unavailable. progress may not survive closing.'); return { ok: false } }
}

export function readSlot(key: string): string | null {
  const result = readSlotResult(key)
  return result.ok ? result.value : null
}

export function writeSlot(key: string, value: string): boolean {
  if (protectedSlots.has(key)) return false
  try {
    localStorage.setItem(key, value)
    if (localStorage.getItem(key) !== value) throw new Error('save write was not retained')
    reportStorageIssue(key, '')
    return true
  } catch {
    reportStorageIssue(key, 'could not save. keep this tab open and use SAVE TRANSFER.')
    return false
  }
}

export function removeSlot(key: string): boolean {
  if (protectedSlots.has(key)) return false
  try {
    localStorage.removeItem(key)
    if (localStorage.getItem(key) !== null) throw new Error('save removal was not retained')
    reportStorageIssue(key, '')
    return true
  } catch {
    reportStorageIssue(key, 'could not save. keep this tab open and use SAVE TRANSFER.')
    return false
  }
}

export function readSavedSlot<T>(key: string, normalize: (value: unknown) => T): T | null {
  const raw = readSlot(key)
  if (raw === null) return null
  try {
    const value = normalize(JSON.parse(raw))
    protectedSlots.delete(key)
    return value
  } catch {
    // Keep the exact bytes before a fresh game can replace the unreadable slot.
    try {
      let recovery = `${key}:recovery`
      if (localStorage.getItem(recovery) !== null && localStorage.getItem(recovery) !== raw) {
        recovery += `:${crypto.randomUUID()}`
      }
      localStorage.setItem(recovery, raw)
      if (localStorage.getItem(recovery) !== raw) throw new Error('recovery copy was not retained')
      protectedSlots.delete(key)
    } catch { protectedSlots.add(key) }
    reportStorageIssue(`${key}:recovery`, protectedSlots.has(key)
      ? 'an unreadable save is protected. new progress cannot be saved until storage works.'
      : 'an unreadable save was kept for recovery. this is a fresh game.')
    return null
  }
}

export const SAVE_GENERATION_KEY = 'sortit:save-generation'
