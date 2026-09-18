<script lang="ts">
  import type { Snippet } from 'svelte'
  // a real modal dialog: showModal() gives the :modal state, focus trap, Escape,
  // and an inert page behind it. it also RESTORES focus to the opener on close(),
  // which only fires if we actually call close() rather than unmount the element,
  // so the close buttons call the `close` passed to the children snippet. `label`
  // gives the dialog an accessible name (a modal with none is a screen-reader dead end).
  let { label, onclose, children }: {
    label: string
    onclose?: () => void
    children: Snippet<[close: () => void]>
  } = $props()
  let el: HTMLDialogElement
  // an unmount closes the element too, but that close is not the USER's: when
  // one dialog opens another (MORE opens ABOUT), the store already moved on,
  // and reporting the teardown as a close would clear the dialog it just opened
  let unmounting = false

  $effect(() => {
    if (!el) return
    if (!el.open) el.showModal()
    return () => { unmounting = true; if (el?.open) el.close() }
  })

  const close = () => el?.close()
  function handleClose() {
    if (unmounting) return
    onclose?.()
    // A nested sheet's opener belonged to the discarded MORE dialog. Native
    // restoration cannot focus it, so return to the surviving menu control.
    if (document.activeElement === document.body || el.contains(document.activeElement)) {
      document.querySelector<HTMLElement>('[data-menu-opener]')?.focus()
    }
  }
  function onclick(e: MouseEvent) { if (e.target === el) el.close() } // backdrop click
</script>

<dialog bind:this={el} aria-label={label} onclose={handleClose} {onclick}>
  {@render children(close)}
</dialog>
