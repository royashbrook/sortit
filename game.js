// the game: state, rendering, and the tap-tap interaction loop.
//
// state is tubes of items { uid, c, hid }: uid keeps an item's DOM identity
// stable across re-renders (that is what the pour animation keys on), c is the
// colour slot into the theme's 12 items, hid marks a mystery-level item still
// face-down. the solver only ever sees the numeric colour layer.
import { legalMoves, isComplete, isWin, solve } from './solver.js'
import { sound } from './sounds.js'
import { confetti } from './confetti.js'

const HINT_BUDGET = { maxNodes: 60000 }

export function createGame({ boardEl, movesEl, onWin, onMove }) {
  let capacity = 4
  let theme = null
  let tubes = []          // item-layer state
  let history = []        // snapshots for unlimited undo
  let selected = null
  let moves = 0
  let over = false
  let rows = []           // tube index -> row number, for layout

  // ---------------------------------------------------------------- helpers

  const colorsOf = t => t.map(item => item.c)
  const numeric = () => tubes.map(colorsOf)

  function checkpoint() {
    history.push({ tubes: tubes.map(t => t.map(item => ({ ...item }))), moves })
  }

  function revealTops(changed) {
    let revealed = false
    for (const t of tubes) {
      const top = t[t.length - 1]
      if (top && top.hid) { top.hid = false; revealed = true }
      // a finished tube shows all its faces, even the ones that were mysteries
      if (t.length && isComplete(colorsOf(t), capacity)) {
        for (const item of t) { if (item.hid) { item.hid = false; revealed = true } }
      }
    }
    if (revealed && changed) sound.reveal()
  }

  // on mystery boards only the revealed part of a run is really "known", so
  // that is all a tap picks up — the solver may know more, the kid does not.
  function visibleRun(index) {
    const tube = tubes[index]
    const top = tube[tube.length - 1]
    let n = 0
    for (let i = tube.length - 1; i >= 0; i--) {
      if (tube[i].hid || tube[i].c !== top.c) break
      n++
    }
    return Math.max(1, n)
  }

  function setMoves(n) {
    moves = n
    movesEl.textContent = `${moves} ${moves === 1 ? 'move' : 'moves'}`
  }

  // ----------------------------------------------------------------- layout

  // rows of tubes sized in JS: both dimensions depend on capacity, row count
  // and viewport, and CSS cannot minimise over all three at once.
  function rowsFor(count) {
    const rowCount = count <= 5 ? 1 : count <= 10 ? 2 : 3
    const base = Math.floor(count / rowCount)
    const extra = count % rowCount
    const sizes = Array.from({ length: rowCount }, (_, r) => base + (r < extra ? 1 : 0))
    const assignment = []
    let t = 0
    sizes.forEach((size, r) => { for (let i = 0; i < size; i++) assignment[t++] = r })
    return { rowCount, sizes, assignment }
  }

  function measure() {
    const { rowCount, sizes } = rowsFor(tubes.length)
    const gap = 8
    const pad = 5                  // tube inner padding
    const lip = 10                 // extra height above the top item
    const availW = boardEl.clientWidth
    const availH = boardEl.clientHeight - (rowCount - 1) * gap
    const widest = Math.max(...sizes)
    const bySide = (availH / rowCount - lip - pad) / capacity
    const byWidth = (availW - (widest - 1) * gap) / widest - pad * 2
    const side = Math.max(24, Math.min(64, bySide, byWidth))
    boardEl.style.setProperty('--side', `${side}px`)
    boardEl.style.setProperty('--tube-h', `${side * capacity + lip + pad}px`)
  }

  // ----------------------------------------------------------------- render

  function itemNode(item) {
    const el = document.createElement('span')
    el.className = 'item' + (item.hid ? ' hid' : '')
    el.dataset.uid = item.uid
    const art = item.hid
      ? '<circle cx="32" cy="32" r="22" fill="#C9BCB2" stroke="#3D3230" stroke-width="3"/><path d="M26 28 Q26 21 32 21 Q38 21 38 27 Q38 32 32 33 L32 36" stroke="#3D3230" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="32" cy="43" r="2.4" fill="#3D3230"/>'
      : theme.items[item.c].svg
    el.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${art}</svg>`
    return el
  }

  function render() {
    const { rowCount, assignment } = rowsFor(tubes.length)
    rows = assignment
    const rowEls = Array.from({ length: rowCount }, () => {
      const el = document.createElement('div')
      el.className = 'row'
      return el
    })
    tubes.forEach((tube, index) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'tube'
      el.dataset.t = index
      const named = tube.map(i => (i.hid ? 'mystery' : theme.items[i.c].key))
      el.setAttribute('aria-label', `tube ${index + 1}: ${named.join(', ') || 'empty'}`)
      if (isComplete(colorsOf(tube), capacity) && !tube.some(i => i.hid)) el.classList.add('done')
      tube.forEach(item => el.append(itemNode(item)))
      el.addEventListener('pointerdown', () => tap(index))
      rowEls[assignment[index]].append(el)
    })
    boardEl.replaceChildren(...rowEls)
    measure()
    paintSelection()
  }

  function paintSelection() {
    boardEl.querySelectorAll('.tube').forEach((el, index) => {
      const on = index === selected
      el.classList.toggle('sel', on)
      el.querySelectorAll('.item').forEach(node => node.classList.remove('lift'))
      if (on) {
        const run = visibleRun(index)
        const nodes = el.querySelectorAll('.item')
        for (let k = 0; k < run; k++) nodes[nodes.length - 1 - k]?.classList.add('lift')
      }
    })
  }

  // FLIP: re-render moved items from their old screen position to the new one.
  function animateMove(uids) {
    const before = new Map()
    for (const uid of uids) {
      const node = boardEl.querySelector(`[data-uid="${uid}"]`)
      if (node) before.set(uid, node.getBoundingClientRect())
    }
    render()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const uid of uids) {
      const node = boardEl.querySelector(`[data-uid="${uid}"]`)
      const from = before.get(uid)
      if (!node || !from) continue
      const to = node.getBoundingClientRect()
      const dx = from.left - to.left
      const dy = from.top - to.top
      node.style.transition = 'none'
      node.style.transform = `translate(${dx}px, ${dy}px)`
      requestAnimationFrame(() => requestAnimationFrame(() => {
        node.style.transition = 'transform .22s cubic-bezier(.3,1.2,.5,1)'
        node.style.transform = ''
      }))
    }
  }

  function shake(index) {
    const el = boardEl.querySelector(`[data-t="${index}"]`)
    el?.classList.remove('shake')
    void el?.offsetWidth
    el?.classList.add('shake')
    sound.no()
  }

  // ------------------------------------------------------------ interaction

  function legalTargets(from) {
    return legalMoves(numeric(), capacity).filter(m => m.from === from)
  }

  function tap(index) {
    if (over) return
    const tube = tubes[index]

    if (selected === null) {
      if (!tube.length || isComplete(colorsOf(tube), capacity)) return
      selected = index
      sound.pick()
      paintSelection()
      return
    }

    if (selected === index) {
      selected = null
      paintSelection()
      return
    }

    const move = legalTargets(selected).find(m => m.to === index)
    if (!move) {
      // kid-friendly: an illegal tap on another pickable tube just switches
      // the selection instead of scolding, a tap into a bad drop wiggles.
      if (tube.length && !isComplete(colorsOf(tube), capacity)) {
        selected = index
        sound.pick()
        paintSelection()
        return
      }
      shake(index)
      return
    }

    checkpoint()
    move.count = Math.min(move.count, visibleRun(move.from))
    const movedUids = tubes[move.from].slice(-move.count).map(i => i.uid)
    const next = tubes.map(t => t.slice())
    next[move.to] = next[move.to].concat(next[move.from].splice(next[move.from].length - move.count, move.count))
    tubes = next
    selected = null
    setMoves(moves + 1)
    revealTops(true)
    sound.drop()

    const doneNow = isComplete(colorsOf(tubes[move.to]), capacity)
    animateMove(movedUids)
    if (doneNow && !isWin(numeric(), capacity)) sound.tube()

    onMove?.()

    if (isWin(numeric(), capacity)) {
      over = true
      sound.win()
      confetti(theme.items.map(i => i.color))
      onWin(moves)
      return
    }
    if (legalMoves(numeric(), capacity).length === 0) onMove?.('stuck')
  }

  // ------------------------------------------------------------- public api

  return {
    start(board, boardTheme) {
      capacity = board.params.capacity
      theme = boardTheme
      let uid = 0
      tubes = board.tubes.map(t => t.map((c, slot) => ({
        uid: uid++,
        c,
        hid: board.params.hidden && slot < t.length - 1,
      })))
      history = []
      selected = null
      over = false
      setMoves(0)
      render()
    },
    undo() {
      const last = history.pop()
      if (!last) return false
      tubes = last.tubes
      selected = null
      over = false
      setMoves(last.moves)
      render()
      return true
    },
    hint() {
      const result = solve(numeric(), capacity, HINT_BUDGET)
      if (!result.solved) return false
      const move = result.moves[0]
      for (const t of [move.from, move.to]) {
        const el = boardEl.querySelector(`[data-t="${t}"]`)
        el?.classList.remove('hint')
        void el?.offsetWidth
        el?.classList.add('hint')
      }
      return true
    },
    canUndo: () => history.length > 0,
    measure,
  }
}
