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
    },
  ) {
    this.vx += ((1 - this.sx) * SPRING - this.vx * DAMPING) * dt
    this.vy += ((1 - this.sy) * SPRING - this.vy * DAMPING) * dt
    this.sx += this.vx * dt
    this.sy += this.vy * dt
    if (Math.abs(s.velX) > 30) this.facing = Math.sign(s.velX)
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
    this.drawFace(mood, s.dashing)
    this.drawFeet(s, running, alpha)
    this.drawHands(s, mood, alpha)
  }

  private drawFace(mood: Mood, dashing: boolean) {
    const g = this.face
    g.clear()
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

  private drawFeet(s: { x: number; bottom: number; dashing: boolean }, running: boolean, alpha: number) {
    const g = this.feet
    g.clear()
    if (s.dashing) return
    g.setAlpha(alpha)
    g.fillStyle(0x2a2a3a)
    g.lineStyle(2, INK)
    for (const [fx, phase] of [[-12, 0], [10, Math.PI]] as const) {
      const lift = running ? Math.max(0, Math.sin(this.step + phase)) * 6 : 0
      const x = s.x + fx
      const y = s.bottom + 2 - lift
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

  private drawHands(s: { x: number; centreY: number; grounded: boolean; dashing: boolean; dashAngle: number; velX: number }, mood: Mood, alpha: number) {
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
    const bob = s.grounded ? Math.sin(t * 3) * 2 : -10
    const swing = s.grounded && Math.abs(s.velX) > 60 ? Math.sin(this.step) * 7 : 0
    back.setPosition(s.x - this.facing * 36, s.centreY - 4 + bob + swing)
    if (this.gunHand) front.setPosition(this.gunHand.x, this.gunHand.y)
    else front.setPosition(s.x + this.facing * 36, s.centreY - 4 + bob - swing)
  }
}
