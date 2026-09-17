# polish without changing the puzzle

The puzzle is already played and enjoyed. Preserve its deterministic levels,
solver, move rules, difficulty, scoring and existing saves while improving the
presentation and the code that carries them (refs #29, #67).

## hardware skin

The nuts are projected hexagonal prisms with lit facets, small bevels and one
high-contrast symbol on a physical face. The top nut hides the crown below it.
One threaded shaft runs continuously into a solid hexagonal head behind each
stack. The crown accounts for the shaft's occlusion; a travelling nut has a
complete hole once it clears the post.

The existing Web Animations flight owns timing and position. A small SVG
projection follows that timing only while a nut travels: unscrew fully above
the source, carry, then screw onto the destination. It stops on completion,
cancellation or removal. Reduced motion keeps the same move without the flight.
This does not need a 3D engine or a mesh asset pipeline.

`tools/verify-nut-geometry.mjs` checks the projection and turning phases.
`tests/hardware.spec.js` checks actual browser occlusion, clearances, cancellation,
phone layouts and reduced motion in Chromium and WebKit. Browser emulation is
not a physical-iPhone performance or preference test.

## readable skin art

Dice Table uses rounded D6s with inset pips instead of unmarked polyhedra.
Six pip counts in light and dark finishes distinguish the twelve pieces without
relying on body colour alone. Saved colour indices keep their existing order.
Block Mine's original pixel pickaxe has a separate wooden haft and hooked metal
head. Its grip is the pivot, and its tip meets the source face from either side.
The carrier, timing, reduced-motion path and puzzle rules remain unchanged.

The hardware picker uses the same post and nut renderers as the board, with
room for the crown above the stacking box. `tests/skin-art.spec.js` measures
paint bounds and compositor impact positions in both browser engines.
`tools/verify-dice-art.mjs` checks pip identities and the saved palette order.

## save lifecycle

Resume must not persist the fresh deal used to initialise the board before the
saved board is restored. Export flushes the current board and clock. After a
successful import or rollback, the outgoing store retires its write authority
so pagehide cannot overwrite the incoming save. A cancelled or failed transfer
does not retire the store.

`tools/verify-save-lifecycle.mjs` executes the compiled store and the page's real
handlers, including pagehide during navigation. The wire format and slot names
are unchanged.

## remaining adoption work (#67)

1. Share one pure save normalizer between local resume and transfer. Validate
   undo snapshots before using them: a malformed history entry can currently
   survive resume and throw when Undo is pressed. Preserve readable legacy saves
   and retain unreadable bytes for recovery rather than silently discarding them.
2. Introduce strict TypeScript at the engine/save boundaries, then the rune store
   and UI. Keep deterministic old/new comparison through the conversion. The
   current Svelte check is useful but does not establish strict JavaScript types.
3. Give the service worker app-scoped cache ownership and explicit update
   consent. Prove old/new tabs, offline navigation, retained save bytes and cache
   retirement with real two-build browser tests.
4. Adopt the house release identity, packaged licence inventory, deploy ordering
   and live-byte receipts. Pin the safety tests in CI. This change adds the locked
   browser runner and runs its suites in both check and deploy; it does not close
   all release requirements.
5. Finish listener/timer teardown at the shell boundary, then test repeated
   mounts and exits. Avoid restructuring stable gameplay merely for appearance.
