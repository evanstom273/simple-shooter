import Phaser from 'phaser'
import { PLAYER } from './tuning.ts'

// The player's visible square, separate from its physics body so it can
// squash, stretch and lean without changing collisions.
//
// Scale runs on a damped spring: effects kick it away from 1 and it wobbles
// back, which gives the bounce.
const SPRING = 520
const DAMPING = 22

export const PLAYER_COLOURS = {
  normal: 0xf2f2f2,
  dash: 0x8fd3ff,
}

export class PlayerView {
  readonly rect: Phaser.GameObjects.Rectangle
  private sx = 1
  private sy = 1
  private vx = 0
  private vy = 0
  private lean = 0
  private flash = 0

  constructor(scene: Phaser.Scene) {
    this.rect = scene.add.rectangle(0, 0, PLAYER.size, PLAYER.size, PLAYER_COLOURS.normal).setDepth(10)
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
    // Spring back towards 1.
    this.vx += ((1 - this.sx) * SPRING - this.vx * DAMPING) * dt
    this.vy += ((1 - this.sy) * SPRING - this.vy * DAMPING) * dt
    this.sx += this.vx * dt
    this.sy += this.vy * dt

    const r = this.rect
    if (s.dashing) {
      // Stretched along the dash direction, centred on the body.
      r.setOrigin(0.5, 0.5)
      r.setPosition(s.x, s.centreY)
      r.setRotation(s.dashAngle)
      r.setScale(1.45, 0.7)
      r.setFillStyle(PLAYER_COLOURS.dash)
      return
    }

    // Slight stretch with vertical speed in the air; lean into the run on the ground.
    const airStretch = s.grounded ? 0 : Phaser.Math.Clamp(Math.abs(s.velY) / 4000, 0, 0.12)
    const targetLean = s.grounded ? (s.velX / PLAYER.runSpeed) * 0.07 : (s.velX / PLAYER.runSpeed) * 0.04
    this.lean += (targetLean - this.lean) * Math.min(1, dt * 14)

    // Feet stay planted: scale from the bottom centre.
    r.setOrigin(0.5, 1)
    r.setPosition(s.x, s.bottom)
    r.setRotation(this.lean)
    r.setScale(this.sx * (1 - airStretch * 0.5), this.sy * (1 + airStretch))

    this.flash = Math.max(0, this.flash - dt)
    r.setFillStyle(this.flash > 0 ? 0xffffff : PLAYER_COLOURS.normal)
    r.setStrokeStyle(this.flash > 0 ? 4 : 0, PLAYER_COLOURS.dash, this.flash > 0 ? 0.9 : 0)
  }
}
