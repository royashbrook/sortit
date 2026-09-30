<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import type { Snippet } from 'svelte'
  import { applyTheme, loadTheme } from '$lib/ui/themes.ts'
  let { children }: { children: Snippet } = $props()

  // paint the saved shell theme before anything else reads the tokens
  onMount(() => applyTheme(loadTheme()))

  // iOS ignores user-scalable=no, so block the pinch/double-tap zoom gesture directly
  onMount(() => {
    const block = (event: Event) => event.preventDefault()
    addEventListener('gesturestart', block)
    return () => removeEventListener('gesturestart', block)
  })

</script>

<svelte:head><title>Sort It</title></svelte:head>

{@render children()}
