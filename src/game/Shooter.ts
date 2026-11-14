import Phaser from 'phaser'
import { sfx } from '../audio/sfx.ts'
import type { AimMode } from '../settings/store.ts'
import { burst } from './fx.ts'
import type { Target } from './targets.ts'
import { AIM, ARENA, PLAYER, WEAPONS } from './tuning.ts'

// Aiming and shooting (#36–#39, #41–#43): the three aim modes, auto-aim
// targeting, bullets, the gun barrel, the crosshair and the target bracket.
// Platforms don't block bullets or auto-aim (#42); only the floor stops bullets.

const BULLET_COLOUR = 0xfff2b0
const BRACKET_COLOUR = 0xfff2b0

interface Bullet {
  o: Phaser.GameObjects.Rectangle
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export interface ShooterInput {
  x: number
  y: number
  /** Direction last moved (-1 / 1): "straight ahead" when there's nothing to aim at. */
  facing: number
  dashing: boolean
  mode: AimMode
  /** Has a gun. Unarmed (the start of a run, #21): no shooting or barrel, but auto-aim still picks a target for the dash. */
  armed: boolean
  /** Trigger held (mouse button or right-side touch). */
  fireHeld: boolean
  /** Manual mode: the world point being aimed at, if any. */
  aimPoint: { x: number; y: number } | null
  /** Screen pixels → world pixels, for constant-size UI drawn in the world. */
  pxToWorld: number
  /** Desktop manual mode: draw the crosshair here. */
  crosshair: { x: number; y: number } | null
}

export class Shooter {
  private bullets: Bullet[] = []
  private cooldown = 0
  private locked: Target | null = null
  /** The current auto-aim target, if any (for the off-screen marker and zoom). */
  get target(): Target | null {
    return this.locked
  }
  private aimAngle = 0
  private barrel: Phaser.GameObjects.Rectangle
  private barrelKick = 0
  private overlay: Phaser.GameObjects.Graphics
  private scene: Phaser.Scene
  /** Top of the floor: the only thing that stops bullets. */
  private floorY: number
  private targets: () => Target[]

  constructor(scene: Phaser.Scene, floorY: number, targets: () => Target[]) {
    this.scene = scene
    this.floorY = floorY
    this.targets = targets
    this.barrel = scene.add.rectangle(0, 0, PLAYER.size * 0.42, PLAYER.size * 0.22, 0xd8d8e4).setOrigin(0, 0.5).setDepth(11)
    this.overlay = scene.add.graphics().setDepth(20)
  }

  /**
   * The nearest living target in range, re-checked every frame (#43). Keeps the
   * current target unless another is at least AIM.switchMargin closer, so the
   * bracket doesn't flick between two enemies at similar distances.
   */
  private updateLock(x: number, y: number) {
    const dist = (t: Target) => Phaser.Math.Distance.Between(x, y, t.x, t.y)
    if (this.locked && (!this.locked.alive || dist(this.locked) > AIM.range)) this.locked = null
    let best: Target | null = null
    let bestD: number = AIM.range
    for (const t of this.targets()) {
      if (!t.alive) continue
      const d = dist(t)
      if (d < bestD) {
        best = t
        bestD = d
      }
    }
    if (!this.locked || (best && best !== this.locked && bestD < dist(this.locked) * (1 - AIM.switchMargin))) this.locked = best
  }

  /** Returns the shot direction if a shot was fired this frame (for recoil). */
  update(dt: number, s: ShooterInput): { x: number; y: number } | null {
    const auto = s.mode !== 'manual'
    if (auto) this.updateLock(s.x, s.y)
    else this.locked = null

    // Where are we aiming?
    let target: { x: number; y: number } | null = null
    if (auto && this.locked) target = this.locked
    else if (!auto && s.aimPoint) target = s.aimPoint
    const angle = target ? Math.atan2(target.y - s.y, target.x - s.x) : s.facing < 0 ? Math.PI : 0
    // Barrel swings quickly to the aim, so it doesn't snap.
    this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, angle, dt * 30)

    // Should we fire?
    let wantFire = s.armed && s.fireHeld
    if (s.mode === 'fullAuto') {
      // Full auto fires only when there's a target; never at nothing.
      wantFire = s.armed && !!this.locked
    }

    this.cooldown -= dt
    let fired: { x: number; y: number } | null = null
    if (wantFire && !s.dashing && this.cooldown <= 0) {
      // Carry the leftover so holding the trigger gives an exact fire rate.
      this.cooldown = Math.max(0, this.cooldown + 1 / WEAPONS.pistol.fireRate)
      fired = { x: Math.cos(angle), y: Math.sin(angle) }
      this.aimAngle = angle
      this.fire(s.x, s.y, fired)
    }

    if (this.cooldown < 0) this.cooldown = 0
    this.updateBullets(dt)
    this.drawBarrel(dt, s)
    this.drawOverlay(s)
    return fired
  }

  private fire(x: number, y: number, dir: { x: number; y: number }) {
    const w = WEAPONS.pistol
    const muzzle = PLAYER.size * 0.62
    const mx = x + dir.x * muzzle
    const my = y + dir.y * muzzle
    const o = this.scene.add.rectangle(mx, my, 18, 6, BULLET_COLOUR).setDepth(8).setRotation(Math.atan2(dir.y, dir.x))
    this.bullets.push({ o, x: mx, y: my, vx: dir.x * w.bulletSpeed, vy: dir.y * w.bulletSpeed, life: 1.2 })

    // Muzzle flash: a bright little star plus a soft glow (above the darkness).
    const flash = this.scene.add.star(mx, my, 4, 4, 14, 0xffffff).setDepth(12).setRotation(Math.random())
    this.scene.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 70, onComplete: () => flash.destroy() })
    const glow = this.scene.add.circle(mx, my, 46, BULLET_COLOUR, 0.28).setDepth(5).setBlendMode(Phaser.BlendModes.ADD)
    this.scene.tweens.add({ targets: glow, alpha: 0, scale: 1.4, duration: 110, onComplete: () => glow.destroy() })
    this.barrelKick = 1
    sfx.shoot()
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life -= dt
      // Sub-steps so fast bullets can't skip through thin platforms or targets.
      const dist = Math.hypot(b.vx, b.vy) * dt
      const steps = Math.max(1, Math.ceil(dist / 10))
      let dead = b.life <= 0
      for (let k = 0; k < steps && !dead; k++) {
        b.x += (b.vx * dt) / steps
        b.y += (b.vy * dt) / steps
        if (b.x < 0 || b.x > ARENA.width || b.y < 0 || b.y > ARENA.height) {
          dead = true
          break
        }
        if (b.y >= this.floorY) {
          const back = Math.atan2(-b.vy, -b.vx)
          burst(this.scene, b.x, b.y, { count: 5, colour: BULLET_COLOUR, angle: back, spread: 0.9, speed: [100, 260], size: [3, 6], life: 200 })
          sfx.spark()
          dead = true
          break
        }
        for (const t of this.targets()) {
          if (t.alive && Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < t.radius) {
            const len = Math.hypot(b.vx, b.vy)
            t.hit(WEAPONS.pistol.damage, { x: b.vx / len, y: b.vy / len })
            dead = true
            break
          }
        }
      }
      if (dead) {
        b.o.destroy()
        this.bullets.splice(i, 1)
      } else {
        b.o.setPosition(b.x, b.y)
      }
    }
  }

  private drawBarrel(dt: number, s: ShooterInput) {
    this.barrelKick = Math.max(0, this.barrelKick - dt * 12)
    const out = PLAYER.size * 0.32 - this.barrelKick * 7
    this.barrel
      .setVisible(s.armed && !s.dashing)
      .setPosition(s.x + Math.cos(this.aimAngle) * out, s.y + Math.sin(this.aimAngle) * out)
      .setRotation(this.aimAngle)
  }

  private drawOverlay(s: ShooterInput) {
    const g = this.overlay
    g.clear()
    const px = s.pxToWorld

    // Target bracket: four corner marks around the locked target, slowly turning.
    const t = this.locked
    if (t) {
      const h = t.radius + 10
      const arm = h * 0.5
      const spin = this.scene.time.now / 1200
      const c = Math.cos(spin)
      const sn = Math.sin(spin)
      const rot = (lx: number, ly: number) => ({ x: t.x + lx * c - ly * sn, y: t.y + lx * sn + ly * c })
      g.lineStyle(3 * px, BRACKET_COLOUR, 0.9)
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const corner = rot(sx * h, sy * h)
        const ax = rot(sx * (h - arm), sy * h)
        const ay = rot(sx * h, sy * (h - arm))
        g.lineBetween(corner.x, corner.y, ax.x, ax.y)
        g.lineBetween(corner.x, corner.y, ay.x, ay.y)
      }
    }

    // Desktop manual crosshair.
    if (s.crosshair) {
      const { x, y } = s.crosshair
      const r = 10 * px
      const gap = 4 * px
      g.lineStyle(2 * px, 0xffffff, 0.9)
      g.lineBetween(x - r - gap, y, x - gap, y)
      g.lineBetween(x + gap, y, x + r + gap, y)
      g.lineBetween(x, y - r - gap, x, y - gap)
      g.lineBetween(x, y + gap, x, y + r + gap)
      g.fillStyle(0xffffff, 0.9)
      g.fillCircle(x, y, 1.6 * px)
    }
  }
}
