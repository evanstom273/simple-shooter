// Hand-made chunks (#79): small authored pieces of level the generator picks
// and stitches together. Coordinates are in tiles (TILE px), measured from the
// chunk's top-left; a ground chunk's bottom edge sits on the floor, an air
// chunk floats with its bottom edge on a band line.
//
// Lyra's own chunks come from the chunk editor (Testing → Chunk editor) and
// join this pool; drafted ones live here.

export const TILE = 20

export type PieceType =
  // Solid ground: one-way platform, solid block.
  | 'plat'
  | 'block'
  // Harmful (#81): spikes (dir = the way the points face), saw (dx/dy = track), jet (dir = firing direction), pit (a gap in the floor; ground chunks only).
  | 'spikes'
  | 'saw'
  | 'jet'
  | 'pit'
  // Environment (#81): moving platform (dx/dy = travel), crumbling platform, bounce pad, conveyor (dir left/right), wind zone (dir).
  | 'mover'
  | 'crumble'
  | 'bounce'
  | 'conveyor'
  | 'wind'

export type Dir = 'up' | 'down' | 'left' | 'right'

export interface Piece {
  t: PieceType
  x: number
  y: number
  w: number
  h: number
  dir?: Dir
  /** Mover travel / saw track, in tiles. */
  dx?: number
  dy?: number
}

export interface Chunk {
  id: string
  name: string
  kind: 'ground' | 'air'
  w: number
  h: number
  /** Worlds it can appear in (#79 palettes); empty or missing = all. */
  worlds?: number[]
  /** Earliest section it can appear in (the gradual ramp, #79). */
  minSection?: number
  pieces: Piece[]
  /** Made in the chunk editor. */
  custom?: boolean
}

const p = (t: PieceType, x: number, y: number, w: number, h: number, extra: Partial<Piece> = {}): Piece => ({ t, x, y, w, h, ...extra })

/** Claude's starter set. Heights: a single jump is ~10 tiles, a double jump ~18. */
export const STARTER_CHUNKS: Chunk[] = [
  // ---- Ground ----
  {
    id: 'pillar-pair',
    name: 'Pillar pair',
    kind: 'ground',
    w: 14,
    h: 18,
    pieces: [p('block', 0, 4, 2, 14), p('block', 12, 4, 2, 14), p('plat', 2, 6, 10, 1)],
  },
  {
    id: 'shaft',
    name: 'Shaft',
    kind: 'ground',
    w: 12,
    h: 34,
    pieces: [p('block', 0, 4, 2, 30), p('block', 10, 4, 2, 30), p('plat', 2, 18, 8, 1)],
  },
  {
    id: 'steps',
    name: 'Steps',
    kind: 'ground',
    w: 18,
    h: 14,
    pieces: [p('block', 0, 10, 6, 4), p('block', 6, 6, 6, 8), p('block', 12, 2, 6, 12)],
  },
  {
    id: 'ledge-stack',
    name: 'Ledge stack',
    kind: 'ground',
    w: 16,
    h: 30,
    pieces: [p('plat', 0, 21, 10, 1), p('plat', 6, 12, 10, 1), p('plat', 0, 3, 10, 1)],
  },
  {
    id: 'tower',
    name: 'Tower',
    kind: 'ground',
    w: 18,
    h: 38,
    pieces: [p('block', 7, 4, 4, 34), p('plat', 0, 26, 6, 1), p('plat', 12, 18, 6, 1), p('plat', 0, 10, 6, 1)],
  },
  {
    id: 'low-wall',
    name: 'Low wall',
    kind: 'ground',
    w: 10,
    h: 8,
    pieces: [p('block', 3, 0, 4, 8)],
  },
  {
    id: 'spike-trough',
    name: 'Spike trough',
    kind: 'ground',
    w: 16,
    h: 10,
    minSection: 1,
    pieces: [p('block', 0, 6, 3, 4), p('block', 13, 6, 3, 4), p('spikes', 3, 9, 10, 1, { dir: 'up' }), p('plat', 4, 0, 8, 1)],
  },
  {
    id: 'pit-hop',
    name: 'Pit hop',
    kind: 'ground',
    w: 16,
    h: 10,
    minSection: 2,
    pieces: [p('pit', 4, 9, 8, 1), p('plat', 5, 2, 6, 1)],
  },
  {
    id: 'crumble-bridge',
    name: 'Crumble bridge',
    kind: 'ground',
    w: 20,
    h: 6,
    minSection: 3,
    pieces: [p('pit', 3, 5, 14, 1), p('crumble', 3, 5, 5, 1), p('crumble', 8, 5, 4, 1), p('crumble', 12, 5, 5, 1)],
  },
  {
    id: 'bounce-tower',
    name: 'Bounce tower',
    kind: 'ground',
    w: 16,
    h: 40,
    minSection: 1,
    pieces: [p('block', 0, 6, 3, 34), p('bounce', 5, 39, 4, 1), p('block', 0, 4, 12, 2), p('plat', 11, 20, 5, 1)],
  },
  {
    id: 'jet-floor',
    name: 'Jet floor',
    kind: 'ground',
    w: 18,
    h: 14,
    minSection: 2,
    pieces: [p('jet', 4, 13, 2, 1, { dir: 'up' }), p('jet', 12, 13, 2, 1, { dir: 'up' }), p('plat', 1, 4, 16, 1)],
  },
  {
    id: 'conveyor-run',
    name: 'Conveyor run',
    kind: 'ground',
    w: 20,
    h: 10,
    minSection: 2,
    pieces: [p('conveyor', 0, 9, 20, 1, { dir: 'left' }), p('plat', 6, 1, 8, 1)],
  },
  {
    id: 'lift',
    name: 'Lift',
    kind: 'ground',
    w: 14,
    h: 36,
    minSection: 2,
    pieces: [p('block', 0, 4, 2, 32), p('mover', 3, 34, 6, 1, { dy: -26 }), p('plat', 2, 4, 12, 1)],
  },
  {
    id: 'saw-gap',
    name: 'Saw gap',
    kind: 'ground',
    w: 18,
    h: 16,
    minSection: 3,
    pieces: [p('block', 0, 8, 4, 8), p('block', 14, 8, 4, 8), p('saw', 8, 12, 2, 2, { dx: 0, dy: -8 }), p('plat', 4, 2, 10, 1)],
  },
  {
    id: 'wind-tunnel',
    name: 'Wind tunnel',
    kind: 'ground',
    w: 20,
    h: 24,
    minSection: 3,
    pieces: [p('wind', 2, 0, 16, 24, { dir: 'up' }), p('plat', 0, 6, 4, 1), p('plat', 16, 6, 4, 1)],
  },

  // ---- Air ----
  { id: 'slab', name: 'Slab', kind: 'air', w: 14, h: 1, pieces: [p('plat', 0, 0, 14, 1)] },
  { id: 'stagger', name: 'Stagger', kind: 'air', w: 22, h: 5, pieces: [p('plat', 0, 4, 9, 1), p('plat', 13, 0, 9, 1)] },
  { id: 'perch', name: 'Perch', kind: 'air', w: 12, h: 8, pieces: [p('block', 5, 1, 2, 7), p('plat', 0, 0, 12, 1)] },
  { id: 'island', name: 'Island', kind: 'air', w: 16, h: 6, pieces: [p('block', 2, 3, 12, 3), p('plat', 0, 0, 4, 1), p('plat', 12, 0, 4, 1)] },
  { id: 'twin', name: 'Twins', kind: 'air', w: 24, h: 1, pieces: [p('plat', 0, 0, 8, 1), p('plat', 16, 0, 8, 1)] },
  {
    id: 'spiked-shelf',
    name: 'Spiked shelf',
    kind: 'air',
    w: 14,
    h: 3,
    minSection: 1,
    pieces: [p('block', 0, 1, 14, 1), p('spikes', 0, 2, 14, 1, { dir: 'down' }), p('plat', 0, 0, 14, 1)],
  },
  {
    id: 'crumble-trio',
    name: 'Crumble trio',
    kind: 'air',
    w: 22,
    h: 1,
    minSection: 2,
    pieces: [p('crumble', 0, 0, 6, 1), p('crumble', 8, 0, 6, 1), p('crumble', 16, 0, 6, 1)],
  },
  {
    id: 'ferry',
    name: 'Ferry',
    kind: 'air',
    w: 30,
    h: 1,
    minSection: 2,
    pieces: [p('mover', 0, 0, 8, 1, { dx: 22 })],
  },
  {
    id: 'saw-rail',
    name: 'Saw rail',
    kind: 'air',
    w: 28,
    h: 6,
    minSection: 3,
    pieces: [p('plat', 0, 5, 6, 1), p('plat', 22, 5, 6, 1), p('saw', 7, 0, 2, 2, { dx: 12 })],
  },
]
