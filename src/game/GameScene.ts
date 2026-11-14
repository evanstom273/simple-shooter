import Phaser from 'phaser'
import { touchInput, type Controls } from './controls.ts'
import { sfx } from '../audio/sfx.ts'
import { burst, ring } from './fx.ts'
import { buzz } from './haptics.ts'
import { PLAYER_COLOURS, PlayerView } from './PlayerView.ts'
import { createPracticeTargets } from './PracticeTargets.ts'
import { Shooter } from './Shooter.ts'
import type { Target } from './targets.ts'
import { settingsStore } from '../settings/store.ts'
import { ARENA, DASH, DUMMY, GRAVITY, PLATFORMS, PLAYER, SCREEN, VIEW, WEAPONS } from './tuning.ts'

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
  private keys!: { left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key; jump: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key }

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

  /** Seconds since last on the ground (for coyote time). */
  private sinceGrounded = 0
  /** Seconds left on a remembered jump press (jump buffering). */
  private jumpBuffered = 0
  /** Seconds left falling through platforms after pressing down. */
  private dropTime = 0
  private standingOn: Phaser.GameObjects.Rectangle | null = null
  private lookAhead = 0
  private stepTimer = 0
  private motes: { o: Phaser.GameObjects.Rectangle; vx: number; vy: number; phase: number }[] = []
  private shooter!: Shooter
  /** Zoom that fills the screen (#35); the target zoom-out (#44) scales it down. */
  private baseZoom = 1
  private minZoom = 0.1
  private zoomFactor = 1
  private targets: Target[] = []

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

    this.createMotes()

    const platforms = this.physics.add.staticGroup()
    for (const p of PLATFORMS) {
      const r = this.add.rectangle(p.x, p.y, p.w, p.h, COLOURS.platform).setOrigin(0)
      platforms.add(r)
      r.setData('baseY', p.y)
      if (!p.solid) {
        // One-way: only the top is solid, so you can jump up through from below.
        const pb = r.body as Phaser.Physics.Arcade.StaticBody
        pb.checkCollision.down = false
        pb.checkCollision.left = false
        pb.checkCollision.right = false
        r.setData('oneWay', true)
      }
    }

    // Physics box: invisible. What you see is PlayerView, which squashes and stretches.
    this.darkness = this.createDarkness()

    this.player = this.add.rectangle(ARENA.width / 2, ARENA.height - 120, PLAYER.size, PLAYER.size, 0xffffff).setVisible(false)
    this.view = new PlayerView(this)

    // Desktop dash cooldown: a thin bar under the square, hidden when ready.
    this.cooldownBack = this.add.rectangle(0, 0, PLAYER.size, 6, 0xffffff, 0.12).setOrigin(0, 0.5).setDepth(9)
    this.cooldownBar = this.add.rectangle(0, 0, PLAYER.size, 6, COLOURS.dash, 0.9).setOrigin(0, 0.5).setDepth(9)
    this.physics.add.existing(this.player)

    // Shooting. Bullets pass through platforms; only the floor stops them (#42).
    const floorY = PLATFORMS.find((p) => p.solid)?.y ?? ARENA.height
    // Temporary practice dummies until enemies exist: one floating above some platforms.
    const spots = [1, 3, 5, 7, 9].map((i) => PLATFORMS[i]).filter(Boolean).map((p) => ({ x: p.x + p.w / 2, y: p.y - DUMMY.radius - 70 }))
    this.targets = createPracticeTargets(this, spots)
    this.shooter = new Shooter(this, floorY, () => this.targets)
    this.body_ = this.player.body as Phaser.Physics.Arcade.Body
    this.body_.setCollideWorldBounds(true)
    this.physics.add.collider(
      this.player,
      platforms,
      (_pl, plat) => {
        if (this.body_.touching.down) this.standingOn = plat as Phaser.GameObjects.Rectangle
      },
      // While dropping through, one-way platforms don't collide.
      (_pl, plat) => !(this.dropTime > 0 && (plat as Phaser.GameObjects.Rectangle).getData('oneWay')),
    )

    const kb = this.input.keyboard!
    this.keys = {
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
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
    this.scene.launch('markers')
    this.scene.launch('touch')
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this))
  }

  /**
   * Fill the whole screen, whatever its shape. Zoom is set so the screen would
   * show a 1600×900 area, then pulled out by VIEW.zoom; the camera follows the
   * player around the (bigger) arena.
   */
  private fitCamera() {
    const cam = this.cameras.main
    const { width, height } = this.scale
    cam.setSize(width, height)
    const baseline = Math.max(width / VIEW.baseWidth, height / VIEW.baseHeight)
    // Never so far out that the view is bigger than the arena.
    this.minZoom = Math.max(width / ARENA.width, height / ARENA.height)
    this.baseZoom = Math.max(baseline * VIEW.zoom, this.minZoom)
    cam.setZoom(Math.max(this.baseZoom * this.zoomFactor, this.minZoom))
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
    const down = this.keys.down.isDown || touchInput.stickY > 0.6
    return { moveX, jump, down, dash }
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
    if (!grounded) this.standingOn = null

    if (grounded && !this.wasGrounded && !this.dashing) this.onLand(this.lastVelY)
    if (grounded) this.airJumpsLeft = PLAYER.airJumps
    this.sinceGrounded = grounded ? 0 : this.sinceGrounded + dt
    this.jumpBuffered = c.jump ? PLAYER.jumpBuffer : Math.max(0, this.jumpBuffered - dt)
    this.dropTime = Math.max(0, this.dropTime - dt)

    // Down (or down + jump) on a one-way platform: drop through it.
    if (c.down && grounded && this.standingOn?.getData('oneWay') && !this.dashing) {
      this.dropTime = PLAYER.dropThrough
      this.jumpBuffered = 0
      this.sinceGrounded = PLAYER.coyoteTime // no coyote jump off the platform you just left
      b.setVelocityY(Math.max(b.velocity.y, 120))
      this.view.kick(1.15, 0.85)
    }

    // Skid: turning round at speed on the ground kicks up dust.
    this.skidCooldown = Math.max(0, this.skidCooldown - dt)
    if (grounded && !this.dashing && c.moveX !== 0 && Math.sign(c.moveX) !== Math.sign(b.velocity.x) && Math.abs(b.velocity.x) > PLAYER.runSpeed * 0.6 && this.skidCooldown === 0) {
      this.skidCooldown = 0.25
      burst(this, this.player.x, feetY - 3, { count: 5, colour: COLOURS.dust, angle: b.velocity.x > 0 ? -0.4 : Math.PI + 0.4, spread: 0.3, speed: [120, 260], size: [5, 9], gravity: -60 })
      sfx.skid()
    }

    // Footstep ticks while running on the ground.
    if (grounded && !this.dashing && Math.abs(b.velocity.x) > PLAYER.runSpeed * 0.5) {
      this.stepTimer -= dt
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.26
        sfx.step()
      }
    } else {
      this.stepTimer = 0.1
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

      // Ground jump: on the ground, or just after leaving it (coyote time); a press
      // just before landing also counts (buffer). Otherwise a fresh press in the air double jumps.
      const canGroundJump = grounded || this.sinceGrounded < PLAYER.coyoteTime
      const wantsJump = this.jumpBuffered > 0 && !(c.down && this.dropTime > 0)
      if (wantsJump && (canGroundJump || c.jump)) {
        this.jumpBuffered = 0
        if (canGroundJump) {
          this.sinceGrounded = PLAYER.coyoteTime
          sfx.jump()
          b.setVelocityY(-PLAYER.jumpSpeed)
          this.view.kick(0.72, 1.32)
          burst(this, this.player.x, feetY - 3, { count: 6, colour: COLOURS.dust, angle: -DOWN, spread: 1.2, speed: [60, 160], size: [5, 9], gravity: 200 })
        } else if (this.airJumpsLeft > 0) {
          this.airJumpsLeft--
          sfx.airJump()
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

    this.updateShooting(dt)
    this.updateTargetZoom(dt)
    this.updateLookAhead(dt)
    this.updateDarkness()
    this.updateMotes(dt)
  }

  private updateShooting(dt: number) {
    const cam = this.cameras.main
    const touch = touchInput.controlsShown
    const mouse = this.input.mousePointer
    const mode = settingsStore.aimMode

    let fireHeld = false
    let aimPoint: { x: number; y: number } | null = null
    if (touch) {
      fireHeld = touchInput.fireHeld
      if (fireHeld) aimPoint = cam.getWorldPoint(touchInput.fireX, touchInput.fireY)
    } else if (mouse) {
      fireHeld = mouse.leftButtonDown()
      aimPoint = cam.getWorldPoint(mouse.x, mouse.y)
    }
    const desktopManual = !touch && mode === 'manual'
    this.game.canvas.style.cursor = desktopManual ? 'none' : ''

    const shot = this.shooter.update(dt, {
      x: this.player.x,
      y: this.player.y,
      facing: this.facing,
      dashing: this.dashing,
      mode,
      fireHeld,
      aimPoint,
      pxToWorld: 1 / cam.zoom,
      crosshair: desktopManual && aimPoint ? aimPoint : null,
    })
    if (shot) {
      // Small recoil: mostly sideways; a little lift if firing downwards in the air.
      const b = this.body_
      b.setVelocityX(b.velocity.x - shot.x * WEAPONS.pistol.recoil)
      if (!b.blocked.down) b.setVelocityY(b.velocity.y - shot.y * WEAPONS.pistol.recoil * 0.5)
      this.view.kick(1 - Math.abs(shot.x) * 0.06, 1 - Math.abs(shot.y) * 0.06)
    }
  }

  /** For the marker overlay. */
  get markerInfo() {
    return { targets: this.targets, target: this.shooter.target, player: this.player }
  }

  /**
   * Target off screen (judged at the normal zoom, so it doesn't see-saw):
   * zoom out just enough to bring it in, up to VIEW.targetZoomOut (#44).
   */
  private updateTargetZoom(dt: number) {
    const cam = this.cameras.main
    const t = this.shooter.target
    let want = 1
    if (t) {
      const cx = cam.midPoint.x
      const cy = cam.midPoint.y
      const margin = t.radius + 40
      const halfW = cam.width / this.baseZoom / 2
      const halfH = cam.height / this.baseZoom / 2
      const dx = Math.abs(t.x - cx) + margin
      const dy = Math.abs(t.y - cy) + margin
      if (dx > halfW || dy > halfH) {
        const needed = Math.min(halfW / dx, halfH / dy)
        want = Math.max(1 - VIEW.targetZoomOut, needed)
      }
    }
    const speed = want < this.zoomFactor ? VIEW.zoomOutSpeed : VIEW.zoomInSpeed
    this.zoomFactor += (want - this.zoomFactor) * Math.min(1, dt * speed)
    cam.setZoom(Math.max(this.baseZoom * this.zoomFactor, this.minZoom))
  }

  /** The camera leads a little in the direction you're running. */
  private updateLookAhead(dt: number) {
    const cam = this.cameras.main
    const v = this.body_.velocity.x / PLAYER.runSpeed
    const target = Phaser.Math.Clamp(v, -1, 1) * (cam.width / cam.zoom) * SCREEN.lookAhead
    this.lookAhead += (target - this.lookAhead) * Math.min(1, dt * SCREEN.lookAheadSpeed)
    // followOffset is subtracted from the target, so negative looks ahead to the right.
    cam.setFollowOffset(-this.lookAhead, 0)
  }

  /** Faint specks drifting in the air, under the darkness so they only show near the light. */
  private createMotes() {
    for (let i = 0; i < SCREEN.motes; i++) {
      const s = Phaser.Math.FloatBetween(3, 7)
      const o = this.add
        .rectangle(Phaser.Math.Between(0, ARENA.width), Phaser.Math.Between(0, ARENA.height), s, s, 0xdcdcf0, Phaser.Math.FloatBetween(0.12, 0.35))
        .setDepth(3)
        .setAngle(Phaser.Math.Between(0, 90))
      this.motes.push({ o, vx: Phaser.Math.FloatBetween(-12, 12), vy: Phaser.Math.FloatBetween(-22, -6), phase: Math.random() * Math.PI * 2 })
    }
  }

  private updateMotes(dt: number) {
    const t = this.time.now / 1000
    for (const m of this.motes) {
      m.o.x += (m.vx + Math.sin(t * 0.7 + m.phase) * 10) * dt
      m.o.y += m.vy * dt
      m.o.angle += m.vx * dt
      if (m.o.y < -10) m.o.y = ARENA.height + 10
      if (m.o.x < -10) m.o.x = ARENA.width + 10
      else if (m.o.x > ARENA.width + 10) m.o.x = -10
    }
  }

  /** Landing on a platform: it dips and brightens for a moment (visual only). */
  private platformReact(k: number) {
    const plat = this.standingOn
    if (!plat || plat.getData('busy')) return
    const baseY = plat.getData('baseY') as number
    plat.setData('busy', true)
    const flash = this.add.rectangle(plat.x, baseY, plat.width, plat.height, 0xffffff, 0.12 + 0.18 * k).setOrigin(0).setDepth(1)
    this.tweens.add({ targets: flash, alpha: 0, duration: 260, onComplete: () => flash.destroy() })
    this.tweens.add({
      targets: [plat, flash],
      y: baseY + 2 + 4 * k,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        plat.y = baseY
        plat.setData('busy', false)
      },
    })
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
    sfx.land(k)
    buzz(8 + 22 * k)
    this.platformReact(k)
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
    sfx.dashReady()
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
    sfx.dash()
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
      sfx.dashImpact()
      buzz(35)
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
