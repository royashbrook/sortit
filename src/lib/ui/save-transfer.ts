import { SKINS } from '../engine/skins.ts'
import { SHELL_THEMES } from './themes.ts'
import { normalizeProgress, normalizeGame, isRecord } from '../save-schema.ts'
import { SAVE_GENERATION_KEY } from '../storage.ts'

export const SAVE_PREFIX = 'si1.'
export const ROLLBACK_KEY = 'sortit:pre-restore'

const SLOT_KEYS = {
  progress: 'sortit:progress',
  game: 'sortit:game',
  skin: 'sortit:skin',
  theme: 'sortit:theme',
  muted: 'sortit:muted',
} as const
type SlotName = keyof typeof SLOT_KEYS
export type SaveSlots = Record<SlotName, string | null>
type SaveStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
interface SavePayload { v: number; p: { c: number; d: (number | null)[]; s: (number | null)[]; w?: true } | null; g: Record<string, unknown> | null; k: string | null; t: string | null; m: string | null }
const MAX_CODE_LENGTH = 100_000
const MAX_SAVE_LENGTH = 1_000_000

const record = isRecord

function parse(raw: string | null, label: string): unknown {
  try { return JSON.parse(raw ?? 'null') } catch { throw new Error(`${label} is damaged`) }
}

function validateSlots(value: unknown): SaveSlots {
  const slots = value
  if (!record(slots)) throw new Error('save slots are missing')
  for (const name of Object.keys(SLOT_KEYS)) {
    if (!(slots[name] === null || typeof slots[name] === 'string')) throw new Error(`${name} is damaged`)
  }
  // Local resume supplies defaults for older stored shapes. The v1 transfer
  // format has always required these fields; importing must not invent them.
  if (typeof slots.progress === 'string') {
    const progress = parse(slots.progress, 'progress')
    if (!record(progress) || progress.done == null || progress.stars == null) throw new Error('progress is not a valid Sort It save')
    normalizeProgress(progress)
  }
  if (typeof slots.game === 'string') {
    const game = parse(slots.game, 'puzzle')
    if (!record(game) || ['moves', 'elapsed', 'history', 'seen'].some(key => game[key] == null)) throw new Error('puzzle is not a valid Sort It save')
    normalizeGame(game)
  }
  if (slots.skin !== null && !SKINS.some(skin => skin.key === slots.skin)) throw new Error('game look is not recognized')
  if (slots.theme !== null && !SHELL_THEMES.some(theme => theme.key === slots.theme)) throw new Error('colour theme is not recognized')
  if (slots.muted !== null && slots.muted !== '0' && slots.muted !== '1') throw new Error('sound setting is damaged')
  return slots as SaveSlots
}

export function readSaveSlots(storage: SaveStorage = localStorage): SaveSlots {
  return Object.fromEntries(Object.entries(SLOT_KEYS).map(([name, key]) => [name, storage.getItem(key)])) as SaveSlots
}

function writeSaveSlots(storage: SaveStorage, slots: SaveSlots) {
  for (const [name, key] of Object.entries(SLOT_KEYS)) {
    const value = slots[name as SlotName]
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    if (storage.getItem(key) !== value) throw new Error('save write could not be verified')
  }
}

function dense(map: Record<number, number>) {
  const levels = Object.keys(map).map(Number)
  const last = levels.length ? Math.max(...levels) : 0
  return Array.from({ length: last }, (_, index) => map[index + 1] ?? null)
}

function expand(values: unknown): Record<number, unknown> {
  if (!Array.isArray(values)) throw new Error('progress is damaged')
  return Object.fromEntries(values.flatMap((value, index) => value === null ? [] : [[index + 1, value]]))
}

function compact(slots: SaveSlots): SavePayload {
  const rawProgress = slots.progress === null ? null : parse(slots.progress, 'progress')
  const progress = rawProgress === null ? null : normalizeProgress(rawProgress)
  const game = slots.game === null ? null : parse(slots.game, 'puzzle')
  return {
    v: 1,
    // the first-run flag rides along only when set, so a save without it
    // round-trips byte for byte
    p: progress === null ? null : { c: progress.current, d: dense(progress.done), s: dense(progress.stars), ...(record(rawProgress) && rawProgress.welcomed === true ? { w: true } : {}) },
    // Keep the exact board, but not its growing undo stack. That makes a long
    // session portable by QR without changing any earned progress.
    g: record(game) ? { ...game, history: [] } : null,
    k: slots.skin,
    t: slots.theme,
    m: slots.muted,
  }
}

function expandPayload(payload: unknown) {
  if (!record(payload) || payload.v !== 1 || (payload.p !== null && !record(payload.p))) {
    throw new Error('that save code is from a newer version of Sort It')
  }
  const progress = payload.p === null ? null : JSON.stringify({
    current: payload.p.c,
    done: expand(payload.p.d),
    stars: expand(payload.p.s),
    ...(payload.p.w === true ? { welcomed: true } : {}),
  })
  return validateSlots({
    progress,
    game: payload.g === null ? null : JSON.stringify(payload.g),
    skin: payload.k,
    theme: payload.t,
    muted: payload.m,
  })
}

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function compress(bytes: Uint8Array) {
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

class SaveTooLargeError extends Error {}
async function decompress(bytes: Uint8Array) {
  // Count bytes while consuming and stop at the bound, rather than collecting the whole
  // inflated output and measuring it afterwards. A code under MAX_CODE_LENGTH can carry
  // tens of megabytes, so the cap has to bound the work, not just the result.
  const stream = new Blob([new Uint8Array(bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  try {
    const chunks = []
    let size = 0
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SAVE_LENGTH) {
        // Marked so decodeSave re-raises it instead of flattening it into "damaged":
        // an oversized save is not a corrupt one, and the player is told which.
        throw new SaveTooLargeError('that save code is too large')
      }
      chunks.push(value)
    }
    const out = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      out.set(chunk, offset)
      offset += chunk.byteLength
    }
    return out
  } finally {
    reader.cancel().catch(() => {})
  }
}

export async function encodeSave(storage: SaveStorage = localStorage) {
  return encodeSaveSlots(readSaveSlots(storage))
}

export async function encodeSaveSlots(slots: SaveSlots): Promise<string> {
  const payload = JSON.stringify(compact(validateSlots(slots)))
  const bytes = new TextEncoder().encode(payload)
  if (typeof CompressionStream === 'undefined') return `${SAVE_PREFIX}0.${toBase64Url(bytes)}`
  try { return `${SAVE_PREFIX}1.${toBase64Url(await compress(bytes))}` }
  catch { return `${SAVE_PREFIX}0.${toBase64Url(bytes)}` }
}

export async function decodeSave(code: string) {
  const text = String(code ?? '').trim()
  if (!text.startsWith(SAVE_PREFIX) || text.length > MAX_CODE_LENGTH) throw new Error('that is not a Sort It save code')
  const body = text.slice(SAVE_PREFIX.length)
  const dot = body.indexOf('.')
  if (dot < 1) throw new Error('that save code looks damaged')
  let bytes
  try { bytes = fromBase64Url(body.slice(dot + 1)) } catch { throw new Error('that save code looks damaged') }
  const flag = body.slice(0, dot)
  if (flag === '1') {
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot read a compressed save code')
    // An oversized save is not a corrupt one: re-raise that, flatten only real damage.
    try { bytes = await decompress(bytes) }
    catch (error) { if (error instanceof SaveTooLargeError) throw error; throw new Error('that save code looks damaged') }
  } else if (flag !== '0') {
    throw new Error('that save code is from a newer version of Sort It')
  }
  const json = new TextDecoder().decode(bytes)
  if (json.length > MAX_SAVE_LENGTH) throw new Error('that save code is too large')
  const payload = parse(json, 'save code')
  return { version: 1, slots: expandPayload(payload) }
}

function setGeneration(storage: SaveStorage, value: string | null): void {
  if (value === null) storage.removeItem(SAVE_GENERATION_KEY)
  else storage.setItem(SAVE_GENERATION_KEY, value)
  if (storage.getItem(SAVE_GENERATION_KEY) !== value) throw new Error('save handoff could not be verified')
}

export async function importSave(code: string, storage: SaveStorage = localStorage, now = Date.now, signal?: AbortSignal) {
  const incoming = await decodeSave(code)
  signal?.throwIfAborted()
  const current = readSaveSlots(storage)
  const oldRollback = storage.getItem(ROLLBACK_KEY)
  const generation = storage.getItem(SAVE_GENERATION_KEY)
  const rollback = JSON.stringify({ version: 1, savedAt: now(), slots: current })
  storage.setItem(ROLLBACK_KEY, rollback)
  if (storage.getItem(ROLLBACK_KEY) !== rollback) throw new Error('rollback copy could not be verified')
  try {
    writeSaveSlots(storage, incoming.slots)
    setGeneration(storage, crypto.randomUUID())
  } catch (error) {
    let restored = false
    try { writeSaveSlots(storage, current); setGeneration(storage, generation); restored = true } catch { /* exact rollback remains available */ }
    if (restored) {
      if (oldRollback === null) storage.removeItem(ROLLBACK_KEY)
      else storage.setItem(ROLLBACK_KEY, oldRollback)
    }
    throw error
  }
  return incoming
}

export function hasRollback(storage?: SaveStorage) {
  try {
    const payload = parse((storage ?? localStorage).getItem(ROLLBACK_KEY), 'rollback')
    return record(payload) && payload.version === 1 && !!validateSlots(payload.slots)
  } catch { return false }
}

export function restoreRollback(storage: SaveStorage = localStorage) {
  const raw = storage.getItem(ROLLBACK_KEY)
  const payload = parse(raw, 'rollback')
  if (!record(payload) || payload.version !== 1) throw new Error('rollback is damaged')
  const slots = validateSlots(payload.slots)
  const current = readSaveSlots(storage)
  const generation = storage.getItem(SAVE_GENERATION_KEY)
  try {
    writeSaveSlots(storage, slots)
    storage.removeItem(ROLLBACK_KEY)
    if (storage.getItem(ROLLBACK_KEY) !== null) throw new Error('rollback removal could not be verified')
    setGeneration(storage, crypto.randomUUID())
  } catch (error) {
    try { writeSaveSlots(storage, current); setGeneration(storage, generation); if (raw !== null) storage.setItem(ROLLBACK_KEY, raw) } catch { /* leave the recovery bytes available */ }
    throw error
  }
}

export function saveLink(code: string, base = location.href) {
  const url = new URL(base)
  url.search = ''
  url.hash = `save=${code}`
  return url.href
}

export function codeFromHash(hash: string) {
  const match = /(?:^#?|&)save=([^&]+)/.exec(String(hash ?? ''))
  try { return match ? decodeURIComponent(match[1]) : null } catch { return null }
}
