import Phaser from 'phaser'
import { sfx } from '../audio/sfx.ts'
import { ARENA, WAVES } from './tuning.ts'

// Gold drops (#53, #54): kills scatter a few gold pieces that fall, settle,
// and fly to you once you're close. At the end of a wave everything left flies to you.

const GOLD = 0xffcf4a

interface Piece {
  o: Phaser.GameObjects.Rectangle
  x: number
  y: number
  vx: number
  vy: number
  value: number
  age: number
  homing: boolean
}

export class Gold {
  private pieces: Piece[] = []
  private scene: Phaser.Scene
  private floorY: number
  private onCollect: (value: number) => void

  constructor(scene: Phaser.Scene, floorY: number, onCollect: (value: number) => void) {
    this.scene = scene
    this.floorY = floorY
    this.onCollect = onCollect
  }

  /** Scatter `value` gold at (x, y) as a handful of pieces. */
  drop(x: number, y: number, value: number) {
    const n = Phaser.Math.Clamp(Math.round(value / 25), 3, 8)
    const each = Math.floor(value / n)
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? value - each * (n - 1) : each
      const o = this.scene.add.rectangle(x, y, 10, 10, GOLD).setDepth(8).setAngle(45)
      const a = -Math.PI / 2 + Phaser.Math.FloatBetween(-1.1, 1.1)
      const sp = Phaser.Math.Between(180, 380)
      this.pieces.push({ o, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, value: v, age: 0, homing: false })
    }
  }

  /** Wave over: everything left flies to the player. */
  collectAll() {
    for (const p of this.pieces) p.homing = true
  }

  get remaining() {
    return this.pieces.length
  }

  update(dt: number, px: number, py: number) {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const p = this.pieces[i]
      p.age += dt
      const dx = px - p.x
      const dy = py - p.y
      const d = Math.hypot(dx, dy)
      if (!p.homing && p.age > 0.35 && d < WAVES.magnetRange) p.homing = true
      if (p.homing) {
        // Accelerate towards the player.
        const sp = Math.min(1600, 300 + p.age * 900)
        p.vx += ((dx / (d || 1)) * sp - p.vx) * Math.min(1, dt * 8)
        p.vy += ((dy / (d || 1)) * sp - p.vy) * Math.min(1, dt * 8)
        if (d < 26) {
          this.onCollect(p.value)
          sfx.coin()
          p.o.destroy()
          this.pieces.splice(i, 1)
          continue
        }
      } else {
        // Fall and settle on the floor (gold isn't stopped by platforms; it sinks to the floor).
        p.vy += 1400 * dt
        p.vx *= 0.98
        if (p.y > this.floorY - 6) {
          p.y = this.floorY - 6
          p.vy = -p.vy * 0.35
          p.vx *= 0.7
          if (Math.abs(p.vy) < 40) p.vy = 0
        }
      }
      p.x = Phaser.Math.Clamp(p.x + p.vx * dt, 6, ARENA.width - 6)
      p.y += p.vy * dt
      p.o.setPosition(p.x, p.y).setAngle(45 + p.age * 180)
    }
  }
}
