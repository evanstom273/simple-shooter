// The Firmament (#111–#113): the thing the cathedral worships. A thick serpent of
// night sky edged in stars, with a constellation for a spine. Two phases, each a
// full health bar; no adds; slow and enormous; strictly one attack at a time.
// Phase 1: coiled behind the Sanctum's great rose window. Only its tail threads
// in, and that's what you shoot. Tail sweep, tail slam, shedding stars.
// The window breaking (the signature moment): a pull-back, then glass rains while
// it pours in. Phase 2: in the room. Lunge, swallow the light, back through the
// window (out again from the window, the roof, the floor or a wall).
import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst } from '../fx.ts'
import { BOSS_NAMES, type Boss, type BossCtx } from './types.ts'
import { BossPart, drawEye, FloorWave, GLASS, GOLD, INK, mix, Projectile, STAR, VIOLET, VOID, Zone } from './common.ts'

const F = {
  barHp: 50,
  window: { x: 0.5, y: 560, r: 380 },
  gap: 1.4,
  tail: { nodes: 18, width: 50, tipWidth: 12 },
  sweep: { tell: 1.1, time: 2.6 },
  slam: { rise: 0.8, hang: 0.9, crash: 0.18, rest: 1.1 },
  shed: { time: 2.8, every: 0.07 },
  body: { nodes: 64, gap: 22, head: 74, tail: 12 },
  lunge: { tell: 0.9, speed: 1500, recover: 1.1 },
  dark: 10,
  roam: 280,
}

type P1 = 'idle' | 'sweepTell' | 'sweep' | 'slamRise' | 'slamHang' | 'slamCrash' | 'slamRest' | 'shed' | 'return'
type P2 = 'enter' | 'roam' | 'lungeTell' | 'lunge' | 'recover' | 'darkTell' | 'toWindow' | 'hidden' | 'exitTell'
type Exit = { x: number; y: number; dx: number; dy: number; kind: 'window' | 'roof' | 'floor' | 'wall' }

export class Firmament implements Boss {
  readonly name = BOSS_NAMES.firmament
  readonly bars = 2
  bar = 0
  dead = false
  x: number
  y: number
  private ctx: BossCtx
  private bg: Phaser.GameObjects.Graphics
  private g: Phaser.GameObjects.Graphics
  private top: Phaser.GameObjects.Graphics
  private health = F.barHp
  private phase: 1 | 2 | 0 = 1
  private s1: P1 = 'idle'
  private s2: P2 = 'enter'
  private timer = 2.5
  private t = 0
  private heat = 0
  private flash = 0
  private zone = new Zone(2)
  private lastAttack = ''
  private broken = false
  // Phase 1: the tail.
  private anchor: { x: number; y: number }
  private tip: { x: number; y: number }
  private tipTarget: { x: number; y: number }
  private tailParts: BossPart[] = []
  private tailPts: { x: number; y: number }[] = []
  private sweepDir = 1
  private slamX = 0
  private shedTimer = 0
  // Phase 2: the serpent.
  private nodes: { x: number; y: number }[] = []
  private head = { x: 0, y: 0, vx: 0, vy: 0 }
  private bodyParts: BossPart[] = []
  private headPart = new BossPart(56, VIOLET)
  private lungeDir = { x: 0, y: 0 }
  private lungeLeft = 0
  private darkLeft = 0
  private exit: Exit | null = null
  private dust: { f: number; s: number; k: number }[] = []
  private winX: number

  constructor(ctx: BossCtx) {
    this.ctx = ctx
    const L = ctx.level
    this.winX = L.width * F.window.x
    this.x = this.winX
    this.y = F.window.y
    this.anchor = { x: this.winX + 110, y: F.window.y + F.window.r - 40 }
    this.tip = { x: this.anchor.x, y: this.anchor.y }
    this.tipTarget = { x: this.winX + 200, y: L.floorY - 180 }
    this.bg = ctx.scene.add.graphics().setDepth(0.5)
    this.g = ctx.scene.add.graphics().setDepth(5)
    this.top = ctx.scene.add.graphics().setDepth(5.2)
    for (let i = 0; i < F.tail.nodes; i += 3) {
      const part = new BossPart(24, STAR)
      part.onHit = (d) => this.damage(d)
      part.onStomp = (d) => this.damage(d * 2)
      this.tailParts.push(part)
    }
    for (let i = 0; i < F.body.nodes; i++) this.nodes.push({ x: this.winX, y: F.window.y })
    for (let i = 4; i < F.body.nodes; i += 5) {
      const part = new BossPart(30, STAR)
      part.onHit = (d) => this.damage(d)
      part.onStomp = (d) => this.damage(d * 2)
      this.bodyParts.push(part)
    }
    this.headPart.damage = 3
    this.headPart.onHit = (d) => this.damage(d)
    this.headPart.onStomp = (d) => this.damage(d * 2)
    // Specks of starlight inside the body: fixed per node so they don't crawl.
    for (let k = 0; k < F.body.nodes * 3; k++) this.dust.push({ f: Math.random() * 1.6 - 0.8, s: Math.random() < 0.3 ? 1.6 : 1, k: Math.floor(k / 3) })
    ctx.addHazard(this.zone)
    sfx.spawn()
  }

  get parts(): BossPart[] {
    if (this.phase === 1) return this.s1 === 'return' && this.timer > 0.8 ? [] : this.tailParts
    if (this.phase === 2) return this.s2 === 'hidden' || this.s2 === 'exitTell' || this.s2 === 'enter' ? [] : [this.headPart, ...this.bodyParts]
    return []
  }
  get hp() {
    return Math.max(0, this.health) / F.barHp
  }

  private damage(d: number) {
    if (this.phase === 0 || this.dead) return
    this.health -= d
    this.flash = 0.06
    sfx.targetHit()
    if (this.health <= 0) {
      if (this.phase === 1) this.breakWindow()
      else this.die()
    }
  }

  private breakWindow() {
    // The signature moment (#113): pull back, the window shatters, it pours in.
    this.phase = 0
    this.zone.clear()
    this.ctx.pullBack(2)
    this.ctx.shake(1800, 0.012)
    sfx.runOver()
    const sc = this.ctx.scene
    sc.time.delayedCall(700, () => {
      this.broken = true
      sfx.shatter()
      sfx.dashImpact()
      this.ctx.shake(600, 0.03)
      burst(sc, this.winX, F.window.y, { count: 60, colour: GLASS, angle: Math.PI / 2, spread: Math.PI, speed: [200, 700], size: [8, 18], life: 1400, gravity: 900 })
      burst(sc, this.winX, F.window.y, { count: 30, colour: VIOLET, angle: Math.PI / 2, spread: Math.PI, speed: [200, 600], size: [8, 16], life: 1400, gravity: 900 })
    })
    sc.time.delayedCall(2000, () => {
      if (this.dead) return
      // Control's back; the glass is still falling (#113).
      for (let k = 0; k < 28; k++) {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * F.window.r
        this.ctx.addHazard(
          new Projectile(sc, this.winX + Math.cos(a) * r, F.window.y + Math.sin(a) * r * 0.6, Phaser.Math.Between(-220, 220), Phaser.Math.Between(-200, 50), {
            damage: 1, size: 12, colour: k % 3 ? GLASS : VIOLET, gravity: 700 + Math.random() * 400, life: 5, floorY: this.ctx.level.floorY,
          }),
        )
      }
      this.phase = 2
      this.bar = 1
      this.health = F.barHp
      this.s2 = 'enter'
      this.timer = 1.6
      this.head = { x: this.winX, y: F.window.y, vx: -150, vy: 500 }
      for (const n of this.nodes) {
        n.x = this.winX
        n.y = F.window.y
      }
    })
  }

  private die() {
    this.dead = true
    this.phase = 0
    this.zone.clear()
    this.ctx.setDark(0)
    for (let i = 0; i < this.ctx.candles.length; i++) this.ctx.setCandle(i, true)
    sfx.waveClear()
    this.ctx.shake(900, 0.025)
    const sc = this.ctx.scene
    for (let i = 0; i < this.nodes.length; i += 4) {
      const n = this.nodes[i]
      sc.time.delayedCall(i * 12, () => burst(sc, n.x, n.y, { count: 6, colour: i % 8 ? STAR : GLASS, angle: 0, spread: Math.PI, speed: [80, 300], size: [4, 9], life: 900 }))
    }
    this.x = this.head.x
    this.y = this.head.y
  }

  update(dt: number) {
    if (this.dead) return
    this.t += dt
    this.timer -= dt
    this.flash = Math.max(0, this.flash - dt)
    this.zone.clear()
    if (this.darkLeft > 0) {
      this.darkLeft -= dt
      if (this.darkLeft <= 0) {
        this.ctx.setDark(0)
        for (let i = 0; i < this.ctx.candles.length; i++) this.ctx.setCandle(i, true)
        sfx.heal()
      }
    }
    if (this.phase === 1) this.updatePhase1(dt)
    else if (this.phase === 2) this.updatePhase2(dt)
    this.draw()
  }

  // ---------- Phase 1 ----------

  private updatePhase1(dt: number) {
    const p = this.ctx.player
    const L = this.ctx.level
    const floor = L.floorY
    switch (this.s1) {
      case 'idle': {
        this.heat = Math.max(0, this.heat - dt * 2)
        this.tipTarget = { x: this.winX + Math.sin(this.t * 0.6) * 500, y: floor - 220 + Math.sin(this.t * 1.1) * 60 }
        if (this.timer <= 0) this.chooseP1()
        break
      }
      case 'sweepTell': {
        this.heat = Math.min(1, this.heat + dt / F.sweep.tell)
        this.tipTarget = { x: this.sweepDir > 0 ? 160 : L.width - 160, y: floor - 26 }
        if (this.timer <= 0) {
          this.s1 = 'sweep'
          this.timer = F.sweep.time
          sfx.roll()
        }
        break
      }
      case 'sweep': {
        const k = 1 - this.timer / F.sweep.time
        const from = this.sweepDir > 0 ? 160 : L.width - 160
        const to = this.sweepDir > 0 ? L.width - 160 : 160
        this.tipTarget = { x: from + (to - from) * Phaser.Math.Easing.Sine.InOut(k), y: floor - 26 }
        this.tip = { ...this.tipTarget }
        this.hurtLowTail(floor - 150)
        if (this.timer <= 0) this.endP1()
        break
      }
      case 'slamRise': {
        this.heat = Math.min(1, this.heat + dt / (F.slam.rise + F.slam.hang))
        this.slamX = Phaser.Math.Clamp(p.x, 200, L.width - 200)
        this.tipTarget = { x: this.slamX, y: 420 }
        if (this.timer <= 0) {
          this.s1 = 'slamHang'
          this.timer = F.slam.hang
        }
        break
      }
      case 'slamHang': {
        this.tipTarget = { x: this.slamX, y: 400 + Math.sin(this.t * 20) * 6 }
        if (this.timer <= 0) {
          this.s1 = 'slamCrash'
          this.timer = F.slam.crash
          sfx.leap()
        }
        break
      }
      case 'slamCrash': {
        const k = 1 - this.timer / F.slam.crash
        this.tip = { x: this.slamX, y: 400 + (floor - 20 - 400) * k }
        this.tipTarget = { ...this.tip }
        this.hurtLowTail(-1)
        if (this.timer <= 0) {
          sfx.land(1)
          sfx.dashImpact()
          this.ctx.shake(400, 0.022)
          burst(this.ctx.scene, this.slamX, floor, { count: 18, colour: STAR, angle: -Math.PI / 2, spread: 1.4, speed: [150, 420], size: [4, 9], life: 700, gravity: 700 })
          // Star shards rolling along the floor (#113).
          for (const d of [-1, 1] as const) this.ctx.addHazard(new FloorWave(this.ctx.scene, this.slamX, floor, d, { damage: 1, speed: 650, range: 1100, colour: GLASS }))
          this.s1 = 'slamRest'
          this.timer = F.slam.rest
          this.heat = 0
        }
        break
      }
      case 'slamRest': {
        this.tipTarget = { x: this.slamX, y: floor - 24 }
        if (this.timer <= 0) this.endP1()
        break
      }
      case 'shed': {
        this.heat = 0.4
        this.tipTarget = { x: this.winX + Math.sin(this.t * 1.5) * 700, y: floor - 360 }
        this.shedTimer -= dt
        while (this.shedTimer <= 0) {
          this.shedTimer += F.shed.every
          const x = Phaser.Math.Between(140, L.width - 140)
          this.ctx.addHazard(
            new Projectile(this.ctx.scene, x, Phaser.Math.Between(80, 300), Phaser.Math.Between(-20, 20), Phaser.Math.Between(110, 170), {
              damage: 1, size: 8, sides: 5, colour: GLASS, glow: STAR, life: 12, sway: 40, floorY: floor,
            }),
          )
        }
        if (this.timer <= 0) this.endP1()
        break
      }
      case 'return': {
        this.heat = Math.max(0, this.heat - dt * 2)
        this.tipTarget = { x: this.winX + 200, y: floor - 220 }
        if (this.timer <= 0) {
          this.s1 = 'idle'
          this.timer = F.gap
        }
        break
      }
    }
    // The tip eases towards its target (snaps during the strikes).
    if (this.s1 !== 'sweep' && this.s1 !== 'slamCrash') {
      const ease = this.s1 === 'sweepTell' ? 3 : 4
      this.tip.x += (this.tipTarget.x - this.tip.x) * Math.min(1, dt * ease)
      this.tip.y += (this.tipTarget.y - this.tip.y) * Math.min(1, dt * ease)
    }
    this.layTail()
  }

  private chooseP1() {
    const options = ['sweep', 'slam', 'shed'].filter((a) => a !== this.lastAttack)
    const pick = options[Phaser.Math.Between(0, options.length - 1)]
    this.lastAttack = pick
    if (pick === 'sweep') {
      this.s1 = 'sweepTell'
      this.timer = F.sweep.tell
      this.sweepDir = this.ctx.player.x > this.ctx.level.width / 2 ? -1 : 1
      sfx.windup(F.sweep.tell)
    } else if (pick === 'slam') {
      this.s1 = 'slamRise'
      this.timer = F.slam.rise
      sfx.windup(F.slam.rise + F.slam.hang)
    } else {
      this.s1 = 'shed'
      this.timer = F.shed.time
      this.shedTimer = 0
      sfx.portalPull()
    }
  }

  private endP1() {
    this.s1 = 'return'
    this.timer = 1
  }

  /** The tail from the window to its tip: a sagging curve, thick at the window. */
  private layTail() {
    const a = this.anchor
    const b = this.tip
    const cx = (a.x + b.x) / 2 + (b.x - a.x) * 0.15
    const cy = Math.max(a.y, b.y) + 120
    this.tailPts.length = 0
    for (let i = 0; i < F.tail.nodes; i++) {
      const u = i / (F.tail.nodes - 1)
      this.tailPts.push({ x: (1 - u) ** 2 * a.x + 2 * (1 - u) * u * cx + u * u * b.x, y: (1 - u) ** 2 * a.y + 2 * (1 - u) * u * cy + u * u * b.y })
    }
    // Keep it above the floor.
    for (const q of this.tailPts) q.y = Math.min(q.y, this.ctx.level.floorY - 14)
    for (let j = 0; j < this.tailParts.length; j++) {
      const q = this.tailPts[Math.min(this.tailPts.length - 1, j * 3 + 2)]
      this.tailParts[j].x = q.x
      this.tailParts[j].y = q.y
    }
  }

  /** Tail segments below `minY` (or all, if minY < 0) hurt this frame. */
  private hurtLowTail(minY: number) {
    for (let i = 1; i < this.tailPts.length; i++) {
      const a = this.tailPts[i - 1]
      const b = this.tailPts[i]
      if (minY >= 0 && a.y < minY && b.y < minY) continue
      this.zone.lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, w: this.tailWidth(i) * 1.6 })
    }
  }

  private tailWidth(i: number) {
    const u = i / (F.tail.nodes - 1)
    return F.tail.width + (F.tail.tipWidth - F.tail.width) * u
  }

  // ---------- Phase 2 ----------

  private updatePhase2(dt: number) {
    const p = this.ctx.player
    const L = this.ctx.level
    const h = this.head
    this.headPart.attacking = false
    switch (this.s2) {
      case 'enter': {
        // Pours out of the window, head-first.
        h.vy += 300 * dt
        this.moveHead(dt)
        if (this.timer <= 0) this.toRoam()
        break
      }
      case 'roam': {
        this.heat = Math.max(0, this.heat - dt * 2)
        const tx = L.width / 2 + Math.sin(this.t * 0.35) * (L.width * 0.33) + (p.x - L.width / 2) * 0.25
        const ty = L.floorY - 420 + Math.sin(this.t * 0.7) * 220
        this.steerHead(tx, ty, F.roam, dt)
        if (this.timer <= 0) this.chooseP2()
        break
      }
      case 'lungeTell': {
        // Pull the head back, away from you (the big tell, #113).
        this.heat = Math.min(1, this.heat + dt / F.lunge.tell)
        const dx = h.x - p.x
        const dy = h.y - p.y
        const d = Math.hypot(dx, dy) || 1
        this.steerHead(h.x + (dx / d) * 160, h.y + (dy / d) * 160 - 40, 260, dt)
        if (this.timer <= 0) this.startLunge(p.x, p.y)
        break
      }
      case 'lunge': {
        const step = F.lunge.speed * dt
        h.x += this.lungeDir.x * step
        h.y += this.lungeDir.y * step
        h.vx = this.lungeDir.x * F.lunge.speed
        h.vy = this.lungeDir.y * F.lunge.speed
        this.lungeLeft -= step
        this.headPart.attacking = true
        this.zone.circles.push({ x: h.x, y: h.y, r: F.body.head * 0.55 })
        if (h.y > L.floorY - 50) {
          h.y = L.floorY - 50
          this.lungeDir.y = 0
        }
        if (h.x < 80 || h.x > L.width - 80) this.lungeLeft = 0
        if (this.lungeLeft <= 0) {
          this.s2 = 'recover'
          this.timer = F.lunge.recover
          h.vx *= 0.1
          h.vy *= 0.1
          this.ctx.shake(150, 0.008)
        }
        this.follow()
        break
      }
      case 'recover': {
        this.heat = Math.max(0, this.heat - dt * 2)
        h.vx *= 1 - Math.min(1, dt * 3)
        h.vy *= 1 - Math.min(1, dt * 3)
        this.moveHead(dt)
        if (this.timer <= 0) this.toRoam()
        break
      }
      case 'darkTell': {
        this.heat = Math.min(1, this.heat + dt / 0.7)
        h.vx *= 0.95
        h.vy *= 0.95
        this.moveHead(dt)
        if (this.timer <= 0) {
          // Swallow the light (#113): ~10 s of dark, lit only by its stars.
          for (let i = 0; i < this.ctx.candles.length; i++) this.ctx.setCandle(i, false)
          this.ctx.setDark(1)
          this.darkLeft = F.dark
          sfx.runOver()
          this.ctx.shake(300, 0.01)
          this.toRoam()
        }
        break
      }
      case 'toWindow': {
        const arrived = this.steerHead(this.winX, F.window.y, 900, dt)
        if (arrived) {
          this.s2 = 'hidden'
          this.timer = 1.2
        }
        break
      }
      case 'hidden': {
        // Everything follows the head into the sky.
        for (const n of this.nodes) {
          n.x += (this.winX - n.x) * Math.min(1, dt * 6)
          n.y += (F.window.y - n.y) * Math.min(1, dt * 6)
        }
        if (this.timer <= 0) {
          this.exit = this.pickExit()
          this.s2 = 'exitTell'
          this.timer = 1.0
          sfx.windup(1)
        }
        break
      }
      case 'exitTell': {
        if (this.timer <= 0 && this.exit) {
          const e = this.exit
          h.x = e.x
          h.y = e.y
          for (const n of this.nodes) {
            n.x = e.x - e.dx * 30
            n.y = e.y - e.dy * 30
          }
          if (e.kind !== 'window') {
            sfx.dashImpact()
            this.ctx.shake(300, 0.018)
            burst(this.ctx.scene, e.x, e.y, { count: 20, colour: e.kind === 'floor' ? 0x4a3e6a : 0x332a4c, angle: Math.atan2(e.dy, e.dx), spread: 0.9, speed: [150, 450], size: [8, 16], life: 800, gravity: 700 })
          }
          this.startLunge(p.x, p.y)
          this.exit = null
        }
        break
      }
    }
    if (this.s2 !== 'hidden' && this.s2 !== 'exitTell' && this.s2 !== 'lunge') this.follow()
    // Parts ride the body.
    this.headPart.x = h.x
    this.headPart.y = h.y
    for (let j = 0; j < this.bodyParts.length; j++) {
      const n = this.nodes[4 + j * 5]
      this.bodyParts[j].x = n.x
      this.bodyParts[j].y = n.y
      this.bodyParts[j].radius = Math.max(16, this.bodyWidth(4 + j * 5) * 0.9)
    }
    this.x = h.x
    this.y = h.y
  }

  private toRoam() {
    this.s2 = 'roam'
    this.timer = F.gap + 0.6
  }

  private chooseP2() {
    const options = ['lunge', 'dark', 'window'].filter((a) => a !== this.lastAttack && !(a === 'dark' && this.darkLeft > 0))
    const pick = options[Phaser.Math.Between(0, options.length - 1)]
    this.lastAttack = pick
    if (pick === 'lunge') {
      this.s2 = 'lungeTell'
      this.timer = F.lunge.tell
      sfx.windup(F.lunge.tell)
    } else if (pick === 'dark') {
      this.s2 = 'darkTell'
      this.timer = 0.7
    } else {
      this.s2 = 'toWindow'
      this.timer = 4
    }
  }

  private startLunge(px: number, py: number) {
    const h = this.head
    const dx = px - h.x
    const dy = py - h.y
    const d = Math.hypot(dx, dy) || 1
    this.lungeDir = { x: dx / d, y: dy / d }
    this.lungeLeft = d + 260
    this.s2 = 'lunge'
    this.heat = 1
    sfx.leap()
    sfx.roll()
  }

  /** Back through the window (#113): out again from the window at a new angle, the roof, the floor or a wall. */
  private pickExit(): Exit {
    const p = this.ctx.player
    const L = this.ctx.level
    const kinds: Exit['kind'][] = ['window', 'roof', 'floor', 'wall']
    const kind = kinds[Phaser.Math.Between(0, kinds.length - 1)]
    if (kind === 'roof') return { kind, x: Phaser.Math.Clamp(p.x + Phaser.Math.Between(-200, 200), 200, L.width - 200), y: 20, dx: 0, dy: 1 }
    if (kind === 'floor') return { kind, x: Phaser.Math.Clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.Between(350, 600), 200, L.width - 200), y: L.floorY - 10, dx: 0, dy: -1 }
    if (kind === 'wall') {
      const left = p.x > L.width / 2
      return { kind, x: left ? 130 : L.width - 130, y: L.floorY - Phaser.Math.Between(150, 600), dx: left ? 1 : -1, dy: 0 }
    }
    const a = Math.PI * (0.15 + Math.random() * 0.7)
    return { kind, x: this.winX + Math.cos(a) * F.window.r * 0.8, y: F.window.y + Math.sin(a) * F.window.r * 0.8, dx: Math.cos(a), dy: Math.sin(a) }
  }

  private steerHead(tx: number, ty: number, speed: number, dt: number) {
    const h = this.head
    const dx = tx - h.x
    const dy = ty - h.y
    const d = Math.hypot(dx, dy)
    const want = Math.min(speed, d * 2)
    h.vx += ((dx / (d || 1)) * want - h.vx) * Math.min(1, dt * 1.5)
    h.vy += ((dy / (d || 1)) * want - h.vy) * Math.min(1, dt * 1.5)
    this.moveHead(dt)
    return d < 30
  }

  private moveHead(dt: number) {
    const h = this.head
    const L = this.ctx.level
    h.x = Phaser.Math.Clamp(h.x + h.vx * dt, 60, L.width - 60)
    h.y = Phaser.Math.Clamp(h.y + h.vy * dt, 40, L.floorY - 50)
  }

  /** Follow the leader: each node keeps its distance behind the one before. */
  private follow() {
    let px = this.head.x
    let py = this.head.y
    for (const n of this.nodes) {
      const dx = n.x - px
      const dy = n.y - py
      const d = Math.hypot(dx, dy) || 1
      if (d > F.body.gap) {
        n.x = px + (dx / d) * F.body.gap
        n.y = py + (dy / d) * F.body.gap
      }
      n.y = Math.min(n.y, this.ctx.level.floorY - 20)
      px = n.x
      py = n.y
    }
  }

  private bodyWidth(i: number) {
    const u = i / (F.body.nodes - 1)
    return F.body.head * 0.6 + (F.body.tail - F.body.head * 0.6) * Math.pow(u, 0.8)
  }

  // ---------- Drawing ----------

  private draw() {
    const L = this.ctx.level
    const bg = this.bg
    const g = this.g
    const top = this.top
    bg.clear()
    g.clear()
    top.clear()
    const wx = this.winX
    const wy = F.window.y
    const R = F.window.r
    // The window's sky.
    bg.fillStyle(0x0b0818, 1)
    bg.fillCircle(wx, wy, R)
    bg.fillStyle(0x2a1d52, 0.6)
    bg.fillCircle(wx, wy, R * 0.6)
    if (this.phase === 1 || (this.phase === 0 && !this.broken)) {
      this.drawCoil(g, wx, wy, R)
      // Mullions and tracery, over the coil.
      top.lineStyle(10, 0x332a4c, 1)
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6
        top.lineBetween(wx + Math.cos(a) * 110, wy + Math.sin(a) * 110, wx + Math.cos(a) * R, wy + Math.sin(a) * R)
      }
      top.strokeCircle(wx, wy, 110)
      top.fillStyle(VIOLET, 0.08)
      top.fillCircle(wx, wy, R)
    } else {
      // Broken: jagged teeth of glass round the rim.
      top.fillStyle(0x332a4c, 1)
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2
        const r2 = R - 30 - ((k * 37) % 60)
        const pts = [
          new Phaser.Math.Vector2(wx + Math.cos(a) * R, wy + Math.sin(a) * R),
          new Phaser.Math.Vector2(wx + Math.cos(a + 0.12) * r2, wy + Math.sin(a + 0.12) * r2),
          new Phaser.Math.Vector2(wx + Math.cos(a + 0.28) * R, wy + Math.sin(a + 0.28) * R),
        ]
        top.fillPoints(pts, true)
      }
    }
    top.lineStyle(26, 0x4a3e6a, 1)
    top.strokeCircle(wx, wy, R)
    top.lineStyle(3, INK, 1)
    top.strokeCircle(wx, wy, R + 13)

    if (this.phase === 1) {
      this.drawBand(g, this.tailPts, (i) => this.tailWidth(i), 0)
      // Slam marker.
      if (this.s1 === 'slamRise' || this.s1 === 'slamHang') {
        g.fillStyle(0x000000, 0.35)
        g.fillEllipse(this.slamX, L.floorY - 2, 160, 18)
        g.lineStyle(3, STAR, 0.7)
        g.strokeEllipse(this.slamX, L.floorY - 2, 160, 18)
      }
    } else if (this.phase === 2) {
      if (this.s2 === 'exitTell' && this.exit) this.drawExitTell(g, this.exit)
      if (this.s2 !== 'exitTell') {
        const pts = [this.head, ...this.nodes]
        this.drawBand(g, pts, (i) => (i === 0 ? F.body.head * 0.6 : this.bodyWidth(i - 1)), 1)
        this.drawHead(g)
      }
    }
  }

  /** Phase 1: the coil behind the glass. */
  private drawCoil(g: Phaser.GameObjects.Graphics, wx: number, wy: number, R: number) {
    const pts: { x: number; y: number }[] = []
    const ph = this.t * 0.25
    for (let k = 0; k < 50; k++) {
      const u = k / 49
      const a = ph + u * Math.PI * 3.2
      const r = (0.18 + u * 0.62) * R
      pts.push({ x: wx + Math.cos(a) * r, y: wy + Math.sin(a) * r * 0.85 })
    }
    this.drawBand(g, pts, (i) => 32 - (i / 49) * 8, 2)
    drawEye(g, pts[0].x, pts[0].y, 12, { red: this.heat > 0.3, open: 0.5 + this.heat * 0.5 })
  }

  /** A band of night sky: void, star-edged, a constellation down the middle. */
  private drawBand(g: Phaser.GameObjects.Graphics, pts: { x: number; y: number }[], width: (i: number) => number, _seed: number) {
    const n = pts.length
    if (n < 2) return
    const left: Phaser.Math.Vector2[] = []
    const right: Phaser.Math.Vector2[] = []
    const nor: { x: number; y: number }[] = []
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(n - 1, i + 1)]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const d = Math.hypot(dx, dy) || 1
      const nx = -dy / d
      const ny = dx / d
      nor.push({ x: nx, y: ny })
      const w = width(i)
      left.push(new Phaser.Math.Vector2(pts[i].x + nx * w, pts[i].y + ny * w))
      right.push(new Phaser.Math.Vector2(pts[i].x - nx * w, pts[i].y - ny * w))
    }
    const outline = [...left, ...right.reverse()]
    const flash = this.flash > 0
    g.fillStyle(STAR, 0.08)
    g.lineStyle(10, STAR, 0.08)
    g.strokePoints(outline, true)
    g.fillStyle(flash ? 0x2a2a3a : VOID, 1)
    g.fillPoints(outline, true)
    g.lineStyle(2, mix(STAR, 0xffffff, this.heat), 0.7)
    g.strokePoints(outline, true)
    right.reverse()
    // Dust inside.
    g.fillStyle(GLASS, 0.8)
    for (const d of this.dust) {
      const i = Math.floor((d.k * n) / F.body.nodes)
      if (i >= n) continue
      const w = width(i)
      g.fillCircle(pts[i].x + nor[i].x * w * d.f, pts[i].y + nor[i].y * w * d.f, d.s)
    }
    // Edge stars.
    g.fillStyle(GLASS, 1)
    g.lineStyle(1, GOLD, 1)
    for (let i = 2; i < n; i += 4) {
      for (const side of [left[i], right[i]]) {
        const s = Math.max(2, width(i) * 0.09)
        g.fillRect(side.x - s, side.y - s, s * 2, s * 2)
      }
    }
    // The spine: a constellation.
    g.lineStyle(2, STAR, 0.6)
    let prev: { x: number; y: number } | null = null
    for (let i = 3; i < n; i += 6) {
      if (prev) g.lineBetween(prev.x, prev.y, pts[i].x, pts[i].y)
      prev = pts[i]
    }
    for (let i = 3; i < n; i += 6) {
      const s = Math.max(3, width(i) * 0.2)
      g.fillStyle(0x9fd8ff, 0.18)
      g.fillCircle(pts[i].x, pts[i].y, s * 2.6)
      g.fillStyle(GLASS, 1)
      g.lineStyle(1.5, GOLD, 1)
      const star = []
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k * Math.PI * 2) / 5
        star.push(new Phaser.Math.Vector2(pts[i].x + Math.cos(a) * s, pts[i].y + Math.sin(a) * s))
      }
      g.fillPoints(star, true)
      g.strokePoints(star, true)
    }
  }

  /** A void diamond round the eye, pointing the way it's going. */
  private drawHead(g: Phaser.GameObjects.Graphics) {
    const h = this.head
    const n = this.nodes[2]
    let ux = h.x - n.x
    let uy = h.y - n.y
    const d = Math.hypot(ux, uy) || 1
    ux /= d
    uy /= d
    const vx = -uy
    const vy = ux
    const H = 62
    const jaw = [
      new Phaser.Math.Vector2(h.x + ux * H * 1.5, h.y + uy * H * 1.5),
      new Phaser.Math.Vector2(h.x + vx * H * 1.1 + ux * H * 0.1, h.y + vy * H * 1.1 + uy * H * 0.1),
      new Phaser.Math.Vector2(h.x - ux * H * 0.9, h.y - uy * H * 0.9),
      new Phaser.Math.Vector2(h.x - vx * H * 1.1 + ux * H * 0.1, h.y - vy * H * 1.1 + uy * H * 0.1),
    ]
    g.fillStyle(0xb3263a, 0.05 + this.heat * 0.15)
    g.fillCircle(h.x, h.y, H * 2.2)
    g.fillStyle(this.flash > 0 ? 0x2a2a3a : VOID, 1)
    g.fillPoints(jaw, true)
    g.lineStyle(2.5, mix(STAR, 0xffffff, this.heat), 0.9)
    g.strokePoints(jaw, true)
    g.fillStyle(GLASS, 1)
    for (const q of jaw) g.fillRect(q.x - 4, q.y - 4, 8, 8)
    const p = this.ctx.player
    drawEye(g, h.x + ux * H * 0.2, h.y + uy * H * 0.2, 26, { red: true, lookX: Phaser.Math.Clamp((p.x - h.x) / 300, -1, 1), lookY: Phaser.Math.Clamp((p.y - h.y) / 300, -1, 1) })
  }

  private drawExitTell(g: Phaser.GameObjects.Graphics, e: Exit) {
    const k = 1 - this.timer
    const t = this.t
    if (e.kind === 'window') {
      g.fillStyle(0xb3263a, 0.25 + 0.2 * Math.sin(t * 20))
      g.fillCircle(e.x, e.y, 50 + k * 30)
    } else if (e.kind === 'roof') {
      // Dust and stone falling first.
      g.fillStyle(0x4a3e6a, 0.8)
      for (let i = 0; i < 6; i++) g.fillRect(e.x - 80 + ((i * 53 + t * 300) % 160), ((t * 400 + i * 90) % 300) + 20, 8, 8)
      g.lineStyle(3, STAR, 0.5)
      g.strokeEllipse(e.x, 30, 180, 30)
    } else if (e.kind === 'floor') {
      // A patch of floor goes dark.
      g.fillStyle(VOID, 0.5 + 0.4 * k)
      g.fillEllipse(e.x, e.y + 6, 200 + k * 60, 26)
      g.lineStyle(3, STAR, 0.6)
      g.strokeEllipse(e.x, e.y + 6, 200 + k * 60, 26)
    } else {
      // The wall's cracks glow.
      g.lineStyle(4, STAR, 0.4 + 0.5 * k)
      g.lineBetween(e.x - e.dx * 20, e.y - 90, e.x, e.y - 20)
      g.lineBetween(e.x, e.y - 20, e.x - e.dx * 30, e.y + 40)
      g.lineBetween(e.x - e.dx * 30, e.y + 40, e.x, e.y + 100)
    }
  }

  destroy() {
    this.bg.destroy()
    this.g.destroy()
    this.top.destroy()
    this.zone.done = true
  }
}
