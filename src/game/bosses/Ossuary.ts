// The Ossuary (#107, #109, #115): a greater Void Mass. A cairn of bone-pale
// polygons (7, 6, 5 and 4 sides) with the Void Mass's hole and eye on top.
// Shots crack the top layer; stomps knock it off. Each layer lost makes it
// smaller and faster; when the last goes, the bare eye and hole flee: catch it
// and shoot it. It eats candles (each makes its next attack bigger). Attacks,
// one at a time: slam (Motes rise from the open graves), roll (drops into the
// graves and climbs out), swallow (never a kill: down to nearly dead, spat out,
// then it backs off).
import Phaser from 'phaser'
import { sfx } from '../../audio/sfx.ts'
import { burst, ring } from '../fx.ts'
import { BOSS_NAMES, type Boss, type BossCtx } from './types.ts'
import { BONE, BossPart, drawEye, FloorWave, INK, IRIS, LILAC, mix, polyPoints, VIOLET, VOID, Zone } from './common.ts'

const LAYERS = [
  { sides: 7, w: 220, h: 56 },
  { sides: 6, w: 184, h: 52 },
  { sides: 5, w: 150, h: 48 },
  { sides: 4, w: 116, h: 44 },
]
const O = {
  layerHp: 3,
  eyeHp: 6,
  walk: 95,
  gap: 2.0,
  slam: { rise: 280, riseTime: 0.65, hang: 0.3, drop: 1900, damage: 2 },
  roll: { tell: 0.6, speed: 620, range: 1500 },
  swallow: { tell: 0.55, pull: 1.3, chew: 1.4, backOff: 3.5 },
  flee: 330,
  maxMotes: 8,
}

type State = 'walk' | 'rise' | 'hang' | 'drop' | 'recover' | 'rollTell' | 'roll' | 'pit' | 'swallowTell' | 'pull' | 'chew' | 'backOff' | 'flee' | 'dead'

export class Ossuary implements Boss {
  readonly name = BOSS_NAMES.ossuary
  readonly bars = 1
  readonly bar = 0
  dead = false
  x: number
  y: number
  /** Ground under it (the floor, or a sarcophagus it's climbed). */
  private ground: number
  private ctx: BossCtx
  private g: Phaser.GameObjects.Graphics
  private layerHp = LAYERS.map(() => O.layerHp)
  private lost = 0
  private eyeHp = O.eyeHp
  private part = new BossPart(110, BONE)
  private state: State = 'walk'
  private timer = 2
  private heat = 0
  private power = 0
  private tilt = 0
  private dir = 1
  private vx = 0
  private vy = 0
  private travelled = 0
  private stompCool = 0
  private flash = 0
  private zone = new Zone(2)
  private lastAttack = ''
  private eyeOpen = 0.5

  constructor(ctx: BossCtx) {
    this.ctx = ctx
    const L = ctx.level
    this.x = L.width - 400
    this.ground = L.floorY
    this.y = this.ground
    this.g = ctx.scene.add.graphics().setDepth(6)
    this.part.heavy = false
    this.part.damage = 3
    this.part.onHit = (d, src) => this.onHit(d, src === 'dash' || src === 'stomp')
    this.part.onStomp = (d) => this.onStomp(d)
    ctx.addHazard(this.zone)
    ring(ctx.scene, this.x, this.y - 100, 300, 120, VIOLET, { grow: 1.5, life: 600, line: 5 })
    sfx.spawn()
  }

  get parts() {
    return this.state === 'pit' || this.state === 'chew' ? [] : [this.part]
  }
  get hp() {
    const total = LAYERS.length * O.layerHp + O.eyeHp
    return (this.layerHp.reduce((a, b) => a + Math.max(0, b), 0) + Math.max(0, this.eyeHp)) / total
  }
  private get layers() {
    return LAYERS.slice(this.lost)
  }
  private get height() {
    return this.layers.reduce((a, l) => a + l.h, 0)
  }
  private get speedK() {
    return 1 + this.lost * 0.22
  }
  private get topY() {
    return this.y - this.height
  }

  private onHit(damage: number, impact: boolean) {
    this.flash = 0.08
    if (this.state === 'flee') {
      this.eyeHp -= damage
      sfx.enemyHit()
      if (this.eyeHp <= 0) this.die()
      return
    }
    const i = this.lost
    // Shots and dashes crack the top layer; only a stomp knocks it off (#107).
    this.layerHp[i] = Math.max(0.5, this.layerHp[i] - damage * (impact ? 1 : 1))
    sfx.spark()
  }

  private onStomp(damage: number) {
    if (this.state === 'flee') {
      this.onHit(damage * 2, true)
      return
    }
    if (this.stompCool > 0) return
    this.stompCool = 0.5
    this.flash = 0.1
    const i = this.lost
    if (this.layerHp[i] <= 1.5) this.knockOff()
    else {
      this.layerHp[i] -= 1.5 * damage
      if (this.layerHp[i] <= 0) this.knockOff()
      else sfx.enemyHit()
    }
  }

  private knockOff() {
    const i = this.lost
    const l = LAYERS[i]
    this.layerHp[i] = 0
    this.lost++
    sfx.shatter()
    this.ctx.shake(200, 0.012)
    burst(this.ctx.scene, this.x, this.topY, { count: 16, colour: BONE, angle: -Math.PI / 2, spread: 1.4, speed: [150, 420], size: [8, 16], life: 800, gravity: 900 })
    void l
    if (this.lost >= LAYERS.length) {
      // The bare eye and hole flee (#115).
      this.state = 'flee'
      this.timer = 0
      this.part.radius = 38
      this.part.attacking = false
      this.zone.clear()
      this.vx = 0
      this.vy = -500
      sfx.runOver()
    } else {
      this.part.radius = Math.max(this.layers[0].w / 2, this.height / 2) * 0.9
    }
  }

  private die() {
    this.state = 'dead'
    this.dead = true
    this.zone.clear()
    sfx.waveClear()
    this.ctx.shake(500, 0.02)
    burst(this.ctx.scene, this.x, this.y, { count: 26, colour: VIOLET, angle: 0, spread: Math.PI, speed: [100, 420], size: [6, 12], life: 800 })
    burst(this.ctx.scene, this.x, this.y, { count: 12, colour: 0xffffff, angle: 0, spread: Math.PI, speed: [60, 200], size: [3, 6], life: 600 })
  }

  /** The ground at x: the floor, a sarcophagus or block top, or nothing (a pit). */
  private groundAt(x: number, halfW: number): number | null {
    const L = this.ctx.level
    let best: number | null = null
    for (const p of L.platforms) {
      if (!p.solid || p.edge) continue
      if (x + halfW * 0.5 < p.x || x - halfW * 0.5 > p.x + p.w) continue
      if (p.y < L.floorY - 120) continue // only low things: sarcophagi, the floor
      if (best === null || p.y < best) best = p.y
    }
    return best
  }

  private inPitAt(x: number) {
    return (this.ctx.level.pits ?? []).some((p) => x > p.x + 20 && x < p.x + p.w - 20)
  }

  update(dt: number) {
    if (this.dead) return
    const p = this.ctx.player
    const L = this.ctx.level
    this.timer -= dt
    this.stompCool = Math.max(0, this.stompCool - dt)
    this.flash = Math.max(0, this.flash - dt)
    this.zone.clear()
    this.part.attacking = false
    const halfW = (this.layers[0]?.w ?? 80) / 2
    const minX = 60 + halfW
    const maxX = L.width - 60 - halfW

    switch (this.state) {
      case 'walk':
      case 'backOff': {
        this.heat = Math.max(0, this.heat - dt * 2)
        this.tilt *= 1 - Math.min(1, dt * 6)
        this.eyeOpen += (0.45 - this.eyeOpen) * Math.min(1, dt * 4)
        let tx = p.x
        if (this.state === 'backOff') tx = p.x < this.x ? maxX : minX
        else {
          // A lit candle within reach draws it (#115).
          const c = this.nearestCandle()
          if (c) tx = c.x
        }
        const want = Math.sign(tx - this.x) * O.walk * this.speedK * (this.state === 'backOff' ? 1.6 : 1)
        const nx = this.x + want * dt
        if (Math.abs(tx - this.x) > 20 && !this.inPitAt(nx) && nx > minX && nx < maxX) this.x = nx
        this.followGround(dt)
        this.eatCandles()
        if (this.timer <= 0) {
          if (this.state === 'backOff') {
            this.state = 'walk'
            this.timer = 1
          } else this.chooseAttack()
        }
        break
      }
      case 'rise': {
        this.heat = Math.min(1, this.heat + dt / O.slam.riseTime)
        this.eyeOpen = 1
        this.y -= (O.slam.rise / O.slam.riseTime) * dt
        // Drifts over you as it rises.
        const tx = Phaser.Math.Clamp(p.x, minX, maxX)
        this.x += Phaser.Math.Clamp(tx - this.x, -320 * dt, 320 * dt)
        if (this.timer <= 0) {
          this.state = 'hang'
          this.timer = O.slam.hang
        }
        break
      }
      case 'hang': {
        if (this.timer <= 0) {
          this.state = 'drop'
          this.vy = 0
        }
        break
      }
      case 'drop': {
        this.vy = O.slam.drop
        this.y += this.vy * dt
        this.part.attacking = true
        const gy = this.groundAt(this.x, halfW) ?? L.floorY
        if (this.y >= gy) {
          this.y = gy
          this.ground = gy
          this.land()
        }
        break
      }
      case 'recover': {
        this.heat = Math.max(0, this.heat - dt * 2)
        this.tilt *= 1 - Math.min(1, dt * 4)
        this.eyeOpen += (0.2 - this.eyeOpen) * Math.min(1, dt * 4)
        if (this.timer <= 0) this.toWalk()
        break
      }
      case 'rollTell': {
        this.heat = Math.min(1, this.heat + dt / O.roll.tell)
        this.tilt = this.dir * 0.35 * this.heat
        this.eyeOpen = 1
        if (this.timer <= 0) {
          this.state = 'roll'
          this.travelled = 0
          this.vy = 0
          sfx.roll()
        }
        break
      }
      case 'roll': {
        const speed = O.roll.speed * this.speedK * (1 + 0.15 * this.power)
        const step = speed * dt
        this.x += this.dir * step
        this.travelled += step
        this.tilt += this.dir * dt * (speed / (halfW || 1))
        this.part.attacking = true
        this.zone.circles.push({ x: this.x, y: this.y - this.height / 2, r: Math.max(halfW, this.height / 2) * 0.85 })
        const gy = this.groundAt(this.x, halfW)
        if (gy === null || this.inPitAt(this.x)) {
          // Into the grave (#115).
          this.vy += 2400 * dt
          this.y += this.vy * dt
          if (this.y > L.floorY + 300) {
            this.state = 'pit'
            this.timer = 0.7
            this.ctx.shake(150, 0.008)
            sfx.land(1)
          }
        } else {
          this.y += (gy - this.y) * Math.min(1, dt * 14)
          this.ground = gy
        }
        if (this.x <= minX || this.x >= maxX || this.travelled > O.roll.range) {
          this.x = Phaser.Math.Clamp(this.x, minX, maxX)
          if (this.x <= minX || this.x >= maxX) {
            sfx.dashImpact()
            this.ctx.shake(200, 0.01)
          }
          this.state = 'recover'
          this.timer = 1.2
          this.power = 0
        }
        break
      }
      case 'pit': {
        if (this.timer <= 0) {
          // Climbs out on the far side and rights itself.
          const pit = (L.pits ?? []).reduce((best, q) => (Math.abs(q.x + q.w / 2 - this.x) < Math.abs(best.x + best.w / 2 - this.x) ? q : best), (L.pits ?? [])[0])
          this.x = Phaser.Math.Clamp(this.dir > 0 ? pit.x + pit.w + halfW + 10 : pit.x - halfW - 10, minX, maxX)
          this.y = L.floorY
          this.ground = L.floorY
          this.tilt = 0
          burst(this.ctx.scene, this.x, L.floorY, { count: 14, colour: BONE, angle: -Math.PI / 2, spread: 1, speed: [100, 300], size: [5, 10], life: 500, gravity: 600 })
          this.ctx.shake(200, 0.01)
          this.state = 'recover'
          this.timer = 1.1
          this.power = 0
        }
        break
      }
      case 'swallowTell': {
        this.eyeOpen = 1
        this.heat = Math.min(1, this.heat + dt / O.swallow.tell)
        if (this.timer <= 0) {
          this.state = 'pull'
          this.timer = O.swallow.pull
          sfx.portalPull()
        }
        break
      }
      case 'pull': {
        // The hole on top pulls (#115): get away from it.
        const hx = this.x
        const hy = this.topY
        const dx = hx - p.x
        const dy = hy - p.y
        const d = Math.hypot(dx, dy)
        if (Math.abs(dx) < 170 && p.y < hy + 30 && p.y > hy - 340) {
          const k = 1 - Math.min(1, d / 340)
          this.ctx.nudgePlayer((dx / (d || 1)) * 1500 * k * dt * 2, (dy / (d || 1)) * 1500 * k * dt * 2)
          if (d < 46) {
            this.state = 'chew'
            this.timer = O.swallow.chew
            this.ctx.swallowPlayer(hx, hy)
            sfx.hurt()
            break
          }
        }
        if (this.timer <= 0) this.toWalk()
        break
      }
      case 'chew': {
        this.ctx.shake(60, 0.004)
        this.tilt = Math.sin(this.timer * 30) * 0.06
        if (this.timer <= 0) {
          const away = p.x < L.width / 2 ? 1 : -1
          this.ctx.releasePlayer(away * 520, -900)
          sfx.shatter()
          this.state = 'backOff'
          this.timer = O.swallow.backOff
          this.tilt = 0
        }
        break
      }
      case 'flee': {
        this.updateFlee(dt)
        break
      }
    }

    // The part sits on the whole stack (or the fleeing eye).
    if (this.state === 'flee') {
      this.part.x = this.x
      this.part.y = this.y
    } else {
      this.part.x = this.x
      this.part.y = this.y - this.height / 2
      this.part.radius = Math.max(halfW, this.height / 2) * 0.92
    }
    this.draw()
  }

  private toWalk() {
    this.state = 'walk'
    this.timer = O.gap / this.speedK
  }

  private followGround(dt: number) {
    const gy = this.groundAt(this.x, (this.layers[0]?.w ?? 80) / 2) ?? this.ctx.level.floorY
    this.ground = gy
    this.y += (gy - this.y) * Math.min(1, dt * 8)
  }

  private nearestCandle() {
    let best: { x: number; i: number } | null = null
    for (let i = 0; i < this.ctx.candles.length; i++) {
      const c = this.ctx.candles[i]
      if (!c.lit || c.y < this.ctx.level.floorY - 120) continue
      if (Math.abs(c.x - this.x) > 500) continue
      if (!best || Math.abs(c.x - this.x) < Math.abs(best.x - this.x)) best = { x: c.x, i }
    }
    return best
  }

  private eatCandles() {
    for (let i = 0; i < this.ctx.candles.length; i++) {
      const c = this.ctx.candles[i]
      if (!c.lit || c.y < this.ctx.level.floorY - 120) continue
      if (Math.abs(c.x - this.x) < 50) {
        this.ctx.setCandle(i, false)
        this.power = Math.min(3, this.power + 1)
        sfx.heal()
        ring(this.ctx.scene, this.x, this.topY, 120, 60, 0xffcf7a, { grow: 2, life: 500 })
      }
    }
  }

  private chooseAttack() {
    const p = this.ctx.player
    const above = Math.abs(p.x - this.x) < 180 && p.bottom < this.topY + 20 && p.bottom > this.topY - 360
    if (above) {
      this.state = 'swallowTell'
      this.timer = O.swallow.tell
      this.lastAttack = 'swallow'
      return
    }
    const pick = this.lastAttack === 'slam' ? 'roll' : this.lastAttack === 'roll' ? 'slam' : Math.random() < 0.5 ? 'slam' : 'roll'
    this.lastAttack = pick
    if (pick === 'slam') {
      this.state = 'rise'
      this.timer = O.slam.riseTime
      sfx.windup(O.slam.riseTime + O.slam.hang)
    } else {
      this.state = 'rollTell'
      this.timer = O.roll.tell
      this.dir = p.x > this.x ? 1 : -1
      sfx.windup(O.roll.tell)
    }
  }

  private land() {
    const L = this.ctx.level
    const sc = this.ctx.scene
    sfx.land(1)
    sfx.dashImpact()
    this.ctx.shake(350, 0.02)
    burst(sc, this.x, this.y, { count: 20, colour: BONE, angle: -Math.PI / 2, spread: 1.3, speed: [150, 380], size: [5, 11], life: 600, gravity: 800 })
    const extra = this.power
    for (const d of [-1, 1] as const) {
      this.ctx.addHazard(new FloorWave(sc, this.x + d * ((this.layers[0]?.w ?? 100) / 2), this.y, d, { damage: O.slam.damage + extra, speed: 700 + extra * 120, range: 900 + extra * 250 }))
    }
    // The rotten lids collapse (#115), and Motes rise from the open graves.
    this.ctx.env.shakeCrumbles()
    for (const pit of L.pits ?? []) {
      if (this.ctx.motesAlive() >= O.maxMotes) break
      this.ctx.spawnMote(pit.x + pit.w / 2, L.floorY + 30, Phaser.Math.Between(-80, 80), -420)
    }
    this.power = 0
    this.state = 'recover'
    this.timer = 1.0
  }

  private updateFlee(dt: number) {
    const p = this.ctx.player
    const L = this.ctx.level
    this.timer -= 0
    const dx = this.x - p.x
    const dy = this.y - p.y
    const d = Math.hypot(dx, dy) || 1
    let ax = 0
    let ay = 0
    if (d < 520) {
      ax += (dx / d) * 900
      ay += (dy / d) * 600
    }
    // Wander, and keep off the walls and floor.
    ax += Math.sin(this.ctx.scene.time.now / 700) * 300
    ay += Math.cos(this.ctx.scene.time.now / 900) * 200
    if (this.x < 200) ax += 1200
    if (this.x > L.width - 200) ax -= 1200
    if (this.y < 320) ay += 1200
    if (this.y > L.floorY - 120) ay -= 1400
    this.vx += ax * dt
    this.vy += ay * dt
    const sp = Math.hypot(this.vx, this.vy)
    const max = O.flee
    if (sp > max) {
      this.vx *= max / sp
      this.vy *= max / sp
    }
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.x = Phaser.Math.Clamp(this.x, 80, L.width - 80)
    this.y = Phaser.Math.Clamp(this.y, 260, L.floorY - 60)
  }

  private draw() {
    const g = this.g
    g.clear()
    if (this.state === 'pit' || this.state === 'dead') return
    const p = this.ctx.player
    const look = { lookX: Phaser.Math.Clamp((p.x - this.x) / 300, -1, 1), lookY: Phaser.Math.Clamp((p.y - this.y) / 300, -1, 1) }
    if (this.state === 'flee') {
      // Just the hole and the eye.
      g.fillStyle(VOID, 1)
      g.fillCircle(this.x, this.y, 36)
      g.lineStyle(4, this.flash > 0 ? 0xffffff : VIOLET, 1)
      g.strokeCircle(this.x, this.y, 36)
      drawEye(g, this.x, this.y, 18, { red: true, ...look })
      return
    }
    // Slam marker: where it will land.
    if (this.state === 'rise' || this.state === 'hang' || this.state === 'drop') {
      const gy = this.groundAt(this.x, (this.layers[0]?.w ?? 80) / 2) ?? this.ctx.level.floorY
      g.fillStyle(0x000000, 0.35)
      g.fillEllipse(this.x, gy - 2, (this.layers[0]?.w ?? 80) * 1.1, 18)
      g.lineStyle(3, IRIS, 0.7)
      g.strokeEllipse(this.x, gy - 2, (this.layers[0]?.w ?? 80) * 1.1, 18)
    }
    const cx = this.x
    const cy = this.y - this.height / 2
    const rot = (px: number, py: number) => {
      const c = Math.cos(this.tilt)
      const s = Math.sin(this.tilt)
      const dx = px - cx
      const dy = py - cy
      return new Phaser.Math.Vector2(cx + dx * c - dy * s, cy + dx * s + dy * c)
    }
    let base = this.y
    const fill = this.flash > 0 ? 0xffffff : mix(BONE, 0xfff0d8, this.heat)
    this.layers.forEach((l, j) => {
      const ly = base - l.h / 2
      const pts = polyPoints(cx, ly, l.w / 2, l.sides, -Math.PI / 2 + j * 0.3, 1, (l.h / l.w) * 1.15).map((v) => rot(v.x, v.y))
      g.fillStyle(fill, 1)
      g.fillPoints(pts, true)
      g.lineStyle(3, INK, 1)
      g.strokePoints(pts, true)
      // Cracks on the top layer.
      if (j === 0) {
        const hp = this.layerHp[this.lost]
        if (hp < O.layerHp) {
          g.lineStyle(2, INK, 0.9)
          const n = Math.ceil((O.layerHp - hp) * 1.5)
          for (let k = 0; k < n; k++) {
            const a = rot(cx - l.w * 0.3 + k * l.w * 0.18, ly - l.h * 0.3)
            const b = rot(cx - l.w * 0.25 + k * l.w * 0.18, ly + l.h * 0.25)
            g.lineBetween(a.x, a.y, b.x, b.y)
          }
        }
      }
      base -= l.h
    })
    // The hole and the eye on top.
    const top = rot(cx, this.topY - 4)
    const holeW = this.state === 'swallowTell' || this.state === 'pull' ? 110 : 64
    g.fillStyle(VOID, 1)
    g.fillEllipse(top.x, top.y, holeW, holeW * 0.45)
    g.lineStyle(4, this.state === 'pull' ? LILAC : VIOLET, 1)
    g.strokeEllipse(top.x, top.y, holeW, holeW * 0.45)
    if (this.state === 'pull') {
      g.lineStyle(2, LILAC, 0.5)
      const t = (this.ctx.scene.time.now / 400) % 1
      for (let k = 0; k < 3; k++) {
        const r = 1 - ((t + k / 3) % 1)
        g.strokeEllipse(top.x, top.y - 60 * r, holeW * (1 + r * 1.5), holeW * 0.45 * (1 + r))
      }
    }
    drawEye(g, top.x, top.y - 1, 13, { open: this.eyeOpen, red: this.eyeOpen > 0.8, ...look })
    // Candle power: flames flicker in the cracks.
    for (let k = 0; k < this.power; k++) {
      g.fillStyle(0xffcf7a, 0.9)
      g.fillCircle(cx - 30 + k * 30, this.y - 20 - k * 10, 5)
    }
  }

  destroy() {
    this.g.destroy()
    this.zone.done = true
  }
}
