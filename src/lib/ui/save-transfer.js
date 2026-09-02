import { LEVEL_COUNT, levelBoard, seedBoard } from '../engine/levels.js'
import { SKINS } from '../engine/skins.js'
import { SHELL_THEMES } from './themes.js'

export const SAVE_PREFIX = 'si1.'
export const ROLLBACK_KEY = 'sortit:pre-restore'

const SLOT_KEYS = {
  progress: 'sortit:progress',
  game: 'sortit:game',
  skin: 'sortit:skin',
  theme: 'sortit:theme',
  muted: 'sortit:muted',
}
const MAX_CODE_LENGTH = 100_000
const MAX_SAVE_LENGTH = 1_000_000

const record = value => value && typeof value === 'object' && !Array.isArray(value)
const nonNegativeInteger = value => Number.isInteger(value) && value >= 0

function parse(raw, label) {
  try { return JSON.parse(raw) } catch { throw new Error(`${label} is damaged`) }
}

function validNumberMap(value, clean) {
  return record(value) && Object.entries(value).every(([key, entry]) => {
    const level = Number(key)
    return Number.isInteger(level) && level >= 1 && level <= LEVEL_COUNT && clean(entry)
  })
}

function validateProgress(raw) {
  if (raw === null) return
  const value = parse(raw, 'progress')
  if (!record(value)
      || !Number.isInteger(value.current) || value.current < 1 || value.current > LEVEL_COUNT
      || !validNumberMap(value.done, nonNegativeInteger)
      || !validNumberMap(value.stars, star => Number.isInteger(star) && star >= 1 && star <= 3)) {
    throw new Error('progress is not a valid Sort It save')
  }
}

function validateGame(raw) {
  if (raw === null) return
  const value = parse(raw, 'puzzle')
  if (!record(value)) throw new Error('puzzle is not a valid Sort It save')
  const board = value.kind === 'level' && Number.isInteger(value.n) && value.n >= 1 && value.n <= LEVEL_COUNT
    ? levelBoard(value.n)
    : value.kind === 'seed' && Number.isInteger(value.seed) && value.seed > 0
      ? seedBoard(value.seed)
      : null
  const validItem = item => record(item)
    && nonNegativeInteger(item.uid)
    && Number.isInteger(item.c) && item.c >= 0 && item.c < board.params.colors
    && typeof item.hid === 'boolean'
  const validTubes = tubes => Array.isArray(tubes)
    && tubes.length === board.tubes.length
    && tubes.every(tube => Array.isArray(tube) && tube.length <= board.params.capacity && tube.every(validItem))
  const validHistory = Array.isArray(value.history) && value.history.every(entry =>
    record(entry) && nonNegativeInteger(entry.moves) && validTubes(entry.tubes))
  if (!board || !validTubes(value.tubes) || !nonNegativeInteger(value.moves)
      || !Number.isFinite(value.elapsed) || value.elapsed < 0 || !validHistory
      || !Array.isArray(value.seen) || !value.seen.every(nonNegativeInteger)) {
    throw new Error('puzzle is not a valid Sort It save')
  }
}

function validateSlots(slots) {
  if (!record(slots)) throw new Error('save slots are missing')
  for (const name of Object.keys(SLOT_KEYS)) {
    if (!(slots[name] === null || typeof slots[name] === 'string')) throw new Error(`${name} is damaged`)
  }
  validateProgress(slots.progress)
  validateGame(slots.game)
  if (slots.skin !== null && !SKINS.some(skin => skin.key === slots.skin)) throw new Error('game look is not recognized')
  if (slots.theme !== null && !SHELL_THEMES.some(theme => theme.key === slots.theme)) throw new Error('colour theme is not recognized')
  if (slots.muted !== null && slots.muted !== '0' && slots.muted !== '1') throw new Error('sound setting is damaged')
  return slots
}

export function readSaveSlots(storage = localStorage) {
  return Object.fromEntries(Object.entries(SLOT_KEYS).map(([name, key]) => [name, storage.getItem(key)]))
}

function writeSaveSlots(storage, slots) {
  for (const [name, key] of Object.entries(SLOT_KEYS)) {
    const value = slots[name]
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    if (storage.getItem(key) !== value) throw new Error('save write could not be verified')
  }
}

function dense(map) {
  const levels = Object.keys(map).map(Number)
  const last = levels.length ? Math.max(...levels) : 0
  return Array.from({ length: last }, (_, index) => map[index + 1] ?? null)
}

function expand(values) {
  if (!Array.isArray(values)) throw new Error('progress is damaged')
  return Object.fromEntries(values.flatMap((value, index) => value === null ? [] : [[index + 1, value]]))
}

function compact(slots) {
  const progress = slots.progress === null ? null : parse(slots.progress, 'progress')
  const game = slots.game === null ? null : parse(slots.game, 'puzzle')
  return {
    v: 1,
    p: progress === null ? null : { c: progress.current, d: dense(progress.done), s: dense(progress.stars) },
    // Keep the exact board, but not its growing undo stack. That makes a long
    // session portable by QR without changing any earned progress.
    g: game === null ? null : { ...game, history: [] },
    k: slots.skin,
    t: slots.theme,
    m: slots.muted,
  }
}

function expandPayload(payload) {
  if (!record(payload) || payload.v !== 1 || (payload.p !== null && !record(payload.p))) {
    throw new Error('that save code is from a newer version of Sort It')
  }
  const progress = payload.p === null ? null : JSON.stringify({
    current: payload.p.c,
    done: expand(payload.p.d),
    stars: expand(payload.p.s),
  })
  return validateSlots({
    progress,
    game: payload.g === null ? null : JSON.stringify(payload.g),
    skin: payload.k,
    theme: payload.t,
    muted: payload.m,
  })
}

function toBase64Url(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

async function compress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function encodeSave(storage = localStorage) {
  const slots = validateSlots(readSaveSlots(storage))
  const payload = JSON.stringify(compact(slots))
  const bytes = new TextEncoder().encode(payload)
  if (typeof CompressionStream === 'undefined') return `${SAVE_PREFIX}0.${toBase64Url(bytes)}`
  try { return `${SAVE_PREFIX}1.${toBase64Url(await compress(bytes))}` }
  catch { return `${SAVE_PREFIX}0.${toBase64Url(bytes)}` }
}

export async function decodeSave(code) {
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
    try { bytes = await decompress(bytes) } catch { throw new Error('that save code looks damaged') }
  } else if (flag !== '0') {
    throw new Error('that save code is from a newer version of Sort It')
  }
  const json = new TextDecoder().decode(bytes)
  if (json.length > MAX_SAVE_LENGTH) throw new Error('that save code is too large')
  const payload = parse(json, 'save code')
  return { version: 1, slots: expandPayload(payload) }
}

export async function importSave(code, storage = localStorage, now = Date.now) {
  const incoming = await decodeSave(code)
  const current = readSaveSlots(storage)
  const oldRollback = storage.getItem(ROLLBACK_KEY)
  const rollback = JSON.stringify({ version: 1, savedAt: now(), slots: current })
  storage.setItem(ROLLBACK_KEY, rollback)
  if (storage.getItem(ROLLBACK_KEY) !== rollback) throw new Error('rollback copy could not be verified')
  try {
    writeSaveSlots(storage, incoming.slots)
  } catch (error) {
    let restored = false
    try { writeSaveSlots(storage, current); restored = true } catch { /* exact rollback remains available */ }
    if (restored) {
      if (oldRollback === null) storage.removeItem(ROLLBACK_KEY)
      else storage.setItem(ROLLBACK_KEY, oldRollback)
    }
    throw error
  }
  return incoming
}

export function hasRollback(storage = localStorage) {
  try {
    const payload = parse(storage.getItem(ROLLBACK_KEY), 'rollback')
    return payload.version === 1 && !!validateSlots(payload.slots)
  } catch { return false }
}

export function restoreRollback(storage = localStorage) {
  const raw = storage.getItem(ROLLBACK_KEY)
  const payload = parse(raw, 'rollback')
  if (!record(payload) || payload.version !== 1) throw new Error('rollback is damaged')
  const slots = validateSlots(payload.slots)
  const current = readSaveSlots(storage)
  try {
    writeSaveSlots(storage, slots)
    storage.removeItem(ROLLBACK_KEY)
  } catch (error) {
    try { writeSaveSlots(storage, current) } catch { /* leave the rollback slot intact */ }
    throw error
  }
}

export function saveLink(code, base = location.href) {
  const url = new URL(base)
  url.search = ''
  url.hash = `save=${code}`
  return url.href
}

export function codeFromHash(hash) {
  const match = /(?:^#?|&)save=([^&]+)/.exec(String(hash ?? ''))
  try { return match ? decodeURIComponent(match[1]) : null } catch { return null }
}
