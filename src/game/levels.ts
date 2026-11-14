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
}

export interface Level {
  width: number
  height: number
  platforms: LevelPlat[]
  spawn: { x: number; y: number }
}

export const ARENA_LEVEL: Level = {
  width: 2400,
  height: 1350,
  platforms: [...PLATFORMS],
  spawn: { x: 1200, y: 1230 },
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
}
