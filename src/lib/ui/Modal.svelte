<script>
  // a real modal dialog: showModal() gives the :modal state, focus trap, Escape,
  // and an inert page behind it, none of which `<dialog open>` provides. closing
  // (Escape, backdrop, or a button) calls back so the store clears its dialog.
  let { onclose, children } = $props()
  let el

  $effect(() => {
    if (!el) return
    if (!el.open) el.showModal()
    return () => { if (el?.open) el.close() }
  })

  // backdrop click closes: the click lands on the dialog element itself, not its content
  function onclick(e) { if (e.target === el) el.close() }
</script>

<dialog bind:this={el} onclose={() => onclose?.()} {onclick}>
  {@render children()}
</dialog>
