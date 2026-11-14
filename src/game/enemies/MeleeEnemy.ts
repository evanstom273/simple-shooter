import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst, ring } from '../fx.ts'
import { GRAVITY, MELEE } from '../tuning.ts'
import { firstMove, platformAt, type NavGraph } from './nav.ts'
import type { Enemy, PlayerInfo, Turns } from './types.ts'

// The melee enemy (#40): a small orange circle with one eye. Hops after you,
// finds its way across platforms, winds up (glow + whine), then rolls at you on
// the same level or leaps at you otherwise; dizzy afterwards. Shatters into arcs.

type State = 'spawning' | 'chase' | 'windup' | 'roll' | 'leap' | 'dizzy' | 'dead'

export class MeleeEnemy implements Enemy {
  readonly radius = MELEE.radius
  readonly colour = MELEE.colour
  readonly damage = MELEE.damage
  readonly heavy = false
  alive = false
  state: State = 'spawning'

  /** Invisible physics circle. */
  readonly o: Phaser.GameObjects.Arc
  private body: Phaser.Physics.Arcade.Body
  /** What you see: squashes and stretches without touching the physics. */
  private v: Phaser.GameObjects.Arc
  private eye: Phaser.GameObjects.Arc
  private pupil: Phaser.GameObjects.Arc
  private stars: Phaser.GameObjects.Star[] = []
  private marker: Phaser.GameObjects.Arc | null = null
  /** Health bar: one segment per hit point, shown once it's been hit. */
  private bar: Phaser.GameObjects.Graphics
  private turns: Turns

  private scene: Phaser.Scene
  private nav: NavGraph
  private onKill: () => void
  private hp: number = MELEE.health
  private timer = 0
  private hopTimer = 0
  private attackCooldown = 0
  private lunge: 'roll' | 'leap' = 'roll'
  private rollDir = 1
  private bounces = 0
  /** Seconds left ignoring one-way platforms (dropping through). */
  dropping = 0
  private wasGrounded = false
  private spin = 0
  private sx = 1
  private sy = 1
  private flash = 0
  private look = { x: 0, y: 0 }

  constructor(scene: Phaser.Scene, x: number, y: number, nav: NavGraph, onKill: () => void, turns: Turns) {
    this.scene = scene
    this.turns = turns
    this.bar = scene.add.graphics().setDepth(9)
    this.nav = nav
    this.onKill = onKill
    this.o = scene.add.circle(x, y, MELEE.radius, 0xffffff, 0).setVisible(false)
    scene.physics.add.existing(this.o)
    this.body = this.o.body as Phaser.Physics.Arcade.Body
    this.body.setCircle(MELEE.radius)
    this.body.setCollideWorldBounds(true)
    this.body.enable = false
    this.o.setData('enemy', this)

    this.v = scene.add.circle(x, y, MELEE.radius, MELEE.colour).setDepth(7).setVisible(false)
    this.eye = scene.add.circle(x, y, MELEE.radius * 0.36, 0xffffff).setDepth(8).setVisible(false)
    this.pupil = scene.add.circle(x, y, MELEE.radius * 0.18, 0x1a1020).setDepth(9).setVisible(false)

    // Warning marker first, then it fades in (#40).
    this.timer = MELEE.spawnWarning
    this.marker = scene.add.circle(x, y, MELEE.radius * 1.6).setStrokeStyle(3, MELEE.colour, 0.8).setDepth(6)
    scene.tweens.add({ targets: this.marker, scale: 0.6, alpha: 0.4, duration: 300, yoyo: true, repeat: -1 })
    sfx.spawn()
  }

  get dead() {
    return this.state === 'dead'
  }

  get x() {
    return this.o.x
  }
  get y() {
    return this.o.y
  }

  /** Mid-lunge: the only time touching it hurts (#52). */
  get attacking() {
    return this.state === 'roll' || this.state === 'leap'
  }

  private get grounded() {
    return this.body.blocked.down || this.body.touching.down
  }

  hit(damage: number, dir: { x: number; y: number }) {
    if (!this.alive) return
    this.hp -= damage
    this.flash = 0.07
    this.kick(1.35, 0.7)
    sfx.enemyHit()
    this.body.setVelocity(dir.x * MELEE.knockback, Math.min(this.body.velocity.y, -260 + dir.y * 200))
    // A hit during the wind-up cancels the lunge (#40); a hit mid-roll or mid-leap knocks it out of it.
    if (this.state === 'windup' || this.state === 'roll' || this.state === 'leap') this.toDizzy()
    if (this.hp <= 0) this.die(dir)
  }

  update(dt: number, player: PlayerInfo) {
    if (this.state === 'dead') return
    this.dropping = Math.max(0, this.dropping - dt)
    this.flash = Math.max(0, this.flash - dt)

    if (this.state === 'spawning') {
      this.timer -= dt
      if (this.timer <= 0) this.appear()
      return
    }

    const grounded = this.grounded
    const landed = grounded && !this.wasGrounded
    this.wasGrounded = grounded
    const b = this.body
    this.attackCooldown = Math.max(0, this.attackCooldown - dt)

    switch (this.state) {
      case 'chase':
        if (landed) {
          this.hopTimer = MELEE.hopPause
          b.setVelocityX(0)
          this.kick(1.25, 0.8)
        }
        if (grounded) {
          this.hopTimer -= dt
          if (this.hopTimer <= 0) this.think(player)
        }
        break

      case 'windup': {
        b.setVelocityX(b.velocity.x * 0.8)
        this.timer -= dt
        // Shiver and swell as it heats up.
        const k = 1 - this.timer / MELEE.windup
        this.sx = 1 + 0.12 * k + Math.sin(this.scene.time.now / 25) * 0.04 * k
        this.sy = 1 - 0.08 * k
        if (this.timer <= 0) this.release(player)
        break
      }

      case 'roll':
        if (b.blocked.left || b.blocked.right) {
          this.rollDir = b.blocked.left ? 1 : -1
          this.bounces++
          this.kick(0.7, 1.3)
          sfx.bounce()
          burst(this.scene, this.x - this.rollDir * this.radius, this.y, { count: 6, colour: MELEE.colour, angle: this.rollDir > 0 ? 0 : Math.PI, spread: 0.8, speed: [100, 260], size: [3, 7], life: 240 })
        }
        b.setVelocityX(this.rollDir * MELEE.rollSpeed)
        this.spin += (b.velocity.x / this.radius) * dt
        this.timer -= dt
        if (this.bounces >= MELEE.rollBounces || this.timer <= 0) this.toDizzy()
        break

      case 'leap':
        this.spin += (b.velocity.x / this.radius) * dt * 0.5
        this.timer += dt
        if (grounded && this.timer > 0.1) {
          this.kick(1.45, 0.6)
          burst(this.scene, this.x, b.bottom, { count: 8, colour: MELEE.colour, angle: -Math.PI / 2, spread: 1.4, speed: [80, 220], size: [3, 7], life: 260, gravity: 300 })
          this.toDizzy()
        }
        break

      case 'dizzy':
        if (grounded) b.setVelocityX(b.velocity.x * 0.85)
        this.timer -= dt
        if (this.timer <= 0) {
          this.state = 'chase'
          this.attackCooldown = MELEE.attackCooldown
          this.spin = 0
          this.turns.release(this)
        }
        break
    }

    this.draw(dt, player)
  }

  /** Grounded and ready: lunge if close, else take the next step of the route. */
  private think(player: PlayerInfo) {
    const dx = player.x - this.x
    const dy = player.y - this.y
    const dist = Math.hypot(dx, dy)
    const here = platformAt(this.nav, this.x, this.body.bottom)
    const sameLevel = (here >= 0 && here === player.platform) || Math.abs(dy) < 40

    // Someone else is attacking: keep your distance, hopping back and forth (#49).
    if (this.turns.isOthers(this) && dist < MELEE.waitDistance + 80) {
      const away = -Math.sign(dx) || 1
      this.hop(dist < MELEE.waitDistance ? away : Math.random() < 0.5 ? 1 : -1, 0.6)
      return
    }

    if (this.attackCooldown === 0 && dist < MELEE.attackRange && this.turns.request(this)) {
      this.lunge = sameLevel ? 'roll' : 'leap'
      this.state = 'windup'
      this.timer = MELEE.windup
      this.body.setVelocityX(0)
      sfx.windup(MELEE.windup)
      return
    }

    const edge = here >= 0 && player.platform >= 0 && here !== player.platform ? firstMove(this.nav, here, player.platform) : null
    if (!edge) {
      this.hop(Math.sign(dx) || 1)
      return
    }
    const [lo, hi] = edge.fromX
    if (this.x < lo || this.x > hi) {
      this.hop(Math.sign((lo + hi) / 2 - this.x))
      return
    }
    // In position: make the move.
    const b = this.body
    const here_ = this.nav.plats[here]
    const there = this.nav.plats[edge.to]
    const rise = here_.y - there.y
    const toward = Math.sign(edge.toX - this.x) || 1
    if (edge.move === 'up') {
      b.setVelocity(toward * 60, -Math.sqrt(2 * GRAVITY * (rise + 70)))
      this.kick(0.7, 1.35)
    } else if (edge.move === 'drop') {
      this.dropping = 0.3
      b.setVelocity(0, 160)
      this.kick(1.2, 0.85)
    } else {
      b.setVelocity(toward * 380, rise > 0 ? -Math.sqrt(2 * GRAVITY * (rise + 90)) : -420)
      this.kick(0.75, 1.3)
    }
    sfx.enemyHop()
  }

  private hop(dir: number, scale = 1) {
    this.body.setVelocity(dir * MELEE.hopSpeedX * scale, -MELEE.hopSpeedY)
    this.kick(0.82, 1.2)
    sfx.enemyHop()
  }

  private release(player: PlayerInfo) {
    const b = this.body
    if (this.lunge === 'roll') {
      this.state = 'roll'
      this.rollDir = Math.sign(player.x - this.x) || 1
      this.bounces = 0
      this.timer = MELEE.rollTime
      this.kick(1.3, 0.8)
      sfx.roll()
    } else {
      // Ballistic arc to where the player is now.
      const t = MELEE.leapTime
      b.setVelocity((player.x - this.x) / t, (player.y - this.y - 0.5 * GRAVITY * t * t) / t)
      this.state = 'leap'
      this.timer = 0
      this.kick(0.7, 1.35)
      sfx.leap()
    }
  }

  private toDizzy() {
    this.state = 'dizzy'
    this.timer = MELEE.dizzy
    sfx.dizzy()
  }

  private appear() {
    this.marker?.destroy()
    this.marker = null
    this.state = 'chase'
    this.alive = true
    this.body.enable = true
    this.body.reset(this.o.x, this.o.y)
    for (const p of [this.v, this.eye, this.pupil]) {
      p.setVisible(true).setAlpha(0)
      this.scene.tweens.add({ targets: p, alpha: 1, duration: 250 })
    }
    this.kick(0.5, 1.5)
    ring(this.scene, this.x, this.y, this.radius * 3, this.radius * 3, MELEE.colour, { grow: 0.3, life: 250 })
  }

  private die(dir: { x: number; y: number }) {
    this.alive = false
    this.state = 'dead'
    this.turns.release(this)
    this.bar.destroy()
    this.body.enable = false
    const { x, y } = this
    // Shatter into curved shards of the circle (#40).
    for (let i = 0; i < 6; i++) {
      const a0 = i * 60 + Phaser.Math.Between(-10, 10)
      const shard = this.scene.add.arc(x, y, this.radius, a0, a0 + 50).setStrokeStyle(7, MELEE.colour).setDepth(7)
      shard.isFilled = false
      const ang = Phaser.Math.DegToRad(a0 + 25)
      const sp = Phaser.Math.Between(140, 280)
      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(ang) * sp * 0.5 + dir.x * 40,
        y: y + Math.sin(ang) * sp * 0.5 + dir.y * 40 + 30,
        angle: Phaser.Math.Between(-200, 200),
        alpha: 0,
        scale: 0.6,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy(),
      })
    }
    burst(this.scene, x, y, { count: 10, colour: MELEE.colour, angle: 0, spread: Math.PI, speed: [120, 320], size: [3, 7], life: 360 })
    ring(this.scene, x, y, this.radius * 2, this.radius * 2, 0xffffff, { grow: 2.4, life: 260 })
    sfx.shatter()
    for (const s of this.stars) s.destroy()
    this.stars = []
    this.v.destroy()
    this.eye.destroy()
    this.pupil.destroy()
    this.o.destroy()
    this.onKill()
  }

  private kick(x: number, y: number) {
    this.sx = x
    this.sy = y
  }

  private draw(dt: number, player: PlayerInfo) {
    const { x, y } = this
    // Squash eases back to round.
    const k = Math.min(1, dt * 14)
    if (this.state !== 'windup') {
      this.sx += (1 - this.sx) * k
      this.sy += (1 - this.sy) * k
    }
    // Feet stay on the ground: offset by the squash.
    const offY = this.radius * (1 - this.sy)
    const heat = this.state === 'windup' ? 1 - this.timer / MELEE.windup : 0
    const colour = this.flash > 0 ? 0xffffff : heat > 0 ? lerpColour(MELEE.colour, MELEE.hotColour, heat) : MELEE.colour
    this.v.setPosition(x, y + offY).setScale(this.sx, this.sy).setFillStyle(colour)

    // Eye: looks at you; spins round with the body when rolling; wobbles when dizzy.
    let ex: number
    let ey: number
    const r = this.radius * 0.42
    if (this.state === 'roll' || this.state === 'leap') {
      ex = Math.cos(this.spin) * r
      ey = Math.sin(this.spin) * r
    } else {
      const ang = Math.atan2(player.y - y, player.x - x)
      this.look.x += (Math.cos(ang) * r - this.look.x) * Math.min(1, dt * 10)
      this.look.y += (Math.sin(ang) * r - this.look.y) * Math.min(1, dt * 10)
      ex = this.look.x
      ey = this.look.y
    }
    const wob = this.state === 'dizzy' ? this.scene.time.now / 90 : 0
    const px = this.state === 'dizzy' ? Math.cos(wob) * 3 : Math.cos(Math.atan2(player.y - y, player.x - x)) * 2.5
    const py = this.state === 'dizzy' ? Math.sin(wob) * 3 : Math.sin(Math.atan2(player.y - y, player.x - x)) * 2.5
    this.eye.setPosition(x + ex * this.sx, y + offY + ey * this.sy)
    this.pupil.setPosition(this.eye.x + px, this.eye.y + py)

    // Health bar: shown once it's been hit; one segment per hit point.
    this.bar.clear()
    if (this.hp < MELEE.health) {
      const seg = 12
      const gap = 3
      const total = MELEE.health * seg + (MELEE.health - 1) * gap
      const bx = x - total / 2
      const by = y - this.radius - 16
      for (let i = 0; i < MELEE.health; i++) {
        this.bar.fillStyle(i < this.hp ? MELEE.colour : 0xffffff, i < this.hp ? 0.95 : 0.15)
        this.bar.fillRect(bx + i * (seg + gap), by, seg, 5)
      }
    }

    // Dizzy stars orbiting overhead.
    if (this.state === 'dizzy') {
      while (this.stars.length < 3) this.stars.push(this.scene.add.star(x, y, 5, 3, 7, 0xffe28a).setDepth(9))
      this.stars.forEach((s, i) => {
        const a = this.scene.time.now / 220 + (i * Math.PI * 2) / 3
        s.setPosition(x + Math.cos(a) * this.radius * 1.1, y - this.radius * 1.5 + Math.sin(a) * this.radius * 0.35).setRotation(a)
      })
    } else if (this.stars.length) {
      for (const s of this.stars) s.destroy()
      this.stars = []
    }
  }
}

function lerpColour(a: number, b: number, t: number) {
  const ca = Phaser.Display.Color.IntegerToColor(a)
  const cb = Phaser.Display.Color.IntegerToColor(b)
  const c = Phaser.Display.Color.Interpolate.ColorWithColor(ca, cb, 100, Math.round(t * 100))
  return Phaser.Display.Color.GetColor(c.r, c.g, c.b)
}
