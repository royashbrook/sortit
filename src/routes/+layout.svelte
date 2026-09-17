<script lang="ts">
  import '../app.css'
  import { onMount } from 'svelte'
  import type { Snippet } from 'svelte'
  import { applyTheme, loadTheme } from '$lib/ui/themes.ts'
  let { children }: { children: Snippet } = $props()

  // paint the saved shell theme before anything else reads the tokens
  onMount(() => applyTheme(loadTheme()))

</script>

<svelte:head><title>Sort It</title></svelte:head>

{@render children()}
