import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst, ring } from '../fx.ts'
import { ARENA, RANGED } from '../tuning.ts'
import type { Enemy, Hazard, PlayerInfo, Turns } from './types.ts'

// The ranged enemy (#56): a small green flying triangle. Keeps a vantage point,
// darts away when you get close, and fires a single fast leading shot after a
// heavy tell (points at you, glows, charging sound, aim line that tracks your
// predicted path then locks). Only fires when on screen. One dash kills it.

type State = 'spawning' | 'hover' | 'charge' | 'lock' | 'dart' | 'dead'

class Shot implements Hazard {
  readonly damage = RANGED.damage
  done = false
  private o: Phaser.GameObjects.Rectangle
  private glow: Phaser.GameObjects.Arc
  x: number
  y: number
  private vx: number
  private vy: number
  private life = 2.5

  constructor(scene: Phaser.Scene, x: number, y: number, dx: number, dy: number) {
    this.x = x
    this.y = y
    this.vx = dx * RANGED.shotSpeed
    this.vy = dy * RANGED.shotSpeed
    this.o = scene.add.rectangle(x, y, 26, 8, RANGED.hotColour).setDepth(8).setRotation(Math.atan2(dy, dx))
    this.glow = scene.add.circle(x, y, 14, RANGED.colour, 0.35).setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
  }

  update(dt: number) {
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.life -= dt
    // Passes through platforms (#56, like yours, #42); stops at the arena edges and floor.
    if (this.life <= 0 || this.x < -40 || this.x > ARENA.width + 40 || this.y < -40 || this.y > ARENA.height - 40) this.done = true
    this.o.setPosition(this.x, this.y)
    this.glow.setPosition(this.x, this.y)
  }

  hits(l: number, t: number, r: number, b: number) {
    return this.x > l - 6 && this.x < r + 6 && this.y > t - 6 && this.y < b + 6
  }

  destroy() {
    this.o.destroy()
    this.glow.destroy()
  }
}

export class RangedEnemy implements Enemy {
  readonly radius = RANGED.radius
  readonly colour = RANGED.colour
  readonly damage = RANGED.damage
  readonly heavy = false
  readonly attacking = false
  alive = false
  state: State = 'spawning'
  x: number
  y: number

  private scene: Phaser.Scene
  private turns: Turns
  private onKill: () => void
  private fire: (h: Hazard) => void
  private hp: number = RANGED.health
  private vx = 0
  private vy = 0
  private timer = 0
  private reload = 1
  private dartCooldown = 0
  private angle = 0
  private aim = { x: 0, y: 0 }
  private bob = Math.random() * Math.PI * 2
  private flash = 0
  private side = Math.random() < 0.5 ? -1 : 1

  private body: Phaser.GameObjects.Triangle
  private line: Phaser.GameObjects.Graphics
  private bar: Phaser.GameObjects.Graphics
  private marker: Phaser.GameObjects.Arc | null

  constructor(scene: Phaser.Scene, x: number, y: number, turns: Turns, onKill: () => void, fire: (h: Hazard) => void) {
    this.scene = scene
    this.turns = turns
    this.onKill = onKill
    this.fire = fire
    this.x = x
    this.y = y
    const r = RANGED.radius
    // A long, pointy triangle pointing right (angle 0), so its facing reads at a glance; rotated to face its aim.
    this.body = scene.add.triangle(x, y, r * 1.25, 0, -r * 0.75, -r * 0.6, -r * 0.75, r * 0.6, RANGED.colour).setDepth(7).setVisible(false)
    this.body.setDisplayOrigin(0, 0)
    this.line = scene.add.graphics().setDepth(6)
    this.bar = scene.add.graphics().setDepth(9)
    this.timer = 1
    this.marker = scene.add.circle(x, y, r * 1.8).setStrokeStyle(3, RANGED.colour, 0.8).setDepth(6)
    scene.tweens.add({ targets: this.marker, scale: 0.6, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 })
    sfx.spawn()
  }

  get dead() {
    return this.state === 'dead'
  }

  hit(damage: number, dir: { x: number; y: number }) {
    if (!this.alive) return
    this.hp -= damage
    this.flash = 0.07
    this.vx = dir.x * 600
    this.vy = dir.y * 600
    sfx.enemyHit()
    if (this.hp <= 0) this.die()
  }

  update(dt: number, p: PlayerInfo) {
    if (this.state === 'dead') return
    if (this.state === 'spawning') {
      this.timer -= dt
      if (this.timer <= 0) this.appear()
      return
    }
    this.flash = Math.max(0, this.flash - dt)
    this.reload = Math.max(0, this.reload - dt)
    this.dartCooldown = Math.max(0, this.dartCooldown - dt)
    const dx = p.x - this.x
    const dy = p.y - this.y
    const dist = Math.hypot(dx, dy)
    const onScreen = p.view.contains(this.x, this.y)

    // Too close: dart a short way off (interrupts a shot).
    if (this.state !== 'dart' && dist < RANGED.dartTrigger && this.dartCooldown === 0) {
      if (this.state === 'charge' || this.state === 'lock') this.turns.release(this)
      this.state = 'dart'
      this.timer = RANGED.dartTime
      this.dartCooldown = RANGED.dartCooldown
      const away = Math.atan2(-dy, -dx) + Phaser.Math.FloatBetween(-0.5, 0.5)
      this.vx = Math.cos(away) * RANGED.dartSpeed
      this.vy = Math.sin(away) * RANGED.dartSpeed - 250
      this.side = -this.side
      sfx.leap()
      burst(this.scene, this.x, this.y, { count: 6, colour: RANGED.colour, angle: away + Math.PI, spread: 0.6, speed: [100, 260], size: [3, 6], life: 220 })
    }

    switch (this.state) {
      case 'hover': {
        // Drift to a vantage point: off to one side of you and above.
        this.bob += dt * 2.4
        const tx = Phaser.Math.Clamp(p.x + this.side * RANGED.preferredDistance, 60, ARENA.width - 60)
        const ty = Phaser.Math.Clamp(p.y - RANGED.preferredHeight + Math.sin(this.bob) * 30, 60, ARENA.height - 140)
        this.steer(tx, ty, RANGED.hoverSpeed, dt)
        this.turnTo(Math.atan2(dy, dx), dt)
        if (this.reload === 0 && onScreen && dist < RANGED.fireRange && this.turns.request(this)) {
          this.state = 'charge'
          this.timer = RANGED.charge
          sfx.windup(RANGED.charge + RANGED.lock)
        }
        break
      }
      case 'charge': {
        // Slow down and track where you're going to be.
        this.vx *= 0.9
        this.vy *= 0.9
        const t = dist / RANGED.shotSpeed
        this.aim.x = Phaser.Math.Clamp(p.x + p.vx * t, 0, ARENA.width)
        this.aim.y = Phaser.Math.Clamp(p.y + p.vy * t, 0, ARENA.height)
        this.turnTo(Math.atan2(this.aim.y - this.y, this.aim.x - this.x), dt, 14)
        this.timer -= dt
        if (this.timer <= 0) {
          this.state = 'lock'
          this.timer = RANGED.lock
          sfx.dashReady()
        }
        break
      }
      case 'lock':
        this.vx = 0
        this.vy = 0
        this.timer -= dt
        if (this.timer <= 0) this.shoot()
        break
      case 'dart':
        this.vx *= 0.9
        this.vy *= 0.9
        this.timer -= dt
        if (this.timer <= 0) this.state = 'hover'
        break
    }

    this.x = Phaser.Math.Clamp(this.x + this.vx * dt, 30, ARENA.width - 30)
    this.y = Phaser.Math.Clamp(this.y + this.vy * dt, 30, ARENA.height - 90)
    this.draw()
  }

  private steer(tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - this.x
    const dy = ty - this.y
    const d = Math.hypot(dx, dy) || 1
    const want = Math.min(speed, d * 3)
    const k = Math.min(1, dt * 3)
    this.vx += ((dx / d) * want - this.vx) * k
    this.vy += ((dy / d) * want - this.vy) * k
  }

  private turnTo(a: number, dt: number, speed = 8) {
    this.angle = Phaser.Math.Angle.RotateTo(this.angle, a, dt * speed)
  }

  private shoot() {
    const a = Math.atan2(this.aim.y - this.y, this.aim.x - this.x)
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    this.fire(new Shot(this.scene, this.x + dx * this.radius, this.y + dy * this.radius, dx, dy))
    this.angle = a
    this.vx = -dx * 200
    this.vy = -dy * 200
    this.reload = RANGED.reload
    this.state = 'hover'
    this.turns.release(this)
    sfx.shoot()
    const flash = this.scene.add.star(this.x + dx * this.radius, this.y + dy * this.radius, 4, 4, 14, 0xffffff).setDepth(12)
    this.scene.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 80, onComplete: () => flash.destroy() })
  }

  private appear() {
    this.marker?.destroy()
    this.marker = null
    this.state = 'hover'
    this.alive = true
    this.body.setVisible(true).setAlpha(0)
    this.scene.tweens.add({ targets: this.body, alpha: 1, duration: 250 })
    ring(this.scene, this.x, this.y, this.radius * 3, this.radius * 3, RANGED.colour, { grow: 0.3, life: 250 })
  }

  private die() {
    this.alive = false
    if (this.state === 'charge' || this.state === 'lock') this.turns.release(this)
    this.state = 'dead'
    this.turns.release(this)
    // Shatter into smaller green triangles (#56).
    for (let i = 0; i < 6; i++) {
      const r = this.radius * 0.5
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5
      const shard = this.scene.add.triangle(this.x, this.y, r, 0, -r * 0.6, -r * 0.8, -r * 0.6, r * 0.8, RANGED.colour).setDepth(7).setRotation(a)
      shard.setDisplayOrigin(0, 0)
      const sp = Phaser.Math.Between(120, 260)
      this.scene.tweens.add({
        targets: shard,
        x: this.x + Math.cos(a) * sp * 0.5,
        y: this.y + Math.sin(a) * sp * 0.5 + 40,
        rotation: a + Phaser.Math.FloatBetween(-4, 4),
        alpha: 0,
        scale: 0.5,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      })
    }
    burst(this.scene, this.x, this.y, { count: 8, colour: RANGED.colour, angle: 0, spread: Math.PI, speed: [120, 300], size: [3, 6], life: 320 })
    ring(this.scene, this.x, this.y, this.radius * 2, this.radius * 2, 0xffffff, { grow: 2.2, life: 240 })
    sfx.shatter()
    this.body.destroy()
    this.line.destroy()
    this.bar.destroy()
    this.onKill()
  }

  private draw() {
    const heat = this.state === 'charge' ? 1 - this.timer / RANGED.charge : this.state === 'lock' ? 1 : 0
    const col = this.flash > 0 ? 0xffffff : heat > 0 ? lerpColour(RANGED.colour, RANGED.hotColour, heat) : RANGED.colour
    const pulse = this.state === 'lock' ? 1 + Math.sin(this.scene.time.now / 40) * 0.08 : 1 + heat * 0.15
    this.body.setPosition(this.x, this.y).setRotation(this.angle).setFillStyle(col).setScale(pulse)

    // Aim line: faint while tracking, bright and blinking once locked.
    this.line.clear()
    if (this.state === 'charge' || this.state === 'lock') {
      const a = Math.atan2(this.aim.y - this.y, this.aim.x - this.x)
      const len = 1600
      const locked = this.state === 'lock'
      const on = !locked || Math.floor(this.scene.time.now / 70) % 2 === 0
      this.line.lineStyle(locked ? 3 : 1.5, RANGED.hotColour, on ? (locked ? 0.85 : 0.25 + heat * 0.3) : 0.2)
      this.line.lineBetween(this.x, this.y, this.x + Math.cos(a) * len, this.y + Math.sin(a) * len)
    }
    this.bar.clear()
    if (this.hp < RANGED.health) drawBar(this.bar, this.x, this.y - this.radius - 14, this.hp, RANGED.health, RANGED.colour)
  }
}

export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, hp: number, max: number, colour: number) {
  const seg = max > 4 ? 8 : 12
  const gap = max > 4 ? 2 : 3
  const total = max * seg + (max - 1) * gap
  for (let i = 0; i < max; i++) {
    g.fillStyle(i < hp ? colour : 0xffffff, i < hp ? 0.95 : 0.15)
    g.fillRect(x - total / 2 + i * (seg + gap), y, seg, 5)
  }
}

export function lerpColour(a: number, b: number, t: number) {
  const ca = Phaser.Display.Color.IntegerToColor(a)
  const cb = Phaser.Display.Color.IntegerToColor(b)
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100))
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b)
}
