import Phaser from 'phaser'
import { sfx } from '../audio/sfx.ts'
import { burst, ring } from './fx.ts'
import type { Level, LevelEnv } from './levels.ts'

// Hazards and environmental pieces (#81), built from a level's `env` list and
// its crumbling / conveyor platforms. Harmful: spikes, saws, jets (pits are the
// floor's gaps, handled by the scene). Environment: moving platforms,
// crumbling platforms, bounce pads, conveyors, wind. Hazards hurt enemies too.

const INK = 0x1a1a26
export const ENV = {
  /** Stages of damage from a hazard (#81) and the bounce away. */
  damage: 1,
  bounce: 760,
  /** Bounce pads: launch speed, px/s (a jump is 980). */
  pad: 1500,
  /** Jets: seconds idle, warning, firing; reach in px. */
  jet: { idle: 1.8, warn: 0.7, fire: 1.0, reach: 300 },
  /** Saws: px/s along their track. */
  sawSpeed: 220,
  /** Moving platforms: px/s. */
  moverSpeed: 130,
  /** Crumbling: seconds of shaking before it drops, then seconds until it's back. */
  crumble: { shake: 0.5, back: 3 },
  /** Wind: push, px/s² (up: enough to beat gravity); top speed it pushes you to. */
  wind: { accel: 3400, max: 520 },
  /** Seconds before the same hazard can hurt the same enemy again. */
  enemyCooldown: 0.8,
}

interface Hurt {
  /** Push direction (unit-ish) away from the hazard. */
  x: number
  y: number
}

type Box = { left: number; top: number; right: number; bottom: number }

abstract class Piece {
  /** Harmful pieces: is this box touching it right now? Returns the push away. */
  hurts(_b: Box): Hurt | null {
    return null
  }
  update(_dt: number, _t: number) {}
}

class Spikes extends Piece {
  private e: LevelEnv
  constructor(scene: Phaser.Scene, e: LevelEnv) {
    super()
    this.e = e
    const g = scene.add.graphics().setDepth(5)
    const dir = e.dir ?? 'up'
    const along = dir === 'up' || dir === 'down' ? e.w : e.h
    const n = Math.max(1, Math.round(along / 20))
    const step = along / n
    g.fillStyle(0xe8e8f4, 1)
    g.lineStyle(2, INK, 1)
    for (let i = 0; i < n; i++) {
      let pts: number[]
      const a = i * step
      if (dir === 'up') pts = [e.x + a, e.y + e.h, e.x + a + step / 2, e.y, e.x + a + step, e.y + e.h]
      else if (dir === 'down') pts = [e.x + a, e.y, e.x + a + step / 2, e.y + e.h, e.x + a + step, e.y]
      else if (dir === 'left') pts = [e.x + e.w, e.y + a, e.x, e.y + a + step / 2, e.x + e.w, e.y + a + step]
      else pts = [e.x, e.y + a, e.x + e.w, e.y + a + step / 2, e.x, e.y + a + step]
      const v = [new Phaser.Math.Vector2(pts[0], pts[1]), new Phaser.Math.Vector2(pts[2], pts[3]), new Phaser.Math.Vector2(pts[4], pts[5])]
      g.fillPoints(v, true)
      g.strokePoints(v, true)
      // Red tips: these hurt.
      g.fillStyle(0xff5a5a, 1)
      g.fillCircle(pts[2], pts[3], 2.5)
      g.fillStyle(0xe8e8f4, 1)
    }
  }
  hurts(b: Box): Hurt | null {
    const e = this.e
    // The points stick out a little less than the full box.
    if (b.right <= e.x + 3 || b.left >= e.x + e.w - 3 || b.bottom <= e.y + 4 || b.top >= e.y + e.h - 4) return null
    const d = this.e.dir ?? 'up'
    return d === 'up' ? { x: 0, y: -1 } : d === 'down' ? { x: 0, y: 1 } : d === 'left' ? { x: -1, y: -0.4 } : { x: 1, y: -0.4 }
  }
}

class Saw extends Piece {
  private c: Phaser.GameObjects.Container
  private r: number
  private sx: number
  private sy: number
  private len: number
  private phase = Math.random() * Math.PI * 2
  x = 0
  y = 0
  private e: LevelEnv
  constructor(scene: Phaser.Scene, e: LevelEnv) {
    super()
    this.e = e
    this.r = Math.max(e.w, e.h) / 2 + 10
    this.sx = e.x + e.w / 2
    this.sy = e.y + e.h / 2
    this.len = Math.hypot(e.dx ?? 0, e.dy ?? 0)
    if (this.len > 0) {
      const t = scene.add.graphics().setDepth(4)
      t.lineStyle(4, 0x3a3c58, 1)
      t.lineBetween(this.sx, this.sy, this.sx + (e.dx ?? 0), this.sy + (e.dy ?? 0))
      t.fillStyle(0x3a3c58, 1)
      t.fillCircle(this.sx, this.sy, 6)
      t.fillCircle(this.sx + (e.dx ?? 0), this.sy + (e.dy ?? 0), 6)
    }
    const g = scene.add.graphics()
    const teeth = 12
    const pts: Phaser.Math.Vector2[] = []
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i / (teeth * 2)) * Math.PI * 2
      const rr = i % 2 === 0 ? this.r : this.r * 0.78
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * rr, Math.sin(a) * rr))
    }
    g.fillStyle(0xffb547, 1)
    g.lineStyle(2.5, INK, 1)
    g.fillPoints(pts, true)
    g.strokePoints(pts, true)
    g.fillStyle(0x2a2b40, 1)
    g.fillCircle(0, 0, this.r * 0.35)
    g.lineStyle(2, INK, 1)
    g.strokeCircle(0, 0, this.r * 0.35)
    this.c = scene.add.container(this.sx, this.sy, [g]).setDepth(6)
    this.x = this.sx
    this.y = this.sy
  }
  update(dt: number, t: number) {
    // Back and forth along the track (ease at the ends).
    if (this.len > 0) {
      const period = (this.len * 2) / ENV.sawSpeed
      const k = 0.5 - 0.5 * Math.cos((t / period) * Math.PI * 2 + this.phase)
      this.x = this.sx + (this.e.dx ?? 0) * k
      this.y = this.sy + (this.e.dy ?? 0) * k
    }
    this.c.setPosition(this.x, this.y)
    this.c.rotation += dt * 9
  }
  hurts(b: Box): Hurt | null {
    const nx = Phaser.Math.Clamp(this.x, b.left, b.right)
    const ny = Phaser.Math.Clamp(this.y, b.top, b.bottom)
    const d = Math.hypot(nx - this.x, ny - this.y)
    if (d > this.r - 4) return null
    const cx = (b.left + b.right) / 2 - this.x
    const cy = (b.top + b.bottom) / 2 - this.y
    const len = Math.hypot(cx, cy) || 1
    return { x: cx / len, y: Math.min(-0.5, cy / len) }
  }
  /** For enemies: centre + radius. */
  circle() {
    return { x: this.x, y: this.y, r: this.r }
  }
}

class Jet extends Piece {
  private g: Phaser.GameObjects.Graphics
  private timer: number
  private state: 'idle' | 'warn' | 'fire' = 'idle'
  private scene: Phaser.Scene
  private e: LevelEnv
  constructor(scene: Phaser.Scene, e: LevelEnv) {
    super()
    this.e = e
    this.scene = scene
    this.g = scene.add.graphics().setDepth(6)
    this.timer = Math.random() * ENV.jet.idle
  }
  private get dir() {
    const d = this.e.dir ?? 'up'
    return d === 'up' ? { x: 0, y: -1 } : d === 'down' ? { x: 0, y: 1 } : d === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 }
  }
  /** The flame's box when firing. */
  private flame() {
    const e = this.e
    const d = this.dir
    const R = ENV.jet.reach
    if (d.y < 0) return { left: e.x + 2, right: e.x + e.w - 2, top: e.y - R, bottom: e.y }
    if (d.y > 0) return { left: e.x + 2, right: e.x + e.w - 2, top: e.y + e.h, bottom: e.y + e.h + R }
    if (d.x < 0) return { left: e.x - R, right: e.x, top: e.y + 2, bottom: e.y + e.h - 2 }
    return { left: e.x + e.w, right: e.x + e.w + R, top: e.y + 2, bottom: e.y + e.h - 2 }
  }
  update(dt: number, t: number) {
    this.timer -= dt
    if (this.timer <= 0) {
      if (this.state === 'idle') {
        this.state = 'warn'
        this.timer = ENV.jet.warn
      } else if (this.state === 'warn') {
        this.state = 'fire'
        this.timer = ENV.jet.fire
        sfx.jet()
      } else {
        this.state = 'idle'
        this.timer = ENV.jet.idle
      }
    }
    const g = this.g
    const e = this.e
    g.clear()
    // Nozzle.
    g.fillStyle(0x3a3c58, 1)
    g.lineStyle(2, INK, 1)
    g.fillRect(e.x, e.y, e.w, e.h)
    g.strokeRect(e.x, e.y, e.w, e.h)
    const f = this.flame()
    if (this.state === 'warn') {
      // Wind-up: the mouth glows and flickers, a few sparks.
      const k = 1 - this.timer / ENV.jet.warn
      g.fillStyle(0xff7b3d, 0.35 + 0.4 * k * (0.5 + 0.5 * Math.sin(t * 40)))
      g.fillRect(e.x + 3, e.y + 3, e.w - 6, e.h - 6)
      g.fillStyle(0xff7b3d, 0.08 + 0.12 * k)
      g.fillRect(f.left, f.top, f.right - f.left, f.bottom - f.top)
      if (Math.random() < dt * 20) {
        const d = this.dir
        burst(this.scene, e.x + e.w / 2, e.y + e.h / 2, { count: 1, colour: 0xffb547, angle: Math.atan2(d.y, d.x), spread: 0.3, speed: [80, 200], size: [3, 5], life: 250 })
      }
    } else if (this.state === 'fire') {
      const flick = 0.85 + Math.sin(t * 60) * 0.15
      g.fillStyle(0xff7b3d, 0.55 * flick)
      g.fillRect(f.left - 4, f.top, f.right - f.left + 8, f.bottom - f.top)
      // Hot core down the middle.
      g.fillStyle(0xffe08a, 0.9)
      if (this.dir.y !== 0) {
        const w = (f.right - f.left) * 0.45
        g.fillRect((f.left + f.right) / 2 - w / 2, f.top, w, f.bottom - f.top)
      } else {
        const h = (f.bottom - f.top) * 0.45
        g.fillRect(f.left, (f.top + f.bottom) / 2 - h / 2, f.right - f.left, h)
      }
    }
  }
  hurts(b: Box): Hurt | null {
    if (this.state !== 'fire') return null
    const f = this.flame()
    if (b.right <= f.left || b.left >= f.right || b.bottom <= f.top || b.top >= f.bottom) return null
    const d = this.dir
    return d.y !== 0 ? { x: 0, y: d.y } : { x: d.x, y: -0.5 }
  }
}

class Pad extends Piece {
  private g: Phaser.GameObjects.Graphics
  squash = 0
  readonly e: LevelEnv
  constructor(scene: Phaser.Scene, e: LevelEnv) {
    super()
    this.e = e
    this.g = scene.add.graphics().setDepth(5)
    this.draw()
  }
  draw() {
    const e = this.e
    const g = this.g
    g.clear()
    const lift = 8 - this.squash * 6
    g.fillStyle(0x2a2b40, 1)
    g.fillRect(e.x + 4, e.y + e.h - 6, e.w - 8, 6)
    g.fillStyle(0x7cf08a, 1)
    g.lineStyle(2, INK, 1)
    g.fillRect(e.x, e.y + e.h - 6 - lift, e.w, 6)
    g.strokeRect(e.x, e.y + e.h - 6 - lift, e.w, 6)
    g.lineStyle(3, 0x7cf08a, 0.7)
    const cx = e.x + e.w / 2
    for (let i = 0; i < 2; i++) {
      const y = e.y - 10 - i * 12
      g.lineBetween(cx - 10, y + 8, cx, y)
      g.lineBetween(cx, y, cx + 10, y + 8)
    }
  }
  update(dt: number) {
    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - dt * 4)
      this.draw()
    }
  }
  /** Feet in the pad, moving down (or still): launch. */
  touches(b: Box) {
    const e = this.e
    return b.right > e.x + 4 && b.left < e.x + e.w - 4 && b.bottom >= e.y + e.h - 20 && b.bottom <= e.y + e.h + 6
  }
}

class Wind extends Piece {
  private g: Phaser.GameObjects.Graphics
  private streaks: { u: number; v: number }[] = []
  readonly e: LevelEnv
  constructor(scene: Phaser.Scene, e: LevelEnv) {
    super()
    this.e = e
    this.g = scene.add.graphics().setDepth(3)
    const n = Math.max(6, Math.round((e.w * e.h) / 9000))
    for (let i = 0; i < n; i++) this.streaks.push({ u: Math.random(), v: Math.random() })
  }
  get dir() {
    const d = this.e.dir ?? 'up'
    return d === 'up' ? { x: 0, y: -1 } : d === 'down' ? { x: 0, y: 1 } : d === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 }
  }
  update(dt: number) {
    const e = this.e
    const d = this.dir
    const g = this.g
    g.clear()
    g.fillStyle(0x9fd8ff, 0.04)
    g.fillRect(e.x, e.y, e.w, e.h)
    g.lineStyle(2, 0xcfeaff, 0.35)
    for (const s of this.streaks) {
      // Streaks drift with the wind and wrap round.
      s.u = (s.u + (d.x * dt * 500) / e.w + 1) % 1
      s.v = (s.v + (d.y * dt * 500) / e.h + 1) % 1
      const x = e.x + s.u * e.w
      const y = e.y + s.v * e.h
      g.lineBetween(x, y, x - d.x * 28, y - d.y * 28)
    }
  }
  contains(b: Box) {
    const e = this.e
    return b.right > e.x && b.left < e.x + e.w && b.bottom > e.y && b.top < e.y + e.h
  }
}

/** A platform that travels back and forth (#81): a one-way, immovable physics body you can ride. */
class Mover {
  readonly rect: Phaser.GameObjects.Rectangle
  private sx: number
  private sy: number
  private period: number
  private phase = Math.random() * Math.PI * 2
  private e: LevelEnv
  constructor(scene: Phaser.Scene, e: LevelEnv) {
    this.e = e
    this.sx = e.x
    this.sy = e.y
    this.period = Math.max(1, (Math.hypot(e.dx ?? 0, e.dy ?? 0) * 2) / ENV.moverSpeed)
    this.rect = scene.add.rectangle(e.x, e.y, e.w, Math.max(e.h, 20), 0x6fb7ff).setOrigin(0).setStrokeStyle(2, INK)
    scene.physics.add.existing(this.rect)
    const b = this.body
    b.setAllowGravity(false).setImmovable(true)
    b.checkCollision.down = false
    b.checkCollision.left = false
    b.checkCollision.right = false
    this.rect.setData('oneWay', true).setData('mover', this)
  }
  get body() {
    return this.rect.body as Phaser.Physics.Arcade.Body
  }
  update(dt: number, t: number) {
    if (dt <= 0) return
    // Move by velocity so collisions (and riders) behave: the path's exact speed,
    // plus a gentle pull back onto the path so it never drifts.
    const w = (Math.PI * 2) / this.period
    const a = (t / this.period) * Math.PI * 2 + this.phase
    const k = 0.5 - 0.5 * Math.cos(a)
    const dk = 0.5 * Math.sin(a) * w
    const tx = this.sx + (this.e.dx ?? 0) * k
    const ty = this.sy + (this.e.dy ?? 0) * k
    const b = this.body
    b.setVelocity((this.e.dx ?? 0) * dk + (tx - b.x) * 4, (this.e.dy ?? 0) * dk + (ty - b.y) * 4)
  }
}

/** Crumbling platforms (#81): shake when stood on, drop, come back. */
class Crumble {
  private timer = 0
  private state: 'solid' | 'shaking' | 'gone' = 'solid'
  private scene: Phaser.Scene
  readonly rect: Phaser.GameObjects.Rectangle
  constructor(scene: Phaser.Scene, rect: Phaser.GameObjects.Rectangle) {
    this.scene = scene
    this.rect = rect
    rect.setFillStyle(0x9a7a5a).setStrokeStyle(2, INK)
    const g = scene.add.graphics().setDepth(1)
    g.lineStyle(2, 0x5a4636, 0.9)
    // Jagged cracks, a little different each time.
    for (let x = rect.x + 12; x < rect.x + rect.width - 8; x += 22 + Math.random() * 14) {
      const pts = [0, 0.33, 0.66, 1].map((k, i) => new Phaser.Math.Vector2(x + (i % 2 ? -3 : 3) * (0.5 + Math.random()), rect.y + 2 + k * (rect.height - 4)))
      g.strokePoints(pts, false)
    }
    rect.setData('cracks', g)
  }
  step() {
    if (this.state === 'solid') {
      this.state = 'shaking'
      this.timer = ENV.crumble.shake
      sfx.crumble()
    }
  }
  update(dt: number) {
    const r = this.rect
    const g = r.getData('cracks') as Phaser.GameObjects.Graphics
    const baseX = r.getData('baseX') as number
    if (this.state === 'shaking') {
      this.timer -= dt
      const off = Math.sin(this.scene.time.now / 18) * 3
      r.x = baseX + off
      g.x = off
      if (this.timer <= 0) {
        this.state = 'gone'
        this.timer = ENV.crumble.back
        r.x = baseX
        g.x = 0
        ;(r.body as Phaser.Physics.Arcade.StaticBody).enable = false
        r.setAlpha(0)
        g.setAlpha(0)
        burst(this.scene, r.x + r.width / 2, r.y + r.height / 2, { count: 12, colour: 0x9a7a5a, angle: Math.PI / 2, spread: 1.2, speed: [60, 200], size: [5, 10], life: 500, gravity: 900 })
      }
    } else if (this.state === 'gone') {
      this.timer -= dt
      if (this.timer <= 0) {
        this.state = 'solid'
        ;(r.body as Phaser.Physics.Arcade.StaticBody).enable = true
        this.scene.tweens.add({ targets: [r, g], alpha: 1, duration: 250 })
        ring(this.scene, r.x + r.width / 2, r.y + r.height / 2, r.width, r.height * 2, 0x9a7a5a, { grow: 0.3, life: 250 })
      }
    }
  }
}

export interface EnvActor {
  box: Box
  /** Velocity, to apply wind / launches to. */
  vx: number
  vy: number
}

export class Environment {
  private harmful: (Spikes | Saw | Jet)[] = []
  private pads: Pad[] = []
  private winds: Wind[] = []
  readonly movers: Mover[] = []
  private crumbles = new Map<Phaser.GameObjects.Rectangle, Crumble>()
  private conveyors: { rect: Phaser.GameObjects.Rectangle; g: Phaser.GameObjects.Graphics; speed: number }[] = []
  /** Physics group of moving platforms, for colliders. */
  readonly moverGroup: Phaser.Physics.Arcade.Group
  private enemyHurt = new Map<object, number>()
  private t = 0

  private scene: Phaser.Scene
  constructor(scene: Phaser.Scene, level: Level) {
    this.scene = scene
    this.moverGroup = scene.physics.add.group({ allowGravity: false, immovable: true })
    for (const e of level.env ?? []) {
      if (e.t === 'spikes') this.harmful.push(new Spikes(scene, e))
      else if (e.t === 'saw') this.harmful.push(new Saw(scene, e))
      else if (e.t === 'jet') this.harmful.push(new Jet(scene, e))
      else if (e.t === 'bounce') this.pads.push(new Pad(scene, e))
      else if (e.t === 'wind') this.winds.push(new Wind(scene, e))
      else if (e.t === 'mover') {
        const m = new Mover(scene, e)
        this.moverGroup.add(m.rect)
        // Groups reset body settings on add: set them again.
        m.body.setAllowGravity(false).setImmovable(true)
        m.body.checkCollision.down = false
        m.body.checkCollision.left = false
        m.body.checkCollision.right = false
        this.movers.push(m)
      }
    }
  }

  /** Hook up a platform rectangle from the level (crumbling / conveyor). */
  addPlatform(rect: Phaser.GameObjects.Rectangle, p: { crumble?: boolean; conveyor?: number }) {
    rect.setData('baseX', rect.x)
    if (p.crumble) {
      this.crumbles.set(rect, new Crumble(this.scene, rect))
      rect.setData('crumble', true)
    }
    if (p.conveyor) {
      rect.setFillStyle(0x34364e).setStrokeStyle(2, INK)
      const g = this.scene.add.graphics().setDepth(2)
      this.conveyors.push({ rect, g, speed: p.conveyor })
      rect.setData('conveyor', p.conveyor)
    }
  }

  /** The player is standing on this platform: crumbles start crumbling. */
  stoodOn(rect: Phaser.GameObjects.Rectangle | null) {
    if (rect) this.crumbles.get(rect)?.step()
  }

  update(dt: number) {
    this.t += dt
    for (const h of this.harmful) h.update(dt, this.t)
    for (const p of this.pads) p.update(dt)
    for (const w of this.winds) w.update(dt)
    for (const m of this.movers) m.update(dt, this.t)
    for (const c of this.crumbles.values()) c.update(dt)
    for (const c of this.conveyors) {
      // Chevrons running along the belt.
      const { rect: r, g, speed } = c
      g.clear()
      g.lineStyle(3, 0x8fd3ff, 0.55)
      const dir = Math.sign(speed)
      const off = ((this.t * Math.abs(speed) * 0.5) % 30) * dir
      for (let x = r.x + 10 + ((off % 30) + 30) % 30; x < r.x + r.width - 10; x += 30) {
        const y = r.y + r.height / 2
        g.lineBetween(x - 5 * dir, y - 5, x + 3 * dir, y)
        g.lineBetween(x + 3 * dir, y, x - 5 * dir, y + 5)
      }
    }
    for (const [k, v] of this.enemyHurt) {
      const left = v - dt
      if (left <= 0) this.enemyHurt.delete(k)
      else this.enemyHurt.set(k, left)
    }
  }

  /** Is this box touching anything harmful? The push away if so. */
  hurts(b: Box): Hurt | null {
    for (const h of this.harmful) {
      const hit = h.hurts(b)
      if (hit) return hit
    }
    return null
  }

  /** Hazards hurt enemies too (#81): returns the push if this one should take a hit now. */
  hurtsEnemy(e: object, x: number, y: number, r: number): Hurt | null {
    if (this.enemyHurt.has(e)) return null
    const hit = this.hurts({ left: x - r, right: x + r, top: y - r, bottom: y + r })
    if (hit) this.enemyHurt.set(e, ENV.enemyCooldown)
    return hit
  }

  /** Bounce pads: returns true (and launches) if the actor's feet are on one. */
  bounce(b: Box, vy: number): boolean {
    if (vy < -50) return false
    for (const p of this.pads) {
      if (p.touches(b)) {
        p.squash = 1
        sfx.bounce()
        ring(this.scene, p.e.x + p.e.w / 2, p.e.y + p.e.h - 8, p.e.w * 1.4, 18, 0x7cf08a, { grow: 1.8, life: 300 })
        return true
      }
    }
    return false
  }

  /** Wind on something in it: the new vertical speed, and a sideways drift (px/s) to add to its movement. */
  windPush(b: Box, vy: number, dt: number): { vy: number; drift: number } {
    let drift = 0
    for (const w of this.winds) {
      if (!w.contains(b)) continue
      const d = w.dir
      const max = ENV.wind.max
      if (d.y < 0) vy = Math.max(-max, vy - ENV.wind.accel * dt)
      else if (d.y > 0) vy = Math.min(max * 2, vy + ENV.wind.accel * 0.5 * dt)
      drift += d.x * 260
    }
    return { vy, drift }
  }
}
