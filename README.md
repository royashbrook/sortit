# Sort It

a cosy sorting puzzle for kids. tap a tube, pick up what's on top, drop it on
a matching friend. **no ads, no lives, no timers, nothing to buy, no accounts,
no cookies, nothing sold or shared.** works offline.

a [kidgames](https://github.com/royashbrook/kidgames) house game.

## play locally

```sh
npm run serve   # http://localhost:4310
```

## what's inside

- **600 campaign levels** across 30 themed worlds (7 art themes rotating), plus
  a **daily puzzle** that is the same board for everyone in the world.
- every board is dealt deterministically from its level number / date and
  **proven solvable by an exact solver before it is shown**: see `solver.js`
  and `levels.js`. `npm run verify` re-proves all 600 levels and 3 years of
  dailies in under a second.
- unlimited **undo**, an honest **hint** (it replays the solver from your
  current position), mystery boards, capacity-5 tubes, confetti.
- all art is svg in `art/` (7 packs of 12 characters, see `art/ART-SPEC.md`),
  all sound is synthesised in `sounds.js`. zero external assets, zero requests
  to anyone.
- PWA per the house standard: offline shell (`sw.js`), update banner,
  install helper, share-a-board with no server.

## tools

```sh
npm run verify   # prove every level + 3 years of dailies solvable, twice
npm run icons    # regenerate install PNGs from assets/branding source art
node tools/validate-art.mjs   # mechanical half of the art spec
```

## license

MIT
