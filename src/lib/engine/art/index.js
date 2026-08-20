// the theme registry. ORDER IS FROZEN: world w uses THEMES[w % THEMES.length],
// so reordering or removing entries silently reskins everyone's campaign.
// append new themes at the end only. see ART-SPEC.md.
import shapes from './shapes.js'
import fruits from './fruits.js'
import ocean from './ocean.js'
import bugs from './bugs.js'
import gems from './gems.js'
import workshop from './workshop.js'
import pets from './pets.js'

export const THEMES = [shapes, fruits, ocean, bugs, gems, workshop, pets]

export function themeForWorld(world) {
  return THEMES[world % THEMES.length]
}
