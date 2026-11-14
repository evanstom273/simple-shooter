import Phaser from 'phaser'
import { PLAYER } from './tuning.ts'

// The player as drawn (#61, Stylised Geometry): the square with two oval eyes
// and a smile, floating circle hands, and L-shaped boots, from Lyra's sketch
// (concepts/player-concept.svg). All visual: the physics box is separate, so
// none of this changes collisions.
//
// Squash and stretch runs on a damped spring: effects kick the scale away from
// 1 and it wobbles back.
const SPRING = 520
const DAMPING = 22
const INK = 0x1a1a26
const HALF = PLAYER.size / 2

export const PLAYER_COLOURS = {
  normal: 0xf2f2f2,
  dash: 0x8fd3ff,
  hurt: 0xffb0b0,
}

type Mood = 'normal' | 'dash' | 'hurt' | 'happy'

/**
 * Beam-in / beam-out (#75): the player assembles piece by piece inside a beam
 * of light. Beats fire as each piece arrives (or leaves, in reverse).
 */
export type BeamBeat = 'start' | 'feet' | 'land' | 'hands' | 'eyes' | 'done'
const BEATS: [BeamBeat, number][] = [
  ['feet', 0.25],
  ['land', 0.55],
  ['hands', 0.62],
  ['eyes', 0.82],
]
/** How far above the feet the body drops in from. */
const DROP = 380
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const backOut = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2)

export class PlayerView {
  /** The squashing body (scaled from the feet; rotated along the dash). */
  private outer: Phaser.GameObjects.Container
  private body: Phaser.GameObjects.Rectangle
  private face: Phaser.GameObjects.Graphics
  private feet: Phaser.GameObjects.Graphics
  private hands: [Phaser.GameObjects.Arc, Phaser.GameObjects.Arc]
  private sx = 1
  private sy = 1
  private vx = 0
  private vy = 0
  private lean = 0
  private flash = 0
  private facing = 1
  private step = 0
  private moodTime = 0
  private mood: Mood = 'normal'
  private gunHand: { x: number; y: number } | null = null
  /** Invulnerable after a hit: blink. */
  flicker = false
  private beam: { t: number; dur: number; dir: 1 | -1; k: number; onBeat: (b: BeamBeat, dir: 1 | -1) => void } | null = null
  private pull: { t: number; dur: number; x: number; y: number; from: { x: number; y: number } | null; hands: { x: number; y: number }[] } | null = null
  /** Beamed or pulled out: nothing drawn. */
  private gone = false

  constructor(scene: Phaser.Scene) {
    this.body = scene.add.rectangle(0, -HALF, PLAYER.size, PLAYER.size, PLAYER_COLOURS.normal).setStrokeStyle(3, INK)
    this.face = scene.add.graphics()
    this.face.y = -HALF
    this.outer = scene.add.container(0, 0, [this.body, this.face]).setDepth(10)
    this.feet = scene.add.graphics().setDepth(9)
    const hand = () => scene.add.circle(0, 0, 8, 0xffffff).setStrokeStyle(2.5, INK).setDepth(11)
    this.hands = [hand(), hand()]
  }

  /** Current visual scale (for the dash afterimages). */
  get scaleX() {
    return this.outer.scaleX
  }
  get scaleY() {
    return this.outer.scaleY
  }

  /** Squash (x > 1, y < 1) or stretch (x < 1, y > 1). Keeps roughly the same area. */
  kick(scaleX: number, scaleY: number) {
    this.sx = scaleX
    this.sy = scaleY
    this.vx = 0
    this.vy = 0
  }

  /** Brief white-hot flash, fading out over `seconds`. */
  pulse(seconds = 0.18) {
    this.flash = seconds
  }

  /** Wince for a moment (got hit). */
  ouch() {
    this.mood = 'hurt'
    this.moodTime = 0.45
  }

  /** Grin for a moment (stomp, heal). */
  grin() {
    this.mood = 'happy'
    this.moodTime = 0.5
  }

  /** Hidden, then after `delay` seconds assemble in a beam over `dur` seconds (#75). */
  beamIn(delay: number, dur: number, onBeat: (b: BeamBeat, dir: 1 | -1) => void) {
    this.gone = false
    this.beam = { t: -delay, dur, dir: 1, k: 0, onBeat }
  }

  /** The reverse: come apart and lift out up the beam (#75). */
  beamOut(dur: number, onBeat: (b: BeamBeat, dir: 1 | -1) => void) {
    this.beam = { t: 0, dur, dir: -1, k: 1, onBeat }
  }

  /** Pulled into a portal at (x, y): stretch towards it and shrink away (#75). */
  pullInto(x: number, y: number, dur: number) {
    this.pull = { t: 0, dur, x, y, from: null, hands: this.hands.map((h) => ({ x: h.x, y: h.y })) }
  }

  /** How assembled the player is during a beam (0 = nothing, 1 = whole), or null when no beam is running. */
  get beamK(): number | null {
    if (!this.beam || this.beam.t < 0) return null
    return this.beam.k
  }

  private advanceBeam(dt: number) {
    const b = this.beam
    if (!b) return
    const before = b.t
    b.t += dt
    if (b.t < 0) return
    if (before < 0 || (before === 0 && b.dir === -1)) b.onBeat('start', b.dir)
    const p = clamp01(b.t / b.dur)
    const prev = b.k
    b.k = b.dir === 1 ? p : 1 - p
    // Fire each beat as k crosses it (upwards when arriving, downwards when leaving).
    const order = b.dir === 1 ? BEATS : [...BEATS].reverse()
    for (const [name, at] of order) {
      if (b.dir === 1 ? prev < at && b.k >= at : prev >= at && b.k < at) {
        if (name === 'land' && b.dir === 1) this.kick(1.45, 0.6)
        b.onBeat(name, b.dir)
      }
    }
    if (p >= 1) {
      this.beam = null
      if (b.dir === -1) this.gone = true
      b.onBeat('done', b.dir)
    }
  }

  private hideAll() {
    this.outer.setVisible(false)
    this.feet.clear()
    for (const h of this.hands) h.setVisible(false)
  }

  /** Being pulled into a portal: stretched along the pull, shrinking to nothing at its centre. */
  private drawPull(dt: number, s: { x: number; centreY: number }) {
    const pl = this.pull!
    pl.from ??= { x: s.x, y: s.centreY }
    pl.t += dt
    const k = clamp01(pl.t / pl.dur)
    const e = k * k
    const x = pl.from.x + (pl.x - pl.from.x) * e
    const y = pl.from.y + (pl.y - pl.from.y) * e
    const angle = Math.atan2(pl.y - pl.from.y, pl.x - pl.from.x)
    this.outer.setVisible(k < 1).setPosition(x, y).setRotation(angle).setScale((1 + 1.6 * e) * (1 - e), (1 - e) * (1 - 0.4 * e)).setAlpha(1)
    this.body.y = 0
    this.face.y = 0
    this.body.setFillStyle(PLAYER_COLOURS.normal).setStrokeStyle(3, INK)
    this.drawFace('hurt', true)
    this.feet.clear()
    this.hands.forEach((h, i) => {
      const from = pl.hands[i]
      h.setVisible(k < 1).setAlpha(1).setScale(1 - e)
      h.setPosition(from.x + (pl.x - from.x) * Math.min(1, e * 1.3), from.y + (pl.y - from.y) * Math.min(1, e * 1.3))
    })
    if (k >= 1) {
      this.pull = null
      this.gone = true
    }
  }

  /** Where the gun is held (the front hand goes there), or null when unarmed. */
  holdGun(at: { x: number; y: number } | null) {
    this.gunHand = at
  }

  update(
    dt: number,
    s: {
      x: number
      /** Bottom of the physics body (feet). */
      bottom: number
      centreY: number
      velX: number
      velY: number
      grounded: boolean
      dashing: boolean
      dashAngle: number
      /** Sliding down a wall on this side (#82), else 0. */
      wall?: number
    },
  ) {
    this.advanceBeam(dt)
    if (this.pull) {
      this.drawPull(dt, s)
      return
    }
    if (this.gone || (this.beam && this.beam.t < 0 && this.beam.dir === 1)) {
      this.hideAll()
      return
    }
    this.vx += ((1 - this.sx) * SPRING - this.vx * DAMPING) * dt
    this.vy += ((1 - this.sy) * SPRING - this.vy * DAMPING) * dt
    this.sx += this.vx * dt
    this.sy += this.vy * dt
    if (Math.abs(s.velX) > 30) this.facing = Math.sign(s.velX)
    if (s.wall) this.facing = -s.wall
    this.moodTime = Math.max(0, this.moodTime - dt)
    const mood: Mood = s.dashing ? 'dash' : this.moodTime > 0 ? this.mood : 'normal'
    const running = s.grounded && Math.abs(s.velX) > 60 && !s.dashing
    this.step += dt * (running ? 14 : 0)
    const alpha = this.flicker && Math.floor(performance.now() / 70) % 2 === 0 ? 0.25 : 1
    this.flash = Math.max(0, this.flash - dt)

    const o = this.outer
    if (s.dashing) {
      // Stretched along the dash direction, centred on the body.
      o.setPosition(s.x, s.centreY).setRotation(s.dashAngle).setScale(1.45, 0.7)
      this.body.y = 0
      this.face.y = 0
      this.body.setFillStyle(PLAYER_COLOURS.dash)
    } else {
      const airStretch = s.grounded ? 0 : Phaser.Math.Clamp(Math.abs(s.velY) / 4000, 0, 0.12)
      const targetLean = (s.velX / PLAYER.runSpeed) * (s.grounded ? 0.07 : 0.04)
      this.lean += (targetLean - this.lean) * Math.min(1, dt * 14)
      // Feet stay planted: scale from the bottom centre.
      o.setPosition(s.x, s.bottom).setRotation(this.lean).setScale(this.sx * (1 - airStretch * 0.5), this.sy * (1 + airStretch))
      this.body.y = -HALF
      this.face.y = -HALF
      this.body.setFillStyle(this.flash > 0 ? 0xffffff : mood === 'hurt' ? PLAYER_COLOURS.hurt : PLAYER_COLOURS.normal)
    }
    this.body.setStrokeStyle(this.flash > 0 ? 4 : 3, this.flash > 0 ? PLAYER_COLOURS.dash : INK)
    o.setAlpha(alpha)
    // Beam: pieces arrive one at a time (#75).
    const k = this.beam ? this.beam.k : 1
    const feetK = clamp01((k - 0.25) / 0.1)
    const bodyK = clamp01((k - 0.4) / 0.15)
    const handsK = clamp01((k - 0.62) / 0.12)
    o.setVisible(bodyK > 0)
    if (bodyK < 1) {
      // Falling (or lifting) through the beam: stretched tall.
      o.y -= DROP * (1 - bodyK * bodyK)
      o.setScale(0.78, 1.3).setRotation(0)
    }
    this.drawFace(mood, s.dashing, k < 0.82)
    this.drawFeet(s, running, alpha * feetK, -(1 - feetK) * 26)
    this.drawHands(s, mood, alpha)
    const hs = handsK > 0 ? (this.beam ? backOut(handsK) : 1) : 0
    for (const h of this.hands) h.setVisible(hs > 0).setScale(hs)
  }

  private drawFace(mood: Mood, dashing: boolean, closed = false) {
    const g = this.face
    g.clear()
    if (closed) {
      // Not awake yet: eyes shut, mouth flat.
      const ox = this.facing * 3
      g.lineStyle(3, INK)
      g.lineBetween(-13 + ox, -5, -5 + ox, -5)
      g.lineBetween(5 + ox, -5, 13 + ox, -5)
      g.lineBetween(-4 + ox, 8, 4 + ox, 8)
      return
    }
    // When dashing the body is rotated, so the face points "forward" along it.
    const f = dashing ? 1 : this.facing
    const ox = f * 3
    g.fillStyle(INK)
    if (mood === 'hurt') {
      g.lineStyle(3, INK)
      g.beginPath()
      g.moveTo(-14 + ox, -8)
      g.lineTo(-6 + ox, -4)
      g.lineTo(-14 + ox, 0)
      g.moveTo(14 + ox, -8)
      g.lineTo(6 + ox, -4)
      g.lineTo(14 + ox, 0)
      g.strokePath()
      g.beginPath()
      g.arc(ox, 12, 6, Math.PI * 1.15, Math.PI * 1.85)
      g.strokePath()
      return
    }
    if (mood === 'dash') {
      // Determined: brows down, flat mouth.
      g.fillEllipse(-8 + ox + 4, -2, 7, 6)
      g.fillEllipse(8 + ox + 4, -2, 7, 6)
      g.lineStyle(3, INK)
      g.lineBetween(-14 + ox + 4, -12, -3 + ox + 4, -8)
      g.lineBetween(14 + ox + 4, -12, 3 + ox + 4, -8)
      g.lineBetween(-5 + ox + 4, 9, 5 + ox + 4, 9)
      return
    }
    g.fillEllipse(-9 + ox, -6, 8, 12)
    g.fillEllipse(9 + ox, -6, 8, 12)
    g.fillStyle(0xffffff)
    g.fillCircle(-7.5 + ox, -9, 1.5)
    g.fillCircle(10.5 + ox, -9, 1.5)
    g.lineStyle(3, INK)
    if (mood === 'happy') {
      g.fillStyle(INK)
      g.beginPath()
      g.moveTo(-8 + ox, 6)
      g.arc(ox, 6, 8, 0, Math.PI, false)
      g.closePath()
      g.fillPath()
    } else {
      g.beginPath()
      g.arc(ox, 4, 7, Math.PI * 0.15, Math.PI * 0.85)
      g.strokePath()
    }
  }

  private drawFeet(s: { x: number; bottom: number; dashing: boolean }, running: boolean, alpha: number, dropY = 0) {
    const g = this.feet
    g.clear()
    if (s.dashing || alpha <= 0) return
    g.setAlpha(alpha)
    g.fillStyle(0x2a2a3a)
    g.lineStyle(2, INK)
    for (const [fx, phase] of [[-12, 0], [10, Math.PI]] as const) {
      const lift = running ? Math.max(0, Math.sin(this.step + phase)) * 6 : 0
      const x = s.x + fx
      const y = s.bottom + 2 - lift + dropY
      const f = this.facing
      // An L-shaped boot pointing the way you face.
      const pts = [
        [-7, -10],
        [1, -10],
        [1, 0],
        [13, 0],
        [13, 6],
        [-7, 6],
      ].map(([px, py]) => new Phaser.Math.Vector2(x + px * f, y + py))
      g.fillPoints(pts, true)
      g.strokePoints(pts, true)
    }
  }

  private drawHands(s: { x: number; centreY: number; grounded: boolean; dashing: boolean; dashAngle: number; velX: number; wall?: number }, mood: Mood, alpha: number) {
    const [back, front] = this.facing > 0 ? this.hands : [this.hands[1], this.hands[0]]
    const t = performance.now() / 1000
    for (const h of this.hands) h.setAlpha(alpha)
    if (s.dashing) {
      // Fists out front along the dash.
      const c = Math.cos(s.dashAngle)
      const sn = Math.sin(s.dashAngle)
      const nx = -sn * 10
      const ny = c * 10
      front.setPosition(s.x + c * 44 + nx, s.centreY + sn * 44 + ny)
      back.setPosition(s.x + c * 40 - nx, s.centreY + sn * 40 - ny)
      return
    }
    if (mood === 'hurt' || mood === 'happy') {
      // Arms thrown up.
      back.setPosition(s.x - this.facing * 40, s.centreY - 30)
      front.setPosition(s.x + this.facing * 40, s.centreY - 34)
      return
    }
    if (s.wall) {
      // Wall slide (#82): both hands pressed against the wall.
      const wx = s.x + s.wall * (HALF + 6)
      back.setPosition(wx, s.centreY - 14)
      front.setPosition(wx, s.centreY + 10)
      return
    }
    const bob = s.grounded ? Math.sin(t * 3) * 2 : -10
    const swing = s.grounded && Math.abs(s.velX) > 60 ? Math.sin(this.step) * 7 : 0
    back.setPosition(s.x - this.facing * 36, s.centreY - 4 + bob + swing)
    if (this.gunHand) front.setPosition(this.gunHand.x, this.gunHand.y)
    else front.setPosition(s.x + this.facing * 36, s.centreY - 4 + bob - swing)
  }
}
