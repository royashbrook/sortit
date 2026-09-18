import { LEVEL_COUNT, levelBoard, seedBoard } from './engine/levels.ts'
import { PARS } from './engine/pars.ts'
import { starsFor } from './engine/stars.ts'

export interface GameItem { uid: number; c: number; hid: boolean }
export interface UndoSnapshot { tubes: GameItem[][]; moves: number }
export interface Progress {
  current: number
  done: Record<number, number>
  stars: Record<number, number>
  welcomed: boolean
}
export interface SavedGame {
  kind: 'level' | 'seed'
  n?: number
  seed?: number
  par?: number | null
  tubes: GameItem[][]
  moves: number
  history: UndoSnapshot[]
  started: boolean
  elapsed: number
  seen: number[]
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const integer = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function invalid(label: string): never { throw new Error(`${label} is not a valid Sort It save`) }

export function normalizeProgress(value: unknown): Progress {
  if (!isRecord(value) || !integer(value.current) || value.current < 1 || value.current > LEVEL_COUNT) invalid('progress')
  const readMap = (input: unknown, stars: boolean): Record<number, number> => {
    if (!isRecord(input)) invalid('progress')
    const result: Record<number, number> = {}
    for (const [key, entry] of Object.entries(input)) {
      const level = Number(key)
      if (!integer(level) || level < 1 || level > LEVEL_COUNT || !integer(entry) || (stars && (entry < 1 || entry > 3))) invalid('progress')
      result[level] = entry
    }
    return result
  }
  const done = readMap(value.done ?? {}, false)
  const stars = readMap(value.stars ?? {}, true)
  for (const [key, moves] of Object.entries(done)) {
    const n = Number(key)
    if (stars[n] === undefined) stars[n] = starsFor(moves, PARS[n - 1] ?? null, null)
  }
  return { current: value.current, done, stars, welcomed: value.welcomed === true || Object.keys(done).length > 0 || value.current > 1 }
}

export function normalizeGame(value: unknown): SavedGame {
  if (!isRecord(value)) invalid('puzzle')
  const board = value.kind === 'level' && integer(value.n) && value.n >= 1 && value.n <= LEVEL_COUNT
    ? levelBoard(value.n)
    : value.kind === 'seed' && integer(value.seed) && value.seed > 0 ? seedBoard(value.seed) : null
  if (!board) invalid('puzzle')
  function readTubes(input: unknown): GameItem[][] {
    if (!Array.isArray(input) || input.length !== board!.tubes.length) invalid('puzzle')
    const ids = new Set<number>()
    return input.map((tube: unknown) => {
      if (!Array.isArray(tube) || tube.length > board!.params.capacity) invalid('puzzle')
      return tube.map((item: unknown) => {
        if (!isRecord(item) || !integer(item.uid) || ids.has(item.uid) || !integer(item.c)
          || item.c >= board!.params.colors || typeof item.hid !== 'boolean') invalid('puzzle')
        ids.add(item.uid)
        return { uid: item.uid, c: item.c, hid: item.hid }
      })
    })
  }
  const tubes = readTubes(value.tubes)
  const moves = value.moves ?? 0
  const elapsed = value.elapsed ?? 0
  const history = value.history ?? []
  const seen = value.seen ?? []
  if (!integer(moves) || typeof elapsed !== 'number' || !Number.isFinite(elapsed) || elapsed < 0
    || !Array.isArray(history) || !Array.isArray(seen) || !seen.every(integer)) invalid('puzzle')
  if (value.par !== undefined && value.par !== null && !integer(value.par)) invalid('puzzle')
  const snapshots = history.map((entry: unknown): UndoSnapshot => {
    if (!isRecord(entry) || !integer(entry.moves)) invalid('puzzle')
    return { tubes: readTubes(entry.tubes), moves: entry.moves }
  })
  return {
    kind: board.kind, ...(board.kind === 'level' ? { n: board.n } : { seed: board.seed }),
    ...(value.par !== undefined ? { par: value.par as number | null } : {}),
    tubes, moves, elapsed, history: snapshots, seen,
    started: typeof value.started === 'boolean' ? value.started : moves > 0,
  }
}
