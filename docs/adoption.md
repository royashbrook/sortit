# release adoption (refs #67)

In progress, not a release receipt. Baseline: `d9949e6`, version 1.1.21.
The DOM/SVG board, canvas effects, controls, levels, scoring and art remain the
product. SvelteKit stays because the static shell and deployment already use it.

## implemented locally

- Strict TypeScript for engine, art, UI helpers, rune store and page components.
  Source contracts live beside the engine, save parser and storage boundary.
- One pure save parser for local resume and transfer, including every undo entry.
  Unreadable local bytes are copied before replacement. If copying fails, that
  slot stays protected against writes. Ordinary storage failures are visible.
- Import and rollback adopt the incoming state in place, not after a timed
  browser reload. A local generation marker distinguishes replacement from a
  normal cross-tab progress merge. Existing transferable slots and codes remain.
- Store, board, audio and effects own their intervals, listeners, animation
  frames and pending work, and release them on disposal.
- Release identity, input fingerprint, bundled licence inventory and artifact
  integrity tools exist. These are not yet the deployment path.

## evidence so far

- `npm run svelte-check`: zero errors and warnings.
- Engine comparisons against the pinned baseline: 600 full boards/solutions,
  seven shared seeds, pars, all skin/theme SVG and sampled geometry unchanged.
- All 600 solvability/par checks and 1,095 daily checks pass.
- `verify-save-safety`: five new assertions fail on the shipped baseline and
  pass here. Existing transfer, lifecycle, first-run and clock verifiers pass.
- Presentation cleanup checks pass, including deliberately broken controls.
  Eight focused Chromium/WebKit lifecycle tests passed before the final save
  integration. The full integrated browser suite is still required.
- `verify:release`: tag/history fixtures, fingerprints, notices and artifact
  rejection tests pass. This does not prove deployment ordering is wired in CI.

## still required before release

1. Finish the scoped typed worker/update controller, consent, offline notices,
   cache retirement and real old/new browser tests. The legacy worker is still
   present. The new build verifier intentionally rejects missing offline notices.
2. Complete browser save/storage/cancellation coverage, lifecycle integration,
   old/new independent comparison and final visual/control review. Exercise
   recovery-copy failure, import marker failure and two-tab replacement.
3. Wire all new checks into the existing verify/CI path, preserve and deploy
   the validated artifact, pin the deployment CLI, and prevent stale deployments.
   Both workflow files are unchanged in this checkpoint.
4. Record every house evidence row, establish the next immutable major/minor
   anchor without rewriting old tags, obtain exact-head review and verify the
   production bytes and installed-client transition after deployment.

No claim of physical-phone performance or completion of #67 is made here.
