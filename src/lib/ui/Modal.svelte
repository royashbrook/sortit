<script>
  // a real modal dialog: showModal() gives the :modal state, focus trap, Escape,
  // and an inert page behind it. it also RESTORES focus to the opener on close(),
  // which only fires if we actually call close() rather than unmount the element,
  // so the close buttons call the `close` passed to the children snippet. `label`
  // gives the dialog an accessible name (a modal with none is a screen-reader dead end).
  let { label, onclose, children } = $props()
  let el

  $effect(() => {
    if (!el) return
    if (!el.open) el.showModal()
    return () => { if (el?.open) el.close() }
  })

  const close = () => el?.close()
  function onclick(e) { if (e.target === el) el.close() } // backdrop click
</script>

<dialog bind:this={el} aria-label={label} onclose={() => onclose?.()} {onclick}>
  {@render children(close)}
</dialog>
