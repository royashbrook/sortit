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
  integrity tools exist. These are not yet the deployment path.

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
  The strict release path and hosted deployment are not yet integrated.
- `verify:release`: tag/history fixtures, fingerprints, notices and artifact
  rejection tests pass. This does not prove deployment ordering is wired in CI.
- `npm run verify` includes the release, save safety, presentation lifecycle and
  worker/controller checks. `node tools/verify-pwa.mjs --legacy <shipped-build>` runs
  the separate real-artifact suite; it is not yet wired into hosted workflows.

## local house evidence map

Runtime source: `e145f131fa5ea9d8f7971bb19f97c4a7688a2626`. Clean development
artifact: `1.1.29-dev`, fingerprint
`b65ce4f0e053d9f02e454e417181301525d552abcdc4a0831be631ca75066875`.
The table describes local evidence at that source, not a hosted release receipt.
The eventual release issue must record the integrated source/build and CI/live
results. A local pass does not certify that deployment runs the check.

| house claim | local status | evidence and limits |
|---|---|---|
| typed Svelte app, Vite artifact | pass | Strict `svelte-check` reports zero errors/warnings; `allowJs:false`, `strict:true`; `build:dev` emits the static artifact and passes integrity/licence checks. The pinned browser dependency is in the lockfile. Hosted strict/artifact gates remain unwired. |
| rules and generated content | pass | `npm run verify`: all 600 campaign boards/pars and 1,095 dailies. Independent pre-change comparison preserves boards, solutions, seeds, scoring and art. This is not a new gameplay/difficulty approval. |
| input and lifecycle | pass | Integrated Chromium/WebKit suite: 88/88, covering real moves, undo/cancel, hidden/resumed boards, unmount/remount and reduced motion. Node checks cover gesture-lazy audio and controller disposal. |
| phone layout and accessible controls | not checked | Artifact tests cover 360x640 and 430x932 layouts, paint bounds and target ownership in both engines; a 430px WebKit board capture was inspected. Full focus/contrast/rotation review and physical-device checks are not established by those geometry tests. |
| local data survives | pass | Eleven save-safety cases, ten native save cases, transfer/rollback and legacy worker migration. Corrupt undo, unavailable/full storage, live-memory export, cancelled reset/import, stale tabs and denied recovery copies are covered. |
| installed updates and offline | pass | Fresh native suite 10/10, then both legacy paths repeated ten times per engine, 40/40 with no retries/skips. Consent, lower fingerprints, failed download, held-tab assets, offline cold start/play and notices are covered. WebKit uses complete server socket outage, not its offline emulator. Real-origin and physical-device transition remain unverified. |
| truthful privacy and copy | not checked | Copy lint and first-party source review are not an all-flow deployed-host request/cookie audit. Host-injected code must be checked after deployment. |
| theme and art | not checked | Shell token tests, both-theme geometry checks and unchanged art comparisons pass. That does not establish every composited contrast pair or full shell theme-swap coverage. |
| reproducible release identity | not checked | Version-history fixtures, input fingerprint and artifact rejection tests pass. The next milestone, actual CI ordering, validated-artifact deployment and live comparison remain pending. |
| distribution rights | pass | Built inventory identifies emitted package modules, complete upstream notices and copied static assets. Repository art and synthesized audio are first-party code; fonts use local/system stacks, with no font/audio files in the static asset inventory. Both native engines serve notices offline. Production serving remains to be checked. |
| product quality | not checked | Existing user feedback supports keeping the puzzle/art. Automated wins do not prove first-use clarity, enjoyable pacing or sound feel at this candidate. A short real-control review with a named audience/substitute remains required. |

No house row is marked not applicable wholesale. Continuous-physics/frame-rate
equivalence is not applicable to this discrete turn-based puzzle, but its
presentation/input lifetimes still are. Outstanding checks stay owned by the
release work in #67; none is waived by this table. No physical-device performance
or child-preference claim is made.

## still required before release

1. Rerun the real old/new worker suite against final rebuilt artifacts after
   integration. Browser offline emulation and
   socket-outage evidence do not establish physical-phone behavior.
2. Run the full integrated suite at the final head, independent old/new comparison,
   and final visual/control review. Preserve the passing save/storage/cancellation
   and lifecycle checks while integrating the release work.
3. Wire all new checks into the existing verify/CI path, preserve and deploy
   the validated artifact, pin the deployment CLI, and prevent stale deployments.
   Both workflow files are unchanged in this checkpoint.
4. Record every house evidence row, establish the next immutable major/minor
   anchor without rewriting old tags, obtain exact-head review and verify the
   production bytes and installed-client transition after deployment.

No claim of physical-phone performance or completion of #67 is made here.
