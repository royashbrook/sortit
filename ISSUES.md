# issues

The [GitHub issues](https://github.com/royashbrook/sortit/issues) are the live
backlog. This file preserves the original local launch audit, not open work.

## #1: build "Sort It" to a releasable, locally-testable state

a kids' ball-sort puzzle PWA per the kidgames house standard
(~/gh/kidgames/STANDARD.md). scope:

- seed-deterministic boards: 600-level campaign + daily + share-a-seed
- exact solver guarantees every shipped level is solvable
- 7 art themes, all art generated in-repo (svg, no external assets)
- offline-first service worker, install helper, update banner
- unlimited undo, hint, no ads / no lives / no timers / nothing to buy

status: shipped. [#1](https://github.com/royashbrook/sortit/issues/1) closed
2026-08-24. Later architecture and release adoption shipped under
[#67](https://github.com/royashbrook/sortit/issues/67).

### adversarial review 2026-08-18 (6 reviewers, all findings triaged)

fixed:
- player-facing move legality decoupled from the solver's pruned move list
  (second empty tube refused drops; uniform tube couldn't pour to an empty;
  mystery boards leaked hidden colours through refusals)
- layout: body pinned to 100dvh (killed a feedback loop that overflowed small
  phones), measure() subtracts board padding, row count is now optimised
  (2×7 beats 3×5 on narrow phones), 20px floor + #game overflow guard
- loadProgress sanitizes hostile/corrupt stores (non-object done soft-locked
  every campaign win; NaN current killed PLAY and LEVELS)
- hint() after a win threw a TypeError (keyboard-reachable); undo after a win
  left the SORTED! sheet over a live board
- keyboard playability: tubes now activate on click (Enter/Space work), focus
  survives re-renders
- reduced-motion: hint/shake get static cues instead of nothing
- ios install sheet no longer permanently overwrites how-to-play
- menu "play with a friend" always shares today, not the last-played board
- share button double-tap no longer latches the feedback label
- mystery reveals survive undo (knowledge is kept, the move is taken back)
- picker: level won via a friend's link stays replayable, not green-but-locked
- cross-tab storage writes merge instead of last-writer-wins
- done-tube ✓ badge (form cue, not colour-only); 44px chip floor; bigger
  picker sub-text; world nav renamed PREV/NEXT; maskable icon added to the sw
  shell; update banner baseline seeded from the cached shell, not the first
  probe; confetti canvas css box matches its backing store

The original deferrals are superseded: in-progress games persist, and the
portrait/landscape and safe-area work has executable coverage described in
[adoption evidence](docs/adoption.md). The solver remains bounded rather than
claiming an unlimited hint search. Current defects belong on GitHub, not in a
second unsynchronized checklist here.
