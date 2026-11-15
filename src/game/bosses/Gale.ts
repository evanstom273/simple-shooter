// The Gale (#107, #110, #116): a kite of four triangles riding the Bell Tower's
// wind, with an eye at the cross and a tail of red bows. In flight it's hard to
// hurt (shots glance off); it dives through the shaft and lashes with its tail,
// and some of the bows unfold into Motes. Every so often it perches on one of the
// landings' wall ends (fixed spots, about 4 s) to turn the wind's direction:
// folded tall and narrow, eye wide open. That's when you stomp it.
import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst, ring } from '../fx.ts'
import { BOSS_NAMES, type Boss, type BossCtx } from './types.ts'
import { BONE, BossPart, drawEye, INK, IRIS, mix, STAR, VIOLET, Zone } from './common.ts'
import type { LevelEnv } from '../levels.ts'

const G = {
  hp: 30,
  /** Damage taken in flight, as a fraction (#116: catch it when it perches). */
  flightArmour: 0.25,
  speed: 430,
  perchTime: 4,
  attacksBetweenPerches: 2,
  dive: { tell: 0.7, speed: 1500, depth: 900 },
  lash: { tell: 0.5, time: 0.4, reach: 360 },
  wind: 0.5,
  maxMotes: 6,
}

type State = 'fly' | 'diveTell' | 'dive' | 'swoop' | 'lashTell' | 'lash' | 'toPerch' | 'perched' | 'dead'
const DIRS: NonNullable<LevelEnv['dir']>[] = ['left', 'right', 'up', 'down']

export class Gale implements Boss {
  readonly name = BOSS_NAMES.gale
  readonly bars = 1
  readonly bar = 0
  dead = false
  x: number
  y: number
  private vx = 0
  private vy = 0
  private ctx: BossCtx
  private g: Phaser.GameObjects.Graphics
  private health = G.hp
  private part = new BossPart(56, VIOLET)
  private state: State = 'fly'
  private timer = 2.5
  private attacks = 0
  /** 0 = open kite, 1 = folded (perched or diving). */
  private fold = 0
  private heat = 0
  private flash = 0
  private tail: { x: number; y: number }[] = []
  private bows = [3, 6, 9]
  private perch: { x: number; y: number } | null = null
  private wind: { e: LevelEnv; strength: number }
  private zone = new Zone(2)
  private diveX = 0
  private lashFrom = 0
  private lashDir = 1
  private lastAttack = ''

  constructor(ctx: BossCtx) {
    this.ctx = ctx
    const L = ctx.level
    this.x = L.width / 2
    this.y = L.floorY - 900
    this.g = ctx.scene.add.graphics().setDepth(6)
    for (let i = 0; i < 12; i++) this.tail.push({ x: this.x, y: this.y + 64 + i * 14 })
    this.part.damage = 2
    this.part.onHit = (d, src) => this.onHit(d, src === 'dash')
    this.part.onStomp = (d) => this.onStomp(d)
    // Its own wind through the whole tower (#116), turned at each perch.
    this.wind = ctx.env.addWind(ctx.scene, { t: 'wind', x: 60, y: 60, w: L.width - 120, h: L.floorY - 60, dir: 'left' })
    this.wind.strength = G.wind
    ctx.addHazard(this.zone)
    sfx.spawn()
  }

  get parts() {
    return [this.part]
  }
  get hp() {
    return Math.max(0, this.health) / G.hp
  }

  private onHit(damage: number, dash: boolean) {
    const perched = this.state === 'perched'
    const k = perched ? 1 : G.flightArmour
    this.health -= damage * k * (dash && perched ? 2 : 1)
    this.flash = 0.08
    if (perched) sfx.enemyHit()
    else sfx.spark()
    if (this.health <= 0) this.die()
  }

  private onStomp(damage: number) {
    if (this.state !== 'perched') {
      sfx.bounce()
      return
    }
    this.health -= 4 * damage
    this.flash = 0.12
    sfx.enemyHit()
    this.ctx.shake(140, 0.01)
    if (this.health <= 0) this.die()
  }

  private die() {
    this.state = 'dead'
    this.dead = true
    this.zone.clear()
    this.wind.strength = 0
    sfx.waveClear()
    this.ctx.shake(500, 0.02)
    burst(this.ctx.scene, this.x, this.y, { count: 24, colour: BONE, angle: 0, spread: Math.PI, speed: [150, 450], size: [6, 12], life: 900, gravity: 500 })
    burst(this.ctx.scene, this.x, this.y, { count: 18, colour: VIOLET, angle: 0, spread: Math.PI, speed: [100, 380], size: [6, 12], life: 900, gravity: 500 })
  }

  /** The landings' wall ends (#116, Claude's placeholder): fixed, learnable perches. */
  private perches() {
    const L = this.ctx.level
    const out: { x: number; y: number }[] = []
    for (const p of L.platforms) {
      if (p.solid || p.crumble || p.w < 200) continue
      const leftWall = p.x <= 70
      out.push({ x: leftWall ? p.x + 70 : p.x + p.w - 70, y: p.y })
    }
    return out
  }

  update(dt: number) {
    if (this.dead) return
    const p = this.ctx.player
    const L = this.ctx.level
    this.timer -= dt
    this.flash = Math.max(0, this.flash - dt)
    this.zone.clear()
    this.part.attacking = false

    switch (this.state) {
      case 'fly': {
        this.fold += (0 - this.fold) * Math.min(1, dt * 5)
        this.heat = Math.max(0, this.heat - dt * 2)
        const side = p.x < L.width / 2 ? 1 : -1
        const tx = Phaser.Math.Clamp(p.x + side * 320 + Math.sin(this.ctx.scene.time.now / 900) * 120, 160, L.width - 160)
        const ty = Phaser.Math.Clamp(p.y - 380 + Math.cos(this.ctx.scene.time.now / 700) * 60, 200, L.floorY - 300)
        this.steer(tx, ty, G.speed, dt)
        if (this.timer <= 0) {
          if (this.attacks >= G.attacksBetweenPerches) this.goPerch()
          else this.chooseAttack()
        }
        break
      }
      case 'diveTell': {
        this.fold += (0.9 - this.fold) * Math.min(1, dt * 6)
        this.heat = Math.min(1, this.heat + dt / G.dive.tell)
        this.steer(this.diveX, Math.max(200, p.y - 520), 700, dt)
        if (this.timer <= 0) {
          this.state = 'dive'
          this.timer = G.dive.depth / G.dive.speed + 0.2
          this.vx = 0
          this.vy = G.dive.speed
          sfx.leap()
        }
        break
      }
      case 'dive': {
        this.y += this.vy * dt
        this.part.attacking = true
        this.zone.circles.push({ x: this.x, y: this.y, r: 46 })
        if (this.timer <= 0 || this.y > L.floorY - 80) {
          this.state = 'swoop'
          this.timer = 0.9
          this.vy = -200
          this.vx = (this.x < L.width / 2 ? 1 : -1) * 600
        }
        break
      }
      case 'swoop': {
        this.fold += (0 - this.fold) * Math.min(1, dt * 4)
        this.heat = Math.max(0, this.heat - dt * 2)
        this.vy -= 1800 * dt
        this.x += this.vx * dt
        this.y += this.vy * dt
        this.x = Phaser.Math.Clamp(this.x, 140, L.width - 140)
        if (this.timer <= 0) this.endAttack()
        break
      }
      case 'lashTell': {
        this.heat = Math.min(1, this.heat + dt / G.lash.tell)
        this.vx *= 1 - Math.min(1, dt * 5)
        this.vy *= 1 - Math.min(1, dt * 5)
        this.x += this.vx * dt
        this.y += this.vy * dt
        if (this.timer <= 0) {
          this.state = 'lash'
          this.timer = G.lash.time
          sfx.dash()
          // Some bows unfold into Motes (#116).
          for (let k = 0; k < 2 && this.ctx.motesAlive() < G.maxMotes; k++) {
            const b = this.tail[this.bows[(k + Math.floor(Math.random() * 3)) % 3]]
            this.ctx.spawnMote(b.x, b.y, Phaser.Math.Between(-150, 150), -150)
          }
        }
        break
      }
      case 'lash': {
        // The tail whips round in an arc on your side.
        const k = 1 - this.timer / G.lash.time
        const a = this.lashFrom + this.lashDir * Math.PI * 1.1 * (1 - (1 - k) * (1 - k))
        for (let i = 0; i < this.tail.length; i++) {
          const r = 50 + i * (G.lash.reach / this.tail.length)
          const tx = this.x + Math.cos(a - this.lashDir * i * 0.05) * r
          const ty = this.y + Math.sin(a - this.lashDir * i * 0.05) * r
          this.tail[i].x += (tx - this.tail[i].x) * Math.min(1, dt * 30)
          this.tail[i].y += (ty - this.tail[i].y) * Math.min(1, dt * 30)
        }
        for (let i = 1; i < this.tail.length; i++) {
          const a0 = this.tail[i - 1]
          const b0 = this.tail[i]
          this.zone.lines.push({ x1: a0.x, y1: a0.y, x2: b0.x, y2: b0.y, w: 18 })
        }
        if (this.timer <= 0) this.endAttack()
        break
      }
      case 'toPerch': {
        const pr = this.perch!
        this.fold += (0.6 - this.fold) * Math.min(1, dt * 3)
        const arrived = this.steer(pr.x, pr.y - 50, 650, dt)
        if (arrived || this.timer <= 0) {
          this.x = pr.x
          this.y = pr.y - 50
          this.vx = 0
          this.vy = 0
          this.state = 'perched'
          this.timer = G.perchTime
          this.turnWind()
        }
        break
      }
      case 'perched': {
        this.fold += (1 - this.fold) * Math.min(1, dt * 8)
        this.heat = 0
        if (this.timer <= 0) {
          this.state = 'fly'
          this.timer = 2.2
          this.attacks = 0
          this.vy = -500
          sfx.leap()
        }
        break
      }
    }

    this.updateTail(dt)
    this.part.x = this.x
    this.part.y = this.y
    this.part.radius = this.state === 'perched' ? 50 : 56
    this.draw()
  }

  /** Fly towards a point; true once there. */
  private steer(tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - this.x
    const dy = ty - this.y
    const d = Math.hypot(dx, dy)
    const want = Math.min(speed, d * 2.5)
    this.vx += (((dx / (d || 1)) * want) - this.vx) * Math.min(1, dt * 3)
    this.vy += (((dy / (d || 1)) * want) - this.vy) * Math.min(1, dt * 3)
    this.x += this.vx * dt
    this.y += this.vy * dt
    return d < 12
  }

  private chooseAttack() {
    const p = this.ctx.player
    const near = Math.hypot(p.x - this.x, p.y - this.y) < G.lash.reach + 80
    const pick = near && this.lastAttack !== 'lash' ? 'lash' : 'dive'
    this.lastAttack = pick
    this.attacks++
    if (pick === 'dive') {
      this.state = 'diveTell'
      this.timer = G.dive.tell
      this.diveX = p.x
      sfx.windup(G.dive.tell)
    } else {
      this.state = 'lashTell'
      this.timer = G.lash.tell
      this.lashDir = p.x > this.x ? -1 : 1
      this.lashFrom = p.x > this.x ? -Math.PI / 2 + Math.PI : -Math.PI / 2
      this.lashFrom = Math.atan2(p.y - this.y, p.x - this.x) - this.lashDir * Math.PI * 0.55
      sfx.windup(G.lash.tell)
    }
  }

  private endAttack() {
    this.state = 'fly'
    this.timer = 1.4
  }

  private goPerch() {
    const p = this.ctx.player
    const all = this.perches()
    // A perch a landing or two above you (or the nearest, at the top).
    const above = all.filter((q) => q.y < p.bottom - 150 && q.y > p.bottom - 700)
    const pool = above.length ? above : all
    pool.sort((a, b) => Math.abs(a.y - (p.bottom - 300)) - Math.abs(b.y - (p.bottom - 300)))
    this.perch = pool[0]
    this.state = 'toPerch'
    this.timer = 3
  }

  private turnWind() {
    const cur = this.wind.e.dir
    const options = DIRS.filter((d) => d !== cur)
    const next = options[Phaser.Math.Between(0, options.length - 1)]
    this.wind.e.dir = next
    this.wind.strength = next === 'up' || next === 'down' ? G.wind * 0.8 : G.wind
    sfx.portalPull()
    ring(this.ctx.scene, this.x, this.y, 200, 200, STAR, { grow: 3, life: 600, line: 5 })
    this.ctx.shake(200, 0.006)
  }

  private updateTail(dt: number) {
    if (this.state === 'lash') return
    // Follow the leader from the kite's bottom tip, streaming with the wind and away from its motion.
    const d = this.wind.e.dir
    const wx = d === 'left' ? -1 : d === 'right' ? 1 : 0
    const wy = d === 'up' ? -1 : d === 'down' ? 1 : 0
    const foldLen = 64 - this.fold * 18
    let px = this.x
    let py = this.y + foldLen
    const seg = 14
    const t = this.ctx.scene.time.now / 1000
    for (let i = 0; i < this.tail.length; i++) {
      const n = this.tail[i]
      // Drift: down, with the wind, against the motion, and a wave.
      const straight = this.state === 'diveTell' || this.state === 'dive'
      n.x += (wx * 60 - this.vx * 0.12 + (straight ? 0 : Math.sin(t * 5 + i * 0.7) * 25)) * dt
      n.y += ((straight ? -200 : 60) + wy * 60 - this.vy * 0.12) * dt
      const dx = n.x - px
      const dy = n.y - py
      const len = Math.hypot(dx, dy) || 1
      n.x = px + (dx / len) * seg
      n.y = py + (dy / len) * seg
      px = n.x
      py = n.y
    }
  }

  private draw() {
    const g = this.g
    g.clear()
    if (this.dead) return
    const p = this.ctx.player
    // The tail and its bows.
    g.lineStyle(this.state === 'lash' ? 5 : 3, mix(BONE, 0xffffff, this.heat), 1)
    g.beginPath()
    g.moveTo(this.x, this.y + 64 - this.fold * 18)
    for (const n of this.tail) g.lineTo(n.x, n.y)
    g.strokePath()
    for (const i of this.bows) {
      const n = this.tail[i]
      g.fillStyle(IRIS, 1)
      g.lineStyle(1.5, INK, 1)
      const tri = (sx: number) => {
        const pts = [new Phaser.Math.Vector2(n.x, n.y), new Phaser.Math.Vector2(n.x + sx * 12, n.y - 8), new Phaser.Math.Vector2(n.x + sx * 10, n.y + 8)]
        g.fillPoints(pts, true)
        g.strokePoints(pts, true)
      }
      tri(-1)
      tri(1)
    }
    // The kite: open in flight, tall and narrow when folded.
    const f = this.fold
    const top = { x: 0, y: -60 - 20 * f }
    const left = { x: -38 + 20 * f, y: -6 - 4 * f }
    const right = { x: 38 - 20 * f, y: -6 - 4 * f }
    const bot = { x: 0, y: 64 - 18 * f }
    const cross = { x: 0, y: -6 - 4 * f }
    const tilt = this.state === 'perched' ? 0 : Phaser.Math.Clamp(this.vx / 1500, -0.4, 0.4)
    const T = (q: { x: number; y: number }) => new Phaser.Math.Vector2(this.x + q.x * Math.cos(tilt) - q.y * Math.sin(tilt), this.y + q.x * Math.sin(tilt) + q.y * Math.cos(tilt))
    const light = this.flash > 0 ? 0xffffff : mix(BONE, 0xfff0d8, this.heat)
    const dark = this.flash > 0 ? 0xffffff : mix(VIOLET, 0xfff0d8, this.heat * 0.7)
    const tris: [typeof top, typeof top, typeof top, number][] = [
      [top, left, cross, light],
      [top, right, cross, dark],
      [left, bot, cross, dark],
      [right, bot, cross, light],
    ]
    for (const [a, b, c, col] of tris) {
      const pts = [T(a), T(b), T(c)]
      g.fillStyle(col, 1)
      g.fillPoints(pts, true)
      g.lineStyle(3, INK, 1)
      g.strokePoints(pts, true)
    }
    const e = T(cross)
    const perched = this.state === 'perched'
    drawEye(g, e.x, e.y, perched ? 13 : 10, {
      open: perched ? 1 : 0.45,
      red: perched || this.heat > 0.5,
      lookX: Phaser.Math.Clamp((p.x - this.x) / 300, -1, 1),
      lookY: Phaser.Math.Clamp((p.y - this.y) / 300, -1, 1),
    })
    // Perched: a ring so the window reads at a glance.
    if (perched) {
      const k = this.timer / G.perchTime
      g.lineStyle(3, IRIS, 0.6)
      g.beginPath()
      g.arc(this.x, this.y, 74, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k)
      g.strokePath()
    }
  }

  destroy() {
    this.g.destroy()
    this.zone.done = true
    this.wind.strength = 0
  }
}
