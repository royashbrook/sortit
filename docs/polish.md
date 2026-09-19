# polish without changing the puzzle

The puzzle is already played and enjoyed. Preserve its deterministic levels,
solver, move rules, difficulty, scoring and existing saves while improving the
presentation and the code that carries them (refs #29, #67).

## glass and material close-out (#29)

Glass Garden adds twelve glossy, symbol-marked marbles, a frosted mystery piece,
clear tubes and a small glass chime. Classic remains the world-art look. Glass
is the fresh-install default; explicit saved choices are untouched, and an older
save without a skin key retains the old Nuts & Bolts default. Original SVG paths
use no downloaded textures, fonts, filters or shared definition ids.

Every look has a distinct synthesized landing palette. Mine's one pickaxe strike
now sounds at its actual contact rather than replaying the old three-strike
performance. The nut's seat sounds when it reaches the destination stack, not
halfway through its trip. A new move, undo, replay, look change, navigation or
hidden page cancels outgoing move voices without cutting off unrelated cues.
Reduced motion lands immediately. Landing particles use elapsed-time geometry,
so their range does not double on a 120 Hz display.

`tools/verify-material-motion.mjs` exercises the real store/audio schedule and
30/60/120 Hz particle paths. `tests/glass.spec.js` checks default migration,
picker persistence, dense-board geometry and target ownership in both engines;
the shared rotation, input, safe-area and celebration checks include glass.

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

Block Mine maps a complete square texture onto each face. The right face's
vertical axis stays vertical, so bark, grass edges and masonry do not turn
sideways. The complete cube silhouette is centered within the column. Original
pixel grain is batched into two paths per face, with large ore silhouettes kept
legible on dense boards. No Minecraft texture files or third-party assets are
bundled. The static voxel valley is decorative, behind the controls, and tinted
by the shell backdrop. It makes no requests and runs no animation loop.

`tests/mine-art.spec.js` measures whole-cube centering, upright face axes, picker
bounds, unobstructed touch targets and skin switching at 360/430px in both shell
themes and browser engines. The pickaxe's existing contact tests still run.

Each look also owns its win confetti: glass marbles, nuts/screws, voxel cubes, neon sparks,
hearts/stars, pipped dice, or classic paper/bubbles. These are small canvas
drawings using the active art palette, not emoji or downloaded images. Tiny
stamps are painted once per win; each animation frame only moves the stamps. The
short burst fades away, does not intercept taps, clears on a new board and is
absent with reduced motion. `verify-confetti.mjs` checks the geometry and
lifecycle; `confetti.spec.js` wins a real board in every look and checks the
shipped paint calls, next-board cleanup and reduced motion in both engines.

## save lifecycle

Resume must not persist the fresh deal used to initialise the board before the
saved board is restored. Export flushes the current board and clock. After a
successful import or rollback, the outgoing store retires its write authority
so pagehide cannot overwrite the incoming save. A cancelled or failed transfer
does not retire the store.

An open transfer sheet rebuilds its export from the adopted state after import,
rollback or another tab's transfer (#91). The old code and QR are withdrawn
while the replacement is encoded; a late QR completion cannot restore the old
image. Failed and cancelled transfers leave the current export alone.

`tools/verify-save-lifecycle.mjs` executes the compiled store and the page's real
handlers, including pagehide during navigation. The wire format and slot names
are unchanged.

## architecture adoption (#67)

Architecture adoption shipped in 1.1.53 and #67 is closed. The pinned development
evidence and final disposition live in [release adoption](adoption.md). Browser
automation does not substitute for physical-phone or child-preference testing.
