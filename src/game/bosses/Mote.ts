// Motes (#94, #99): Celestial Gothic Horror's swarm, and what every mini boss
// calls in (#107). A little black triangle with one pale eye and faint violet
// wings. Drawn to your light: they circle you, and now and then one glints and
// darts at you. One shot kills one.
import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst } from '../fx.ts'
import type { Enemy, PlayerInfo } from '../enemies/types.ts'
import type { HitSource } from '../targets.ts'
import { GLASS, INK, LILAC, VOID, VIOLET } from './common.ts'

const MOTE = {
  size: 13,
  health: 0.5,
  orbit: [110, 210] as [number, number],
  speed: 260,
  /** Seconds between darts, and the glint before one. */
  every: [2.5, 5.5] as [number, number],
  tell: 0.45,
  dartSpeed: 720,
  dartTime: 0.35,
  damage: 1,
}

export class Mote implements Enemy {
  readonly radius = MOTE.size + 4
  readonly colour = VIOLET
  readonly damage = MOTE.damage
  readonly heavy = false
  x: number
  y: number
  private vx: number
  private vy: number
  private health = MOTE.health
  private g: Phaser.GameObjects.Graphics
  private scene: Phaser.Scene
  private phase = Math.random() * Math.PI * 2
  private orbitR = Phaser.Math.Between(MOTE.orbit[0], MOTE.orbit[1])
  private spin = Math.random() < 0.5 ? 1 : -1
  private timer = Phaser.Math.FloatBetween(MOTE.every[0], MOTE.every[1])
  private state: 'swarm' | 'tell' | 'dart' | 'dead' = 'swarm'
  private dartDir = { x: 0, y: 0 }
  private flap = Math.random() * 10
  private onKilled: () => void
  lastHitSource: HitSource = 'shot'
  dead = false

  constructor(scene: Phaser.Scene, x: number, y: number, vx: number, vy: number, onKilled: () => void) {
    this.scene = scene
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    this.onKilled = onKilled
    this.g = scene.add.graphics().setDepth(7)
  }

  get alive() {
    return !this.dead
  }
  get hittable() {
    return !this.dead
  }
  get attacking() {
    return this.state === 'dart'
  }
  get top() {
    return this.y - MOTE.size
  }

  update(dt: number, p: PlayerInfo) {
    if (this.dead) return
    this.flap += dt * 22
    if (this.state === 'swarm') {
      // Circle the player's light, wobbling.
      this.phase += dt * this.spin * 1.6
      const tx = p.x + Math.cos(this.phase) * this.orbitR
      const ty = p.y - 30 + Math.sin(this.phase * 1.3) * this.orbitR * 0.6
      const dx = tx - this.x
      const dy = ty - this.y
      const d = Math.hypot(dx, dy) || 1
      const want = Math.min(MOTE.speed, d * 3)
      this.vx += ((dx / d) * want - this.vx) * Math.min(1, dt * 3)
      this.vy += ((dy / d) * want - this.vy) * Math.min(1, dt * 3)
      this.timer -= dt
      if (this.timer <= 0 && Math.hypot(p.x - this.x, p.y - this.y) < 320) {
        this.state = 'tell'
        this.timer = MOTE.tell
      }
    } else if (this.state === 'tell') {
      this.vx *= 1 - Math.min(1, dt * 6)
      this.vy *= 1 - Math.min(1, dt * 6)
      this.timer -= dt
      if (this.timer <= 0) {
        const dx = p.x - this.x
        const dy = p.y - this.y
        const d = Math.hypot(dx, dy) || 1
        this.dartDir = { x: dx / d, y: dy / d }
        this.state = 'dart'
        this.timer = MOTE.dartTime
        sfx.leap()
      }
    } else if (this.state === 'dart') {
      this.vx = this.dartDir.x * MOTE.dartSpeed
      this.vy = this.dartDir.y * MOTE.dartSpeed
      this.timer -= dt
      if (this.timer <= 0) {
        this.state = 'swarm'
        this.timer = Phaser.Math.FloatBetween(MOTE.every[0], MOTE.every[1])
      }
    }
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.draw()
  }

  private draw() {
    const g = this.g
    const s = MOTE.size
    g.clear()
    const wing = Math.sin(this.flap) * 0.6 + 0.4
    g.fillStyle(LILAC, 0.45)
    g.fillTriangle(this.x - 3, this.y - 2, this.x - s * 1.6, this.y - s * (0.2 + wing), this.x - s * 1.2, this.y + 4)
    g.fillTriangle(this.x + 3, this.y - 2, this.x + s * 1.6, this.y - s * (0.2 + wing), this.x + s * 1.2, this.y + 4)
    // The body: a downward black triangle.
    g.fillStyle(VOID, 1)
    g.lineStyle(2, VIOLET, 1)
    g.fillTriangle(this.x - s, this.y - s * 0.7, this.x + s, this.y - s * 0.7, this.x, this.y + s)
    g.strokeTriangle(this.x - s, this.y - s * 0.7, this.x + s, this.y - s * 0.7, this.x, this.y + s)
    // One pale eye; it glints before a dart.
    const glint = this.state === 'tell'
    g.fillStyle(glint ? 0xffffff : GLASS, 1)
    g.fillCircle(this.x, this.y - 2, glint ? 5 : 3.5)
    if (glint) {
      g.lineStyle(2, 0xffffff, 0.6)
      g.strokeCircle(this.x, this.y - 2, 10)
    }
    g.fillStyle(INK, 1)
    g.fillCircle(this.x, this.y - 2, 1.5)
  }

  hit(damage: number, dir: { x: number; y: number }, source: HitSource = 'shot') {
    if (this.dead) return
    this.lastHitSource = source
    this.health -= damage
    this.vx += dir.x * 200
    this.vy += dir.y * 200
    if (this.health <= 0) this.die()
    else sfx.enemyHit()
  }

  stomp(fromX: number) {
    this.lastHitSource = 'stomp'
    this.vx = Math.sign(this.x - fromX) * 200
    this.die()
  }

  push(vx: number, vy: number) {
    this.vx += vx
    this.vy += vy
  }

  fallOut() {
    this.die()
  }

  private die() {
    if (this.dead) return
    this.dead = true
    this.state = 'dead'
    sfx.shatter()
    burst(this.scene, this.x, this.y, { count: 6, colour: VIOLET, angle: 0, spread: Math.PI, speed: [80, 220], size: [3, 6], life: 300 })
    this.g.destroy()
    this.onKilled()
  }
}
