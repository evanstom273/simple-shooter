// The level generator (#79): builds a closed room for a story section out of
// hand-made chunks, then checks every standing surface can be reached with the
// base kit (jump, double jump, dash, wall jump; no stat upgrades, #77/#78) and
// removes anything that can't.
//
// Layout: solid walls left and right and a ceiling; a floor (with gaps where
// chunks have pits); a row of ground chunks along the floor; floating air
// chunks in bands above, each band within a double jump of the one below.
import type { Level, LevelEnv, LevelPlat } from '../levels.ts'
import { STARTER_CHUNKS, TILE, type Chunk, type Piece } from './chunks.ts'

const WALL = 40
const FLOOR_H = 80
/** Rise between air bands, px: inside a double jump (~360) with room to spare. */
const BAND = 290
/** Reach with the base kit, px (double jump ~360 high; a dash adds ~225 any way). */
export const REACH = { rise: 350, across: 430, drop: 520, climbSide: 220 }

export type Shape = 'wide' | 'standard' | 'tall'

export interface GenOptions {
  world: number
  section: number
  /** Extra chunks (from the editor) to add to the pool. */
  extra?: Chunk[]
  /** Only these chunks (for testing one chunk). */
  only?: Chunk[]
  shape?: Shape
  /** Fixed room size (endless keeps one size so only the inside changes). */
  size?: { w: number; h: number }
  /** Leave out chunks with pits (endless: the floor stays whole while the room rebuilds). */
  noPits?: boolean
  seed?: number
}

/** Small seeded RNG so a layout can be reproduced. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Placed {
  chunk: Chunk
  x: number
  y: number
  /** Index of this placement; pieces remember it so a whole air chunk can be removed. */
  id: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const overlaps = (a: Rect, b: Rect, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y

export function generate(o: GenOptions): Level {
  const r = rng(o.seed ?? Math.floor(Math.random() * 2 ** 31))
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const between = (lo: number, hi: number) => lo + r() * (hi - lo)

  const pool = (o.only ?? [...STARTER_CHUNKS, ...(o.extra ?? [])]).filter(
    (c) =>
      !c.off &&
      (o.world === 0 || !c.worlds?.length || c.worlds.includes(o.world)) &&
      (c.minSection ?? 1) <= o.section &&
      !(o.noPits && c.pieces.some((pc) => pc.t === 'pit')),
  )
  const ground = pool.filter((c) => c.kind === 'ground')
  const air = pool.filter((c) => c.kind === 'air')

  // Size varies per layout (#79): wide, standard or tall.
  const shape: Shape = o.shape ?? pick<Shape>(['wide', 'standard', 'standard', 'tall'])
  const snap = (v: number) => Math.round(v / TILE) * TILE
  const W = o.size?.w ?? snap(shape === 'wide' ? between(3000, 3600) : shape === 'tall' ? between(1800, 2100) : between(2400, 2800))
  const H = o.size?.h ?? snap(shape === 'wide' ? between(1250, 1400) : shape === 'tall' ? between(2200, 2500) : between(1450, 1650))
  const floorY = H - FLOOR_H

  const placed: Placed[] = []
  const occupied: Rect[] = []
  const reserve = { x: W / 2 - 140, y: floorY - 160, w: 280, h: 160 } // spawn spot: clear floor
  occupied.push(reserve)

  // Ground row, left to right, with some open floor between chunks.
  let cursor = WALL + snap(between(40, 200))
  for (let guard = 0; guard < 60 && ground.length; guard++) {
    const c = pick(ground)
    const cw = c.w * TILE
    const ch = c.h * TILE
    if (cursor + cw > W - WALL - 20) break
    const rect = { x: cursor, y: floorY - ch, w: cw, h: ch }
    if (ch > floorY - 320 || overlaps(rect, reserve, 20)) {
      // Too tall for this room, or over the spawn: skip past.
      if (overlaps(rect, reserve, 20)) cursor = reserve.x + reserve.w + snap(between(40, 120))
      continue
    }
    placed.push({ chunk: c, x: rect.x, y: rect.y, id: placed.length })
    occupied.push(rect)
    cursor += cw + snap(between(60, 260))
  }

  // Air bands above, each within reach of the one below. Sparse (about a
  // quarter of the width each), and laid out as a zigzag: each band's main
  // chunk steps across from the last one, so climbing has a readable route
  // instead of a scatter of platforms.
  let anchor = { x: W / 2 - 200, w: 400 } // the spawn area of the floor
  let goRight = r() < 0.5
  for (let base = floorY - BAND; base > 260 && air.length; base -= BAND) {
    const target = (W - WALL * 2) * 0.25
    let used = 0
    let main = true
    for (let tries = 0; tries < 30 && used < target; tries++) {
      const c = pick(air)
      const cw = c.w * TILE
      const ch = c.h * TILE
      const y = snap(base + between(-30, 30)) - ch
      let x: number
      if (main) {
        // Step across from the band below: overlap its end a little, or leave a short gap.
        const step = between(-cw * 0.3, 180)
        x = goRight ? anchor.x + anchor.w + step : anchor.x - cw - step
        if (x < WALL + 20 || x + cw > W - WALL - 20) {
          goRight = !goRight
          x = goRight ? anchor.x + anchor.w + step : anchor.x - cw - step
        }
        x = snap(Math.max(WALL + 20, Math.min(W - WALL - 20 - cw, x)))
      } else {
        x = snap(between(WALL + 20, W - WALL - 20 - cw))
      }
      const rect = { x, y, w: cw, h: ch }
      if (y < WALL + 140) break
      if (occupied.some((q) => overlaps(rect, q, main ? 40 : 160))) continue
      placed.push({ chunk: c, x, y, id: placed.length })
      occupied.push(rect)
      used += cw
      if (main) {
        anchor = { x, w: cw }
        goRight = !goRight
        main = false
      }
    }
  }

  // Turn placements into level pieces (px).
  const platforms: (LevelPlat & { from?: number })[] = []
  const env: (LevelEnv & { from?: number })[] = []
  const pits: { x: number; w: number }[] = []
  for (const pl of placed) {
    for (const pc of pl.chunk.pieces) addPiece(pc, pl, platforms, env, pits)
  }

  mergePlatforms(platforms)

  // Floor, broken by pits; walls and ceiling.
  const floorPieces: LevelPlat[] = []
  let fx = 0
  for (const pit of [...pits].sort((a, b) => a.x - b.x)) {
    if (pit.x > fx) floorPieces.push({ x: fx, y: floorY, w: pit.x - fx, h: FLOOR_H, solid: true, floor: true })
    fx = Math.max(fx, pit.x + pit.w)
  }
  if (fx < W) floorPieces.push({ x: fx, y: floorY, w: W - fx, h: FLOOR_H, solid: true, floor: true })
  const edges: LevelPlat[] = [
    { x: 0, y: 0, w: WALL, h: floorY, solid: true, edge: true },
    { x: W - WALL, y: 0, w: WALL, h: floorY, solid: true, edge: true },
    { x: WALL, y: 0, w: W - WALL * 2, h: WALL, solid: true, edge: true },
  ]

  // Reachability with the base kit: drop what can't be reached.
  const all = [...floorPieces, ...platforms]
  const reached = reachable(all, edges, W)
  const deadPlacements = new Set<number>()
  platforms.forEach((pl, i) => {
    if (reached.has(floorPieces.length + i)) return
    const from = pl.from
    if (from !== undefined && placed[from].chunk.kind === 'air') deadPlacements.add(from)
  })
  const keptPlats = platforms.filter((pl, i) => reached.has(floorPieces.length + i) && !(pl.from !== undefined && deadPlacements.has(pl.from)))
  const keptEnv = env.filter((e) => !(e.from !== undefined && deadPlacements.has(e.from)))

  const strip = <T extends { from?: number }>(x: T) => {
    const { from: _from, ...rest } = x
    void _from
    return rest
  }
  return {
    width: W,
    height: H,
    floorY,
    platforms: [...floorPieces, ...edges, ...keptPlats.map(strip)],
    env: keptEnv.map(strip),
    pits,
    spawn: { x: W / 2, y: floorY - 40 },
  }
}

/**
 * A small room with just one chunk in it, for play-testing in the editor (#79).
 * Ground chunks sit on the floor; air chunks float a jump above it. Nothing is
 * removed: `unreachable` counts platforms the base kit can't get to.
 */
export function chunkTestLevel(c: Chunk): Level & { unreachable: number } {
  const cw = c.w * TILE
  const ch = c.h * TILE
  const W = Math.max(1600, Math.ceil((cw + 900) / TILE) * TILE)
  const H = Math.max(1000, Math.ceil((ch + 600) / TILE) * TILE)
  const floorY = H - FLOOR_H
  const x = Math.round((W - cw) / 2 / TILE) * TILE
  const y = c.kind === 'ground' ? floorY - ch : floorY - 240 - ch
  const pl: Placed = { chunk: c, x, y, id: 0 }
  const platforms: LevelPlat[] = []
  const env: LevelEnv[] = []
  const pits: { x: number; w: number }[] = []
  for (const pc of c.pieces) addPiece(pc, pl, platforms, env, pits)
  const floorPieces: LevelPlat[] = []
  let fx = 0
  for (const pit of [...pits].sort((a, b) => a.x - b.x)) {
    if (pit.x > fx) floorPieces.push({ x: fx, y: floorY, w: pit.x - fx, h: FLOOR_H, solid: true, floor: true })
    fx = Math.max(fx, pit.x + pit.w)
  }
  if (fx < W) floorPieces.push({ x: fx, y: floorY, w: W - fx, h: FLOOR_H, solid: true, floor: true })
  const edges: LevelPlat[] = [
    { x: 0, y: 0, w: WALL, h: floorY, solid: true, edge: true },
    { x: W - WALL, y: 0, w: WALL, h: floorY, solid: true, edge: true },
    { x: WALL, y: 0, w: W - WALL * 2, h: WALL, solid: true, edge: true },
  ]
  const all = [...floorPieces, ...platforms]
  const reached = reachable(all, edges, W)
  const clean = platforms.map((p) => {
    const { from: _f, ...rest } = p as LevelPlat & { from?: number }
    void _f
    return rest
  })
  const cleanEnv = env.map((e) => {
    const { from: _f, ...rest } = e as LevelEnv & { from?: number }
    void _f
    return rest
  })
  return {
    width: W,
    height: H,
    floorY,
    platforms: [...floorPieces, ...edges, ...clean],
    env: cleanEnv,
    pits,
    spawn: { x: Math.min(x - 160, 300), y: floorY - 40 },
    unreachable: platforms.length - platforms.filter((_, i) => reached.has(floorPieces.length + i)).length,
  }
}

/**
 * Join plain one-way platforms at the same height with only a small gap
 * between them into one longer platform (fewer tiny separate bits).
 */
function mergePlatforms(platforms: (LevelPlat & { from?: number })[]) {
  const plain = (p: LevelPlat) => !p.solid && !p.crumble && !p.conveyor && !p.edge && !p.floor
  const sorted = platforms.filter(plain).sort((a, b) => a.y - b.y || a.x - b.x)
  const gone = new Set<LevelPlat>()
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i]
    if (gone.has(a)) continue
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j]
      if (gone.has(b) || Math.abs(b.y - a.y) > 20) continue
      const gap = b.x - (a.x + a.w)
      if (gap < 140 && b.x + b.w > a.x) {
        const right = Math.max(a.x + a.w, b.x + b.w)
        a.x = Math.min(a.x, b.x)
        a.w = right - a.x
        a.y = Math.min(a.y, b.y)
        gone.add(b)
      }
    }
  }
  for (let i = platforms.length - 1; i >= 0; i--) if (gone.has(platforms[i])) platforms.splice(i, 1)
}

function addPiece(pc: Piece, pl: Placed, platforms: (LevelPlat & { from?: number })[], env: (LevelEnv & { from?: number })[], pits: { x: number; w: number }[]) {
  const x = pl.x + pc.x * TILE
  const y = pl.y + pc.y * TILE
  const w = pc.w * TILE
  const h = pc.h * TILE
  const from = pl.id
  switch (pc.t) {
    case 'plat':
      platforms.push({ x, y, w, h: Math.max(h, 20), from })
      break
    case 'block':
      platforms.push({ x, y, w, h, solid: true, from })
      break
    case 'crumble':
      platforms.push({ x, y, w, h: Math.max(h, 20), crumble: true, from })
      break
    case 'conveyor':
      platforms.push({ x, y, w, h: Math.max(h, 20), solid: true, conveyor: pc.dir === 'left' ? -220 : 220, from })
      break
    case 'pit':
      pits.push({ x, w })
      break
    case 'spikes':
    case 'saw':
    case 'jet':
    case 'bounce':
    case 'wind':
    case 'mover':
      env.push({ t: pc.t, x, y, w, h, dir: pc.dir, dx: (pc.dx ?? 0) * TILE, dy: (pc.dy ?? 0) * TILE, from })
      break
  }
}

/**
 * Which surfaces (platform tops) can be reached from the floor with the base
 * kit. Jumps: up to REACH.rise up, REACH.across sideways; drops further.
 * Walls: anything touching a wall face you can reach can be climbed (#82: you
 * can climb the same wall), so the top of that block and ledges beside the
 * face are reachable too.
 */
export function reachable(surfaces: LevelPlat[], edges: LevelPlat[], W: number): Set<number> {
  const n = surfaces.length
  const seen = new Set<number>()
  const queue: number[] = []
  surfaces.forEach((s, i) => {
    if (s.floor) {
      seen.add(i)
      queue.push(i)
    }
  })
  // Wall faces: each solid block's two sides, plus the room's side walls.
  const faces: { x: number; top: number; bottom: number; side: -1 | 1; owner: number }[] = []
  surfaces.forEach((s, i) => {
    if (!s.solid || s.floor || s.h < 60) return
    faces.push({ x: s.x, top: s.y, bottom: s.y + s.h, side: -1, owner: i }) // approached from the left
    faces.push({ x: s.x + s.w, top: s.y, bottom: s.y + s.h, side: 1, owner: i }) // from the right
  })
  for (const e of edges) {
    if (e.h < 200) continue
    if (e.x === 0) faces.push({ x: e.w, top: e.y, bottom: e.y + e.h, side: 1, owner: -1 })
    else if (e.x + e.w === W) faces.push({ x: e.x, top: e.y, bottom: e.y + e.h, side: -1, owner: -1 })
  }

  const gapBetween = (a: LevelPlat, b: LevelPlat) => Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w))
  const canJump = (a: LevelPlat, b: LevelPlat) => {
    const rise = a.y - b.y
    const gap = gapBetween(a, b)
    if (rise > REACH.rise) return false
    if (rise > 0) {
      if (gap > REACH.across - rise * 0.6) return false
      // A solid block right above you: you need to get round it.
      if (b.solid && gap === 0 && !(a.x < b.x - 40 || a.x + a.w > b.x + b.w + 40)) return false
      return true
    }
    return gap <= REACH.drop + Math.min(-rise, 600) * 0.3
  }
  // Can you get onto this wall face from surface a?
  const reachesFace = (a: LevelPlat, f: (typeof faces)[number]) => {
    const near = f.side === -1 ? a.x < f.x && a.x + a.w >= f.x - REACH.climbSide : a.x + a.w > f.x && a.x <= f.x + REACH.climbSide
    return near && a.y > f.top + 10 && a.y - REACH.rise <= f.bottom
  }
  // Ledges you can hop onto from a face while climbing it.
  const offFace = (f: (typeof faces)[number], c: LevelPlat) => {
    const end = f.side === -1 ? c.x + c.w : c.x
    const sideOk = f.side === -1 ? c.x < f.x : c.x + c.w > f.x
    return sideOk && Math.abs(end - f.x) <= 160 && c.y >= f.top - 120 && c.y <= f.bottom
  }

  while (queue.length) {
    const i = queue.shift()!
    const a = surfaces[i]
    for (let j = 0; j < n; j++) {
      if (seen.has(j)) continue
      if (canJump(a, surfaces[j])) {
        seen.add(j)
        queue.push(j)
      }
    }
    for (const f of faces) {
      if (!reachesFace(a, f)) continue
      if (f.owner >= 0 && !seen.has(f.owner)) {
        seen.add(f.owner)
        queue.push(f.owner)
      }
      for (let j = 0; j < n; j++) {
        if (!seen.has(j) && offFace(f, surfaces[j])) {
          seen.add(j)
          queue.push(j)
        }
      }
    }
  }
  return seen
}
