<script>
  import { flip } from 'svelte/animate'
  import { untrack } from 'svelte'

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
    if (!count) return
    let best = null
    for (let rc = 1; rc <= Math.min(4, count); rc++) {
      const widest = Math.ceil(count / rc)
      const availH = availHTotal - (rc - 1) * GAP
      const bySide = (availH / rc - LIP - PAD) / capacity
      const byWidth = (availW - (widest - 1) * GAP) / widest - PAD * 2
      const s = Math.min(64, bySide, byWidth)
      if (!best || s > best.s) best = { rc, s }
    }
    side = Math.max(20, Math.min(64, best.s))
    tubeH = side * capacity + LIP + PAD
    rowCount = best.rc
  }

  // re-measure when the board changes size or the tube count changes
  $effect(() => {
    store.tubes.length
    untrack(() => measure())
  })
  $effect(() => {
    if (!boardEl) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(boardEl)
    return () => ro.disconnect()
  })

  // assign each tube to a row, biggest rows first (the vanilla rowsFor)
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
  const artFor = item => item.hid ? HID_ART : store.theme.items[item.c].svg

  const isLifted = (index, item) => {
    if (store.selected !== index) return false
    const tube = store.tubes[index]
    const run = store.visibleRun(index)
    return tube.indexOf(item) >= tube.length - run
  }

  const flipParams = { duration: (store.skin.motion?.seconds ?? .22) * 1000 }
</script>

<div
  id="board"
  bind:this={boardEl}
  data-skin={store.skin.key}
  style:--side="{side}px"
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
          aria-label="tube {index + 1}"
        >
          {#each store.tubes[index] as item (item.uid)}
            <span class="item" class:hid={item.hid} class:lift={isLifted(index, item)} animate:flip={flipParams}>
              <svg viewBox="0 0 64 64" aria-hidden="true">{@html artFor(item)}</svg>
            </span>
          {/each}
        </button>
      {/each}
    </div>
  {/each}
</div>
