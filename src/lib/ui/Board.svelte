<script>
  import { flightKeyframes, flightOptions } from './flight.js'
  import { fx } from './fx.js'
  import { mine as mineActors } from './actors.js'

  let { store } = $props()

  let boardEl
  let side = $state(44)
  let tubeH = $state(200)
  let rowCount = $state(1)

  const GAP = 8, PAD = 5, LIP = 10

  // rows + tube size chosen to fill the board across viewport, rows and capacity
  // at once, ported verbatim from the vanilla layout so phones fit the same way
  function measure() {
    if (!boardEl) return
    const cs = getComputedStyle(boardEl)
    const availW = boardEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    const availHTotal = boardEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
    const count = store.tubes.length
    const capacity = store.capacity
    const pieceRatio = store.skin.pieceRatio ?? 1
    const tubeLip = store.skin.tubeLip ?? LIP
    if (!count) return
    // the tube button is the tap target and never goes below 44px (its min-width
    // in css). so a row layout is only feasible if that many 44px tubes fit the
    // width: without this check the layout picked a wide row and the css floor
    // overflowed it, clipping the edge tubes' hit area (level 175 at 375px).
    const TUBE_MIN = 44
    let best = null
    for (let rc = 1; rc <= Math.min(4, count); rc++) {
      const widest = Math.ceil(count / rc)
      if (widest * TUBE_MIN + (widest - 1) * GAP > availW) continue // 44px tubes don't fit this row count
      const availH = availHTotal - (rc - 1) * GAP
      const bySide = (availH / rc - tubeLip - PAD) / (capacity * pieceRatio)
      const byWidth = (availW - (widest - 1) * GAP) / widest - PAD * 2
      const s = Math.min(64, bySide, byWidth)
      if (!best || s > best.s) best = { rc, s }
    }
    if (!best) best = { rc: Math.min(4, count), s: 20 } // pathological fallback
    rowCount = best.rc
    side = Math.max(20, Math.min(64, best.s))
    tubeH = side * capacity * pieceRatio + tubeLip + PAD
    rowCount = best.rc
  }

  $effect(() => {
    if (!boardEl) return
    measure()
    const ro = new ResizeObserver(() => measure())
    ro.observe(boardEl)
    return () => ro.disconnect()
  })
  // re-measure when the tube count changes (new board)
  $effect(() => { store.tubes.length; measure() })

  // the flight. svelte's animate:flip cannot follow an item between two keyed
  // tube lists, so positions are captured BEFORE the DOM updates ($effect.pre)
  // and the trip is played AFTER with the web animations api: flight.js builds
  // the path (lift, arc, the skin's landing verb), fx.js bursts on touchdown.
  let before = new Map()
  $effect.pre(() => {
    const uids = store.lastMovedUids
    store.moveSeq // re-run each move
    before = new Map()
    if (!boardEl) return
    for (const uid of uids) {
      const node = boardEl.querySelector(`[data-uid="${uid}"]`)
      if (!node) continue
      const tube = node.closest('.tube')
      before.set(uid, {
        rect: node.getBoundingClientRect(),
        tubeTop: tube ? tube.getBoundingClientRect().top : 0,
        verb: node.dataset.verb || 'drop',
      })
    }
  })
  // the running actor performance, if any. it belongs to ONE move sequence:
  // any later sequence (a second move, undo, reset, a skin change) or an
  // unmount tears it down before it can keep performing over a board that no
  // longer has that move.
  let actorRun = null
  $effect(() => () => { actorRun?.cancel(); actorRun = null }) // unmount only
  $effect(() => {
    const flightSeq = String(store.moveSeq)
    if (!boardEl) return
    // a re-run for the SAME sequence (a resize re-measuring `side`) keeps the
    // performance; only a new sequence ends it
    if (actorRun && actorRun.seq !== flightSeq) { actorRun.cancel(); actorRun = null }
    // A rapid second move or undo owns the node now. Cancel the old compositor
    // work before starting (or declining) this sequence; its settled promise
    // is sequence-guarded below so it cannot tear down the new flight's cue.
    for (const node of boardEl.querySelectorAll('.item.flying')) {
      if (node.dataset.flightSeq === flightSeq) continue
      for (const animation of node.getAnimations()) animation.cancel()
      node.classList.remove('flying')
    }
    if (!before.size) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { before = new Map(); return }
    const motion = store.skin.motion ?? { seconds: .22, lift: 1, spin: 0, stagger: 0, land: 'drop' }
    let index = 0
    const trips = [] // what an actor-driven move needs to know about each item
    for (const [uid, from] of before) {
      const node = boardEl.querySelector(`[data-uid="${uid}"]`)
      if (!node) continue
      const to = node.getBoundingClientRect()
      const destTube = node.closest('.tube')
      const destTop = destTube ? destTube.getBoundingClientRect().top : to.top
      // the arc peaks above BOTH mouths, so a trip between rows still clears
      const peakRel = Math.min(from.tubeTop, destTop) - to.top - motion.lift * side
      const rimRel = Math.min(-2, destTop - to.top)
      const verb = from.verb || motion.land
      const keyframes = flightKeyframes(verb, {
        dx: from.rect.left - to.left,
        dy: from.rect.top - to.top,
        peakRel, rimRel,
        spin: motion.spin ?? 0,
      })
      for (const a of node.getAnimations()) a.cancel()
      node.style.transformOrigin = ['screw', 'roll', 'breakpop', 'mine'].includes(verb) ? '50% 50%' : '50% 80%'
      node.dataset.flightSeq = flightSeq
      // css-side companions (a nut's turning band) sync to the same clock
      node.style.setProperty('--flight-secs', `${motion.seconds}s`)
      node.style.setProperty('--flight-delay', `${index * (motion.stagger ?? 0)}s`)
      node.classList.add('flying')
      const burst = index < 4 // a long convoy bursts only its head, not 7 puffs
      const options = flightOptions(motion, index)
      const anim = node.animate(keyframes, options)
      // a broken block bursts where it BROKE, at the source, when the shudder
      // ends (the flight's own timing), not where it respawns
      if (burst && (verb === 'breakpop' || verb === 'mine')) {
        setTimeout(() => {
          if (node.dataset.flightSeq === flightSeq) fx.land(from.rect, 'breakpop', [pieceColor(uid)])
        }, options.delay + options.duration * (verb === 'mine' ? 0.32 : 0.42))
      }
      anim.finished.then(() => {
        if (node.dataset.flightSeq !== flightSeq) return
        node.classList.remove('flying')
        if (burst) fx.land(node.getBoundingClientRect(), verb, artColors())
      }).catch(() => {
        if (node.dataset.flightSeq === flightSeq) node.classList.remove('flying')
      })
      trips.push({ from: from.rect, to, svg: node.innerHTML, color: pieceColor(uid) })
      index += 1
    }
    // the mine move is PERFORMED: a pickaxe mines the source, a carrier brings
    // the run over and sets it down. actors ride the pieces' seconds/stagger.
    if (trips.length && motion.land === 'mine') {
      actorRun = mineActors(boardEl, trips, motion, {
        warp: rect => fx.land(rect, 'warp', ['#D46BFF', '#7A2BC9']),
      })
      actorRun.seq = flightSeq
      actorRun.done.then(() => { if (actorRun?.seq === flightSeq) actorRun = null })
    }
    before = new Map()
  })

  const rows = $derived.by(() => {
    const count = store.tubes.length
    const base = Math.floor(count / rowCount)
    const extra = count % rowCount
    const out = Array.from({ length: rowCount }, () => [])
    let t = 0
    for (let r = 0; r < rowCount; r++) {
      const size = base + (r < extra ? 1 : 0)
      for (let i = 0; i < size; i++) out[r].push(t++)
    }
    return out
  })

  const HID_ART = '<circle cx="32" cy="32" r="22" fill="#C9BCB2" stroke="#3D3230" stroke-width="3"/><path d="M26 28 Q26 21 32 21 Q38 21 38 27 Q38 32 32 33 L32 36" stroke="#3D3230" stroke-width="3.6" fill="none" stroke-linecap="round"/><circle cx="32" cy="43" r="2.4" fill="#3D3230"/>'
  const pieceFor = item => store.skin.pieces?.[item.c] ?? store.theme.items[item.c]
  const artFor = item => item.hid ? (store.skin.hidden ?? HID_ART) : pieceFor(item).svg
  const verbFor = item => pieceFor(item)?.verb ?? store.skin.motion?.land ?? 'drop'
  const artColors = () => (store.skin.pieces ?? store.theme?.items ?? []).map(item => item.color)
  const pieceColor = uid => {
    for (const tube of store.tubes) for (const item of tube) if (item.uid === uid) return pieceFor(item).color
    return '#8A6142'
  }

  // the vanilla rich label: a screen-reader player solves by contents, so name
  // each piece (or "mystery"), or "empty"
  const tubeLabel = (index) => {
    const named = store.tubes[index].map(i => i.hid ? 'mystery' : pieceFor(i).key)
    return `tube ${index + 1}: ${named.join(', ') || 'empty'}`
  }

  const isLifted = (index, item) => {
    if (store.selected !== index) return false
    const tube = store.tubes[index]
    const run = store.visibleRun(index)
    return tube.indexOf(item) >= tube.length - run
  }
</script>

<div
  id="board"
  bind:this={boardEl}
  data-skin={store.skin.key}
  style:--side="{side}px"
  style:--item-h="{side * (store.skin.pieceRatio ?? 1)}px"
  style:--tube-h="{tubeH}px"
  style:background={store.theme?.tint}
  aria-label="sorting board"
>
  {#each rows as row}
    <div class="row">
      {#each row as index (index)}
        <button
          class="tube"
          class:sel={store.selected === index}
          class:done={store.isTubeDone(store.tubes[index])}
          class:hint={store.hintTubes.includes(index)}
          onclick={() => store.tap(index)}
          aria-label={tubeLabel(index)}
        >
          {#each store.tubes[index] as item, itemIndex (item.uid)}
            <span
              class="item"
              class:hid={item.hid}
              class:lift={isLifted(index, item)}
              data-uid={item.uid}
              data-verb={verbFor(item)}
              style:--stack-depth={itemIndex + 1}
            >
              <svg viewBox={store.skin.pieceViewBox ?? '0 0 64 64'} aria-hidden="true">{@html artFor(item)}</svg>
            </span>
          {/each}
        </button>
      {/each}
    </div>
  {/each}
</div>
