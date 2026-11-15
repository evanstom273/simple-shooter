// The Rose (#107, #108, #114): the Nave's stained-glass rose come alive. A serene
// pale glass face (the Saint) in a halo of twelve glass rays. Shots only crack a
// ray; a dash or stomp shatters a cracked one, and a few Motes pour through each
// gap. At six rays left the face cracks, one red eye opens, and it gets meaner.
// Attacks, one at a time: shard volley, ray beams, spin and dive. Its shards
// bring the crumbling arch down; it drifts up by the pillars' capitals.
import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst, ring } from '../fx.ts'
import { BOSS_NAMES, type Boss, type BossCtx } from './types.ts'
import { BONE, BossPart, drawEye, GLASS, GOLD, INK, IRIS, mix, Projectile, Zone } from './common.ts'

const RAYS = 12
const R = {
  face: 58,
  inner: 64,
  outer: 150,
  /** Half-width of a ray's base, radians. */
  half: 0.2,
  integrity: 4,
  speed: 170,
  gap: 1.7,
  gapAngry: 1.1,
  shard: 430,
  beam: { tell: 1.0, burn: 1.4, width: 26, length: 1900, turn: 0.35 },
  dive: { spin: 0.9, speed: 900, radius: 145 },
  motesPerRay: 3,
  maxMotes: 9,
}

type State = 'drift' | 'volley' | 'beams' | 'diveSet' | 'diveSpin' | 'dive' | 'rise' | 'dying'

export class Rose implements Boss {
  readonly name = BOSS_NAMES.rose
  readonly bars = 1
  readonly bar = 0
  dead = false
  x: number
  y: number
  private ctx: BossCtx
  private g: Phaser.GameObjects.Graphics
  private fx: Phaser.GameObjects.Graphics
  private rot = 0
  private spinSpeed = 0.15
  private rays: { integrity: number; part: BossPart; flash: number }[] = []
  private state: State = 'drift'
  private timer = 2.2
  private target: { x: number; y: number }
  private zone = new Zone(2)
  private beams: number[] = []
  private heat = 0
  private diveDir = 1
  private wobble = 0
  private hurtFlash = 0
  private lastAttack = ''

  constructor(ctx: BossCtx) {
    this.ctx = ctx
    const L = ctx.level
    this.x = L.width / 2
    this.y = -200
    this.target = { x: L.width / 2, y: 520 }
    this.g = ctx.scene.add.graphics().setDepth(6)
    this.fx = ctx.scene.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD)
    for (let i = 0; i < RAYS; i++) {
      const part = new BossPart(30, GOLD)
      part.damage = 2
      part.onHit = (d, src) => this.hitRay(i, d, src === 'dash' || src === 'stomp')
      part.onStomp = (d) => this.hitRay(i, d, true)
      this.rays.push({ integrity: R.integrity, part, flash: 0 })
    }
    ctx.addHazard(this.zone)
    sfx.spawn()
  }

  get parts() {
    return this.rays.filter((r) => r.integrity > 0).map((r) => r.part)
  }
  get intact() {
    return this.rays.filter((r) => r.integrity > 0).length
  }
  get hp() {
    return this.intact / RAYS
  }
  private get angry() {
    return this.intact <= RAYS / 2
  }

  private hitRay(i: number, damage: number, impact: boolean) {
    const r = this.rays[i]
    if (r.integrity <= 0) return
    r.flash = 0.12
    this.hurtFlash = 0.08
    if (!impact) {
      // Shots only crack it (#107).
      r.integrity = Math.max(1, r.integrity - damage)
      sfx.spark()
      return
    }
    if (r.integrity <= 2) this.breakRay(i)
    else {
      r.integrity -= 2 * damage
      if (r.integrity <= 0) this.breakRay(i)
      else sfx.enemyHit()
    }
  }

  private breakRay(i: number) {
    const r = this.rays[i]
    const wasAngry = this.angry
    r.integrity = 0
    r.part.active = false
    const a = this.rayAngle(i)
    const tx = this.x + Math.cos(a) * R.outer * 0.7
    const ty = this.y + Math.sin(a) * R.outer * 0.7
    sfx.shatter()
    this.ctx.shake(160, 0.01)
    burst(this.ctx.scene, tx, ty, { count: 14, colour: i % 2 ? BONE : GOLD, angle: a, spread: 0.9, speed: [120, 380], size: [5, 11], life: 600, gravity: 600 })
    // Motes pour through the gap (#114).
    for (let k = 0; k < R.motesPerRay && this.ctx.motesAlive() < R.maxMotes; k++) {
      this.ctx.spawnMote(tx, ty, Math.cos(a) * 200 + Phaser.Math.Between(-80, 80), Math.sin(a) * 200 + Phaser.Math.Between(-80, 80))
    }
    if (!wasAngry && this.angry) {
      // The face cracks; one eye opens.
      sfx.runOver()
      this.ctx.shake(400, 0.016)
      ring(this.ctx.scene, this.x, this.y, 200, 200, IRIS, { grow: 2.5, life: 600, line: 6 })
    }
    if (this.intact === 0) this.die()
  }

  private die() {
    this.state = 'dying'
    this.zone.clear()
    this.dead = true
    sfx.waveClear()
    this.ctx.shake(500, 0.02)
    burst(this.ctx.scene, this.x, this.y, { count: 30, colour: GLASS, angle: 0, spread: Math.PI, speed: [150, 500], size: [6, 14], life: 900, gravity: 700 })
    burst(this.ctx.scene, this.x, this.y, { count: 20, colour: GOLD, angle: 0, spread: Math.PI, speed: [100, 400], size: [5, 10], life: 800, gravity: 700 })
  }

  private rayAngle(i: number) {
    return this.rot + (i * Math.PI * 2) / RAYS - Math.PI / 2
  }

  update(dt: number) {
    if (this.dead) return
    const p = this.ctx.player
    const L = this.ctx.level
    this.hurtFlash = Math.max(0, this.hurtFlash - dt)
    this.wobble += dt
    this.timer -= dt
    this.zone.clear()
    const angryK = this.angry ? 1.3 : 1

    switch (this.state) {
      case 'drift': {
        this.heat = Math.max(0, this.heat - dt * 2)
        this.spinSpeed += (0.15 - this.spinSpeed) * Math.min(1, dt * 2)
        this.moveTowards(this.target.x, this.target.y + Math.sin(this.wobble * 1.3) * 20, R.speed * angryK, dt)
        if (this.timer <= 0) this.chooseAttack()
        break
      }
      case 'volley': {
        this.heat = Math.min(1, this.heat + dt / 0.7)
        if (this.timer <= 0) {
          this.fireVolley()
          this.endAttack()
        }
        break
      }
      case 'beams': {
        const burning = this.timer < R.beam.burn
        this.spinSpeed = burning ? R.beam.turn * (this.diveDir) : 0
        this.heat = burning ? 1 : Math.min(1, this.heat + dt)
        for (const i of this.beams) {
          if (this.rays[i].integrity <= 0) continue
          const a = this.rayAngle(i)
          const x1 = this.x + Math.cos(a) * R.outer
          const y1 = this.y + Math.sin(a) * R.outer
          const x2 = this.x + Math.cos(a) * R.beam.length
          const y2 = this.y + Math.sin(a) * R.beam.length
          if (burning) this.zone.lines.push({ x1, y1, x2, y2, w: R.beam.width })
        }
        if (this.timer <= 0) this.endAttack()
        break
      }
      case 'diveSet': {
        const sx = this.diveDir > 0 ? 260 : L.width - 260
        const arrived = this.moveTowards(sx, L.floorY - R.dive.radius - 10, 520, dt)
        if (arrived || this.timer <= 0) {
          this.state = 'diveSpin'
          this.timer = R.dive.spin / angryK
          sfx.windup(this.timer)
        }
        break
      }
      case 'diveSpin': {
        this.spinSpeed = Math.min(9, this.spinSpeed + dt * 12)
        this.heat = Math.min(1, this.heat + dt * 1.5)
        if (this.timer <= 0) {
          this.state = 'dive'
          sfx.roll()
        }
        break
      }
      case 'dive': {
        this.x += this.diveDir * R.dive.speed * angryK * dt
        this.zone.circles.push({ x: this.x, y: this.y, r: R.dive.radius * 0.95 })
        if ((this.diveDir > 0 && this.x > L.width - 260) || (this.diveDir < 0 && this.x < 260)) {
          this.state = 'rise'
          this.timer = 1.2
        }
        break
      }
      case 'rise': {
        this.spinSpeed += (0.15 - this.spinSpeed) * Math.min(1, dt * 3)
        this.heat = Math.max(0, this.heat - dt)
        this.moveTowards(L.width / 2, 520, 420, dt)
        if (this.timer <= 0) this.endAttack()
        break
      }
    }
    this.rot += this.spinSpeed * dt
    for (const r of this.rays) r.flash = Math.max(0, r.flash - dt)

    // Parts follow their rays.
    for (let i = 0; i < RAYS; i++) {
      const a = this.rayAngle(i)
      const part = this.rays[i].part
      part.x = this.x + Math.cos(a) * (R.inner + R.outer) * 0.5
      part.y = this.y + Math.sin(a) * (R.inner + R.outer) * 0.5
      part.attacking = this.state === 'dive'
    }
    void p
    this.draw()
  }

  /** Ease towards a point; true once there. */
  private moveTowards(tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - this.x
    const dy = ty - this.y
    const d = Math.hypot(dx, dy)
    if (d < 4) return true
    const step = Math.min(d, speed * dt * Math.min(1, d / 120 + 0.25))
    this.x += (dx / d) * step
    this.y += (dy / d) * step
    return false
  }

  private chooseAttack() {
    const L = this.ctx.level
    const options = ['volley', 'beams', 'dive'].filter((a) => a !== this.lastAttack)
    const pick = options[Phaser.Math.Between(0, options.length - 1)]
    this.lastAttack = pick
    if (pick === 'volley') {
      this.state = 'volley'
      this.timer = 0.7
      sfx.windup(0.7)
    } else if (pick === 'beams') {
      this.state = 'beams'
      this.timer = R.beam.tell + R.beam.burn
      this.diveDir = Math.random() < 0.5 ? 1 : -1
      const live = this.rays.map((r, i) => (r.integrity > 0 ? i : -1)).filter((i) => i >= 0)
      Phaser.Utils.Array.Shuffle(live)
      this.beams = live.slice(0, this.angry ? 3 : 2)
      sfx.windup(R.beam.tell)
    } else {
      this.state = 'diveSet'
      this.timer = 2.5
      this.diveDir = this.ctx.player.x > L.width / 2 ? 1 : -1
    }
  }

  private endAttack() {
    const L = this.ctx.level
    this.state = 'drift'
    this.timer = this.angry ? R.gapAngry : R.gap
    this.heat = 0
    // Next spot: the middle, or up by one of the pillars' capitals (#114).
    const spots = [
      { x: L.width / 2, y: 520 },
      { x: 510, y: 230 },
      { x: L.width - 510, y: 230 },
      { x: L.width / 2 - 300, y: 420 },
      { x: L.width / 2 + 300, y: 420 },
    ]
    this.target = spots[Phaser.Math.Between(0, spots.length - 1)]
  }

  private fireVolley() {
    const sc = this.ctx.scene
    const speed = R.shard * (this.angry ? 1.2 : 1)
    sfx.shotgun()
    for (let i = 0; i < RAYS; i++) {
      if (this.rays[i].integrity <= 0) continue
      const a = this.rayAngle(i)
      for (const off of this.angry ? [-0.12, 0.12] : [0]) {
        const sh = new Projectile(sc, this.x + Math.cos(a) * R.outer, this.y + Math.sin(a) * R.outer, Math.cos(a + off) * speed, Math.sin(a + off) * speed, {
          damage: 1,
          size: 11,
          colour: i % 2 ? BONE : GOLD,
          glow: 0xffcf7a,
          life: 4,
          floorY: this.ctx.level.floorY,
        })
        // Its shards bring the crumbling arch down (#114).
        sh.onMove = (x, y) => this.ctx.env.collapseAt(x, y)
        this.ctx.addHazard(sh)
      }
    }
  }

  private draw() {
    const g = this.g
    const fx = this.fx
    g.clear()
    fx.clear()
    const { x, y } = this
    const sc = this.ctx.scene
    void sc
    // Beam tells and beams.
    if (this.state === 'beams') {
      const burning = this.timer < R.beam.burn
      for (const i of this.beams) {
        if (this.rays[i].integrity <= 0) continue
        const a = this.rayAngle(i)
        const x1 = x + Math.cos(a) * R.outer
        const y1 = y + Math.sin(a) * R.outer
        const x2 = x + Math.cos(a) * R.beam.length
        const y2 = y + Math.sin(a) * R.beam.length
        if (burning) {
          fx.lineStyle(R.beam.width * 2, 0xffcf7a, 0.25)
          fx.lineBetween(x1, y1, x2, y2)
          fx.lineStyle(R.beam.width, 0xfff0d8, 0.85)
          fx.lineBetween(x1, y1, x2, y2)
        } else {
          const blink = Math.sin(this.wobble * 30) > 0 ? 0.6 : 0.3
          fx.lineStyle(3, 0xffcf7a, blink)
          fx.lineBetween(x1, y1, x2, y2)
        }
      }
    }
    // Rays.
    for (let i = 0; i < RAYS; i++) {
      const r = this.rays[i]
      if (r.integrity <= 0) continue
      const a = this.rayAngle(i)
      const base = i % 2 ? BONE : GOLD
      const col = r.flash > 0 ? 0xffffff : mix(base, 0xfff0d8, this.heat)
      const pts = [
        new Phaser.Math.Vector2(x + Math.cos(a - R.half) * R.inner, y + Math.sin(a - R.half) * R.inner),
        new Phaser.Math.Vector2(x + Math.cos(a) * R.outer, y + Math.sin(a) * R.outer),
        new Phaser.Math.Vector2(x + Math.cos(a + R.half) * R.inner, y + Math.sin(a + R.half) * R.inner),
      ]
      g.fillStyle(col, 1)
      g.fillPoints(pts, true)
      g.lineStyle(3, INK, 1)
      g.strokePoints(pts, true)
      if (r.integrity < R.integrity) {
        // Cracks: more of them the more it's been hit.
        g.lineStyle(2, INK, 0.8)
        const n = R.integrity - Math.ceil(r.integrity)
        for (let k = 0; k <= n; k++) {
          const t = 0.35 + k * 0.18
          const cx = x + Math.cos(a) * (R.inner + (R.outer - R.inner) * t)
          const cy = y + Math.sin(a) * (R.inner + (R.outer - R.inner) * t)
          const nx = -Math.sin(a) * 9
          const ny = Math.cos(a) * 9
          g.lineBetween(cx - nx, cy - ny, cx + nx * 0.3 + Math.cos(a) * 6, cy + ny * 0.3 + Math.sin(a) * 6)
        }
      }
    }
    // The gold ring and the face.
    g.lineStyle(8, GOLD, 1)
    g.strokeCircle(x, y, R.face + 4)
    g.lineStyle(2, INK, 1)
    g.strokeCircle(x, y, R.face + 8)
    g.fillStyle(this.hurtFlash > 0 ? 0xffffff : GLASS, 1)
    g.fillCircle(x, y, R.face)
    g.lineStyle(3, INK, 1)
    g.strokeCircle(x, y, R.face)
    // Serene closed eyes; one cracks open (red) at half (#108).
    const lineW = 3
    g.lineStyle(lineW, INK, 1)
    g.beginPath()
    g.arc(x - 20, y - 8, 11, 0.15 * Math.PI, 0.85 * Math.PI)
    g.strokePath()
    if (this.angry) {
      drawEye(g, x + 20, y - 8, 13, { red: true, lookX: Phaser.Math.Clamp((this.ctx.player.x - x) / 300, -1, 1), lookY: Phaser.Math.Clamp((this.ctx.player.y - y) / 300, -1, 1) })
      // The crack.
      g.lineStyle(2, INK, 1)
      g.lineBetween(x + 6, y - 50, x + 14, y - 26)
      g.lineBetween(x + 14, y - 26, x + 8, y - 18)
      g.lineBetween(x + 28, y + 6, x + 40, y + 32)
    } else {
      g.beginPath()
      g.arc(x + 20, y - 8, 11, 0.15 * Math.PI, 0.85 * Math.PI)
      g.strokePath()
    }
    g.lineStyle(3, INK, 1)
    g.lineBetween(x - 8, y + 24, x + 8, y + 24)
  }

  destroy() {
    this.g.destroy()
    this.fx.destroy()
    this.zone.done = true
  }
}
