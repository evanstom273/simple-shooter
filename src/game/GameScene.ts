import Phaser from 'phaser'
import { touchInput, type Controls } from './controls.ts'
import { ARENA, DASH, GRAVITY, PLATFORMS, PLAYER } from './tuning.ts'

const COLOURS = {
  arena: 0x14141c,
  platform: 0x3a3a4a,
  player: 0xf2f2f2,
  dash: 0x8fd3ff,
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Rectangle
  private body_!: Phaser.Physics.Arcade.Body
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; jump: Phaser.Input.Keyboard.Key }

  private facing = 1
  private airJumpsLeft: number = PLAYER.airJumps
  private mouseDash: { x: number; y: number } | null = null

  /** Seconds left in the current dash (0 = not dashing). */
  private dashTime = 0
  private dashDir = new Phaser.Math.Vector2()
  /** Seconds until the dash can be used again. */
  private dashCooldown = 0
  private trailTimer = 0

  /** True while the player can't be hurt. Enemies will check this (#24, #27). */
  get invulnerable() {
    return this.dashTime > 0
  }
  get dashing() {
    return this.dashTime > 0
  }

  constructor() {
    super('game')
  }

  create() {
    this.physics.world.gravity.y = GRAVITY
    this.physics.world.setBounds(0, 0, ARENA.width, ARENA.height)

    this.add.rectangle(0, 0, ARENA.width, ARENA.height, COLOURS.arena).setOrigin(0)

    const platforms = this.physics.add.staticGroup()
    for (const p of PLATFORMS) {
      const r = this.add.rectangle(p.x, p.y, p.w, p.h, COLOURS.platform).setOrigin(0)
      platforms.add(r)
    }

    this.player = this.add.rectangle(ARENA.width / 2, 780, PLAYER.size, PLAYER.size, COLOURS.player).setDepth(10)
    this.physics.add.existing(this.player)
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body
    this.body_.setCollideWorldBounds(true)
    this.physics.add.collider(this.player, platforms)

    const kb = this.input.keyboard!
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
    }

    // Right-click dashes towards the mouse (#21).
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (p.wasTouch || !p.rightButtonDown()) return
      this.mouseDash = { x: p.worldX - this.player.x, y: p.worldY - this.player.y }
    })

    const cam = this.cameras.main
    cam.setBounds(0, 0, ARENA.width, ARENA.height)
    cam.startFollow(this.player, false, 0.12, 0.12)
    this.fitCamera()
    cam.centerOn(this.player.x, this.player.y)
    this.scene.launch('touch')
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this))
  }

  /**
   * Fill the whole screen, whatever its shape: zoom until the arena covers it,
   * then follow the player within the arena. On screens close to 16:9 you see
   * (nearly) all of it; on narrow or very wide screens you see a zoomed-in slice.
   */
  private fitCamera() {
    const cam = this.cameras.main
    const { width, height } = this.scale
    cam.setSize(width, height)
    cam.setZoom(Math.max(width / ARENA.width, height / ARENA.height))
  }

  private readControls(): Controls {
    let moveX = (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0)
    if (moveX === 0) moveX = touchInput.moveX
    const jump = Phaser.Input.Keyboard.JustDown(this.keys.jump) || touchInput.jumpQueued
    touchInput.jumpQueued = false

    let dash = this.mouseDash
    this.mouseDash = null
    if (touchInput.dashQueued) {
      // Touch: dash the way the joystick points; with the stick idle, the way you're facing.
      dash = Math.hypot(touchInput.stickX, touchInput.stickY) > 0.3 ? { x: touchInput.stickX, y: touchInput.stickY } : { x: 0, y: 0 }
      touchInput.dashQueued = false
    }
    return { moveX, jump, dash }
  }

  update(_time: number, deltaMs: number) {
    const c = this.readControls()
    const dt = deltaMs / 1000
    const b = this.body_
    const grounded = b.blocked.down || b.touching.down

    if (grounded) this.airJumpsLeft = PLAYER.airJumps
    if (c.moveX !== 0) this.facing = Math.sign(c.moveX)

    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    if (c.dash && this.dashCooldown === 0 && !this.dashing) this.startDash(c.dash)

    if (this.dashing) {
      this.updateDash(dt)
    } else {
      const target = c.moveX * PLAYER.runSpeed
      const t = Math.min(1, dt * PLAYER.responsiveness)
      b.setVelocityX(b.velocity.x + (target - b.velocity.x) * t)

      if (c.jump) {
        if (grounded) {
          b.setVelocityY(-PLAYER.jumpSpeed)
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft--
          b.setVelocityY(-PLAYER.jumpSpeed * PLAYER.airJumpScale)
          this.airJumpPuff()
        }
      }
    }

    touchInput.dashReady = 1 - this.dashCooldown / DASH.cooldown
  }

  private startDash(dir: { x: number; y: number }) {
    this.dashDir.set(dir.x, dir.y)
    if (this.dashDir.lengthSq() < 1e-6) this.dashDir.set(this.facing, 0)
    this.dashDir.normalize()
    if (Math.abs(this.dashDir.x) > 0.1) this.facing = Math.sign(this.dashDir.x)

    this.dashTime = DASH.duration
    this.dashCooldown = DASH.cooldown
    this.body_.setAllowGravity(false)
    this.player.setFillStyle(COLOURS.dash)
    this.trailTimer = 0
  }

  private updateDash(dt: number) {
    this.body_.setVelocity(this.dashDir.x * DASH.speed, this.dashDir.y * DASH.speed)

    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.025
      const ghost = this.add.rectangle(this.player.x, this.player.y, PLAYER.size, PLAYER.size, COLOURS.dash, 0.45).setDepth(5)
      this.tweens.add({ targets: ghost, alpha: 0, scale: 0.6, duration: 220, onComplete: () => ghost.destroy() })
    }

    this.dashTime -= dt
    if (this.dashTime <= 0) {
      this.dashTime = 0
      this.body_.setAllowGravity(true)
      this.body_.setVelocity(this.dashDir.x * DASH.speed * DASH.carry, this.dashDir.y * DASH.speed * DASH.carry)
      this.player.setFillStyle(COLOURS.player)
    }
  }

  private airJumpPuff() {
    const y = this.player.y + PLAYER.size / 2
    const ring = this.add.ellipse(this.player.x, y, PLAYER.size * 1.2, PLAYER.size * 0.35).setStrokeStyle(3, 0xffffff, 0.6).setDepth(5)
    this.tweens.add({ targets: ring, alpha: 0, scaleX: 1.8, scaleY: 1.4, duration: 260, onComplete: () => ring.destroy() })
  }
}
