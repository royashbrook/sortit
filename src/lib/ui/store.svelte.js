// the game store: all UI state as runes, wrapping the pure engine. it imports
// the engine (solver/levels/stars/skins) and NEVER the other way round, so the
// node verifiers keep proving the same modules the game runs (shell spec rule 1).
import { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT, levelBoard, seedBoard } from '../engine/levels.js'
import { isComplete, isWin, solve } from '../engine/solver.js'
import { THEMES, themeForWorld } from '../engine/art/index.js'
import { STAR_SLACK, parFor, starsFor } from '../engine/stars.js'
import { SKINS, loadSkin, saveSkin } from '../engine/skins.js'
import { dailySeed } from '../engine/seed.js'
import { sound } from './sounds.js'
import { confetti } from './confetti.js'

export { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT }

const HINT_BUDGET = { maxNodes: 60000 }
const PROGRESS_KEY = 'sortit:progress'

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}')
    const current = Number.isInteger(raw?.current) ? Math.min(Math.max(raw.current, 1), LEVEL_COUNT) : 1
    const done = {}
    if (raw?.done && typeof raw.done === 'object' && !Array.isArray(raw.done)) {
      for (const [k, v] of Object.entries(raw.done)) {
        const n = Number(k)
        if (Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT && Number.isFinite(v)) done[n] = v
      }
    }
    const stars = {}
    if (raw?.stars && typeof raw.stars === 'object' && !Array.isArray(raw.stars)) {
      for (const [k, v] of Object.entries(raw.stars)) {
        const n = Number(k)
        if (Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT && Number.isInteger(v)) stars[n] = Math.min(Math.max(v, 1), 3)
      }
    }
    for (const [k, best] of Object.entries(done)) {
      const n = Number(k)
      if (stars[n] == null) stars[n] = starsFor(best, PARS_AT(n), null)
    }
    return { current, done, stars }
  } catch {
    return { current: 1, done: {}, stars: {} }
  }
}
// par lookup that survives a missing table entry (kept tiny so loadProgress reads clean)
import { PARS } from '../engine/pars.js'
function PARS_AT(n) { return PARS[n - 1] ?? null }

function saveProgress(p) { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)) } catch { /* fine */ } }

export function createStore() {
  let screen = $state('menu')       // 'menu' | 'levels' | 'game'
  let board = $state(null)          // levels.js board being played
  let theme = $state(null)
  let skin = $state(loadSkin())
  let progress = $state(loadProgress())
  let world = $state(0)

  let tubes = $state([])            // item state { uid, c, hid }
  let capacity = $state(4)
  let selected = $state(null)
  let moves = $state(0)
  let over = $state(false)
  let stuck = $state(false)
  let won = $state(null)            // { stars, detail, score, perfect, canNext }
  let clockText = $state('0:00')

  let history = []                  // undo snapshots (not reactive: read only on undo)
  let seen = new Set()
  let uidNext = 0
  let clockStart = null
  let clockStopped = null
  let dialog = $state(null)         // 'howto' | 'looks' | 'about' | null
  let hintTubes = $state([])        // indices the hint button flashes
  let moveSeq = $state(0)           // bumps each move so Board runs its FLIP
  let lastMovedUids = $state([])    // the item uids the last move carried

  const colorsOf = t => t.map(i => i.c)
  const numeric = () => tubes.map(colorsOf)

  function tick() {
    if (clockStart == null || clockStopped != null || screen !== 'game') return
    const s = Math.floor((Date.now() - clockStart) / 1000)
    clockText = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }
  if (typeof window !== 'undefined') setInterval(tick, 500)

  function revealTops(changed) {
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

  function visibleRun(index) {
    const tube = tubes[index]
    const top = tube[tube.length - 1]
    let n = 0
    for (let i = tube.length - 1; i >= 0; i--) { if (tube[i].hid || tube[i].c !== top.c) break; n++ }
    return Math.max(1, n)
  }

  function playerMove(from, to) {
    const src = tubes[from], dst = tubes[to]
    if (!src.length || from === to) return null
    const space = capacity - dst.length
    if (space === 0) return null
    if (dst.length && dst[dst.length - 1].c !== src[src.length - 1].c) return null
    return { from, to, count: Math.min(visibleRun(from), space) }
  }

  function anyPlayerMove() {
    for (let from = 0; from < tubes.length; from++) {
      if (!tubes[from].length || isComplete(colorsOf(tubes[from]), capacity)) continue
      for (let to = 0; to < tubes.length; to++) if (from !== to && playerMove(from, to)) return true
    }
    return false
  }

  function finishWin() {
    over = true
    clockStopped = Date.now()
    tick()
    const stars = starsFor(moves, board.par, board.solution.length)
    let detail = `sorted in ${moves} moves, ${clockText}!`
    let canNext = false
    if (board.kind === 'level') {
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
    confetti(theme.items.map(i => i.color))
  }

  function tap(index) {
    if (over) return
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
    history.push({ tubes: tubes.map(t => t.map(i => ({ ...i }))), moves })
    lastMovedUids = tubes[move.from].slice(-move.count).map(i => i.uid)
    const next = tubes.map(t => t.slice())
    next[move.to] = next[move.to].concat(next[move.from].splice(next[move.from].length - move.count, move.count))
    tubes = next
    selected = null
    moves += 1
    moveSeq += 1
    revealTops(true)
    sound.drop()
    const doneNow = isComplete(colorsOf(tubes[move.to]), capacity)
    if (doneNow && !isWin(numeric(), capacity)) sound.tube()
    if (isWin(numeric(), capacity)) { finishWin(); return }
    stuck = !anyPlayerMove()
  }

  function themeForBoard(b) {
    if (b.kind === 'level') return themeForWorld(Math.floor((b.n - 1) / WORLD_SIZE))
    return THEMES[b.seed % THEMES.length]
  }

  function play(b) {
    board = b
    board.par = null
    theme = themeForBoard(b)
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
    clockStart = Date.now()
    clockStopped = null
    clockText = '0:00'
    revealTops(false)
    screen = 'game'
    setTimeout(() => { if (board === b) board.par = parFor(b) }, 0)
  }

  return {
    // reactive reads
    get screen() { return screen },
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
    get moveSeq() { return moveSeq },
    get lastMovedUids() { return lastMovedUids },
    get skins() { return SKINS },
    get boardLabel() {
      if (!board) return ''
      if (board.kind === 'level') return `level ${board.n}`
      return board.seed === dailySeed() ? "today's puzzle" : `puzzle ${board.seed}`
    },

    // interactions
    tap,
    visibleRun,
    isTubeDone: t => isComplete(colorsOf(t), capacity) && !t.some(i => i.hid),
    goMenu() { screen = 'menu' },
    openLevels() { world = Math.floor((progress.current - 1) / WORLD_SIZE); screen = 'levels' },
    setWorld(w) { world = Math.max(0, Math.min(WORLD_COUNT - 1, w)) },
    startLevel(n) { play(levelBoard(n)) },
    startDaily() { play(seedBoard(dailySeed())) },
    startSeed(seed) { play(seedBoard(seed)) },
    replay() { board.kind === 'level' ? play(levelBoard(board.n)) : play(seedBoard(board.seed)) },
    nextLevel() { play(levelBoard(Math.min(board.n + 1, LEVEL_COUNT))) },
    undo() {
      const last = history.pop()
      if (!last) return
      for (const t of last.tubes) for (const it of t) if (seen.has(it.uid)) it.hid = false
      tubes = last.tubes
      selected = null
      over = false
      moves = last.moves
      won = null
      stuck = false
    },
    hint() {
      if (over) return true
      const r = solve(numeric(), capacity, HINT_BUDGET)
      if (!r.solved || !r.moves.length) return false
      const m = r.moves[0]
      hintTubes = [m.from, m.to]
      setTimeout(() => { hintTubes = [] }, 2000)
      return m
    },
    setSkin(next) { skin = next; saveSkin(next) },
    openDialog(d) { dialog = d },
    closeDialog() { dialog = null },
    // two tabs writing one store: adopt the better of the two rather than clobber
    mergeExternalProgress() {
      const incoming = loadProgress()
      incoming.current = Math.max(incoming.current, progress.current)
      for (const [n, best] of Object.entries(progress.done)) if (incoming.done[n] == null || best < incoming.done[n]) incoming.done[n] = best
      for (const [n, earned] of Object.entries(progress.stars)) if ((incoming.stars[n] ?? 0) < earned) incoming.stars[n] = earned
      progress = incoming
      saveProgress(incoming)
    },
  }
}
