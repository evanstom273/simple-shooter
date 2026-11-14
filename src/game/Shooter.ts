import Phaser from 'phaser'
import { sfx } from '../audio/sfx.ts'
import type { AimMode } from '../settings/store.ts'
import { burst } from './fx.ts'
import type { Target } from './targets.ts'
import { AIM, ARENA, PLAYER, WEAPON_ORDER, WEAPONS, type WeaponId } from './tuning.ts'

// Aiming and shooting (#36–#39, #41–#43, #68): the three aim modes, auto-aim,
// the three weapons with magazines that reload automatically once empty,
// bullets (platforms don't stop them; the floor does), the gun on the
// character, reload ring, crosshair and target bracket.

const BRACKET_COLOUR = 0xfff2b0

interface Bullet {
  o: Phaser.GameObjects.Rectangle
  x: number
  y: number
  vx: number
  vy: number
  life: number
  damage: number
}

export interface ShooterInput {
  x: number
  y: number
  /** Direction last moved (-1 / 1): "straight ahead" when there's nothing to aim at. */
  facing: number
  dashing: boolean
  mode: AimMode
  /** Trigger held (mouse button or right-side touch). */
  fireHeld: boolean
  /** Manual mode: the world point being aimed at, if any. */
  aimPoint: { x: number; y: number } | null
  /** Screen pixels → world pixels, for constant-size UI drawn in the world. */
  pxToWorld: number
  /** Desktop manual mode: draw the crosshair here. */
  crosshair: { x: number; y: number } | null
}

export interface WeaponStatus {
  id: WeaponId
  ammo: number
  magazine: number
  /** 0…1 while reloading, else null. */
  reloading: number | null
}

export class Shooter {
  private bullets: Bullet[] = []
  private cooldown = 0
  private locked: Target | null = null
  private aimAngle = 0
  private barrel: Phaser.GameObjects.Rectangle
  private barrel2: Phaser.GameObjects.Rectangle
  private barrelKick = 0
  private overlay: Phaser.GameObjects.Graphics
  private scene: Phaser.Scene
  /** Top of the floor: the only thing that stops bullets. */
  private floorY: number
  private targets: () => Target[]

  /** Weapons you have (#21: none at the start), in the order you got them. */
  private owned: WeaponId[] = []
  private current = -1
  private ammo: Partial<Record<WeaponId, number>> = {}
  /** Seconds left reloading the current weapon (0 = not reloading). */
  private reloadLeft = 0
  /** Where the player's front hand holds the gun (null when unarmed or dashing). */
  grip: { x: number; y: number } | null = null

  /** Damage multiplier per weapon from buying it again (#26). */
  damageBonus: Partial<Record<WeaponId, number>> = {}

  constructor(scene: Phaser.Scene, floorY: number, targets: () => Target[]) {
    this.scene = scene
    this.floorY = floorY
    this.targets = targets
    this.barrel = scene.add.rectangle(0, 0, 10, 10, 0xd8d8e4).setOrigin(0, 0.5).setDepth(11).setVisible(false)
    this.barrel2 = scene.add.rectangle(0, 0, 10, 10, 0xd8d8e4).setOrigin(0, 0.5).setDepth(11).setVisible(false)
    this.overlay = scene.add.graphics().setDepth(20)
  }

  /** The current auto-aim target, if any (for the off-screen marker and zoom). */
  get target(): Target | null {
    return this.locked
  }

  get armed() {
    return this.current >= 0
  }

  get weapon(): WeaponId | null {
    return this.current >= 0 ? this.owned[this.current] : null
  }

  get reloading() {
    return this.reloadLeft > 0
  }

  /** Gain a weapon (testing buttons now; the shop later). Owning it already raises its damage (#26). */
  give(id: WeaponId) {
    if (this.owned.includes(id)) {
      this.damageBonus[id] = (this.damageBonus[id] ?? 1) + 0.25
      return
    }
    this.owned.push(id)
    this.ammo[id] = WEAPONS[id].magazine
    if (!this.reloading) this.current = this.owned.length - 1
  }

  /** Switch by slot (number keys) or step (wheel / cycle button). Not while reloading (#68). */
  select(slot: number) {
    if (this.reloading || slot < 0 || slot >= this.owned.length || slot === this.current) return false
    this.current = slot
    this.cooldown = Math.max(this.cooldown, 0.12)
    sfx.dashReady()
    return true
  }

  cycle(step: number) {
    if (this.owned.length < 2) return false
    return this.select((this.current + step + this.owned.length) % this.owned.length)
  }

  status(): { weapons: WeaponStatus[]; current: WeaponId | null } {
    return {
      current: this.weapon,
      weapons: WEAPON_ORDER.filter((id) => this.owned.includes(id)).map((id) => ({
        id,
        ammo: this.ammo[id] ?? 0,
        magazine: WEAPONS[id].magazine,
        reloading: id === this.weapon && this.reloading ? 1 - this.reloadLeft / WEAPONS[id].reload : null,
      })),
    }
  }

  /**
   * The nearest living target in range, re-checked every frame (#43). Keeps the
   * current target unless another is at least AIM.switchMargin closer.
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

  /** Returns the shot direction and recoil if a shot was fired this frame. */
  update(dt: number, s: ShooterInput): { x: number; y: number; recoil: number } | null {
    const auto = s.mode !== 'manual'
    if (auto) this.updateLock(s.x, s.y)
    else this.locked = null

    let target: { x: number; y: number } | null = null
    if (auto && this.locked) target = this.locked
    else if (!auto && s.aimPoint) target = s.aimPoint
    const angle = target ? Math.atan2(target.y - s.y, target.x - s.x) : s.facing < 0 ? Math.PI : 0
    this.aimAngle = Phaser.Math.Angle.RotateTo(this.aimAngle, angle, dt * 30)

    // Reloading: count down, then refill (#68).
    const id = this.weapon
    if (id && this.reloadLeft > 0) {
      this.reloadLeft -= dt
      if (this.reloadLeft <= 0) {
        this.reloadLeft = 0
        this.ammo[id] = WEAPONS[id].magazine
        sfx.reloaded()
      }
    }

    let wantFire = s.fireHeld
    if (s.mode === 'fullAuto') wantFire = !!this.locked // never fires at nothing

    this.cooldown -= dt
    let fired: { x: number; y: number; recoil: number } | null = null
    if (id && wantFire && !s.dashing && !this.reloading && this.cooldown <= 0) {
      const w = WEAPONS[id]
      this.cooldown = Math.max(0, this.cooldown + 1 / w.fireRate)
      this.aimAngle = angle
      this.fire(s.x, s.y, angle, id)
      fired = { x: Math.cos(angle), y: Math.sin(angle), recoil: w.recoil }
      this.ammo[id] = (this.ammo[id] ?? 1) - 1
      if ((this.ammo[id] ?? 0) <= 0) {
        this.reloadLeft = w.reload
        sfx.reloadStart()
      }
    }
    if (this.cooldown < 0) this.cooldown = 0
    this.updateBullets(dt)
    this.drawGun(dt, s)
    this.drawOverlay(s)
    return fired
  }

  private fire(x: number, y: number, angle: number, id: WeaponId) {
    const w = WEAPONS[id]
    const muzzle = PLAYER.size * (0.3 + w.barrel.length)
    const mx = x + Math.cos(angle) * muzzle
    const my = y + Math.sin(angle) * muzzle
    const damage = w.damage * (this.damageBonus[id] ?? 1)
    for (let i = 0; i < w.pellets; i++) {
      const a = angle + (w.pellets > 1 ? -w.spread + (2 * w.spread * i) / (w.pellets - 1) + Phaser.Math.FloatBetween(-0.04, 0.04) : Phaser.Math.FloatBetween(-w.spread, w.spread))
      const speed = w.bulletSpeed * (w.pellets > 1 ? Phaser.Math.FloatBetween(0.85, 1.1) : 1)
      const o = this.scene.add.rectangle(mx, my, w.pellets > 1 ? 10 : 18, w.pellets > 1 ? 6 : 6, w.colour).setDepth(8).setRotation(a)
      this.bullets.push({ o, x: mx, y: my, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: w.life, damage })
    }

    // Muzzle flash and glow (bigger for the shotgun).
    const big = w.pellets > 1 ? 1.6 : 1
    const flash = this.scene.add.star(mx, my, 4, 4 * big, 14 * big, 0xffffff).setDepth(12).setRotation(Math.random())
    this.scene.tweens.add({ targets: flash, scale: 1.6, alpha: 0, duration: 70, onComplete: () => flash.destroy() })
    const glow = this.scene.add.circle(mx, my, 46 * big, w.colour, 0.28).setDepth(5).setBlendMode(Phaser.BlendModes.ADD)
    this.scene.tweens.add({ targets: glow, alpha: 0, scale: 1.4, duration: 110, onComplete: () => glow.destroy() })
    this.barrelKick = 1
    if (id === 'shotgun') sfx.shotgun()
    else if (id === 'automatic') sfx.automatic()
    else sfx.shoot()
  }

  private updateBullets(dt: number) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i]
      b.life -= dt
      const dist = Math.hypot(b.vx, b.vy) * dt
      const steps = Math.max(1, Math.ceil(dist / 10))
      let dead = b.life <= 0
      for (let k = 0; k < steps && !dead; k++) {
        b.x += (b.vx * dt) / steps
        b.y += (b.vy * dt) / steps
        if (b.x < 0 || b.x > ARENA.width || b.y < 0) {
          dead = true
          break
        }
        if (b.y >= this.floorY) {
          const back = Math.atan2(-b.vy, -b.vx)
          burst(this.scene, b.x, b.y, { count: 4, colour: 0xfff2b0, angle: back, spread: 0.9, speed: [100, 240], size: [3, 6], life: 180 })
          sfx.spark()
          dead = true
          break
        }
        for (const t of this.targets()) {
          if (t.alive && Phaser.Math.Distance.Between(b.x, b.y, t.x, t.y) < t.radius) {
            const len = Math.hypot(b.vx, b.vy)
            t.hit(b.damage, { x: b.vx / len, y: b.vy / len }, 'shot')
            dead = true
            break
          }
        }
      }
      if (dead) {
        b.o.destroy()
        this.bullets.splice(i, 1)
      } else {
        // Shotgun pellets fade over their short life.
        b.o.setPosition(b.x, b.y).setAlpha(Math.min(1, b.life * 6))
      }
    }
  }

  /** The gun on the character: a different barrel per weapon; it spins once while reloading. */
  private drawGun(dt: number, s: ShooterInput) {
    const id = this.weapon
    const show = !!id && !s.dashing
    this.barrel.setVisible(show)
    this.barrel2.setVisible(show && !!id && !!WEAPONS[id].barrel.double)
    if (!id || !show) {
      this.grip = null
      return
    }
    const w = WEAPONS[id]
    this.barrelKick = Math.max(0, this.barrelKick - dt * 12)
    const len = PLAYER.size * w.barrel.length
    const thick = PLAYER.size * w.barrel.thickness
    const out = PLAYER.size * 0.32 - this.barrelKick * (id === 'shotgun' ? 14 : 7)
    // Reload animation: the gun spins round once.
    const spin = this.reloading ? (1 - this.reloadLeft / w.reload) * Math.PI * 2 : 0
    const a = this.aimAngle + spin
    const px = s.x + Math.cos(this.aimAngle) * out
    const py = s.y + Math.sin(this.aimAngle) * out
    this.grip = { x: px, y: py }
    const col = this.reloading ? 0x9a9aae : 0xd8d8e4
    if (w.barrel.double) {
      const nx = -Math.sin(a) * thick * 0.3
      const ny = Math.cos(a) * thick * 0.3
      this.barrel.setSize(len, thick * 0.45).setDisplaySize(len, thick * 0.45).setFillStyle(col).setPosition(px - nx, py - ny).setRotation(a)
      this.barrel2.setSize(len, thick * 0.45).setDisplaySize(len, thick * 0.45).setFillStyle(col).setPosition(px + nx, py + ny).setRotation(a)
    } else {
      this.barrel.setSize(len, thick).setDisplaySize(len, thick).setFillStyle(col).setPosition(px, py).setRotation(a)
    }
  }

  private drawOverlay(s: ShooterInput) {
    const g = this.overlay
    g.clear()
    const px = s.pxToWorld

    // Reload ring around the gun hand: fills as it reloads (#68).
    const id = this.weapon
    if (id && this.reloading) {
      const k = 1 - this.reloadLeft / WEAPONS[id].reload
      const cx = s.x + Math.cos(this.aimAngle) * PLAYER.size * 0.55
      const cy = s.y + Math.sin(this.aimAngle) * PLAYER.size * 0.55
      const r = PLAYER.size * 0.42
      g.lineStyle(3 * px, 0xffffff, 0.18)
      g.strokeCircle(cx, cy, r)
      g.lineStyle(3 * px, WEAPONS[id].colour, 0.95)
      g.beginPath()
      g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2)
      g.strokePath()
    }

    // Target bracket: four corner marks around the locked target, slowly turning.
    const t = this.locked
    if (t) {
      const h = t.radius + 10
      const arm = h * 0.5
      const spinA = this.scene.time.now / 1200
      const c = Math.cos(spinA)
      const sn = Math.sin(spinA)
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
