// Platform route-finding for enemies (#40: "properly navigates").
// Builds a graph of which platforms connect (hop up, drop through, hop across)
// and finds the shortest route with a breadth-first search. Cheap: ~11 platforms.

export interface Plat {
  x: number
  y: number
  w: number
  h: number
  solid?: boolean
  floor?: boolean
}

export type Move = 'up' | 'drop' | 'across'

export interface Edge {
  to: number
  move: Move
  /** Stand anywhere in this x range on the current platform to make the move. */
  fromX: [number, number]
  /** Rough x to aim for on the destination (for jump direction). */
  toX: number
}

export interface NavGraph {
  plats: readonly Plat[]
  edges: Edge[][]
}

/** How high (px) and how far sideways (px) an enemy can jump to reach another platform. */
/** Raised from 250 for the hand-built rooms (#105): enemies plan jumps up to about the player's double jump. */
export const NAV = { upReach: 340, sideReach: 260, dropReach: 420, margin: 24 }

export function buildNav(plats: readonly Plat[]): NavGraph {
  const edges: Edge[][] = plats.map(() => [])
  plats.forEach((a, i) => {
    plats.forEach((b, j) => {
      if (i === j) return
      const rise = a.y - b.y // > 0: b is higher
      const lo = Math.max(a.x, b.x) + NAV.margin
      const hi = Math.min(a.x + a.w, b.x + b.w) - NAV.margin
      const overlap = hi - lo
      if (rise > 0 && rise <= NAV.upReach) {
        if (overlap > 0) {
          // Jump straight up through the one above.
          edges[i].push({ to: j, move: 'up', fromX: [lo, hi], toX: (lo + hi) / 2 })
        } else {
          // Jump up and across a gap from the nearer end.
          const gap = b.x > a.x + a.w ? b.x - (a.x + a.w) : a.x - (b.x + b.w)
          if (gap <= NAV.sideReach) {
            const right = b.x > a.x
            const edgeX = right ? a.x + a.w - NAV.margin : a.x + NAV.margin
            edges[i].push({ to: j, move: 'across', fromX: right ? [edgeX - 40, edgeX] : [edgeX, edgeX + 40], toX: right ? b.x + NAV.margin * 2 : b.x + b.w - NAV.margin * 2 })
          }
        }
      } else if (rise === 0 && overlap <= 0) {
        // Side by side at the same height (#105): walk or hop across the gap.
        const gap = b.x > a.x + a.w ? b.x - (a.x + a.w) : a.x - (b.x + b.w)
        if (gap <= NAV.sideReach) {
          const right = b.x > a.x
          const edgeX = right ? a.x + a.w - NAV.margin : a.x + NAV.margin
          edges[i].push({ to: j, move: 'across', fromX: right ? [edgeX - 40, edgeX] : [edgeX, edgeX + 40], toX: right ? b.x + NAV.margin * 2 : b.x + b.w - NAV.margin * 2 })
        }
      } else if (rise < 0 && -rise <= NAV.dropReach) {
        if (overlap > 0 && !a.solid) {
          // Drop through this (one-way) platform onto the one below.
          edges[i].push({ to: j, move: 'drop', fromX: [lo, hi], toX: (lo + hi) / 2 })
        } else if (overlap > 0 && a.solid && (b.x < a.x - 30 || b.x + b.w > a.x + a.w + 30)) {
          // A solid block standing on (or above) something wider: hop off whichever end is nearer the middle of b (#105).
          const right = b.x + b.w / 2 > a.x + a.w / 2
          const edgeX = right ? a.x + a.w - NAV.margin : a.x + NAV.margin
          edges[i].push({ to: j, move: 'across', fromX: right ? [edgeX - 40, edgeX] : [edgeX, edgeX + 40], toX: right ? a.x + a.w + 60 : a.x - 60 })
        } else if (overlap <= 0) {
          // Hop off the end towards a lower platform.
          const gap = b.x > a.x + a.w ? b.x - (a.x + a.w) : a.x - (b.x + b.w)
          if (gap <= NAV.sideReach * 1.5) {
            const right = b.x > a.x
            const edgeX = right ? a.x + a.w - NAV.margin : a.x + NAV.margin
            edges[i].push({ to: j, move: 'across', fromX: right ? [edgeX - 40, edgeX] : [edgeX, edgeX + 40], toX: right ? b.x + NAV.margin * 2 : b.x + b.w - NAV.margin * 2 })
          }
        }
      }
    })
  })
  return { plats, edges }
}

/**
 * Where walking enemies can spawn (#105): platforms they can get to from the
 * floor (so they can also find their way to you), whose tops aren't covered by
 * something solid sitting right on them (a pillar under its capital).
 */
export function spawnable(g: NavGraph): Set<number> {
  const seen = new Set<number>()
  const queue: number[] = []
  g.plats.forEach((p, i) => {
    if (p.floor) {
      seen.add(i)
      queue.push(i)
    }
  })
  while (queue.length) {
    const i = queue.shift()!
    for (const e of g.edges[i]) if (!seen.has(e.to)) {
      seen.add(e.to)
      queue.push(e.to)
    }
  }
  for (const i of [...seen]) {
    const p = g.plats[i]
    const covered = g.plats.some((q, j) => j !== i && q.solid && q.y + q.h >= p.y - 10 && q.y < p.y && q.x < p.x + p.w - 10 && q.x + q.w > p.x + 10)
    if (covered) seen.delete(i)
  }
  return seen
}

/** The platform whose top is at `bottom` under `x`, or -1. */
export function platformAt(g: NavGraph, x: number, bottom: number, tolerance = 8): number {
  return g.plats.findIndex((p) => Math.abs(p.y - bottom) <= tolerance && x >= p.x - 4 && x <= p.x + p.w + 4)
}

/** The nearest platform at or below (x, bottom): where something there will land. */
export function platformBelow(g: NavGraph, x: number, bottom: number): number {
  let best = -1
  let bestY = Infinity
  g.plats.forEach((p, i) => {
    if (x >= p.x && x <= p.x + p.w && p.y >= bottom - 8 && p.y < bestY) {
      best = i
      bestY = p.y
    }
  })
  return best
}

/** First move of the shortest route from platform `from` to `to`, or null if already there / unreachable. */
export function firstMove(g: NavGraph, from: number, to: number): Edge | null {
  if (from < 0 || to < 0 || from === to) return null
  const prev = new Map<number, { node: number; edge: Edge }>()
  const queue = [from]
  const seen = new Set([from])
  while (queue.length) {
    const n = queue.shift()!
    if (n === to) break
    for (const e of g.edges[n]) {
      if (seen.has(e.to)) continue
      seen.add(e.to)
      prev.set(e.to, { node: n, edge: e })
      queue.push(e.to)
    }
  }
  if (!prev.has(to)) return null
  let step = to
  let edge = prev.get(step)!.edge
  while (prev.get(step)!.node !== from) {
    step = prev.get(step)!.node
    edge = prev.get(step)!.edge
  }
  return edge
}
