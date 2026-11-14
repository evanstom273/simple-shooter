import Phaser from 'phaser'
import { touchInput, type Controls } from './controls.ts'
import { burst, ring } from './fx.ts'
import { PLAYER_COLOURS, PlayerView } from './PlayerView.ts'
import { ARENA, DASH, GRAVITY, PLATFORMS, PLAYER, SCREEN } from './tuning.ts'

const COLOURS = {
  arena: 0x14141c,
  platform: 0x3a3a4a,
  dust: 0xb4b4c6,
  dash: PLAYER_COLOURS.dash,
}

const DOWN = Math.PI / 2

/** Respect the OS "reduce motion" setting: no screen shake. */
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

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

  private view!: PlayerView
  private cooldownBar!: Phaser.GameObjects.Rectangle
  private cooldownBack!: Phaser.GameObjects.Rectangle
  private wasGrounded = true
  /** Vertical speed last frame: the collision has zeroed it by the time we see a landing. */
  private lastVelY = 0
  private skidCooldown = 0
  private darkness!: Phaser.GameObjects.Image

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

    // Physics box: invisible. What you see is PlayerView, which squashes and stretches.
    this.darkness = this.createDarkness()

    this.player = this.add.rectangle(ARENA.width / 2, 780, PLAYER.size, PLAYER.size, 0xffffff).setVisible(false)
    this.view = new PlayerView(this)

    // Desktop dash cooldown: a thin bar under the square, hidden when ready.
    this.cooldownBack = this.add.rectangle(0, 0, PLAYER.size, 6, 0xffffff, 0.12).setOrigin(0, 0.5).setDepth(9)
    this.cooldownBar = this.add.rectangle(0, 0, PLAYER.size, 6, COLOURS.dash, 0.9).setOrigin(0, 0.5).setDepth(9)
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
    cam.startFollow(this.player, false, SCREEN.followLerp, SCREEN.followLerp)
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
    // Same camera smoothing whatever the screen's refresh rate.
    const lerp = 1 - Math.pow(1 - SCREEN.followLerp, dt * 60)
    this.cameras.main.setLerp(lerp, lerp)
    const b = this.body_
    const grounded = b.blocked.down || b.touching.down
    const feetY = b.bottom

    if (grounded && !this.wasGrounded && !this.dashing) this.onLand(this.lastVelY)
    if (grounded) this.airJumpsLeft = PLAYER.airJumps

    // Skid: turning round at speed on the ground kicks up dust.
    this.skidCooldown = Math.max(0, this.skidCooldown - dt)
    if (grounded && !this.dashing && c.moveX !== 0 && Math.sign(c.moveX) !== Math.sign(b.velocity.x) && Math.abs(b.velocity.x) > PLAYER.runSpeed * 0.6 && this.skidCooldown === 0) {
      this.skidCooldown = 0.25
      burst(this, this.player.x, feetY - 3, { count: 5, colour: COLOURS.dust, angle: b.velocity.x > 0 ? -0.4 : Math.PI + 0.4, spread: 0.3, speed: [120, 260], size: [5, 9], gravity: -60 })
    }
    if (c.moveX !== 0) this.facing = Math.sign(c.moveX)

    const wasCooling = this.dashCooldown > 0
    this.dashCooldown = Math.max(0, this.dashCooldown - dt)
    if (wasCooling && this.dashCooldown === 0) this.onDashReady()
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
          this.view.kick(0.72, 1.32)
          burst(this, this.player.x, feetY - 3, { count: 6, colour: COLOURS.dust, angle: -DOWN, spread: 1.2, speed: [60, 160], size: [5, 9], gravity: 200 })
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft--
          b.setVelocityY(-PLAYER.jumpSpeed * PLAYER.airJumpScale)
          this.view.kick(0.8, 1.22)
          ring(this, this.player.x, feetY, PLAYER.size * 1.2, PLAYER.size * 0.35, 0xffffff)
        }
      }
    }

    touchInput.dashReady = 1 - this.dashCooldown / DASH.cooldown

    this.view.update(dt, {
      x: this.player.x,
      bottom: feetY,
      centreY: this.player.y,
      velX: b.velocity.x,
      velY: b.velocity.y,
      grounded,
      dashing: this.dashing,
      dashAngle: this.dashDir.angle(),
    })

    // Cooldown bar (desktop only; touch has the ring on its DASH button).
    const showBar = this.dashCooldown > 0 && !touchInput.controlsShown
    const barY = feetY + 10
    const left = this.player.x - PLAYER.size / 2
    this.cooldownBack.setVisible(showBar).setPosition(left, barY)
    this.cooldownBar.setVisible(showBar).setPosition(left, barY).setScale(touchInput.dashReady, 1)

    this.wasGrounded = grounded
    this.lastVelY = b.velocity.y

    this.updateDarkness()
  }

  /**
   * A big radial gradient: clear in the middle, dark towards the edge, solid
   * dark beyond. Drawn once; scaled and moved with the player each frame.
   */
  private createDarkness() {
    const key = 'darkness'
    if (!this.textures.exists(key)) {
      const size = 512
      const tex = this.textures.createCanvas(key, size, size)!
      const ctx = tex.getContext()
      const c = size / 2
      // The gradient reaches full darkness at half the texture's radius; the rest is solid.
      const g = ctx.createRadialGradient(c, c, 0, c, c, c / 2)
      const { clear, edge } = SCREEN.light
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(clear, 'rgba(0,0,0,0)')
      g.addColorStop(clear + (1 - clear) * 0.5, `rgba(0,0,0,${edge * 0.55})`)
      g.addColorStop(1, `rgba(0,0,0,${edge})`)
      // Canvas gradients carry the last colour on past their radius, so this fills the rest solid.
      ctx.fillStyle = g
      ctx.fillRect(0, 0, size, size)
      tex.refresh()
    }
    // Above the arena and platforms (depth 0), below effects (5+) and the player (10).
    return this.add.image(0, 0, key).setDepth(4)
  }

  private updateDarkness() {
    const cam = this.cameras.main
    // Radius in world units, relative to what's on screen, so it looks the same at any zoom.
    const diag = Math.hypot(cam.width, cam.height) / cam.zoom
    const r = diag * SCREEN.light.radius
    // The texture's gradient ends at half its size, so draw it 4r across.
    this.darkness.setPosition(this.player.x, this.player.y).setDisplaySize(r * 4, r * 4)
  }

  /** Squash and dust, scaled by how hard you hit the ground. */
  private onLand(impactVelY: number) {
    const k = Phaser.Math.Clamp((impactVelY - 200) / 1400, 0, 1)
    if (k <= 0) return
    this.view.kick(1 + 0.4 * k, 1 - 0.4 * k)
    const feetY = this.body_.bottom
    const n = Math.round(3 + 6 * k)
    if (k > 0.35) this.shake(SCREEN.landShake.duration, SCREEN.landShake.intensity * k)
    burst(this, this.player.x - PLAYER.size * 0.3, feetY - 3, { count: n, colour: COLOURS.dust, angle: Math.PI + 0.3, spread: 0.25, speed: [90, 120 + 220 * k], size: [5, 9], gravity: -120 })
    burst(this, this.player.x + PLAYER.size * 0.3, feetY - 3, { count: n, colour: COLOURS.dust, angle: -0.3, spread: 0.25, speed: [90, 120 + 220 * k], size: [5, 9], gravity: -120 })
  }

  private shake(duration: number, intensity: number) {
    if (reduceMotion()) return
    this.cameras.main.shake(duration, intensity, true)
  }

  /** The dash is back: flash and a ring, so you notice without looking for the bar. */
  private onDashReady() {
    this.view.pulse()
    ring(this, this.player.x, this.player.y, PLAYER.size * 1.1, PLAYER.size * 1.1, COLOURS.dash, { grow: 1.7, life: 280, alpha: 0.7 })
  }

  private startDash(dir: { x: number; y: number }) {
    this.dashDir.set(dir.x, dir.y)
    if (this.dashDir.lengthSq() < 1e-6) this.dashDir.set(this.facing, 0)
    this.dashDir.normalize()
    if (Math.abs(this.dashDir.x) > 0.1) this.facing = Math.sign(this.dashDir.x)

    this.dashTime = DASH.duration
    this.dashCooldown = DASH.cooldown
    this.body_.setAllowGravity(false)
    this.trailTimer = 0
    burst(this, this.player.x, this.player.y, {
      count: 10, colour: COLOURS.dash, angle: this.dashDir.angle() + Math.PI, spread: 0.6, speed: [180, 420], size: [5, 10], life: 280,
    })
  }

  private updateDash(dt: number) {
    // Hit something mid-dash: flatten against it and stop the dash.
    const bl = this.body_.blocked
    const hit = (bl.left && this.dashDir.x < -0.3) || (bl.right && this.dashDir.x > 0.3) || (bl.up && this.dashDir.y < -0.3) || (bl.down && this.dashDir.y > 0.3)
    if (hit && this.dashTime < DASH.duration - 0.02) {
      this.endDash(0)
      this.shake(SCREEN.dashImpactShake.duration, SCREEN.dashImpactShake.intensity)
      if (bl.left || bl.right) this.view.kick(0.6, 1.3)
      else this.view.kick(1.4, 0.65)
      const x = bl.left ? this.body_.left : bl.right ? this.body_.right : this.player.x
      const y = bl.up ? this.body_.top : bl.down ? this.body_.bottom : this.player.y
      const away = bl.left ? 0 : bl.right ? Math.PI : bl.up ? DOWN : -DOWN
      burst(this, x, y, { count: 7, colour: COLOURS.dash, angle: away, spread: 1.1, speed: [120, 300], size: [4, 8], life: 260 })
      return
    }

    this.body_.setVelocity(this.dashDir.x * DASH.speed, this.dashDir.y * DASH.speed)

    this.trailTimer -= dt
    if (this.trailTimer <= 0) {
      this.trailTimer = 0.025
      // Afterimage matching the stretched streak.
      const v = this.view.rect
      const ghost = this.add
        .rectangle(this.player.x, this.player.y, PLAYER.size, PLAYER.size, COLOURS.dash, 0.45)
        .setDepth(5)
        .setRotation(this.dashDir.angle())
        .setScale(v.scaleX, v.scaleY)
      this.tweens.add({ targets: ghost, alpha: 0, scaleX: v.scaleX * 0.6, scaleY: v.scaleY * 0.6, duration: 220, onComplete: () => ghost.destroy() })
    }

    this.dashTime -= dt
    if (this.dashTime <= 0) this.endDash(DASH.carry)
  }

  private endDash(carry: number) {
    this.dashTime = 0
    this.body_.setAllowGravity(true)
    this.body_.setVelocity(this.dashDir.x * DASH.speed * carry, this.dashDir.y * DASH.speed * carry)
    // Come out of the streak a little stretched along the way you were going.
    if (Math.abs(this.dashDir.x) > Math.abs(this.dashDir.y)) this.view.kick(1.25, 0.8)
    else this.view.kick(0.8, 1.25)
  }
}
