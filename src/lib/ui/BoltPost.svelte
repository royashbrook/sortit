<script lang="ts">
  import { boltArt } from '../engine/skinart/bolt-geometry.ts'
  let { side, height }: { side: number; height: number } = $props()
  const id = $props.id()
  const viewHeight = $derived(height * 64 / side)
  // The nut's bottom plane and the head's top plane share one seat. The
  // threaded shaft reaches that plane, never the back rim of a saucer.
  const seat = $derived(viewHeight - 12 * 64 / side - 9.6)
</script>

<svg class="bolt-post" viewBox="0 0 64 {viewHeight}" aria-hidden="true">
  {@html boltArt(seat, id)}
</svg>
