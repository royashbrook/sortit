// the game store: all UI state as runes, wrapping the pure engine. it imports
// the engine (solver/levels/stars/skins) and NEVER the other way round, so the
// node verifiers keep proving the same modules the game runs (shell spec rule 1).
import { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT, levelBoard, seedBoard } from '../engine/levels.ts'
import { isComplete, isWin, optimal, solve } from '../engine/solver.ts'
import { THEMES, themeForWorld } from '../engine/art/index.ts'
import { STAR_SLACK, parFor, starsFor } from '../engine/stars.ts'
import { SKINS, loadSkin, saveSkin } from '../engine/skins.ts'
// the SHELL theme layer (the chrome's look), orthogonal to the game-art skin layer
import { SHELL_THEMES, applyTheme, loadTheme, saveTheme } from './themes.ts'
import { dailySeed } from '../engine/seed.ts'
import { sound } from './sounds.ts'
import { confetti, clearConfetti } from './confetti.ts'
import { landingTimes } from './flight.ts'
import { createSessionClock, formatPlayTime } from './play-clock.ts'
import { normalizeGame, normalizeProgress, type GameItem, type Progress, type SavedGame, type UndoSnapshot } from '../save-schema.ts'
import { readSavedSlot, readSlotResult, writeSlot, removeSlot, subscribeStorageStatus, SAVE_GENERATION_KEY } from '../storage.ts'
import type { Board, Skin, Move } from '../engine/types.ts'
import type { SaveSlots } from './save-transfer.ts'
type PlayingBoard = Board & { par: number | null }

export { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT }

const HINT_BUDGET = { maxNodes: 60000 }
const PROGRESS_KEY = 'sortit:progress'
// the game in progress: saved on every change so the app opens straight back
// into it (a won board is not a game in progress, it clears the slot)
const GAME_KEY = 'sortit:game'

function loadProgress(): Progress {
  return readSavedSlot(PROGRESS_KEY, normalizeProgress) ?? { current: 1, done: {}, stars: {}, welcomed: false }
}

export function createStore() {
  let screen = $state<'game' | 'levels'>('game')
  let board = $state<PlayingBoard | null>(null)
  let playSeq = 0                   // bumped per play(), so a stale deferred par lands nowhere
  let theme = $state(THEMES[0])
  let skin = $state(loadSkin())
  let shellTheme = $state(loadTheme())
  const initialProgress = loadProgress()
  const firstRun = !initialProgress.welcomed
  initialProgress.welcomed = true
  let progress = $state(initialProgress)
  let world = $state(0)

  let tubes = $state<GameItem[][]>([])
  let capacity = $state(4)
  let selected = $state<number | null>(null)
  let moves = $state(0)
  let over = $state(false)
  let stuck = $state(false)
  let won = $state<{ stars: number; detail: string; score: string; perfect: boolean; canNext: boolean } | null>(null)
  let clockText = $state('0:00')

  let history: UndoSnapshot[] = []
  let seen = new Set<number>()
  let uidNext = 0
  let savingGame = true            // a successful transfer retires this outgoing store
  let disposed = false
  let generation = readSlotResult(SAVE_GENERATION_KEY)
  let storageMessage = $state('')
  const unsubscribeStorage = subscribeStorageStatus(message => { storageMessage = message })
  const playClock = createSessionClock()
  let dialog = $state<string | null>(null)
  let hintTubes = $state<number[]>([])
  let moveSeq = $state(0)           // bumps each move so Board runs its FLIP
  let lastMovedUids = $state<number[]>([])
  // the one-time first-run card. it is flagged as shown the moment it shows,
  // so a reload never brings it back; GOT IT or the first move takes it down
  let welcome = $state(firstRun)
  if (firstRun) saveProgress(initialProgress)

  const colorsOf = (t: GameItem[]) => t.map(i => i.c)
  const numeric = () => tubes.map(colorsOf)

  function tick() {
    if (screen !== 'game') return
    clockText = formatPlayTime(playClock.elapsed())
  }
  const timer = typeof window !== 'undefined' ? setInterval(tick, 500) : undefined
  let parTimer: ReturnType<typeof setTimeout> | undefined
  let hintTimer: ReturnType<typeof setTimeout> | undefined
  // a tab restored in the background boots hidden; the page reports later changes
  if (typeof document !== 'undefined') playClock.hold('hidden', document.hidden)

  function saveOwnership(): 'current' | 'unavailable' | 'retired' {
    if (!savingGame || disposed) return 'retired'
    const current = readSlotResult(SAVE_GENERATION_KEY)
    if (!generation.ok || !current.ok) return 'unavailable'
    if (current.value !== generation.value) { reloadSave(); return 'retired' }
    return 'current'
  }
  function canSave(): boolean {
    return saveOwnership() === 'current'
  }
  function saveProgress(value: Progress) {
    if (canSave()) writeSlot(PROGRESS_KEY, JSON.stringify(value))
  }

  function revealTops(changed: boolean) {
    let revealed = false
    for (const t of tubes) {
      const top = t[t.length - 1]
      if (top && top.hid) { top.hid = false; revealed = true }
      if (t.length && isComplete(colorsOf(t), capacity)) {
        for (const it of t) if (it.hid) { it.hid = false; revealed = true }
      }
    }
    for (const t of tubes) for (const it of t) if (!it.hid) seen.add(it.uid)
    if (revealed && changed) sound.reveal()
  }

  function visibleRun(index: number) {
    const tube = tubes[index]
    const top = tube[tube.length - 1]
    let n = 0
    for (let i = tube.length - 1; i >= 0; i--) { if (tube[i].hid || tube[i].c !== top.c) break; n++ }
    return Math.max(1, n)
  }

  function playerMove(from: number, to: number): Move | null {
    const src = tubes[from], dst = tubes[to]
    if (!src.length || from === to) return null
    const space = capacity - dst.length
    if (space === 0) return null
    if (dst.length && dst[dst.length - 1].c !== src[src.length - 1].c) return null
    return { from, to, count: Math.min(visibleRun(from), space) }
  }

  const moveVerb = (color: number) => skin.pieces?.[color]?.verb ?? skin.motion?.land ?? 'drop'

  function anyPlayerMove() {
    for (let from = 0; from < tubes.length; from++) {
      if (!tubes[from].length || isComplete(colorsOf(tubes[from]), capacity)) continue
      for (let to = 0; to < tubes.length; to++) if (from !== to && playerMove(from, to)) return true
    }
    return false
  }

  function finishWin() {
    if (!board) return
    over = true
    playClock.finish()
    tick()
    const stars = starsFor(moves, board.par, board.solution.length)
    let detail = `sorted in ${moves} moves, ${clockText}!`
    let canNext = false
    if (board.kind === 'level') {
      // a best stays as earned on whichever deal it was played, and the star
      // goal is always this board's own par: redealing a level never erases
      // an old best and never rescores it against the new deal
      const best = progress.done[board.n]
      if (best == null || moves < best) {
        progress.done = { ...progress.done, [board.n]: moves }
        if (best != null) detail = `sorted in ${moves} moves, ${clockText}, your best yet!`
      } else {
        detail = `sorted in ${moves} moves, ${clockText}. your best is ${best}.`
      }
      if (stars > (progress.stars[board.n] ?? 0)) progress.stars = { ...progress.stars, [board.n]: stars }
      if (board.n === progress.current && progress.current < LEVEL_COUNT) progress.current += 1
      saveProgress($state.snapshot(progress))
      canNext = board.n < LEVEL_COUNT
    }
    const score = board.par != null
      ? (moves <= board.par ? `PERFECT! ${board.par} is the best possible.`
        : `3 stars at ${board.par + STAR_SLACK.three} or fewer. best possible: ${board.par}.`)
      : ''
    won = { stars, detail, score, perfect: board.par != null && moves <= board.par, canNext }
    sound.win()
    confetti((skin.pieces ?? theme.items).map(i => i.color), skin.key)
    saveGame()
  }

  // the in-progress slot. tubes carry uids and hidden flags, history is the
  // undo stack, elapsed keeps the clock honest across a relaunch.
  function gameSnapshot(): SavedGame | null {
    if (!board || over) return null
    return {
      kind: board.kind, ...(board.kind === 'level' ? { n: board.n } : { seed: board.seed }), par: board.par,
      tubes: $state.snapshot(tubes), moves, history: $state.snapshot(history),
      started: playClock.started(), elapsed: playClock.elapsed(),
      seen: [...seen],
    }
  }
  function saveSnapshot(): SaveSlots {
    const game = gameSnapshot()
    return {
      progress: JSON.stringify($state.snapshot(progress)),
      game: game === null ? null : JSON.stringify(game),
      skin: skin.key,
      theme: shellTheme.key,
      muted: sound.muted ? '1' : '0',
    }
  }
  function saveGame(): boolean {
    if (!canSave()) return false
    const game = gameSnapshot()
    return game === null ? removeSlot(GAME_KEY) : writeSlot(GAME_KEY, JSON.stringify(game))
  }
  function flushSave(): boolean {
    if (!canSave()) return false
    let saved = true
    for (const [name, value] of Object.entries(saveSnapshot())) {
      const key = `sortit:${name}`
      if (!(value === null ? removeSlot(key) : writeSlot(key, value))) saved = false
    }
    return saved
  }
  function restoreGame() {
    try {
      const raw = readSavedSlot(GAME_KEY, normalizeGame)
      if (!raw) return false
      const b = raw.kind === 'level' && raw.n !== undefined
        ? levelBoard(raw.n)
        : (raw.kind === 'seed' && raw.seed !== undefined ? seedBoard(raw.seed) : null)
      if (!b) return false
      // the save scores the board it holds, never the level table: a level
      // redealt after the save (a new first salt) would otherwise advertise a
      // best possible this board cannot reach. saves before the par field
      // get it from the exact solver, but only when the dealt board (the undo
      // stack's first entry, else the tubes) differs from today's deal
      const dealt = raw.history[0]?.tubes ?? raw.tubes
      const colours = dealt.map(t => t.map(i => i.c))
      const parOf = typeof raw.par === 'number' ? () => raw.par ?? null
        : JSON.stringify(colours) === JSON.stringify(b.tubes) ? parFor
        : () => { const r = optimal(colours, b.params.capacity); return r.aborted ? null : r.length }
      // Restore must not persist play()'s fresh deal over the saved board (refs #67).
      play(b, parOf, false)
      tubes = raw.tubes.map(t => t.map(i => ({ ...i })))
      uidNext = Math.max(0, ...raw.tubes.flat().map(i => i.uid)) + 1
      moves = Number.isInteger(raw.moves) && raw.moves >= 0 ? raw.moves : 0
      history = Array.isArray(raw.history) ? raw.history : []
      seen = new Set(Array.isArray(raw.seen) ? raw.seen : [])
      // a board nobody has moved on yet has no time on it, whatever was saved.
      // undo can take a played board back to zero moves, so the save carries
      // its own started bit; saves from before that bit only have the count
      const started = typeof raw.started === 'boolean' ? raw.started : moves > 0
      if (started) playClock.restore(Number.isFinite(raw.elapsed) && raw.elapsed > 0 ? raw.elapsed : 0)
      tick()
      stuck = !anyPlayerMove()
      return true
    } catch {
      return false
    }
  }

  function tap(index: number) {
    if (over || saveOwnership() === 'retired') return
    const tube = tubes[index]
    if (selected === null) {
      if (!tube.length || isComplete(colorsOf(tube), capacity)) return
      selected = index; sound.pick(); return
    }
    if (selected === index) { selected = null; return }
    const move = playerMove(selected, index)
    if (!move) {
      if (tube.length && !isComplete(colorsOf(tube), capacity)) { selected = index; sound.pick() }
      else sound.no()
      return
    }
    const movingColor = tubes[move.from][tubes[move.from].length - 1].c
    history.push({ tubes: tubes.map(t => t.map(i => ({ ...i }))), moves })
    lastMovedUids = tubes[move.from].slice(-move.count).map(i => i.uid)
    const next = tubes.map(t => t.slice())
    next[move.to] = next[move.to].concat(next[move.from].splice(next[move.from].length - move.count, move.count))
    tubes = next
    selected = null
    welcome = false
    playClock.begin()
    moves += 1
    moveSeq += 1
    revealTops(true)
    // each landed item sounds at its own touchdown; with motion off there is
    // no flight to wait for, so the whole phrase lands now
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
    sound.move(skin.sound ?? 'pop', still ? [0] : landingTimes(skin.motion, move.count, moveVerb(movingColor)))
    const doneNow = isComplete(colorsOf(tubes[move.to]), capacity)
    if (doneNow && !isWin(numeric(), capacity)) sound.tube()
    if (isWin(numeric(), capacity)) { finishWin(); return }
    stuck = !anyPlayerMove()
    saveGame()
  }

  function themeForBoard(b: Board) {
    if (b.kind === 'level') return themeForWorld(Math.floor((b.n - 1) / WORLD_SIZE))
    return THEMES[b.seed % THEMES.length]
  }

  function play(b: Board, parOf: (board: Board) => number | null = parFor, persist = true) {
    if (disposed || (persist && saveOwnership() === 'retired')) return
    board = { ...b, par: null }
    theme = themeForBoard(b)
    lastMovedUids = []
    moveSeq += 1
    capacity = b.params.capacity
    uidNext = 0
    tubes = b.tubes.map(t => t.map((c, slot) => ({ uid: uidNext++, c, hid: b.params.hidden && slot < t.length - 1 })))
    history = []
    selected = null
    moves = 0
    over = false
    stuck = false
    won = null
    seen = new Set()
    clearConfetti() // the last win's, not this board's
    playClock.reset()
    clockText = '0:00'
    revealTops(false)
    screen = 'game'
    playClock.hold('away', false)
    // par is computed off the critical path so the board paints first. the guard has
    // to be a TOKEN, not object identity: `board` is $state, so `board = b` stores a
    // reactive PROXY and `board === b` is always false, which silently dropped every
    // par (and with it "best possible" + the 3-star goal on the win card).
    const token = ++playSeq
    clearTimeout(parTimer)
    parTimer = setTimeout(() => { if (!disposed && playSeq === token && board) board.par = parOf(b) }, 0)
    if (persist) saveGame()
  }

  // the app opens in a game: the one in progress if there is one, else the
  // player's current level. a ?level= or ?seed= link replaces it on mount.
  if (typeof window !== 'undefined' && !restoreGame()) play(levelBoard(initialProgress.current))

  function reloadSave() {
    if (disposed) return
    const current = readSlotResult(SAVE_GENERATION_KEY)
    if (!current.ok) return
    savingGame = false
    generation = current
    progress = loadProgress()
    skin = loadSkin()
    shellTheme = loadTheme()
    applyTheme(shellTheme)
    welcome = !progress.welcomed
    if (!restoreGame()) play(levelBoard(progress.current), parFor, false)
    savingGame = true
  }

  return {
    // reactive reads
    get screen() { return screen },
    get storageMessage() { return storageMessage },
    get board() { return board },
    get theme() { return theme },
    get skin() { return skin },
    get progress() { return progress },
    get world() { return world },
    get tubes() { return tubes },
    get capacity() { return capacity },
    get selected() { return selected },
    get moves() { return moves },
    get stuck() { return stuck },
    get won() { return won },
    get clock() { return clockText },
    get dialog() { return dialog },
    get hintTubes() { return hintTubes },
    get welcome() { return welcome },
    get moveSeq() { return moveSeq },
    get lastMovedUids() { return lastMovedUids },
    get skins() { return SKINS },
    get shellThemes() { return SHELL_THEMES },
    get shellTheme() { return shellTheme },
    get boardLabel() {
      if (!board) return ''
      if (board.kind === 'level') return `level ${board.n}`
      return board.seed === dailySeed() ? "today's puzzle" : `puzzle ${board.seed}`
    },

    // interactions
    flushSave,
    saveSnapshot,
    stopSaving() { savingGame = false },
    reloadSave,
    dispose() {
      if (disposed) return
      saveGame()
      disposed = true
      savingGame = false
      ++playSeq
      clearInterval(timer)
      clearTimeout(parTimer)
      clearTimeout(hintTimer)
      unsubscribeStorage()
      clearConfetti()
    },
    tap,
    visibleRun,
    isTubeDone: (t: GameItem[]) => isComplete(colorsOf(t), capacity) && !t.some(i => i.hid),
    goGame() {
      screen = 'game'
      playClock.hold('away', false)
      tick()
    },
    openLevels() {
      playClock.hold('away', true)
      tick()
      saveGame()
      world = Math.floor(((board?.kind === 'level' ? board.n : progress.current) - 1) / WORLD_SIZE)
      screen = 'levels'
    },
    setWorld(w: number) { world = Math.max(0, Math.min(WORLD_COUNT - 1, w)) },
    startLevel(n: number) { play(levelBoard(n)) },
    startDaily() { play(seedBoard(dailySeed())) },
    startSeed(seed: number) { play(seedBoard(seed)) },
    replay() { if (board) board.kind === 'level' ? play(levelBoard(board.n)) : play(seedBoard(board.seed)) },
    nextLevel() { if (board?.kind === 'level') play(levelBoard(Math.min(board.n + 1, LEVEL_COUNT))) },
    undo() {
      if (saveOwnership() === 'retired') return
      const last = history.pop()
      if (!last) return
      lastMovedUids = []
      moveSeq += 1
      for (const t of last.tubes) for (const it of t) if (seen.has(it.uid)) it.hid = false
      tubes = last.tubes
      selected = null
      if (over) playClock.reopen()
      over = false
      moves = last.moves
      won = null
      stuck = false
      saveGame()
    },
    hint() {
      if (over) return true
      const r = solve(numeric(), capacity, HINT_BUDGET)
      if (!r.solved || !r.moves.length) return false
      const m = r.moves[0]
      hintTubes = [m.from, m.to] // the board lifts the first, rings the second
      clearTimeout(hintTimer)
      hintTimer = setTimeout(() => { hintTubes = [] }, 2000)
      return m
    },
    dismissWelcome() { welcome = false },
    setSkin(next: Skin) {
      if (saveOwnership() === 'retired') return
      lastMovedUids = []
      moveSeq += 1
      skin = next
      if (canSave()) saveSkin(next)
    },
    setShellTheme(next: typeof shellTheme) {
      if (saveOwnership() === 'retired') return
      shellTheme = next
      if (canSave()) saveTheme(next.key)
      applyTheme(next)
    },
    toggleSound() {
      if (saveOwnership() === 'retired') { sound.reloadSettings(); return sound.muted }
      return sound.toggle()
    },
    openDialog(d: string) { dialog = d; playClock.hold('overlay', true); tick() },
    closeDialog() { dialog = null; playClock.hold('overlay', false); tick() },
    setVisible(visible: boolean) {
      playClock.hold('hidden', !visible)
      tick()
      if (!visible) saveGame()
    },
    // two tabs writing one store: adopt the better of the two rather than clobber
    mergeExternalProgress() {
      if (!canSave()) return
      const incoming = loadProgress()
      incoming.current = Math.max(incoming.current, progress.current)
      incoming.welcomed = incoming.welcomed || progress.welcomed
      for (const [key, best] of Object.entries(progress.done)) { const n = Number(key); if (incoming.done[n] == null || best < incoming.done[n]) incoming.done[n] = best }
      for (const [key, earned] of Object.entries(progress.stars)) { const n = Number(key); if ((incoming.stars[n] ?? 0) < earned) incoming.stars[n] = earned }
      progress = incoming
      saveProgress(incoming)
    },
  }
}

export type Store = ReturnType<typeof createStore>
