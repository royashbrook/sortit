// the game store: all UI state as runes, wrapping the pure engine. it imports
// the engine (solver/levels/stars/skins) and NEVER the other way round, so the
// node verifiers keep proving the same modules the game runs (shell spec rule 1).
import { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT, levelBoard, seedBoard } from '../engine/levels.js'
import { isComplete, isWin, optimal, solve } from '../engine/solver.js'
import { THEMES, themeForWorld } from '../engine/art/index.js'
import { STAR_SLACK, parFor, starsFor } from '../engine/stars.js'
import { SKINS, loadSkin, saveSkin } from '../engine/skins.js'
// the SHELL theme layer (the chrome's look), orthogonal to the game-art skin layer
import { SHELL_THEMES, applyTheme, loadTheme, saveTheme } from './themes.js'
import { dailySeed } from '../engine/seed.js'
import { sound } from './sounds.js'
import { confetti } from './confetti.js'
import { landingTimes } from './flight.js'
import { createSessionClock, formatPlayTime } from './play-clock.js'

export { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT }

const HINT_BUDGET = { maxNodes: 60000 }
const PROGRESS_KEY = 'sortit:progress'
// the game in progress: saved on every change so the app opens straight back
// into it (a won board is not a game in progress, it clears the slot)
const GAME_KEY = 'sortit:game'

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
  let screen = $state('game')       // 'game' | 'levels': the app opens IN the game
  let board = $state(null)          // levels.js board being played
  let playSeq = 0                   // bumped per play(), so a stale deferred par lands nowhere
  let theme = $state(null)
  let skin = $state(loadSkin())
  let shellTheme = $state(loadTheme())
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
  const playClock = createSessionClock()
  let dialog = $state(null)         // 'howto' | 'looks' | 'about' | null
  let hintTubes = $state([])        // indices the hint button flashes
  let moveSeq = $state(0)           // bumps each move so Board runs its FLIP
  let lastMovedUids = $state([])    // the item uids the last move carried

  const colorsOf = t => t.map(i => i.c)
  const numeric = () => tubes.map(colorsOf)

  function tick() {
    if (screen !== 'game') return
    clockText = formatPlayTime(playClock.elapsed())
  }
  if (typeof window !== 'undefined') setInterval(tick, 500)
  // a tab restored in the background boots hidden; the page reports later changes
  if (typeof document !== 'undefined') playClock.hold('hidden', document.hidden)

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

  const moveVerb = color => skin.pieces?.[color]?.verb ?? skin.motion?.land ?? 'drop'

  function anyPlayerMove() {
    for (let from = 0; from < tubes.length; from++) {
      if (!tubes[from].length || isComplete(colorsOf(tubes[from]), capacity)) continue
      for (let to = 0; to < tubes.length; to++) if (from !== to && playerMove(from, to)) return true
    }
    return false
  }

  function finishWin() {
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
    confetti((skin.pieces ?? theme.items).map(i => i.color))
    saveGame()
  }

  // the in-progress slot. tubes carry uids and hidden flags, history is the
  // undo stack, elapsed keeps the clock honest across a relaunch.
  function saveGame() {
    try {
      if (!board || over) { localStorage.removeItem(GAME_KEY); return }
      localStorage.setItem(GAME_KEY, JSON.stringify({
        kind: board.kind, n: board.n, seed: board.seed, par: board.par,
        tubes: $state.snapshot(tubes), moves, history,
        started: playClock.started(), elapsed: playClock.elapsed(),
        seen: [...seen],
      }))
    } catch { /* a blocked store only costs the resume */ }
  }
  function restoreGame() {
    try {
      const raw = JSON.parse(localStorage.getItem(GAME_KEY) ?? 'null')
      if (!raw || !Array.isArray(raw.tubes)) return false
      const b = raw.kind === 'level' && Number.isInteger(raw.n) && raw.n >= 1 && raw.n <= LEVEL_COUNT
        ? levelBoard(raw.n)
        : (raw.kind === 'seed' && Number.isInteger(raw.seed) && raw.seed > 0 ? seedBoard(raw.seed) : null)
      if (!b) return false
      const okItem = i => i && Number.isInteger(i.uid) && Number.isInteger(i.c) && i.c >= 0 && i.c < b.params.colors && typeof i.hid === 'boolean'
      if (raw.tubes.length !== b.tubes.length || !raw.tubes.every(t => Array.isArray(t) && t.every(okItem))) return false
      // the save scores the board it holds, never the level table: a level
      // redealt after the save (a new first salt) would otherwise advertise a
      // best possible this board cannot reach. saves before the par field
      // get it from the exact solver, but only when the dealt board (the undo
      // stack's first entry, else the tubes) differs from today's deal
      const first = Array.isArray(raw.history) ? raw.history[0]?.tubes : null
      const dealt = Array.isArray(first) && first.every(t => Array.isArray(t) && t.every(okItem)) ? first : raw.tubes
      const colours = dealt.map(t => t.map(i => i.c))
      const parOf = Number.isInteger(raw.par) ? () => raw.par
        : JSON.stringify(colours) === JSON.stringify(b.tubes) ? parFor
        : () => { const r = optimal(colours, b.params.capacity); return r.aborted ? null : r.length }
      play(b, parOf)
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
    const movingColor = tubes[move.from][tubes[move.from].length - 1].c
    history.push({ tubes: tubes.map(t => t.map(i => ({ ...i }))), moves })
    lastMovedUids = tubes[move.from].slice(-move.count).map(i => i.uid)
    const next = tubes.map(t => t.slice())
    next[move.to] = next[move.to].concat(next[move.from].splice(next[move.from].length - move.count, move.count))
    tubes = next
    selected = null
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

  function themeForBoard(b) {
    if (b.kind === 'level') return themeForWorld(Math.floor((b.n - 1) / WORLD_SIZE))
    return THEMES[b.seed % THEMES.length]
  }

  function play(b, parOf = parFor) {
    board = b
    board.par = null
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
    setTimeout(() => { if (playSeq === token) board.par = parOf(b) }, 0)
    saveGame()
  }

  // the app opens in a game: the one in progress if there is one, else the
  // player's current level. a ?level= or ?seed= link replaces it on mount.
  if (typeof window !== 'undefined' && !restoreGame()) play(levelBoard(progress.current))

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
    get shellThemes() { return SHELL_THEMES },
    get shellTheme() { return shellTheme },
    get boardLabel() {
      if (!board) return ''
      if (board.kind === 'level') return `level ${board.n}`
      return board.seed === dailySeed() ? "today's puzzle" : `puzzle ${board.seed}`
    },

    // interactions
    tap,
    visibleRun,
    isTubeDone: t => isComplete(colorsOf(t), capacity) && !t.some(i => i.hid),
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
    setWorld(w) { world = Math.max(0, Math.min(WORLD_COUNT - 1, w)) },
    startLevel(n) { play(levelBoard(n)) },
    startDaily() { play(seedBoard(dailySeed())) },
    startSeed(seed) { play(seedBoard(seed)) },
    replay() { board.kind === 'level' ? play(levelBoard(board.n)) : play(seedBoard(board.seed)) },
    nextLevel() { play(levelBoard(Math.min(board.n + 1, LEVEL_COUNT))) },
    undo() {
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
      hintTubes = [m.from, m.to]
      setTimeout(() => { hintTubes = [] }, 2000)
      return m
    },
    setSkin(next) {
      lastMovedUids = []
      moveSeq += 1
      skin = next
      saveSkin(next)
    },
    setShellTheme(next) { shellTheme = next; saveTheme(next.key); applyTheme(next) },
    openDialog(d) { dialog = d; playClock.hold('overlay', true); tick() },
    closeDialog() { dialog = null; playClock.hold('overlay', false); tick() },
    setVisible(visible) {
      playClock.hold('hidden', !visible)
      tick()
      if (!visible) saveGame()
    },
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
