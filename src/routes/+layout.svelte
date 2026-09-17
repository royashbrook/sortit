<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import type { Snippet } from 'svelte'
  import { applyTheme, loadTheme } from '$lib/ui/themes.ts'
  let { children }: { children: Snippet } = $props()

  // paint the saved shell theme before anything else reads the tokens
  onMount(() => applyTheme(loadTheme()))

  // register the service worker by hand (kit's is disabled) so dev never gets a
  // stale one, and only in the built app
  onMount(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`).catch(() => {})
    }
  })
</script>

<svelte:head><title>Sort It</title></svelte:head>

{@render children()}
