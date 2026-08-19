// wiring only: menu, screens, progress, share, install, update. the game
// itself lives in game.js, the boards in levels.js, the art in art/.
import { dailySeed } from './seed.js'
import { LEVEL_COUNT, WORLD_SIZE, WORLD_COUNT, levelBoard, seedBoard } from './levels.js'
import { THEMES, themeForWorld } from './art/index.js'
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

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { current: Math.min(Math.max(raw.current ?? 1, 1), LEVEL_COUNT), done: raw.done ?? {} }
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
  $('board-label').textContent = `${label} · ${theme.title}`
  $('board').style.setProperty('--tint', theme.tint)
  document.getElementById('board').style.background = theme.tint
  show(gameScreen)
  game.start(board, theme)
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
    el.disabled = n > progress.current
    el.innerHTML = `<span>${n}</span>` +
      (best != null ? `<span class="sub">&#10003; ${best}</span>` : '')
    el.addEventListener('click', () => startLevel(n))
    grid.append(el)
  }
  const total = Object.keys(progress.done).length
  $('sorted-total').textContent = total ? `you've sorted ${total} of ${LEVEL_COUNT} levels` : 'sort a level to leave your mark!'
}

// --------------------------------------------------------------- share

async function share(button) {
  const url = new URL(location.href)
  url.search = ''
  if (board?.kind === 'level') url.searchParams.set('level', String(board.n))
  else url.searchParams.set('seed', String(board?.seed ?? dailySeed()))
  const payload = { title: 'Sort It', text: 'play this exact Sort It puzzle with me', url: url.toString() }
  const original = button.textContent
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
  setTimeout(() => { button.textContent = original }, 2600)
}

// --------------------------------------------------------------- wiring

$('play').addEventListener('click', () => startLevel(progress.current))
$('daily').addEventListener('click', () => startSeed(dailySeed(), "today's puzzle"))
$('levels-open').addEventListener('click', () => { world = Math.floor((progress.current - 1) / WORLD_SIZE); renderWorld(); show(levelsScreen) })
$('levels-back').addEventListener('click', () => show(menu))
$('world-prev').addEventListener('click', () => { world = Math.max(0, world - 1); renderWorld() })
$('world-next').addEventListener('click', () => { world = Math.min(WORLD_COUNT - 1, world + 1); renderWorld() })
$('back').addEventListener('click', () => show(menu))
$('howto-open').addEventListener('click', () => howto.showModal())
$('howto-close').addEventListener('click', () => howto.close())

$('again').addEventListener('click', () => replay())
$('next').addEventListener('click', () => startLevel(Math.min(board.n + 1, LEVEL_COUNT)))
$('friends').addEventListener('click', event => {
  if (!board) board = { kind: 'seed', seed: dailySeed() } // sharing from the menu shares today
  share(event.currentTarget)
})
$('share-win').addEventListener('click', event => share(event.currentTarget))

$('undo').addEventListener('click', () => { if (game.undo()) $('stuck').hidden = true })
$('stuck-undo').addEventListener('click', () => { if (game.undo()) $('stuck').hidden = true })
$('stuck-restart').addEventListener('click', () => { replay() })
$('hint').addEventListener('click', event => {
  if (!game.hint()) { // solver says this position is lost: the honest hint is undo
    const chip = event.currentTarget
    chip.textContent = 'TRY UNDO'
    setTimeout(() => { chip.textContent = 'HINT' }, 1800)
  }
})

const soundChip = $('sound')
soundChip.classList.toggle('muted', sound.muted)
soundChip.addEventListener('click', () => soundChip.classList.toggle('muted', sound.toggle()))

addEventListener('resize', () => game.measure())

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

wireUpdate($('update'))
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
