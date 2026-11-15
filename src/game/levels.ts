// Level layouts: the wave arena and the hub (#70, from the approved mock-up,
// concepts/hub-mockup.html). Platforms marked `solid` collide on all sides;
// the rest are one-way (jump up through, drop down through).
import { PLATFORMS } from './tuning.ts'

export interface LevelPlat {
  x: number
  y: number
  w: number
  h: number
  solid?: boolean
  /** The room's own walls and ceiling: not somewhere to stand or spawn. */
  edge?: boolean
  /** Part of the floor. */
  floor?: boolean
  /** Crumbles when stood on, comes back (#81). */
  crumble?: boolean
  /** Conveyor: carries you at this speed, px/s (negative = left) (#81). */
  conveyor?: number
}

/** Hazards and moving pieces, in world px (#81). Types as in gen/chunks.ts. */
export interface LevelEnv {
  t: 'spikes' | 'saw' | 'jet' | 'bounce' | 'wind' | 'mover'
  x: number
  y: number
  w: number
  h: number
  dir?: 'up' | 'down' | 'left' | 'right'
  /** Travel for movers and saws, px. */
  dx?: number
  dy?: number
  /** Mover colour (hand-built rooms: a gold chandelier, a stone counterweight). */
  colour?: number
}

/** Decoration with no mechanics yet (#102): candles (x = centre, y = the surface it stands on) and eyes (centre). */
export interface LevelDecor {
  t: 'candle' | 'eye'
  x: number
  y: number
}

export interface Level {
  width: number
  height: number
  platforms: LevelPlat[]
  spawn: { x: number; y: number }
  /** Top of the floor: bullets stop here, gold settles here. */
  floorY: number
  env?: LevelEnv[]
  /** Gaps in the floor: bottomless (#81). */
  pits?: { x: number; w: number }[]
  /** World look for hand-built rooms (#102): background, one-way platforms, solid blocks, the room's walls, lit top edges. */
  style?: { bg: number; plat: number; block: number; edge: number; top: number }
  /** One-way platform colour override (timber in the Bell Tower). */
  platformColour?: number
  decor?: LevelDecor[]
}

export const ARENA_LEVEL: Level = {
  width: 2400,
  height: 1350,
  platforms: [...PLATFORMS],
  spawn: { x: 1200, y: 1230 },
  floorY: 1310,
}

/** Hub geometry. FLOOR is the hall floor; the endless chamber sits beneath it. */
export const HUB = {
  width: 3800,
  height: 1500,
  floor: 720,
  slab: 70,
  lower: 1320,
  hole: { x: 1830, w: 140 },
  room: { x: 1300, w: 1200 },
  pedestals: [1520, 1700, 2100, 2280],
  portals: [
    { world: 1 as const, x: 380, shape: 'hex' as const, colour: 0x5fd4e8, name: 'World 1' },
    { world: 2 as const, x: 1020, shape: 'diamond' as const, colour: 0xa98bff, name: 'World 2' },
    { world: 3 as const, x: 2780, shape: 'triangle' as const, colour: 0xffb547, name: 'World 3' },
    { world: 4 as const, x: 3420, shape: 'circle' as const, colour: 0xff6f91, name: 'World 4' },
  ],
  endless: { x: 2240 },
  dummy: { x: 2620 },
}

const H = HUB
export const HUB_LEVEL: Level = {
  width: H.width,
  height: H.height,
  platforms: [
    { x: 0, y: H.floor, w: H.hole.x, h: H.slab, solid: true },
    { x: H.hole.x + H.hole.w, y: H.floor, w: H.width - H.hole.x - H.hole.w, h: H.slab, solid: true },
    { x: H.room.x - 60, y: H.lower, w: H.room.w + 120, h: H.height - H.lower, solid: true },
    { x: H.room.x - 60, y: H.floor + H.slab, w: 60, h: H.lower - H.floor - H.slab, solid: true },
    { x: H.room.x + H.room.w, y: H.floor + H.slab, w: 60, h: H.lower - H.floor - H.slab, solid: true },
    // Ledges back up from the endless chamber, the last one right under the hole.
    { x: 1360, y: H.lower - 170, w: 200, h: 16 },
    { x: 1600, y: H.lower - 340, w: 200, h: 16 },
    { x: H.hole.x + 6, y: H.lower - 500, w: H.hole.w - 12, h: 16 },
  ],
  spawn: { x: 1620, y: H.floor - 30 },
  floorY: H.floor,
}

/**
 * Wall-jump test room (#82): closed room with a shaft (two walls), a tall
 * pillar to climb on its own, a ledge stack and a high shelf on the right wall.
 */
export const TEST_ROOM: Level = (() => {
  const W = 2400
  const H = 1600
  const floor = 1540
  return {
    width: W,
    height: H,
    platforms: [
      { x: 0, y: floor, w: W, h: H - floor, solid: true, floor: true },
      { x: 0, y: 0, w: 40, h: floor, solid: true, edge: true },
      { x: W - 40, y: 0, w: 40, h: floor, solid: true, edge: true },
      { x: 40, y: 0, w: W - 80, h: 40, solid: true, edge: true },
      // Shaft: two walls 160 apart.
      { x: 500, y: 700, w: 40, h: floor - 700, solid: true },
      { x: 700, y: 700, w: 40, h: floor - 700, solid: true },
      // Tall pillar: climb the same wall.
      { x: 1200, y: 480, w: 80, h: floor - 480, solid: true },
      // Ledge stack.
      { x: 1650, y: 1370, w: 220, h: 24 },
      { x: 1750, y: 1190, w: 220, h: 24 },
      { x: 1650, y: 1010, w: 220, h: 24 },
      // High shelf off the right wall: climb the wall to get there.
      { x: W - 400, y: 640, w: 360, h: 30, solid: true },
    ],
    spawn: { x: 950, y: floor - 40 },
    floorY: floor,
  }
})()
