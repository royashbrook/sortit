# Sort It

a cosy sorting puzzle for kids. tap a tube, pick up what's on top, drop it on
a matching friend. **no ads, no lives, no timers, nothing to buy, no accounts,
no cookies, nothing sold or shared.** works offline.

a [kidgames](https://github.com/royashbrook/kidgames) house game.

## play locally

```sh
npm ci
npm run dev     # Vite prints the local URL
```

## what's inside

- **600 campaign levels** across 30 themed worlds (7 art themes rotating), plus
  a **daily puzzle** that is the same board for everyone in the world.
- every board is dealt deterministically from its level number / date and
  **proven solvable by an exact solver before it is shown**: see
  [solver.ts](src/lib/engine/solver.ts) and [levels.ts](src/lib/engine/levels.ts).
  `npm run verify` re-proves all 600 levels and 3 years of dailies; allow a few minutes.
- unlimited **undo**, an honest **hint** (it replays the solver from your
  current position), mystery boards, capacity-5 tubes, confetti.
- SVG art lives in `src/lib/engine/art/` and `src/lib/engine/skinart/`.
  Sound is synthesised in [sounds.ts](src/lib/ui/sounds.ts), without third-party media requests.
- PWA features: offline shell (`src/service-worker.ts`), update banner,
  install helper, share-a-board, and QR/code save transfer with one-step rollback.
- SvelteKit + Vite shell with strict TypeScript application code and a framework-free
  puzzle engine. Hosted release/update adoption is still tracked in
  [#67](https://github.com/royashbrook/sortit/issues/67), not claimed complete.
  See the [adoption evidence](docs/adoption.md) and [art decisions](docs/polish.md).

## tools

```sh
npm run verify   # prove every level + 3 years of dailies solvable, twice
npm run svelte-check
npm run build:dev  # explicitly labelled local artifact
npm run build      # strict release: clean tree, complete history, valid milestone tag
npx playwright install chromium webkit
npm run test:browser  # phone layouts, hardware flight/occlusion, reduced motion
node tools/verify-pwa.mjs --legacy /path/to/shipped/build  # real old-to-new worker tests
npm run e2e          # built shell
npm run e2e:first-run
npm run icons    # regenerate install PNGs from assets/branding source art
node tools/validate-art.mjs   # mechanical half of the art spec
```

## license

MIT
