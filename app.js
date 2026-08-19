// wiring only: menu, screens, progress, share, install, update. the game
// itself lives in game.js, the boards in levels.js, the art in art/.
import { dailySeed } from './seed.js'
import { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT, levelBoard, seedBoard } from './levels.js'
import { THEMES, themeForWorld } from './art/index.js'
import { SKINS, loadSkin, saveSkin } from './skins.js'
import { createGame } from './game.js'
import { sound } from './sounds.js'
import { wireInstall } from './install.js'
import { wireUpdate, registerWorker } from './update.js'

const $ = id => document.getElementById(id)
const menu = $('menu')
const levelsScreen = $('levels')
const gameScreen = $('game')
const howto = $('howto')

// ------------------------------------------------------------- progress

const KEY = 'sortit:progress'

// the store is user-writable, so every shape is hostile until proven: a bad
// `done` would otherwise throw inside onWin and soft-lock every campaign win.
function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const current = Number.isInteger(raw?.current)
      ? Math.min(Math.max(raw.current, 1), LEVEL_COUNT)
      : 1
    const done = {}
    if (raw?.done && typeof raw.done === 'object' && !Array.isArray(raw.done)) {
      for (const [key, value] of Object.entries(raw.done)) {
        const n = Number(key)
        if (Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT && Number.isFinite(value)) done[n] = value
      }
    }
    return { current, done }
  } catch {
    return { current: 1, done: {} } // a blocked store never stops a kid playing
  }
}

function saveProgress(progress) {
  try { localStorage.setItem(KEY, JSON.stringify(progress)) } catch { /* fine */ }
}

let progress = loadProgress()

// ------------------------------------------------------------- screens

function show(screen) {
  for (const el of [menu, levelsScreen, gameScreen]) el.hidden = el !== screen
  $('won').hidden = true
  $('stuck').hidden = true
}

// --------------------------------------------------------------- game

let board = null   // the board being played, from levels.js
let theme = null
let skin = loadSkin()

const game = createGame({
  boardEl: $('board'),
  movesEl: $('moves'),
  onMove: kind => { $('stuck').hidden = kind !== 'stuck' },
  onWin: moves => {
    let detail = `sorted in ${moves} moves!`
    if (board.kind === 'level') {
      const best = progress.done[board.n]
      if (best == null || moves < best) {
        progress.done[board.n] = moves
        if (best != null) detail = `sorted in ${moves} moves, your best yet!`
      } else {
        detail = `sorted in ${moves} moves. your best is ${best}.`
      }
      if (board.n === progress.current && progress.current < LEVEL_COUNT) progress.current += 1
      saveProgress(progress)
      $('next').hidden = board.n >= LEVEL_COUNT
    } else {
      $('next').hidden = true
    }
    $('won-detail').textContent = detail
    $('won').hidden = false
  },
})

function themeForBoard(b) {
  if (b.kind === 'level') return themeForWorld(Math.floor((b.n - 1) / WORLD_SIZE))
  return THEMES[b.seed % THEMES.length]
}

function play(b, label) {
  board = b
  theme = themeForBoard(b)
  $('board-label').textContent = label
  $('board').style.background = theme.tint
  show(gameScreen)
  game.start(board, theme, skin)
}

const startLevel = n => play(levelBoard(n), `level ${n}`)
const startSeed = (seed, label) => play(seedBoard(seed), label)
const replay = () => board.kind === 'level' ? startLevel(board.n) : startSeed(board.seed, $('board-label').textContent.split(' · ')[0])

// ---------------------------------------------------------- level picker

let world = 0

function renderWorld() {
  const t = themeForWorld(world)
  $('world-title').textContent = `world ${world + 1} · ${t.title}`
  $('world-count').textContent = `${world + 1} / ${WORLD_COUNT}`
  $('world-prev').disabled = world === 0
  $('world-next').disabled = world === WORLD_COUNT - 1
  const grid = $('world-grid')
  grid.replaceChildren()
  for (let i = 0; i < WORLD_SIZE; i++) {
    const n = world * WORLD_SIZE + i + 1
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'lvl'
    const best = progress.done[n]
    if (best != null) el.classList.add('done')
    if (n === progress.current) el.classList.add('now')
    // beaten-but-ahead levels (won via a friend's link) stay replayable, or
    // the picker would show a green tick the kid cannot tap
    el.disabled = n > progress.current && best == null
    el.innerHTML = `<span>${n}</span>` +
      (best != null ? `<span class="sub">&#10003; ${best}</span>` : '')
    el.addEventListener('click', () => startLevel(n))
    grid.append(el)
  }
  const total = Object.keys(progress.done).length
  $('sorted-total').textContent = total ? `you've sorted ${total} of ${LEVEL_COUNT} levels` : 'sort a level to leave your mark!'
}

// --------------------------------------------------------------- share

const shareTimers = new Map()

async function share(button, subject) {
  const url = new URL(location.href)
  url.search = ''
  if (subject?.kind === 'level') url.searchParams.set('level', String(subject.n))
  else url.searchParams.set('seed', String(subject?.seed ?? dailySeed()))
  const payload = { title: 'Sort It', text: 'play this exact Sort It puzzle with me', url: url.toString() }
  // capture the real label once, so a double-tap can't latch the feedback text
  if (!button.dataset.label) button.dataset.label = button.textContent
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare(payload))) {
      await navigator.share(payload)
      return
    }
  } catch (error) {
    if (error?.name === 'AbortError') return // a closed share sheet is not an error
  }
  try {
    await navigator.clipboard.writeText(url.toString())
    button.textContent = 'LINK COPIED, SEND IT TO THEM'
  } catch {
    button.textContent = 'COULD NOT SHARE, SORRY'
  }
  clearTimeout(shareTimers.get(button))
  shareTimers.set(button, setTimeout(() => { button.textContent = button.dataset.label }, 2600))
}

// --------------------------------------------------------------- wiring

$('play').addEventListener('click', () => startLevel(progress.current))
$('daily').addEventListener('click', () => startSeed(dailySeed(), "today's puzzle"))
$('levels-open').addEventListener('click', () => { world = Math.floor((progress.current - 1) / WORLD_SIZE); renderWorld(); show(levelsScreen) })
$('levels-back').addEventListener('click', () => show(menu))
$('world-prev').addEventListener('click', () => { world = Math.max(0, world - 1); renderWorld() })
$('world-next').addEventListener('click', () => { world = Math.min(WORLD_COUNT - 1, world + 1); renderWorld() })
$('back').addEventListener('click', () => show(menu))

// the ios install sheet borrows the how-to dialog, so opening how-to always
// restores the real content first
const howtoContent = {
  h2: howto.querySelector('h2').textContent,
  ol: howto.querySelector('ol').innerHTML,
  small: howto.querySelector('.small').innerHTML,
}
$('howto-open').addEventListener('click', () => {
  howto.querySelector('h2').textContent = howtoContent.h2
  howto.querySelector('ol').innerHTML = howtoContent.ol
  howto.querySelector('.small').innerHTML = howtoContent.small
  howto.showModal()
})
$('howto-close').addEventListener('click', () => howto.close())

$('again').addEventListener('click', () => replay())
$('next').addEventListener('click', () => startLevel(Math.min(board.n + 1, LEVEL_COUNT)))
$('friends').addEventListener('click', event => {
  // from the menu this always shares TODAY, not whatever board memory holds
  share(event.currentTarget, menu.hidden ? board : { kind: 'seed', seed: dailySeed() })
})
$('share-win').addEventListener('click', event => share(event.currentTarget, board))

const undo = () => { if (game.undo()) { $('stuck').hidden = true; $('won').hidden = true } }
$('undo').addEventListener('click', undo)
$('stuck-undo').addEventListener('click', undo)
$('stuck-restart').addEventListener('click', () => { replay() })
const hintChip = $('hint')
const hintLabel = hintChip.textContent
$('hint').addEventListener('click', () => {
  if (!game.hint()) { // solver says this position is lost: the honest hint is undo
    hintChip.textContent = 'TRY UNDO'
    setTimeout(() => { hintChip.textContent = hintLabel }, 1800)
  }
})

// ---------------------------------------------------------------- looks

const looks = $('looks')

function renderLooks() {
  const grid = $('looks-grid')
  grid.replaceChildren()
  for (const candidate of SKINS) {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'look'
    el.setAttribute('aria-pressed', String(candidate.key === skin.key))
    el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${candidate.preview}</svg><span>${candidate.title}</span>`
    el.addEventListener('click', () => {
      skin = candidate
      saveSkin(skin)
      game.setSkin(skin) // applies live, even mid-game; board state untouched
      renderLooks()
    })
    grid.append(el)
  }
}

for (const id of ['looks-open', 'looks-game']) {
  $(id).addEventListener('click', () => { renderLooks(); looks.showModal() })
}
$('looks-close').addEventListener('click', () => looks.close())

const soundChip = $('sound')
function paintSound(muted) {
  soundChip.classList.toggle('muted', muted)
  soundChip.setAttribute('aria-pressed', String(!muted))
}
paintSound(sound.muted)
soundChip.addEventListener('click', () => paintSound(sound.toggle()))

addEventListener('resize', () => game.measure())

// two contexts (installed app + a tab, a shared family ipad) write the same
// store; adopting the other writer's progress beats silently clobbering it
addEventListener('storage', event => {
  if (event.key !== KEY) return
  const incoming = loadProgress()
  incoming.current = Math.max(incoming.current, progress.current)
  for (const [n, best] of Object.entries(progress.done)) {
    if (incoming.done[n] == null || best < incoming.done[n]) incoming.done[n] = best
  }
  progress = incoming
  if (!levelsScreen.hidden) renderWorld()
})

wireInstall($('install'), {
  showIosHint: () => {
    howto.querySelector('h2').textContent = 'Add to home screen'
    howto.querySelector('ol').innerHTML =
      '<li>Tap the <b>share</b> button at the bottom of Safari.</li>' +
      '<li>Scroll down and tap <b>Add to Home Screen</b>.</li>' +
      '<li>Tap <b>Add</b>. It opens like a real app, and works with no internet.</li>'
    howto.querySelector('.small').textContent = ''
    howto.showModal()
  },
})

wireUpdate($('update'), { allowed: () => gameScreen.hidden }) // never over a game
registerWorker()

// a shared link drops the player straight onto their friend's board
const params = new URLSearchParams(location.search)
const sharedLevel = Number.parseInt(params.get('level') ?? '', 10)
const sharedSeed = Number.parseInt(params.get('seed') ?? '', 10)
if (Number.isFinite(sharedLevel) && sharedLevel >= 1 && sharedLevel <= LEVEL_COUNT) {
  startLevel(sharedLevel)
} else if (Number.isFinite(sharedSeed) && sharedSeed > 0) {
  startSeed(sharedSeed, sharedSeed === dailySeed() ? "today's puzzle" : `puzzle ${sharedSeed}`)
}
