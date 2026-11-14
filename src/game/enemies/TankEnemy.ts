import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst, ring } from '../fx.ts'
import { GRAVITY, STOMP, TANK } from '../tuning.ts'
import { firstMove, platformAt, type NavGraph } from './nav.ts'
import { drawBar, lerpColour } from './RangedEnemy.ts'
import type { Enemy, Hazard, PlayerInfo, Turns } from './types.ts'

// The tank (#58): a big red pentagon (2× the player). Walks slowly, climbs with
// heavy jumps. Attack: a ground slam. Crouches and glows, a marker shows where
// it'll land, a rumble builds, the camera shakes; then it leaps and slams, and
// a shockwave runs both ways along that platform. Long recovery afterwards.
// 8 hits; your dash damages it but can't move it (you bounce off).

type State = 'spawning' | 'walk' | 'windup' | 'leap' | 'recover' | 'dead'

class Shockwave implements Hazard {
  readonly damage = TANK.damage
  done = false
  x: number
  private dir: number
  private topY: number
  private minX: number
  private maxX: number
  private o: Phaser.GameObjects.Triangle

  constructor(scene: Phaser.Scene, x: number, topY: number, dir: number, minX: number, maxX: number) {
    this.x = x
    this.dir = dir
    this.topY = topY
    this.minX = minX
    this.maxX = maxX
    const h = TANK.shockwaveHeight
    // A low sharp wedge leaning into its direction of travel.
    this.o = scene.add.triangle(x, topY, 0, 0, dir * 26, -h, dir * 40, 0, TANK.colour).setDepth(8)
    this.o.setDisplayOrigin(0, 0)
    this.o.setAlpha(0.9)
  }

  update(dt: number) {
    this.x += this.dir * TANK.shockwaveSpeed * dt
    if (this.x < this.minX || this.x > this.maxX) this.done = true
    this.o.setPosition(this.x, this.topY)
  }

  hits(l: number, t: number, r: number, b: number) {
    const lo = Math.min(this.x, this.x + this.dir * 40)
    const hi = Math.max(this.x, this.x + this.dir * 40)
    // Touching the wave: overlapping it sideways and with your feet low enough on its platform.
    return r > lo && l < hi && b > this.topY - TANK.shockwaveHeight && t < this.topY
  }

  destroy() {
    this.o.destroy()
  }
}

/** The slam's landing: a brief damage zone over the tank's footprint, so landing on you always counts. */
class SlamImpact implements Hazard {
  readonly damage = TANK.damage
  done = false
  x: number
  private y: number
  private life = 0.08

  constructor(x: number, bottom: number) {
    this.x = x
    this.y = bottom
  }

  update(dt: number) {
    this.life -= dt
    if (this.life <= 0) this.done = true
  }

  hits(l: number, t: number, r: number, b: number) {
    const half = TANK.size * 0.6
    return r > this.x - half && l < this.x + half && b > this.y - TANK.size && t < this.y + 4
  }

  destroy() {}
}

export class TankEnemy implements Enemy {
  readonly radius = TANK.size * 0.5
  readonly colour = TANK.colour
  readonly damage = TANK.damage
  readonly heavy = true
  alive = false
  state: State = 'spawning'
  dropping = 0

  readonly o: Phaser.GameObjects.Rectangle
  private body: Phaser.Physics.Arcade.Body
  private v: Phaser.GameObjects.Polygon
  private eye: Phaser.GameObjects.Arc
  private pupil: Phaser.GameObjects.Arc
  private landMarker: Phaser.GameObjects.Ellipse
  private bar: Phaser.GameObjects.Graphics
  private marker: Phaser.GameObjects.Arc | null

  private scene: Phaser.Scene
  private nav: NavGraph
  private turns: Turns
  private onKill: () => void
  private spawnHazard: (h: Hazard) => void
  private shake: (ms: number, intensity: number) => void
  private hp: number = TANK.health
  private timer = 1
  private cooldown = 1
  private target = { x: 0, plat: -1 }
  private wasGrounded = false
  private sx = 1
  private sy = 1
  private flash = 0
  private stepTimer = 0
  private rumble = 0
  /** Seconds left flattened by a stomp (#59). */
  private flat = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    nav: NavGraph,
    turns: Turns,
    onKill: () => void,
    spawnHazard: (h: Hazard) => void,
    shake: (ms: number, intensity: number) => void,
  ) {
    this.scene = scene
    this.nav = nav
    this.turns = turns
    this.onKill = onKill
    this.spawnHazard = spawnHazard
    this.shake = shake
    const s = TANK.size
    this.o = scene.add.rectangle(x, y, s * 0.9, s * 0.86, 0xffffff, 0).setVisible(false)
    scene.physics.add.existing(this.o)
    this.body = this.o.body as Phaser.Physics.Arcade.Body
    this.body.setCollideWorldBounds(true)
    this.body.pushable = false
    this.body.enable = false
    this.o.setData('enemy', this)

    // Pentagon, point up, drawn around (0,0) with its base at y = s/2.
    const pts: number[] = []
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 5
      pts.push(Math.cos(a) * s * 0.55, Math.sin(a) * s * 0.55 + s * 0.05)
    }
    this.v = scene.add.polygon(x, y, pts, TANK.colour).setDepth(7).setVisible(false)
    this.v.setDisplayOrigin(0, 0)
    this.eye = scene.add.circle(x, y, s * 0.13, 0xffffff).setDepth(8).setVisible(false)
    this.pupil = scene.add.circle(x, y, s * 0.065, 0x200a0a).setDepth(9).setVisible(false)
    this.landMarker = scene.add.ellipse(0, 0, s * 1.3, 18).setStrokeStyle(3, TANK.colour, 0.9).setDepth(6).setVisible(false)
    this.bar = scene.add.graphics().setDepth(9)
    this.marker = scene.add.circle(x, y, s * 0.7).setStrokeStyle(4, TANK.colour, 0.8).setDepth(6)
    scene.tweens.add({ targets: this.marker, scale: 0.6, alpha: 0.4, duration: 350, yoyo: true, repeat: -1 })
    sfx.spawn()
  }

  get dead() {
    return this.state === 'dead'
  }
  get hittable() {
    return this.alive && this.flat <= 0
  }

  get top() {
    return this.body.bottom - TANK.size * 0.86
  }

  /** Stomped: 1 damage and flattened, but it doesn't move; the player is knocked away instead (#59). */
  stomp() {
    if (!this.hittable) return
    if (this.state === 'windup') {
      this.state = 'walk'
      this.landMarker.setVisible(false)
      this.turns.release(this)
      this.cooldown = TANK.slamCooldown
    }
    this.hit(STOMP.damage)
    if (this.alive) this.flat = STOMP.flatten
  }

  get x() {
    return this.o.x
  }
  get y() {
    return this.o.y
  }
  /** Coming down in a slam: its body hurts (#58). */
  get attacking() {
    return this.state === 'leap' && this.body.velocity.y > 0
  }
  private get grounded() {
    return this.body.blocked.down || this.body.touching.down
  }

  hit(damage: number) {
    if (!this.alive || this.flat > 0) return
    this.hp -= damage
    this.flash = 0.08
    this.sx = 1.12
    this.sy = 0.9
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
    if (this.flat > 0) {
      this.flat -= dt
      this.body.setVelocityX(0)
      this.sx = 1.3
      this.sy = 0.6
      this.draw(dt, p)
      return
    }
    this.dropping = Math.max(0, this.dropping - dt)
    this.cooldown = Math.max(0, this.cooldown - dt)
    const b = this.body
    const grounded = this.grounded
    const landed = grounded && !this.wasGrounded
    this.wasGrounded = grounded
    const here = platformAt(this.nav, this.x, b.bottom)

    switch (this.state) {
      case 'walk': {
        if (landed) this.heavyLanding(0.4)
        if (!grounded) break
        const dx = p.x - this.x
        if (this.cooldown === 0 && Math.hypot(dx, p.y - this.y) < TANK.slamRange && p.platform >= 0 && this.turns.request(this)) {
          this.state = 'windup'
          this.timer = TANK.windup
          b.setVelocityX(0)
          this.rumble = 0
          this.landMarker.setVisible(true)
          sfx.windup(TANK.windup)
          break
        }
        // Walk towards you, taking the route between platforms if needed.
        const edge = here >= 0 && p.platform >= 0 && here !== p.platform ? firstMove(this.nav, here, p.platform) : null
        let goal = p.x
        if (edge) {
          const [lo, hi] = edge.fromX
          if (this.x >= lo && this.x <= hi) {
            this.move(edge.move, here, edge.to, edge.toX)
            break
          }
          goal = (lo + hi) / 2
        }
        const dir = Math.sign(goal - this.x)
        b.setVelocityX(Math.abs(goal - this.x) > 8 ? dir * TANK.walkSpeed : 0)
        // Heavy footsteps.
        this.stepTimer -= dt
        if (b.velocity.x !== 0 && this.stepTimer <= 0) {
          this.stepTimer = 0.45
          this.sx = 1.06
          this.sy = 0.95
          sfx.step()
        }
        break
      }
      case 'windup': {
        // Crouch and glow; the landing marker follows you, then it leaps.
        const k = 1 - this.timer / TANK.windup
        this.sx = 1 + 0.18 * k
        this.sy = 1 - 0.22 * k
        this.target.x = p.x
        this.target.plat = p.platform
        const plat = this.nav.plats[p.platform]
        if (plat) this.landMarker.setPosition(Phaser.Math.Clamp(p.x, plat.x + 30, plat.x + plat.w - 30), plat.y - 2)
        this.landMarker.setAlpha(0.4 + 0.6 * Math.abs(Math.sin(this.scene.time.now / 90)))
        this.rumble -= dt
        if (this.rumble <= 0) {
          this.rumble = 0.12
          this.shake(110, 0.002 + 0.003 * k)
        }
        this.timer -= dt
        if (this.timer <= 0) this.leap()
        break
      }
      case 'leap':
        if (grounded && this.timer > 0.15) this.slam()
        this.timer += dt
        break
      case 'recover':
        b.setVelocityX(0)
        this.timer -= dt
        // Pulling itself up: squashed, slowly straightening.
        this.sy = 0.7 + 0.3 * (1 - this.timer / TANK.recovery)
        this.sx = 1 + (1 - this.sy) * 0.6
        if (this.timer <= 0) {
          this.state = 'walk'
          this.cooldown = TANK.slamCooldown
          this.turns.release(this)
        }
        break
    }
    this.draw(dt, p)
  }

  private move(move: 'up' | 'drop' | 'across', from: number, to: number, toX: number) {
    const b = this.body
    const rise = this.nav.plats[from].y - this.nav.plats[to].y
    const toward = Math.sign(toX - this.x) || 1
    if (move === 'up') b.setVelocity(toward * 50, -Math.sqrt(2 * GRAVITY * (rise + TANK.size + 20)))
    else if (move === 'drop') {
      this.dropping = 0.35
      b.setVelocity(0, 150)
    } else b.setVelocity(toward * 260, rise > 0 ? -Math.sqrt(2 * GRAVITY * (rise + TANK.size + 30)) : -380)
    this.sx = 0.85
    this.sy = 1.2
  }

  private leap() {
    const plat = this.nav.plats[this.target.plat]
    const tx = plat ? Phaser.Math.Clamp(this.target.x, plat.x + 30, plat.x + plat.w - 30) : this.target.x
    const ty = plat ? plat.y - TANK.size * 0.43 : this.y
    const t = TANK.leapTime
    this.body.setVelocity((tx - this.x) / t, (ty - this.y - 0.5 * GRAVITY * t * t) / t)
    // Fall through platforms in the way until it reaches the target's level.
    this.dropping = 0
    this.state = 'leap'
    this.timer = 0
    this.sx = 0.8
    this.sy = 1.3
    sfx.leap()
  }

  private slam() {
    this.state = 'recover'
    this.timer = TANK.recovery
    this.body.setVelocityX(0)
    this.landMarker.setVisible(false)
    this.sx = 1.45
    this.sy = 0.6
    this.shake(260, 0.016)
    sfx.dashImpact()
    sfx.land(1)
    const here = platformAt(this.nav, this.x, this.body.bottom, 12)
    const plat = this.nav.plats[here]
    const top = this.body.bottom
    burst(this.scene, this.x, top, { count: 16, colour: TANK.colour, angle: -Math.PI / 2, spread: 1.4, speed: [120, 340], size: [4, 9], life: 380, gravity: 400 })
    ring(this.scene, this.x, top, TANK.size * 1.4, 24, 0xffffff, { grow: 2.4, life: 300, line: 4 })
    this.spawnHazard(new SlamImpact(this.x, top))
    // Shockwave both ways along this platform (#58).
    const minX = plat ? plat.x : 0
    const maxX = plat ? plat.x + plat.w : 99999
    this.spawnHazard(new Shockwave(this.scene, this.x - TANK.size * 0.45, top, -1, minX, maxX))
    this.spawnHazard(new Shockwave(this.scene, this.x + TANK.size * 0.45, top, 1, minX, maxX))
  }

  private heavyLanding(k: number) {
    this.sx = 1 + 0.25 * k
    this.sy = 1 - 0.25 * k
    this.shake(120, 0.004)
    sfx.land(k)
    burst(this.scene, this.x, this.body.bottom, { count: 8, colour: 0xb4b4c6, angle: -Math.PI / 2, spread: 1.4, speed: [60, 180], size: [4, 8], life: 300, gravity: -100 })
  }

  private appear() {
    this.marker?.destroy()
    this.marker = null
    this.state = 'walk'
    this.alive = true
    this.body.enable = true
    this.body.reset(this.o.x, this.o.y)
    for (const o of [this.v, this.eye, this.pupil]) {
      o.setVisible(true).setAlpha(0)
      this.scene.tweens.add({ targets: o, alpha: 1, duration: 300 })
    }
  }

  private die() {
    this.alive = false
    this.state = 'dead'
    this.turns.release(this)
    this.body.enable = false
    const { x, y } = this
    // Heavy red pentagon chunks that fall (#58).
    for (let i = 0; i < 7; i++) {
      const r = Phaser.Math.Between(10, 18)
      const pts: number[] = []
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5
        pts.push(Math.cos(a) * r, Math.sin(a) * r)
      }
      const c = this.scene.add.polygon(x + Phaser.Math.Between(-30, 30), y + Phaser.Math.Between(-30, 30), pts, TANK.colour).setDepth(7)
      c.setDisplayOrigin(0, 0)
      this.scene.tweens.add({
        targets: c,
        x: c.x + Phaser.Math.Between(-140, 140),
        y: c.y + Phaser.Math.Between(120, 260),
        angle: Phaser.Math.Between(-240, 240),
        alpha: 0,
        duration: 700,
        ease: 'Quad.easeIn',
        onComplete: () => c.destroy(),
      })
    }
    burst(this.scene, x, y, { count: 14, colour: TANK.colour, angle: 0, spread: Math.PI, speed: [120, 320], size: [4, 9], life: 420 })
    ring(this.scene, x, y, TANK.size * 1.2, TANK.size * 1.2, 0xffffff, { grow: 2.2, life: 320, line: 5 })
    this.shake(220, 0.012)
    sfx.shatter()
    sfx.dashImpact()
    for (const o of [this.v, this.eye, this.pupil, this.landMarker, this.bar, this.o]) o.destroy()
    this.onKill()
  }

  private draw(dt: number, p: PlayerInfo) {
    const k = Math.min(1, dt * 10)
    if (this.state === 'walk' || this.state === 'leap') {
      this.sx += (1 - this.sx) * k
      this.sy += (1 - this.sy) * k
    }
    const heat = this.state === 'windup' ? 1 - this.timer / TANK.windup : 0
    const col = this.flash > 0 ? 0xffffff : heat > 0 ? lerpColour(TANK.colour, TANK.hotColour, heat) : TANK.colour
    const half = TANK.size * 0.43
    const baseY = this.body.bottom
    // Scale from the base so it squashes onto the ground.
    this.v.setFillStyle(col).setScale(this.sx, this.sy).setPosition(this.x, baseY - half * this.sy)
    const ang = Math.atan2(p.y - this.y, p.x - this.x)
    const ex = this.x + Math.cos(ang) * TANK.size * 0.12
    const ey = baseY - half * this.sy - TANK.size * 0.05 * this.sy
    this.eye.setPosition(ex, ey).setScale(1, this.sy)
    const wob = this.state === 'recover' ? this.scene.time.now / 120 : 0
    this.pupil.setPosition(ex + Math.cos(wob ? wob : ang) * 4, ey + Math.sin(wob ? wob : ang) * 4)
    this.bar.clear()
    if (this.hp < TANK.health) drawBar(this.bar, this.x, baseY - TANK.size * 0.95 * this.sy - 8, this.hp, TANK.health, TANK.colour)
  }
}
