// mine pieces: twelve blocks from a dug world, drawn as small 2.5d cubes with
// a pixel texture on each face. lit from the upper left: top face brightest,
// front face true colour, right face in shadow. an aesthetic tribute to the
// blocky mining genre: the look is the homage, every name and pixel is ours.
// viewBox 0 0 64 64.
//
// exports { pieces: [12 x { key, color, svg }], hidden: svg }

// Every face uses the SAME square texture coordinates. On the right, x
// recedes and y stays vertical: bark grows up and grass stays at the rim.
// Center the whole silhouette (12..64), not just its front face (12..52).
import type { PieceArt, SkinArt } from '../types.ts'

interface CubeRecipe {
  frontBase: string
  frontPattern: string
  topBase: string
  topPattern?: string
  rightBase: string
  rightPattern?: string
  palette: Record<string, string>
}

const TOP = 'matrix(1 0 .3 -.3 12 20)'
const RIGHT = 'matrix(.3 -.3 0 1 52 20)'

// an 8x8 pixel grid on a 40-unit face: each cell is 5 units
const CELL = 5

// draws a face from a pattern string: 8 rows of 8 chars, each char a key
// into the palette. '.' leaves the base colour showing.
function face(pattern: string, palette: Record<string, string>, base: string): string {
  let out = `<rect x="0" y="0" width="40" height="40" fill="${base}"/>`
  const rows = pattern.trim().split('\n').map(r => r.trim())
  rows.forEach((row, y) => {
    for (let x = 0; x < 8; x++) {
      const ch = row[x]
      if (ch && ch !== '.' && palette[ch]) out += `<rect x="${x * CELL}" y="${y * CELL}" width="${CELL}" height="${CELL}" fill="${palette[ch]}"/>`
    }
  })
  // Original, repeatable fine grain, batched into two paths rather than
  // hundreds of DOM nodes per cube. The large material/seam cues stay clear.
  let light = '', dark = ''
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const grain = (x * 17 + y * 29 + x * y * 7) % 13
      const pixel = `M${x * 2.5} ${y * 2.5}h2.5v2.5h-2.5z`
      if (grain < 2) light += pixel
      if (grain > 10) dark += pixel
    }
  }
  return out + `<path d="${light}" fill="#fff" opacity=".10"/><path d="${dark}" fill="#000" opacity=".09"/>`
}

const OUTLINE = '#1A1410'

function cube({ frontBase, frontPattern, topBase, topPattern, rightBase, rightPattern, palette }: CubeRecipe): string {
  return (
    `<g class="mine-cube" transform="translate(-6 2)">` +
    `<g data-face="top" transform="${TOP}">${face(topPattern ?? frontPattern, palette, topBase)}</g>` +
    `<g data-face="right" transform="${RIGHT}">${face(rightPattern ?? frontPattern, palette, rightBase)}</g>` +
    `<g data-face="front" transform="translate(12 20)">${face(frontPattern, palette, frontBase)}</g>` +
    // the shading that sells the corner: a soft dark wash on the right face,
    // a light wash on the top, and one crisp outline around the whole block
    `<path d="M52 20 L64 8 L64 48 L52 60 Z" fill="#000" opacity=".20"/>` +
    `<path d="M12 20 L24 8 L64 8 L52 20 Z" fill="#fff" opacity=".14"/>` +
    `<path class="cube-edge" d="M12 20 L24 8 L64 8 L64 48 L52 60 L12 60 Z" fill="none" stroke="${OUTLINE}" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="M12 20 L52 20 L52 60 M52 20 L64 8" fill="none" stroke="${OUTLINE}" stroke-width=".8" opacity=".6"/>` +
    `<path d="M13 21H51V59" fill="none" stroke="#fff" stroke-width=".7" opacity=".18"/>` +
    `</g>`
  )
}

// texture recipes. stone-family blocks share the same base so the ores read
// as "stone with something in it", the way a real seam does.
const STONE = { base: '#8E8E8E', light: '#A7A7A7', dark: '#6F6F6F' }
const stoneSpeck = `
  ..L.....
  .....D..
  D.......
  ....L...
  ..D.....
  ......D.
  .L......
  ....D...`

// an ore is stone with one big seam of its mineral on the front and its own
// tint on the top face. two cues at once: the seam is a silhouette (lump,
// bar, nugget, gem, cross) and the top face is a colour, so on a dense board
// of 41px cubes the greys still read apart, which scattered speckles did not.
function ore(name: string, color: string, glint: string, top: string, shape: 'lump' | 'bar' | 'nugget' | 'gem' | 'cross'): PieceArt {
  const seams = {
    lump: `
      ........
      ..OOO...
      .OGOOOO.
      OOOOOOOO
      .OOOOOO.
      ..OOOOO.
      ...OOO..
      ........`,
    bar: `
      ........
      ........
      .OOOOOO.
      .OGGGGO.
      .OOOOOO.
      .OOOOOO.
      ........
      ........`,
    nugget: `
      ........
      .OOOOO..
      .OGGOO..
      .OGOOO..
      .OOOOO..
      .OOOOO..
      ........
      ........`,
    gem: `
      ...O....
      ..OGO...
      .OGOOO..
      OOOOOOO.
      .OOOOO..
      ..OOO...
      ...O....
      ........`,
    cross: `
      ...OO...
      ...OO...
      .OOOGOO.
      .OOOOOO.
      ...OO...
      ...OO...
      ........
      ........`,
  }
  return {
    key: `${name} ore`,
    color,
    svg: cube({
      frontBase: STONE.base, topBase: top, rightBase: STONE.dark,
      frontPattern: seams[shape], topPattern: stoneSpeck, rightPattern: seams[shape],
      palette: { O: color, G: glint, L: STONE.light, D: STONE.dark },
    }),
  }
}

const pieces = [
  {
    key: 'grass block', color: '#6FA644',
    svg: cube({
      frontBase: '#8A6142', topBase: '#7FBF4E', rightBase: '#6E4C33',
      frontPattern: `
        GGGGGGGG
        G.GGG.GG
        ..D.....
        ....D...
        .D......
        ......D.
        ..D.....
        D....D..`,
      topPattern: `
        .g...g..
        ...g...g
        g...g...
        ..g..g..
        g......g
        ...g.g..
        .g......
        .....g..`,
      palette: { G: '#7FBF4E', g: '#98D45E', D: '#6E4C33' },
    }),
  },
  {
    key: 'dirt block', color: '#8A6142',
    svg: cube({
      frontBase: '#8A6142', topBase: '#A3764F', rightBase: '#6E4C33',
      frontPattern: `
        ..D.....
        .....L..
        D...D...
        ...L....
        .D......
        ....D.L.
        L.......
        ...D....`,
      palette: { D: '#6E4C33', L: '#A3764F' },
    }),
  },
  {
    key: 'stone block', color: '#8E8E8E',
    svg: cube({ frontBase: STONE.base, topBase: STONE.light, rightBase: STONE.dark, frontPattern: stoneSpeck, palette: { L: STONE.light, D: STONE.dark } }),
  },
  {
    key: 'cobble block', color: '#6F7783',
    svg: cube({
      frontBase: '#6F7783', topBase: '#8B95A3', rightBase: '#505863',
      // a mortar grid of offset stones: a lattice reads at 41px where the old
      // scatter of light and dark cells read as plain stone
      frontPattern: `
        L.LD.LLD
        ...D...D
        DDDDDDDD
        .LLD.L.D
        ...D...D
        DDDDDDDD
        L..DL..D
        ...D...D`,
      palette: { L: '#8B95A3', D: '#3E444C' },
    }),
  },
  {
    key: 'oak log', color: '#6B4A2B',
    svg: cube({
      frontBase: '#6B4A2B', topBase: '#C9A46B', rightBase: '#523821',
      frontPattern: `
        D.L.D.L.
        D.L.D.L.
        D.L.D.L.
        D.L.D.L.
        D.L.D.L.
        D.L.D.L.
        D.L.D.L.
        D.L.D.L.`,
      topPattern: `
        rrrrrrrr
        r......r
        r.rrrr.r
        r.r..r.r
        r.r..r.r
        r.rrrr.r
        r......r
        rrrrrrrr`,
      palette: { D: '#4A3118', L: '#86603A', r: '#9C7A4C' },
    }),
  },
  {
    key: 'plank block', color: '#C29A5B',
    svg: cube({
      frontBase: '#C29A5B', topBase: '#DDB877', rightBase: '#9C7A44',
      frontPattern: `
        ........
        DDDDDDDD
        ....D...
        DDDDDDDD
        ........
        DDDDDDDD
        ..D.....
        DDDDDDDD`,
      palette: { D: '#8A6A3A' },
    }),
  },
  {
    key: 'sand block', color: '#E6D8A8',
    svg: cube({
      frontBase: '#E6D8A8', topBase: '#F4EAC2', rightBase: '#C4B486',
      frontPattern: `
        ...D....
        L.....D.
        ....L...
        .D......
        ......L.
        ..L.D...
        D.......
        .....D..`,
      palette: { D: '#C4B486', L: '#FBF3D6' },
    }),
  },
  ore('coal', '#2B2B2B', '#4A4A4A', '#6B6B6B', 'lump'),
  ore('iron', '#D9A878', '#F1CBA5', '#E8C9AC', 'bar'),
  ore('gold', '#F5C542', '#FFE795', '#F9DD8E', 'nugget'),
  ore('diamond', '#5FE3E0', '#BDFFFC', '#B5EFED', 'gem'),
  ore('redstone', '#E0342C', '#FF7A72', '#EFA39D', 'cross'),
]

export default {
  pieces,
  // a mystery block: unbreakable-looking dark bedrock with a question mark
  hidden:
    cube({
      frontBase: '#3A3A3A', topBase: '#5A5A5A', rightBase: '#242424',
      frontPattern: `
        L..D..L.
        .DD..D..
        ..L...DD
        D...D...
        ..D...L.
        LD..D...
        ...L..D.
        .D...D..`,
      palette: { L: '#5A5A5A', D: '#1C1C1C' },
    }) +
    `<path d="M21 34 Q21 28 26 28 Q31 28 31 33 Q31 37 27 38.5 L27 41" stroke="#E8E8E8" stroke-width="3.2" fill="none" stroke-linecap="round"/>` +
    `<circle cx="27" cy="46" r="2" fill="#E8E8E8"/>`,
} satisfies SkinArt
