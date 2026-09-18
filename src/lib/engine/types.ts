export type Tube = number[]
export type Tubes = Tube[]

export interface Move {
  from: number
  to: number
  count: number
  score?: number
}

export interface BoardParams {
  colors: number
  capacity: number
  empties: number
  hidden: boolean
}

export interface BoardContents {
  params: BoardParams
  tubes: Tubes
  salt: number
  solution: Move[]
}

export interface LevelBoard extends BoardContents {
  kind: 'level'
  n: number
}

export interface SeedBoard extends BoardContents {
  kind: 'seed'
  seed: number
}

export type Board = LevelBoard | SeedBoard
export type StarCount = 1 | 2 | 3
export type Random = () => number
export type ShareResult = 'shared' | 'cancelled' | 'copied' | 'failed'

export interface SolveOptions {
  maxNodes?: number
  maxDepth?: number
}

export type SolveResult = { nodes: number; aborted: boolean } & (
  { solved: true; moves: Move[] } | { solved: false; moves: null }
)

export type OptimalResult =
  | { length: number; aborted: false }
  | { length: null; aborted: true }

export type MotionVerb = 'drop' | 'screw' | 'breakpop' | 'flip' | 'roll' | 'fly' | 'hover' | 'zig' | 'mine' | 'squish' | 'tumble' | 'bounce' | 'slide' | 'zip' | 'float'
export type SoundPalette = 'metal' | 'stone' | 'neon' | 'pop' | 'cute' | 'dice' | 'glass' | 'wood'
export type SkinKey = 'bolts' | 'mine' | 'dash' | 'kawaii' | 'dice' | 'tubes'

export interface Motion {
  seconds: number
  lift: number
  spin: number
  stagger: number
  land: MotionVerb
}

export interface PieceArt {
  key: string
  color: string
  svg: string
  verb?: MotionVerb
}

export interface Theme {
  key: string
  title: string
  tint: string
  items: PieceArt[]
}

export interface SkinArt {
  pieces: PieceArt[]
  hidden: string
}

export interface Skin {
  key: SkinKey
  title: string
  pieces?: PieceArt[]
  hidden?: string
  pieceRatio?: number
  pieceViewBox?: string
  tubeLip?: number
  motion: Motion
  sound: SoundPalette
  preview: string
}

export interface Point {
  x: number
  y: number
}
