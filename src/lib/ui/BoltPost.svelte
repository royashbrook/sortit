<script lang="ts">
  import { boltArt } from '../engine/skinart/bolt-geometry.ts'
  import { NUT_PITCH, NUT_TOP } from '../engine/skinart/nut-geometry.ts'
  let { side, height, capacity }: { side: number; height: number; capacity: number } = $props()
  const id = $props.id()
  const viewHeight = $derived(height * 64 / side)
  // The nut's bottom plane and the head's top plane share one seat. The
  // threaded shaft reaches that plane, never the back rim of a saucer.
  const seat = $derived(viewHeight - 12 * 64 / side + NUT_TOP)
  // Layout headroom is for a lifted nut, not an extra playable slot.
  const tip = $derived(seat - capacity * NUT_PITCH - 14)
</script>

<svg class="bolt-post" viewBox="0 0 64 {viewHeight}" aria-hidden="true">
  {@html boltArt(seat, id, tip)}
</svg>
