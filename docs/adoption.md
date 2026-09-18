# release adoption (refs #67)

In progress, not a release receipt. Baseline: `d9949e6`, version 1.1.21.
The DOM/SVG board, canvas effects, controls, levels, scoring and art remain the
product. SvelteKit stays because the static shell and deployment already use it.

## architecture decisions

- **Stage:** an existing 1.1 release adopting the house release floor, not a new
  prototype and not a retroactive claim that the earlier release met that floor.
- **Shell:** puzzle/casual, portrait-first with a safe-area-aware bottom dock.
  The manifest stays portrait, standalone, with its existing identity and icons.
- **Renderer:** DOM/SVG for the discrete board and themed pieces, canvas for the
  short confetti effect. This workload does not need a physics or 3D engine.
- **Boundaries:** typed modules under `src/lib/engine/` own generation, solving
  and scoring without Svelte. The rune store owns game state and persistence;
  the page owns intent and controller lifetimes. Presentation helpers own their
  pending frames, sounds and effects.
- **Routing/build:** retain SvelteKit's existing static prerendering and Vite
  artifact. Replacing the router is not part of improving release safety.
- **PWA:** useful for an offline phone puzzle with saved progress. The migration
  must preserve the origin, manifest, storage keys and transfer wire format.

These choices apply the
[house release contract](https://github.com/royashbrook/kidgames/blob/75360d6bd039e74f81efee5fb8175181934b60b5/docs/release-architecture.md)
without changing the puzzle or claiming a framework makes its animation faster.

## implemented locally

- Strict TypeScript for engine, art, UI helpers, rune store and page components.
  Source contracts live beside the engine, save parser and storage boundary.
- One pure save parser for local resume and transfer, including every undo entry.
  Unreadable local bytes are copied before replacement. If copying fails, that
  slot stays protected against writes. Ordinary storage failures are visible.
  Local resume keeps its legacy defaults. The v1 transfer boundary still requires
  its counters, undo/seen arrays and progress maps, rather than inventing fields
  in an incomplete code. The existing positional import clock stays compatible.
- Import and rollback adopt the incoming state in place, not after a timed
  browser reload. A local generation marker distinguishes replacement from a
  normal cross-tab progress merge. Existing transferable slots and codes remain.
- Export uses the live in-memory puzzle and progress even when browser storage
  is unavailable. An update cannot reload unless all five save slots verify.
  Reset and import can be cancelled without replacing the existing save.
- Store, board, audio and effects own their intervals, listeners, animation
  frames and pending work, and release them on disposal.
- The typed worker stages complete downloads, retains old-tab assets and owns
  only this app's caches. The mounted controller compares fingerprints by
  inequality, offers consent, and owns its listeners, polling and requests.
- Release identity, input fingerprint, bundled licence inventory and artifact
  integrity tools are wired into the candidate deployment path. Hosted and live
  validation remain required before this is a release receipt.

## evidence so far

- `npm run svelte-check`: zero errors and warnings.
- Engine comparisons against the pinned baseline: 600 full boards/solutions,
  seven shared seeds, pars, all skin/theme SVG and sampled geometry unchanged.
- All 600 solvability/par checks and 1,095 daily checks pass.
- `verify-save-safety`: the original five assertions fail on the shipped baseline
  and pass here. Eleven cases now cover recovery-copy failures, unavailable storage,
  live export, verified update saves and stale settings. Transfer tests cover
  cancelled imports and failed generation-marker writes with exact rollback.
- Presentation cleanup checks pass, including deliberately broken controls.
  The integrated 88-case Chromium/WebKit art, lifecycle and save suite passed.
  A later denied-storage-access export case failed in both engines before its
  fix; the resulting ten-case save browser suite passes in both engines.
- `verify-update` exercises the actual typed controller and worker. Nineteen guard
  mutations fail: rollback ordering, late registration, lost-ready events,
  applying-state clobbering, duplicate cache keys, retirement during a new
  download, a changed active worker, failed activation recovery and observation
  of an already-waiting worker, overlapping registration/install updates, and
  completion of a matching-page legacy handoff, reuse of a downloaded matching
  worker, replacement of an outdated waiting worker, quiet activation, an ignored
  activation deadline, same-page worker supersession, successful handoff unlock,
  disposal of the activation deadline, and a rejected activation message.
  The active-worker swap is a defensive unit
  invariant, not a reproduced native message to a retired worker.
- Real A/B artifacts pass six update tests across Chromium and WebKit: consent
  to a lexicographically lower fingerprint, save retention, held-tab assets,
  scoped cache retirement, failed-download retry and network-only metadata.
  Offline play and notices pass. WebKit uses complete server socket outage
  because its offline emulator rejects navigation internally. Expected native
  network diagnostics are recorded only in that injected-outage phase.
- A single 10/10 PWA run at `37873d0` did not establish reliable legacy migration:
  the unchanged Chromium legacy case subsequently passed only 6/10 repeats.
  Removing explicit registration.update calls still failed 7/10. The earlier
  overlapping-install explanation is withdrawn. Native traces showed one
  successor receiving activation while the outgoing worker stopped then restarted.
- The controller now stops checks while activation is pending, preventing new
  probes through the outgoing worker. Controller change resumes normal checks.
  Supersession, rejected activation messages and an eight-second deadline release
  the lock with visible failure and permit retry. Disposal clears the deadline.
  Eight seconds is a chosen recovery budget to avoid an indefinitely disabled
  update action, not measured cold-phone activation latency. Expiry neither
  deletes saved data nor forces a reload; the player can retry.
  An unrelated worker failure does not release the selected handoff. The unit
  regression fails on `37873d0` by issuing three probes instead of one.
- The quiet-period diagnostic passed 10/10 original legacy tests with unchanged
  workers and deadlines. The implemented controller then passed the fresh full
  10/10 Chromium/WebKit PWA suite, including already-waiting migration without
  another prompt/reload. These are local development-tree results, not final
  release evidence. Repetition at the reviewed head is still required. No native
  test timeout increase, skip, unregister or cache purge was used. The browser's
  internal reason for the stall is not claimed from these interventions.
- The development artifact builds and passes its integrity/licensing checks.
  The candidate strict release path still needs its first hosted deployment.
- `verify:release`: tag/history fixtures, fingerprints, notices and artifact
  rejection tests pass. This does not prove deployment ordering is wired in CI.
- `npm run verify` includes the release, save safety, presentation lifecycle and
  worker/controller checks. `node tools/verify-pwa.mjs --legacy <shipped-build>` runs
  the separate real-artifact suite. Both candidate workflows now run it with a
  pinned legacy build; hosted success remains to be recorded.

## local house evidence map

Runtime source: `e145f131fa5ea9d8f7971bb19f97c4a7688a2626`. Clean development
artifact: `1.1.29-dev`, fingerprint
`b65ce4f0e053d9f02e454e417181301525d552abcdc4a0831be631ca75066875`.
The rules, save and PWA results below are pinned to that source. The later
keyboard/theme follow-up is called out separately. Neither is a hosted receipt.
The eventual release issue must record the integrated source/build and CI/live
results. A local pass does not certify that deployment runs the check.
The commit-count version changes on documentation-only commits too; that changes
the embedded version and therefore the build fingerprint. If deployed, such a
build is intentionally offered as an update even when gameplay code is unchanged.

| house claim | local status | evidence and limits |
|---|---|---|
| typed Svelte app, Vite artifact | pass | Strict `svelte-check` reports zero errors/warnings; `allowJs:false`, `strict:true`; `build:dev` emits the static artifact and passes integrity/licence checks. The pinned browser dependency is in the lockfile. Candidate hosted strict/artifact wiring still needs a successful run. |
| rules and generated content | pass | `npm run verify`: all 600 campaign boards/pars and 1,095 dailies. Independent pre-change comparison preserves boards, solutions, seeds, scoring and art. This is not a new gameplay/difficulty approval. |
| input and lifecycle | pass | Integrated Chromium/WebKit suite: 88/88, covering real moves, undo/cancel, hidden/resumed boards, unmount/remount and reduced motion. Node checks cover gesture-lazy audio and controller disposal. |
| phone layout and accessible controls | not checked | Scoped local contrast, dialog/screen focus and six-skin rotation checks pass, as detailed below. The complete row still needs physical-device observations and the remaining gesture/safe-area review. This is not a whole-app accessibility certificate. |
| local data survives | pass | Eleven save-safety cases, ten native save cases, transfer/rollback and legacy worker migration. Corrupt undo, unavailable/full storage, live-memory export, cancelled reset/import, stale tabs and denied recovery copies are covered. |
| installed updates and offline | pass | Fresh native suite 10/10, then both legacy paths repeated ten times per engine, 40/40 with no retries/skips. Consent, lower fingerprints, failed download, held-tab assets, offline cold start/play and notices are covered. WebKit uses complete server socket outage, not its offline emulator. Real-origin and physical-device transition remain unverified. |
| truthful privacy and copy | not checked | Copy lint and the two-engine local journey below cover requests, cookies, WebSockets and explicit share/copy handoffs. Synthetic cookie and unexpected-query controls fail. The full deployed-host row remains open; host-injected code must be checked after deployment. |
| theme and art | not checked | Shell token/geometry and unchanged art checks pass. The focused follow-up below fixes measured shell contrast defects across all three themes. The privacy journey switches all six looks and three themes. Final visual review remains separate from these scoped checks. |
| reproducible release identity | not checked | Version-history fixtures, input fingerprint and artifact rejection tests pass. The next milestone, actual CI ordering, validated-artifact deployment and live comparison remain pending. |
| distribution rights | pass | Built inventory identifies emitted package modules, complete upstream notices and copied static assets. Repository art and synthesized audio are first-party code; fonts use local/system stacks, with no font/audio files in the static asset inventory. Both native engines serve notices offline. Production serving remains to be checked. |
| product quality | not checked | An independent technical reviewer exercised fresh first-run coaching, a real move, undo, hint and levels at 430x932 and 360x640 without injected saves or console/page errors. This is a substitute sanity pass, not evidence of child preference, enjoyable pacing or sound feel. The broader product review remains open. |

No house row is marked not applicable wholesale. Continuous-physics/frame-rate
equivalence is not applicable to this discrete turn-based puzzle, but its
presentation/input lifetimes still are. Outstanding checks stay owned by the
release work in #67; none is waived by this table. No physical-device performance
or child-preference claim is made.

### focused keyboard and theme follow-up

The local audit found a persistent Chromium focus loss after MORE → ABOUT →
Escape: the nested sheet's opener had been removed with MORE. WebKit showed a
body-focus snapshot too, but passed the retrying keyboard assertion, so a lasting
WebKit failure is not claimed. The dialog now falls back to the surviving MORE
control only when native restoration has no surviving focused element. Closing
Keyboard-opened LOOKS still restores LOOKS in both engines, rather than forcing
every close to MORE. Pointer-opened LOOKS in WebKit uses the MORE fallback when
native focus has no opener. Screen navigation is separate: entering LEVELS
removed the old navigation node and lost focus before any Escape key. LEVELS
is a main screen, not a dialog. A page-owned effect now focuses the new named
main after a screen change, without moving focus on first mount or on dialog
changes. There is no new Escape action, timer or document listener.

`tests/screen-focus.spec.js` covers LEVELS entry, all three game-return routes
(back, PLAY and a level tile), a working keyboard stack selection, unchanged
Escape behavior and initial/dialog focus controls. Before the fix, eight route
cases failed across both engines while the two controls passed. All ten pass
afterward, alongside the existing eighteen dialog/contrast cases.

The same audit found secondary Daylight text at 3.84:1 against About, and the
version stamp at about 2.08:1 in Daylight and 3.46:1 in Dusk. Broader control checks
then failed all six theme/engine cases: Dusk's selected button text was 1.55:1,
unselected look labels 1.18:1, and Bubblegum's selected theme/navigation labels
2.53:1. Completed-level stars also failed in Daylight and Dusk.

The fix strengthens secondary ink, removes fading from readable version/sound
labels, spends the existing on-accent ink for selected controls, and gives
completed levels a theme-owned green surface. Stars inherit their tile's ink.
The game-specific `--surface-complete` token keeps the existing light-theme green
while supplying a dark green surface under Dusk's light text. No puzzle, save,
piece art, animation or worker code changes in this follow-up.

`tests/shell-accessibility.spec.js` passes 18/18 at 360x640 in Chromium and WebKit:
three themes, direct/nested keyboard closes, the LOOKS focus-return control,
secondary text, regular/selected buttons, muted sound and completed-level stars.
These are scoped normal-text checks, not a whole-app accessibility certificate.

Contrast is calculated from browser-computed sRGB colours, including the version
element's opacity against its flat surface before a modal backdrop appears.
The normal-text target follows
[WCAG contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
The tested controls require opaque flat colours and opacity-one ancestors.
Native Tab navigation reaching browser chrome is not classified as a
focus escape into the underlying game.

### rotation and local privacy follow-up

At the clean `d2959ff` baseline, the twelve-stack bolts board overflows its
vertical bounds at 640x360 in both Chromium and WebKit. The portrait width cap
forces two rows while the minimum piece/target size prevents them fitting.
Short landscape now uses the available width and a compact layout gap. Portrait
keeps its 8px gap and width cap; stack targets remain at least 44px. The layout
calculation reads the rendered gap instead of maintaining a second constant.

`tests/rotation.spec.js` covers all six skins through actual viewport changes
430x932, 932x430, 360x640, 640x360 and 430x740. It checks stack/dock bounds, hit
ownership, target size, unchanged piece identities and working controls after
rotation. The bolts cases fail on the clean baseline in both engines; all
twelve cases pass on the local fix. This is browser emulation, not a phone run.

`tests/local-privacy.spec.js` plays a fresh puzzle to a win, switches looks and
themes, toggles sound, generates a save QR and checks for an update. Requests
remain same-origin GETs without bodies or save-code queries, with no cookies or
WebSockets. The only share/copy payloads appear after their explicit actions.
Native OS handoffs are intercepted; the test neither writes the clipboard nor
proves behavior inside the operating system's share sheet. Both engines pass.
Adding a synthetic cookie or unexpected request query makes each engine fail
the corresponding assertion. The test does not certify unvisited flows or code
injected by the eventual deployment host.

### mobile safe areas and gesture scope

`tests/mobile-shell.spec.js` measures four representative portrait/landscape
safe rectangles using Chromium's native `env(safe-area-inset-*)` override.
It asserts the override reached computed body padding before measuring the
board, dock, version, scrolling LOOKS sheet and LEVELS return control. Two real
wins on short viewports check that every choice can scroll into the safe area,
owns its hit target and leads to the next puzzle. These six cases explicitly
skip WebKit, which has no CDP equivalent in this harness. They are not physical
iPhone evidence. Ordinary viewport/rotation coverage still runs in both engines.

On the unchanged `f19fbee` artifact, four Chromium cases fail: short-portrait
dialogs cross the top/bottom safe bounds, landscape dock buttons cross the side
bounds, landscape dialogs cross the bottom bound, and the short-landscape win
panel starts above the viewport. Safe insets now constrain the dock and dialog.
The win panel is height-limited and scrollable, with scroll padding so its last
button can clear the home indicator. A first clamp without scroll padding left
that last button too low; the same test caught it.

Two additional cases fail on the baseline in both engines because double-tap
zoom suppression applies to the entire document. It now applies only to the
board. The tests pin computed `touch-action`, unrestricted viewport metadata,
ordinary About ancestors and working touch moves, not actual native pinch or
double-tap behavior. `manipulation` already permitted pinch zoom before this
change. All eight supported cases pass locally after the fixes, with six
explicit WebKit capability skips. No puzzle, save, art or worker code changes.

The next screenshot review exposed a gap between those tests: a dense board
with landscape side insets wrapped into two rows taller than the board card.
Viewport safety alone missed it, while the existing board-containment rotation
test used zero insets. Six new combined cases fail on `2ebe517`, one per skin.

The shell now subtracts the body's already-reserved bottom inset from its dock
reservation. A short-landscape header compacts only its three non-interactive
readouts. Bolt headroom scales with the piece size up to the skin's usual cap,
rather than leaving 64px of shaft above a 20px-wide nut. The layout solves both sides
of that cap. The piece-layout width stays at least 20px and targets at least 44px.
Nut height follows its existing .625 projection ratio, not a 20px height floor. Puzzle
contents, portrait header sizing, art definitions and flight rules are unchanged.

The new cases check target/post boxes and compare rendered pixels outside the
board with the stacks shown versus hidden. The moving clock is masked. Native
browser image decoding needs no new dependency or fixed golden screenshot.
An injected piece translation above the card produces outside-board pixels and
proves that the paint check detects overflow even when target boxes stay put.
An earlier SVG `getBBox` attempt was invalid: it counted clipped-away nut
geometry as visible. It is not used as paint evidence. All six combined cases
pass locally. Review then found the first-visit variant: opening a shared
`?level=600` also shows the coaching card. Those six cases fail at `590a3e0`.
A 2px landscape gap lets twelve 44px targets fit the 552px safe width in one
row, leaving room for the coach without hiding it or shrinking targets. The
same cases now cover both an existing player and that first-visit shared link,
including an actual move that dismisses the coach. The paint negative control
uses the current card/piece position, not a lift distance tied to two rows.
The suite has eighteen explicit WebKit safe-area capability skips; ordinary
rotation still runs in both engines. This proves the sampled
layouts, not every possible viewport, zoom setting or physical device.

## still required before release

1. Rerun the real old/new worker suite against final rebuilt artifacts after
   integration. Browser offline emulation and
   socket-outage evidence do not establish physical-phone behavior.
2. Run the full integrated suite at the final head, independent old/new comparison,
   and final visual/control review. Preserve the passing save/storage/cancellation
   and lifecycle checks while integrating the release work.
3. Exercise the updated verify/CI path on hosted runners. The candidate now
   builds the pinned pre-migration app at `d9949e6`, runs the native update suite,
   validates the sealed build and deploys that same directory with Wrangler
   `4.134.0`. Both workflows retain browser failure evidence for seven days.
   Serialized deployments do not cancel an active run. Each checks out current
   main, not the potentially delayed triggering commit, and checks main again
   before publication. The workflow-text and scheduling-policy tests are not
   proof of a hosted Actions execution.
4. Record every house evidence row and the retained immutable major/minor
   anchor, obtain exact-head review and verify the
   production bytes and installed-client transition after deployment.

No claim of physical-phone performance or completion of #67 is made here.

### candidate release path

The existing immutable `v1.1` anchor remains the first-parent milestone for this
adoption. Every reachable commit after it contributes to the patch number. No
old tag moves and no tag must race a main-branch deployment. The strict release
build has no development suffix and must move forward from the shipped 1.1.21.

`tools/release-live.mjs` compares every served artifact byte and the complete
manifest, checks shell/worker/metadata no-store and immutable bundle headers,
and requires Cloudflare-only control files to return 404. It retries the full
comparison for up to three minutes of edge propagation, never accepting a mixed
set of files. The local rejection checks include missing notices, changed bytes,
stale manifest, missing cache/security headers and exposed host configuration.
This is a byte/header receipt, not an installed-client or product playtest.

`static/_headers` supplies those host cache policies and basic browser safety
headers. SvelteKit excludes `_headers` and `_redirects` from its static precache
list. The native PWA fixture server returns 404 for those paths too, so the update
suite exercises the real host-file behavior rather than serving a false success.

The development install still reports three low audit entries from one chain:
cookie 0.6.0 through SvelteKit 2.70.3 and adapter-static. The
[cookie serialization advisory](https://github.com/advisories/GHSA-pxg6-pf52-xh8x)
concerns unsafe cookie name/path/domain fields. App source has no cookie-setting
path, the host publishes only the static build, and the reviewed emitted-module
inventory/source maps contain no cookie or server runtime. This bounds current
browser exposure, not the installed toolchain warning. No downgrade, override or
audit suppression is used; revisit on a Kit update or addition of server cookies.
