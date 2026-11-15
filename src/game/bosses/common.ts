// Pieces every boss uses: hittable parts, and the things they throw at you.
import Phaser from 'phaser'
import { ARENA } from '../tuning.ts'
import type { Enemy, Hazard } from '../enemies/types.ts'
import type { HitSource } from '../targets.ts'

export const INK = 0x1a1a26
export const BONE = 0xe8dcc8
export const GLASS = 0xf6efe3
export const GOLD = 0xc8913a
export const FLAME = 0xffcf7a
export const VIOLET = 0x5b3a8a
export const LILAC = 0xb9a6ff
export const VOID = 0x07060f
export const STAR = 0x9fd8ff
export const IRIS = 0xb3263a

/** Blend two colours (k = 0 → a, 1 → b): for heating towards white before an attack. */
export function mix(a: number, b: number, k: number) {
  const t = Phaser.Math.Clamp(k, 0, 1)
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t)
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t)
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t)
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl)
}

/** Points of a regular polygon. */
export function polyPoints(cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2, sx = 1, sy = 1) {
  const pts: Phaser.Math.Vector2[] = []
  for (let k = 0; k < n; k++) pts.push(new Phaser.Math.Vector2(cx + r * sx * Math.cos(rot + (2 * Math.PI * k) / n), cy + r * sy * Math.sin(rot + (2 * Math.PI * k) / n)))
  return pts
}

/** An eye: white, an iris (red when awake), a slit pupil. `open` 0…1 lids it. */
export function drawEye(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, opts: { open?: number; red?: boolean; lookX?: number; lookY?: number } = {}) {
  const open = opts.open ?? 1
  if (open <= 0.05) {
    g.lineStyle(Math.max(2, r * 0.18), INK, 1)
    g.lineBetween(x - r, y, x + r, y)
    return
  }
  g.fillStyle(GLASS, 1)
  g.fillEllipse(x, y, r * 2, r * 1.3 * open)
  g.lineStyle(Math.max(1.5, r * 0.12), INK, 1)
  g.strokeEllipse(x, y, r * 2, r * 1.3 * open)
  const ix = x + (opts.lookX ?? 0) * r * 0.35
  const iy = y + (opts.lookY ?? 0) * r * 0.2 * open
  g.fillStyle(opts.red ? IRIS : INK, 1)
  g.fillCircle(ix, iy, r * 0.42 * Math.min(1, open + 0.3))
  if (opts.red) {
    g.fillStyle(VOID, 1)
    g.fillEllipse(ix, iy, r * 0.16, r * 0.62 * open)
  }
}

/**
 * Something on a boss you can hit (#107): a ray of the Rose, the Ossuary's top
 * layer, a stretch of the Firmament's tail. Looks like an enemy to the scene, so
 * shooting, dashing, stomping and auto-aim all just work.
 */
export class BossPart implements Enemy {
  x = 0
  y = 0
  radius: number
  colour: number
  /** Can be hit at all right now. */
  active = true
  /** Touching it hurts (only while the boss is attacking with it, #52). */
  attacking = false
  damage = 2
  heavy = false
  lastHitSource: HitSource = 'shot'
  /** Hits, from the scene: `source` says whether it was a shot, a dash or a stomp. */
  onHit: (damage: number, source: HitSource) => void = () => {}
  onStomp: (damage: number) => void = () => {}
  constructor(radius: number, colour: number) {
    this.radius = radius
    this.colour = colour
  }
  get alive() {
    return this.active
  }
  get dead() {
    return false
  }
  get hittable() {
    return this.active
  }
  get top() {
    return this.y - this.radius
  }
  hit(damage: number, _dir: { x: number; y: number }, source: HitSource = 'shot') {
    if (!this.active) return
    this.lastHitSource = source
    this.onHit(damage, source)
  }
  stomp(_fromX: number, damage: number) {
    if (!this.active) return
    this.lastHitSource = 'stomp'
    this.onStomp(damage)
  }
  update() {}
}

/** A thing that flies in a straight line (with optional gravity) and hurts on touch: shards, stars, glass. */
export class Projectile implements Hazard {
  done = false
  x: number
  y: number
  vx: number
  vy: number
  readonly damage: number
  private size: number
  private life: number
  private gravity: number
  private sway: number
  private t = 0
  private o: Phaser.GameObjects.Polygon | Phaser.GameObjects.Rectangle
  private glow: Phaser.GameObjects.Arc | null
  /** Called each frame with its position (the Rose's shards bring the arch down). */
  onMove: ((x: number, y: number) => void) | null = null
  private floorY: number
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    vx: number,
    vy: number,
    opts: { damage?: number; size?: number; colour?: number; glow?: number; life?: number; gravity?: number; sides?: number; sway?: number; floorY?: number } = {},
  ) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.damage = opts.damage ?? 1
    this.size = opts.size ?? 10
    this.life = opts.life ?? 3
    this.gravity = opts.gravity ?? 0
    this.sway = opts.sway ?? 0
    this.floorY = opts.floorY ?? ARENA.height
    const colour = opts.colour ?? GLASS
    const sides = opts.sides ?? 3
    const pts = polyPoints(0, 0, this.size, sides).map((p) => [p.x, p.y]).flat()
    this.o = scene.add.polygon(x, y, pts, colour).setStrokeStyle(2, INK).setDepth(8)
    ;(this.o as Phaser.GameObjects.Polygon).setDisplayOrigin(0, 0)
    this.glow = opts.glow !== undefined ? scene.add.circle(x, y, this.size * 2.2, opts.glow, 0.3).setDepth(7).setBlendMode(Phaser.BlendModes.ADD) : null
  }
  update(dt: number) {
    this.t += dt
    this.vy += this.gravity * dt
    this.x += (this.vx + Math.sin(this.t * 3) * this.sway) * dt
    this.y += this.vy * dt
    this.life -= dt
    if (this.life <= 0 || this.x < -60 || this.x > ARENA.width + 60 || this.y < -200 || this.y > this.floorY + 10) this.done = true
    this.o.setPosition(this.x, this.y)
    this.o.rotation += dt * 4
    this.glow?.setPosition(this.x, this.y)
    this.onMove?.(this.x, this.y)
  }
  hits(l: number, t: number, r: number, b: number) {
    const s = this.size * 0.8
    return this.x + s > l && this.x - s < r && this.y + s > t && this.y - s < b
  }
  destroy() {
    this.o.destroy()
    this.glow?.destroy()
  }
}

/**
 * A hazard that stays put and is moved by its boss each frame: beams, a spinning
 * halo, a rolling cairn, a lashing tail. `persistent`: a hit doesn't use it up.
 */
export class Zone implements Hazard {
  done = false
  readonly persistent = true
  x = 0
  damage: number
  /** Circles and thick lines, in world px. Empty = harmless this frame. */
  circles: { x: number; y: number; r: number }[] = []
  lines: { x1: number; y1: number; x2: number; y2: number; w: number }[] = []
  constructor(damage: number) {
    this.damage = damage
  }
  clear() {
    this.circles.length = 0
    this.lines.length = 0
  }
  update() {}
  hits(l: number, t: number, r: number, b: number) {
    for (const c of this.circles) {
      const nx = Phaser.Math.Clamp(c.x, l, r)
      const ny = Phaser.Math.Clamp(c.y, t, b)
      if ((nx - c.x) ** 2 + (ny - c.y) ** 2 < c.r * c.r) {
        this.x = c.x
        return true
      }
    }
    const cx = (l + r) / 2
    const cy = (t + b) / 2
    const half = (r - l) / 2
    for (const s of this.lines) {
      const dx = s.x2 - s.x1
      const dy = s.y2 - s.y1
      const len2 = dx * dx + dy * dy || 1
      const u = Phaser.Math.Clamp(((cx - s.x1) * dx + (cy - s.y1) * dy) / len2, 0, 1)
      const px = s.x1 + dx * u
      const py = s.y1 + dy * u
      if (Math.hypot(cx - px, cy - py) < s.w / 2 + half) {
        this.x = px
        return true
      }
    }
    return false
  }
  destroy() {
    this.done = true
  }
}

/** A wave of debris running along the floor both ways (the Ossuary's slam, the Firmament's tail slam). */
export class FloorWave implements Hazard {
  done = false
  x: number
  readonly damage: number
  private y: number
  private dir: number
  private speed: number
  private left: number
  private g: Phaser.GameObjects.Graphics
  private colour: number
  constructor(scene: Phaser.Scene, x: number, floorY: number, dir: 1 | -1, opts: { damage?: number; speed?: number; range?: number; colour?: number } = {}) {
    this.x = x
    this.y = floorY
    this.dir = dir
    this.damage = opts.damage ?? 2
    this.speed = opts.speed ?? 700
    this.left = opts.range ?? 900
    this.colour = opts.colour ?? BONE
    this.g = scene.add.graphics().setDepth(8)
  }
  update(dt: number) {
    const step = this.speed * dt
    this.x += step * this.dir
    this.left -= step
    if (this.left <= 0 || this.x < 0 || this.x > ARENA.width) this.done = true
    const g = this.g
    g.clear()
    g.fillStyle(this.colour, 1)
    g.lineStyle(2, INK, 1)
    for (let i = 0; i < 4; i++) {
      const x = this.x - this.dir * i * 16
      const h = 22 - i * 4
      const pts = [new Phaser.Math.Vector2(x - 8, this.y), new Phaser.Math.Vector2(x, this.y - h), new Phaser.Math.Vector2(x + 8, this.y)]
      g.fillPoints(pts, true)
      g.strokePoints(pts, true)
    }
  }
  hits(l: number, t: number, r: number, b: number) {
    return this.x > l - 10 && this.x < r + 10 && b > this.y - 28 && t < this.y
  }
  destroy() {
    this.g.destroy()
  }
}
