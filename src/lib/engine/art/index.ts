// the theme registry. ORDER IS FROZEN: world w uses THEMES[w % THEMES.length],
// so reordering or removing entries silently reskins everyone's campaign.
// append new themes at the end only. see ART-SPEC.md.
import shapes from './shapes.ts'
import fruits from './fruits.ts'
import ocean from './ocean.ts'
import bugs from './bugs.ts'
import gems from './gems.ts'
import workshop from './workshop.ts'
import pets from './pets.ts'
import type { Theme } from '../types.ts'

export const THEMES: Theme[] = [shapes, fruits, ocean, bugs, gems, workshop, pets]

export function themeForWorld(world: number): Theme {
  return THEMES[world % THEMES.length]
}
