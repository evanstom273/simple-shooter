import Phaser from 'phaser'
import { touchInput } from './controls.ts'

// On-screen controls for touch devices, drawn over the game at screen scale.
// Left part of the screen: a floating joystick (appears where your thumb lands).
// Bottom-right: jump button, with the dash button beside it.
const JOYSTICK_ZONE = 0.45 // fraction of screen width, from the left
const DEADZONE = 0.2

export class TouchControlsScene extends Phaser.Scene {
  private dpr = 1
  private base!: Phaser.GameObjects.Arc
  private knob!: Phaser.GameObjects.Arc
  private jumpBtn!: Phaser.GameObjects.Arc
  private jumpLabel!: Phaser.GameObjects.Text
  private dashBtn!: Phaser.GameObjects.Arc
  private dashLabel!: Phaser.GameObjects.Text
  private dashRing!: Phaser.GameObjects.Graphics
  private dashPointer: number | null = null
  private stickPointer: number | null = null
  private jumpPointer: number | null = null
  private home = new Phaser.Math.Vector2()
  private origin = new Phaser.Math.Vector2()

  constructor() {
    super('touch')
  }

  create() {
    this.dpr = this.registry.get('dpr') ?? 1
    this.input.addPointer(3)

    this.base = this.add.circle(0, 0, 1, 0xffffff, 0.08).setStrokeStyle(2 * this.dpr, 0xffffff, 0.25)
    this.knob = this.add.circle(0, 0, 1, 0xffffff, 0.35)
    this.jumpBtn = this.add.circle(0, 0, 1, 0xffffff, 0.12).setStrokeStyle(2 * this.dpr, 0xffffff, 0.35)
    this.jumpLabel = this.add
      .text(0, 0, 'JUMP', { fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0.6)
    this.dashBtn = this.add.circle(0, 0, 1, 0x8fd3ff, 0.12).setStrokeStyle(2 * this.dpr, 0x8fd3ff, 0.35)
    this.dashRing = this.add.graphics()
    this.dashLabel = this.add
      .text(0, 0, 'DASH', { fontFamily: 'system-ui, sans-serif', fontStyle: 'bold', color: '#8fd3ff' })
      .setOrigin(0.5)
      .setAlpha(0.7)

    this.layout()
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this))

    const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false
    this.setShown(coarse)

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this)
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this)
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this)
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onUp, this)
  }

  /** Size things in CSS pixels × dpr so they're the same physical size on every screen. */
  private get unit() {
    // Scale down a little on small screens, never above 1.
    const cssShort = Math.min(this.scale.width, this.scale.height) / this.dpr
    return this.dpr * Math.min(1, cssShort / 400)
  }

  private get stickRadius() {
    return 60 * this.unit
  }

  private layout() {
    const { width, height } = this.scale
    const u = this.unit
    const r = this.stickRadius
    const margin = 32 * u
    this.home.set(margin + r, height - margin - r)
    this.base.setRadius(r)
    this.knob.setRadius(r * 0.45)
    if (this.stickPointer === null) this.placeStick(this.home.x, this.home.y)

    const jr = 46 * u
    this.jumpBtn.setRadius(jr).setPosition(width - margin - jr, height - margin - jr)
    this.jumpLabel.setPosition(this.jumpBtn.x, this.jumpBtn.y).setFontSize(Math.round(16 * u))

    const dr = 38 * u
    this.dashBtn.setRadius(dr).setPosition(this.jumpBtn.x - jr - 22 * u - dr, this.jumpBtn.y - jr * 0.9)
    this.dashLabel.setPosition(this.dashBtn.x, this.dashBtn.y).setFontSize(Math.round(14 * u))
  }

  private placeStick(x: number, y: number) {
    this.origin.set(x, y)
    this.base.setPosition(x, y)
    this.knob.setPosition(x, y)
  }

  private setShown(shown: boolean) {
    for (const o of [this.base, this.knob, this.jumpBtn, this.jumpLabel, this.dashBtn, this.dashLabel, this.dashRing]) o.setVisible(shown)
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (p.wasTouch) this.setShown(true)
    if (!this.base.visible) return

    const jumpHit = Phaser.Math.Distance.Between(p.x, p.y, this.jumpBtn.x, this.jumpBtn.y) <= this.jumpBtn.radius * 1.25
    if (jumpHit && this.jumpPointer === null) {
      this.jumpPointer = p.id
      touchInput.jumpQueued = true
      this.jumpBtn.setFillStyle(0xffffff, 0.3)
      return
    }
    const dashHit = Phaser.Math.Distance.Between(p.x, p.y, this.dashBtn.x, this.dashBtn.y) <= this.dashBtn.radius * 1.25
    if (dashHit && this.dashPointer === null) {
      this.dashPointer = p.id
      touchInput.dashQueued = true
      return
    }
    if (p.x < this.scale.width * JOYSTICK_ZONE && this.stickPointer === null) {
      this.stickPointer = p.id
      this.placeStick(p.x, p.y)
      this.base.setAlpha(1.6)
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.stickPointer) return
    const r = this.stickRadius
    const dx = Phaser.Math.Clamp(p.x - this.origin.x, -r, r)
    const dy = p.y - this.origin.y
    const len = Math.hypot(dx, dy)
    const k = len > r ? r / len : 1
    this.knob.setPosition(this.origin.x + dx * k, this.origin.y + dy * k)
    const x = dx / r
    touchInput.moveX = Math.abs(x) < DEADZONE ? 0 : x
    touchInput.stickX = (dx * k) / r
    touchInput.stickY = (dy * k) / r
  }

  private onUp(p: Phaser.Input.Pointer) {
    if (p.id === this.stickPointer) {
      this.stickPointer = null
      touchInput.moveX = 0
      touchInput.stickX = 0
      touchInput.stickY = 0
      this.placeStick(this.home.x, this.home.y)
      this.base.setAlpha(1)
    }
    if (p.id === this.dashPointer) this.dashPointer = null
    if (p.id === this.jumpPointer) {
      this.jumpPointer = null
      this.jumpBtn.setFillStyle(0xffffff, 0.12)
    }
  }

  update() {
    if (!this.dashBtn.visible) return
    // Cooldown: the ring fills back up; the button lights up when ready.
    const ready = touchInput.dashReady
    this.dashBtn.setFillStyle(0x8fd3ff, ready >= 1 ? (this.dashPointer !== null ? 0.35 : 0.18) : 0.05)
    this.dashLabel.setAlpha(ready >= 1 ? 0.8 : 0.3)
    this.dashRing.clear()
    if (ready < 1) {
      this.dashRing.lineStyle(3 * this.dpr, 0x8fd3ff, 0.8)
      this.dashRing.beginPath()
      this.dashRing.arc(this.dashBtn.x, this.dashBtn.y, this.dashBtn.radius, -Math.PI / 2, -Math.PI / 2 + ready * Math.PI * 2)
      this.dashRing.strokePath()
    }
  }
}
