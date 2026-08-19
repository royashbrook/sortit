# art pack spec

every theme is one ES module in `art/`, default-exporting:

```js
export default {
  key: 'fruits',        // short, stable, lowercase; NEVER renamed after ship
  title: 'Fruit Farm',  // shown as the world name, kid-readable
  tint: '#FFEED2',      // very light warm tint behind the board for this theme
  items: [ /* exactly 12 */ ],
}
```

each item:

```js
{ key: 'apple', color: '#E5484D', svg: '<g>…</g>' }
```

- `svg` is INNER markup for a `viewBox="0 0 64 64"` svg element (no outer
  `<svg>` tag). art stays inside x/y 4..60.
- `color` is the item's dominant fill. all 12 colors in a theme must be
  clearly distinct from each other (they double as the "sort by" identity).
- every item must have a DISTINCT SILHOUETTE. colourblind kids sort by form;
  two items that differ only by colour are a spec violation.
- style: flat warm fills, bold `#3D3230` outline at stroke-width 3
  (stroke-linejoin/linecap round), one friendly face per item (two dot eyes +
  a smile — copy the `face()` helper in `shapes.js`), optional tiny highlight.
  warm and cosy over slick. calm, not loud.
- no raster data, no external refs, no <image>, no gradients-heavy filters.
  plain shapes: path/circle/rect/ellipse/line/polygon/g only.
- keep each item's svg string under ~700 chars.

`shapes.js` is the reference implementation; match its feel so the seven
themes read as one family.

theme order in `art/index.js` is FROZEN after ship (world rotation is
deterministic). new themes append at the end.
